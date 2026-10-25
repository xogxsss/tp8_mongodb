# Modelo documental de FoodStore

## Colecciones

### `pedidos`

Cada documento contiene un pedido y sus detalles embebidos.

```javascript
{
  _id: Long,
  fecha_hora: Date,
  estado: String,
  forma_pago: String,
  id_cliente: Long,
  detalles: [
    {
      id_producto: Long,
      cantidad: Int32,
      precio_unitario_historico: Decimal128
    }
  ]
}
```

### `clientes`

```javascript
{
  _id: Long,
  nombre: String,
  email: String,
  telefono: String, // opcional
  direccion: String
}
```

### `productos`

```javascript
{
  _id: Long,
  nombre: String,
  descripcion: String, // opcional
  precio_lista: Decimal128,
  stock: Int32,
  activo: Boolean,
  id_categoria: Long
}
```

## Relaciones y validaciones

- Un cliente puede tener varios pedidos; `id_cliente` referencia `clientes._id`.
- Los detalles pertenecen a un pedido y se guardan en `pedidos.detalles`. Cada uno referencia un producto por `id_producto`.
- El precio histórico conserva el importe al momento de la compra, aunque luego cambie el precio del producto.
- `cantidad` debe ser mayor que cero. Los precios y el stock no pueden ser negativos; `stock` es entero.
- `email` de cliente y `nombre` de producto son únicos. Estos índices se crean por separado de los validadores JSON Schema.
- `telefono` y `descripcion` son opcionales y admiten `null`.
- IDs de PostgreSQL (`bigint`) se migran como BSON `Long`; los precios, como `Decimal128`.
- La migración es parcial: toma hasta 10 clientes y productos iniciales por ID y hasta 10 pedidos con líneas que referencien esos clientes y productos. Incluye las líneas coincidentes y exige al menos cinco pedidos con detalles.
- PostgreSQL no tiene campo `estado`; para esta entrega se agrega en MongoDB con los valores `pendiente`, `confirmado`, `enviado`, `entregado` o `cancelado`. La migración asigna `entregado` a los pedidos de la muestra.
- El cliente se conserva en `clientes` y el pedido lo referencia con `id_cliente`.

Los validadores JSON de las colecciones están en `schema/`. Las referencias entre colecciones y los productos repetidos dentro de los detalles requieren comprobaciones adicionales en la aplicación. `forma_pago` es texto; para restringirlo a los valores del enum de PostgreSQL, primero hay que consultar sus etiquetas. La regla del trigger de fecha también requiere revisar su función en PostgreSQL.

## Integridad y datos embebidos

1. **Referencia del pedido al cliente:** cada `pedidos.id_cliente` migrado debe corresponder a un documento existente en `clientes`.
2. **Validez del detalle:** cada detalle incluido debe referenciar un producto existente; además, `cantidad` debe ser mayor que cero y `precio_unitario_historico` no puede ser negativo.

Los detalles se almacenan dentro de `pedidos` porque son líneas que pertenecen a un pedido y normalmente se consultan junto con él. Embebidos, forman una unidad documental y conservan el precio histórico de cada producto sin depender del precio actual. En la migración parcial solo se incluyen detalles cuyos pedidos y productos están dentro de la muestra seleccionada.
