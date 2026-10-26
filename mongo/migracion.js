const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Pool } = require('pg');

const projectRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

const { Long, Decimal128 } = mongoose.mongo.BSON;
const schemaDir = path.join(projectRoot, 'schema');
const LIMIT = 10;
const MIN_ORDERS_WITH_DETAILS = 5;

// Helper genérico para castear tipos BSON
const toLong = (v) => Long.fromString(String(v));
const toDecimal = (v) => Decimal128.fromString(String(v));

const loadSchema = (file) => JSON.parse(fs.readFileSync(path.join(schemaDir, file), 'utf8'));

async function ensureCollection(db, name, schema) {
    const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
    const options = { validator: schema, validationLevel: 'strict', validationAction: 'error' };
    if (exists) {
        await db.command({ collMod: name, ...options });
    } else {
        await db.createCollection(name, options);
    }
}

async function migrate() {
    if (!process.env.MONGO_URI) throw new Error('Falta MONGO_URI en .env');

    const pool = new Pool({
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        database: process.env.PGDATABASE || 'foodstore_dev',
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD
    });

    try {
        // 1. Consultas a PostgreSQL
        const { rows: customerRows } = await pool.query(
            'SELECT id_cliente::text, nombre, email, telefono, direccion FROM cliente ORDER BY id_cliente LIMIT $1',
            [LIMIT]
        );

        const { rows: productRows } = await pool.query(
            'SELECT id_producto::text, nombre, descripcion, precio_lista::text, stock, activo, id_categoria::text FROM producto ORDER BY id_producto LIMIT $1',
            [LIMIT]
        );

        const customerIds = customerRows.map((r) => r.id_cliente);
        const productIds = productRows.map((r) => r.id_producto);

        const { rows: orderRows } = await pool.query(
            `SELECT p.id_pedido::text, p.fecha_hora, p.forma_pago::text,
                    p.id_cliente::text
                FROM pedido p
                WHERE p.id_cliente = ANY($1::bigint[])
                AND EXISTS (
                    SELECT 1
                    FROM detalle_pedido d
                    WHERE d.id_pedido = p.id_pedido
                        AND d.id_producto = ANY($2::bigint[])
                )
                ORDER BY p.id_pedido
                LIMIT $3`,
            [customerIds, productIds, LIMIT]
        );

        if (orderRows.length < MIN_ORDERS_WITH_DETAILS) {
            throw new Error(
                `La muestra solo contiene ${orderRows.length} pedidos con líneas; ` +
                `se requieren al menos ${MIN_ORDERS_WITH_DETAILS}.`
            );
        }

        const orderIds = orderRows.map((r) => r.id_pedido);

        const { rows: detailRows } = await pool.query(
            `SELECT id_pedido::text, id_producto::text, cantidad,
                    precio_unitario_historico::text
                FROM detalle_pedido
                WHERE id_pedido = ANY($1::bigint[])
                AND id_producto = ANY($2::bigint[])
                ORDER BY id_pedido, id_producto`,
            [orderIds, productIds]
        );

        // 2. Agrupar detalles por pedido
        const detailsByOrder = detailRows.reduce((acc, r) => {
            if (!acc[r.id_pedido]) acc[r.id_pedido] = [];
            acc[r.id_pedido].push({
                id_producto: toLong(r.id_producto),
                cantidad: r.cantidad,
                precio_unitario_historico: toDecimal(r.precio_unitario_historico)
            });
            return acc;
        }, {});

        // 3. Transformación de Documentos
        const collections = {
            clientes: {
                schema: 'cliente_schema.json',
                indexes: [{ key: { email: 1 }, options: { unique: true } }],
                docs: customerRows.map((r) => ({
                    _id: toLong(r.id_cliente),
                    nombre: r.nombre,
                    email: r.email,
                    telefono: r.telefono,
                    direccion: r.direccion
                }))
            },
            productos: {
                schema: 'producto_schema.json',
                indexes: [{ key: { nombre: 1 }, options: { unique: true } }],
                docs: productRows.map((r) => ({
                    _id: toLong(r.id_producto),
                    nombre: r.nombre,
                    descripcion: r.descripcion,
                    precio_lista: toDecimal(r.precio_lista),
                    stock: r.stock,
                    activo: r.activo,
                    id_categoria: toLong(r.id_categoria)
                }))
            },
            pedidos: {
                schema: 'pedido_schema.json',
                indexes: [],
                docs: orderRows.map((r) => ({
                    _id: toLong(r.id_pedido),
                    fecha_hora: r.fecha_hora,
                    estado: 'entregado',
                    forma_pago: r.forma_pago,
                    id_cliente: toLong(r.id_cliente),
                    detalles: detailsByOrder[r.id_pedido] || []
                }))
            }
        };

        // 4. Conexión y Migración en MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        const db = mongoose.connection.db;

        for (const [colName, config] of Object.entries(collections)) {
            await ensureCollection(db, colName, loadSchema(config.schema));

            for (const idx of config.indexes) {
                await db.collection(colName).createIndex(idx.key, idx.options);
            }

            if (config.docs.length > 0) {
                const bulkOps = config.docs.map((doc) => ({
                    replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true }
                }));
                await db.collection(colName).bulkWrite(bulkOps, { ordered: true });
            }

            console.log(`${colName}: ${config.docs.length} documentos migrados.`);
        }

        console.log('Migración completada. No se eliminaron documentos existentes.');
    } finally {
        await pool.end();
        await mongoose.disconnect();
    }
}

migrate().catch((err) => {
    console.error('Falló la migración:', err.message);
    process.exitCode = 1;
});