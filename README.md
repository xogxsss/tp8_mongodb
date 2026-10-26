# FoodStore: PostgreSQL a MongoDB

Trabajo Práctico N.º 8 de Bases de Datos II. Migra clientes, productos y pedidos; los detalles se embeben en cada pedido.

## Estructura

```text
TP8/
├── data/
│   └── datos_migrados.json
├── docs/
│   └── modelo.md
├── mongo/
│   ├── consultas_mongodb.js
│   └── migracion.js
├── postgresql/
│   └── consultas_postgresql.sql
└── schema/
    ├── cliente_schema.json
    ├── pedido_schema.json
    └── producto_schema.json
```

## Preparación

Se requiere acceso a PostgreSQL y MongoDB. En Windows, si vas a usar MongoDB local y aún no está instalado, podés instalar MongoDB Community Server:

```powershell
winget install --id MongoDB.Server --exact
```

Comprobá que el servicio esté iniciado:

```powershell
Get-Service MongoDB
```

Si está detenido, abrí PowerShell como administrador e iniciá el servicio:

```powershell
Start-Service MongoDB
```

Configurá las conexiones en `.env` tomando como referencia `.env.example`. La URI de ejemplo usa la base `foodstore_nosql`. La migración crea las colecciones `clientes`, `productos` y `pedidos`; las líneas de detalle quedan embebidas en cada pedido. No compartas ni subas `.env`.

## Migración

Desde la carpeta del proyecto, ejecutá:

```bash
npm install
npm run migrate
```

El proceso migra como máximo los primeros 10 clientes y productos por ID y hasta 10 pedidos de esos clientes que tengan líneas asociadas a los productos de la muestra. Incluye sus líneas coincidentes y verifica que migre al menos cinco pedidos con detalles. Cada pedido conserva `id_cliente`; los datos del cliente están en `clientes`. PostgreSQL no tiene un campo `estado`; para esta entrega se agrega en MongoDB con el estado inicial `entregado`. El modelo y sus decisiones están documentados en `docs/modelo.md`.

Para MongoDB local, verificá que el puerto esté disponible antes de migrar:

```powershell
Test-NetConnection 127.0.0.1 -Port 27017
```

Para guardar en `logs/estructura_postgresql.txt` la descripción de las tablas de origen:

```powershell
$env:PGCLIENTENCODING = "WIN1252"
psql -h localhost -U admin_datos -d foodstore_dev -o logs\estructura_postgresql.tmp -c "\d cliente" -c "\d producto" -c "\d pedido" -c "\d detalle_pedido"
if ($LASTEXITCODE -eq 0) {
    $texto = [System.IO.File]::ReadAllText("logs\estructura_postgresql.tmp", [System.Text.Encoding]::GetEncoding(1252))
    [System.IO.File]::WriteAllText("logs\estructura_postgresql.txt", $texto, [System.Text.UTF8Encoding]::new($false))
    Remove-Item logs\estructura_postgresql.tmp
}
Remove-Item Env:PGCLIENTENCODING
```

## Consultas

Con MongoDB iniciado y la conexión configurada, ejecutá las cuatro consultas:

```bash
npm run queries:mongo
```

Este comando se conecta con la configuración de `.env`; no requiere `mongosh`. Para usar la consola interactiva, instalá MongoDB Shell por separado y conectate con `mongosh "mongodb://127.0.0.1:27017/foodstore_nosql"`. El total del pedido se calcula sumando cantidad por precio histórico de cada detalle y se compara con el promedio de la muestra migrada.

Las consultas para PostgreSQL están en `postgresql/consultas_postgresql.sql`.
