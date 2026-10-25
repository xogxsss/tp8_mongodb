# Modelo documental de FoodStore

## Colecciones

### `pedidos`

Cada documento representa un pedido. Sus datos principales quedan en el documento y sus líneas de detalle se guardan embebidas en el arreglo `detalles`.

```javascript
{
  _id: Int32 | Long, // id_pedido de PostgreSQL
  fecha_hora: Date,
  forma_pago: String,
  id_cliente: Int32 | Long, // referencia a clientes._id
  detalles: [
    {
      id_producto: Int32 | Long, // referencia a productos._id
      cantidad: Int32,
      precio_unitario_historico: Decimal128
    }
  ]
}
```

`cantidad` debe ser un entero mayor que cero. `precio_unitario_historico` debe ser igual o mayor que cero y conserva el precio aplicado cuando se realizó la compra, independientemente de cambios posteriores en el precio del producto.

### `clientes`

Cada documento representa un cliente. Los pedidos lo referencian mediante `id_cliente`.

```javascript
{
  _id: Int32 | Long, // id_cliente de PostgreSQL
  nombre: String,
  email: String,
  telefono: String, // opcional
  direccion: String
}
```

`email` debe ser único. `contrasena_hash` no se incluye en este modelo de pedidos: no es necesaria para representar la compra.

### `productos`

Cada documento representa un producto. Los detalles del pedido lo referencian mediante `id_producto`.

```javascript
{
  _id: Int32 | Long, // id_producto de PostgreSQL
  nombre: String,
  descripcion: String, // opcional
  precio_lista: Decimal128,
  stock: Int32,
  activo: Boolean,
  id_categoria: Int32 | Long // referencia a categorias._id
}
```

`nombre` debe ser único; `precio_lista` y `stock` deben ser iguales o mayores que cero. `stock` debe ser un entero. `id_categoria` conserva la referencia de PostgreSQL; si la categoría también se migra, puede apuntar a un documento de una colección `categorias`.

## Relaciones y decisión de diseño

```text
clientes 1 ─── N pedidos 1 ─── N detalles (embebidos)
productos 1 ─── N detalles (referenciados desde cada detalle)
```

- `pedido` y `cliente` se conservan en colecciones separadas, ya que un cliente puede tener varios pedidos.
- `detalle_pedido` no tiene colección propia: sus datos se embeben en `pedidos.detalles`, porque pertenecen al pedido y suelen consultarse con él.
- `producto` se conserva en su propia colección y se referencia desde cada detalle. El precio histórico se almacena en el detalle para preservar el valor de la compra.

## Reglas de validación

La tabla resume las restricciones conocidas del esquema PostgreSQL y su aplicación propuesta en MongoDB. Las reglas de formato y rango pueden expresarse con un validador `$jsonSchema`; las referencias, las reglas que abarcan varios elementos y las reglas de negocio requieren validación adicional en la aplicación.

| Colección / campo | Regla | Aplicación propuesta en MongoDB |
|---|---|---|
| `pedidos._id` | Obligatorio e identifica el pedido. | Usar el ID migrado como `_id`; MongoDB garantiza su unicidad. |
| `pedidos.fecha_hora` | Obligatorio; PostgreSQL asigna `now()` por defecto. | Requerir tipo BSON `date` y asignar la fecha al crear el pedido. |
| `pedidos.forma_pago` | Obligatorio; debe pertenecer al enum `forma_pago_enum`. | Requerir `string` y restringir con `enum` a los valores reales del tipo PostgreSQL. Hay que consultar sus etiquetas para enumerarlas; no están incluidas en la descripción recibida. |
| `pedidos.id_cliente` | Obligatorio y referencia a un cliente existente. | Requerir el tipo de ID elegido y comprobar en la aplicación que exista el documento en `clientes`; `$jsonSchema` no valida referencias entre colecciones. |
| `pedidos.detalles` | Arreglo embebido que representa las filas de `detalle_pedido`. | Requerir un arreglo de objetos con la forma descrita abajo. PostgreSQL no indica que un pedido deba tener al menos un detalle, por lo que no se impone `minItems` aquí. |
| `detalles.id_producto` | Obligatorio y referencia a un producto existente. La clave primaria original no permite repetir un producto dentro del mismo pedido. | Requerir el ID y comprobar en la aplicación que el producto exista y que no haya `id_producto` duplicados dentro de `detalles`. |
| `detalles.cantidad` | Obligatoria; entero mayor que cero (`CHECK cantidad > 0`). | BSON `int` (o un tipo entero compatible) y mínimo `1`. |
| `detalles.precio_unitario_historico` | Obligatorio; `numeric(10,2)` y valor igual o mayor que cero (`CHECK precio >= 0`). | BSON `decimal` (`Decimal128`), entre `0` y `99999999.99`, en múltiplos de `0.01`. |
| `clientes._id` | Obligatorio e identifica al cliente. | Usar el ID migrado como `_id`; MongoDB garantiza su unicidad. |
| `clientes.nombre` | Obligatorio; máximo 100 caracteres. | Requerir `string` con longitud entre 0 y 100. |
| `clientes.email` | Obligatorio; máximo 255 caracteres y único. | Requerir `string` con longitud entre 0 y 255 y crear un índice único. Si la colección ya contiene datos, resolver duplicados antes de crear el índice. |
| `clientes.telefono` | Nullable; si se proporciona, máximo 20 caracteres. | Permitir que falte o sea `null`; si es string, limitar a 20 caracteres. |
| `clientes.direccion` | Obligatoria; máximo 200 caracteres. | Requerir `string` con longitud entre 0 y 200. |
| `productos._id` | Obligatorio e identifica al producto. | Usar el ID migrado como `_id`; MongoDB garantiza su unicidad. |
| `productos.nombre` | Obligatorio; máximo 100 caracteres y único. | Requerir `string` con longitud entre 0 y 100 y crear un índice único. |
| `productos.descripcion` | Nullable (`text`). | Permitir que falte o sea `null`; si es string, validar como texto. |
| `productos.precio_lista` | Obligatorio; `numeric(10,2)` y valor igual o mayor que cero. | BSON `decimal` (`Decimal128`), entre `0` y `99999999.99`, en múltiplos de `0.01`. |
| `productos.stock` | Obligatorio; entero igual o mayor que cero; default `0`. | Requerir un tipo BSON entero y mínimo `0`; asignar `0` al crear si no se especifica. |
| `productos.activo` | Obligatorio; default `true`. | Requerir `bool`; asignar `true` al crear si no se especifica. |
| `productos.id_categoria` | Obligatorio y referencia a una categoría existente. | Requerir el ID y comprobar en la aplicación que exista en `categorias`, si esa colección se migra. |

El esquema informado también tiene un trigger `trg_validar_fecha_pedido` que ejecuta `fn_validar_fecha_pedido`. Como no se conoce el cuerpo de esa función, no se debe asumir qué fechas acepta: hay que inspeccionarla en PostgreSQL y trasladar su regla a la aplicación antes de afirmar que la validación quedó replicada.

Las restricciones `NOT NULL` se representan requiriendo los campos. Los campos nullable `clientes.telefono` y `productos.descripcion` pueden omitirse o almacenar `null`, según lo indicado en sus esquemas. Los índices únicos de `clientes.email` y `productos.nombre` deben crearse aparte del validador documental.

## Tipos e identificadores

Los archivos `*_schema.json` contienen validadores MongoDB `$jsonSchema` en JSON válido y se pueden pasar como valor de `validator` al crear una colección. Los índices únicos de `clientes.email` y `productos.nombre` deben crearse por separado. Las referencias entre colecciones, la unicidad de `id_producto` dentro de `detalles`, los valores reales del enum `forma_pago_enum` y la regla del trigger de fecha requieren validación adicional fuera de estos esquemas.

Los precios se representan como BSON `Decimal128` para conservar precisión decimal. Los identificadores de PostgreSQL son `bigint`; los esquemas aceptan BSON `int` o `long`, pero para preservar todo el rango de `bigint` conviene migrarlos como `Long` y mantener el mismo tipo en todas sus referencias. La migración debe convertir explícitamente esos valores al tipo BSON elegido.