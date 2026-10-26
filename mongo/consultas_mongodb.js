const path = require('node:path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const { Decimal128 } = mongoose.mongo.BSON;

async function ejecutarConsultas() {
    if (!process.env.MONGO_URI) {
        throw new Error('Falta configurar MONGO_URI en el archivo .env.');
    }

    try {
        await mongoose.connect(process.env.MONGO_URI);
        const pedidos = mongoose.connection.db.collection('pedidos');

        // a) Mostrar el identificador y el estado de todos los pedidos.
        console.log('\na) Identificador y estado de todos los pedidos');
        const todosLosPedidos = await pedidos
            .find(
                { estado: { $type: 'string' } },
                { projection: { _id: 1, estado: 1 } }
            )
            .toArray();
        console.dir(todosLosPedidos, { depth: null });

        // b) Filtrar pedidos por un estado presente en los datos migrados.
        console.log('\nb) Pedidos filtrados por un estado migrado');
        const estados = await pedidos.distinct('estado', {
            estado: { $type: 'string' }
        });
        if (estados.length === 0) {
            console.log('No hay pedidos migrados para consultar.');
        } else {
            const estadoElegido = estados[0];
            console.log(`Estado elegido: ${estadoElegido}`);
            const pedidosFiltrados = await pedidos
                .find(
                    { estado: estadoElegido },
                    { projection: { _id: 1, estado: 1 } }
                )
                .toArray();
            console.dir(pedidosFiltrados, { depth: null });
        }

        // c) Buscar pedidos que incluyan un producto existente en sus detalles.
        console.log('\nc) Pedidos que contienen un producto migrado');
        const [productoEncontrado] = await pedidos.aggregate([
            { $unwind: '$detalles' },
            { $group: { _id: '$detalles.id_producto' } },
            { $limit: 1 }
        ]).toArray();

        if (!productoEncontrado) {
            console.log('No hay detalles de pedido migrados para consultar.');
        } else {
            console.log(`Producto elegido (_id): ${productoEncontrado._id}`);
            const pedidosConProducto = await pedidos
                .find(
                    {
                        estado: { $type: 'string' },
                        detalles: {
                            $elemMatch: { id_producto: productoEncontrado._id }
                        }
                    },
                    { projection: { _id: 1, detalles: 1 } }
                )
                .toArray();
            console.dir(pedidosConProducto, { depth: null });
        }

        // d) Calcular el total de cada pedido y filtrar los que superan el promedio.
        const calcularTotal = {
            $set: {
                total: {
                    $reduce: {
                        input: { $ifNull: ['$detalles', []] },
                        initialValue: Decimal128.fromString('0'),
                        in: {
                            $add: [
                                '$$value',
                                {
                                    $multiply: [
                                        '$$this.cantidad',
                                        '$$this.precio_unitario_historico'
                                    ]
                                }
                            ]
                        }
                    }
                }
            }
        };

        console.log('\nd) Pedidos cuyo total supera el promedio de la muestra');
        const [promedio] = await pedidos.aggregate([
            { $match: { estado: { $type: 'string' } } },
            calcularTotal,
            { $group: { _id: null, importe: { $avg: '$total' } } }
        ]).toArray();

        if (!promedio) {
            console.log('No hay pedidos migrados para calcular el umbral.');
        } else {
            console.log(
                `Umbral elegido: ${promedio.importe} (promedio de los totales migrados).`
            );
            const pedidosSobreUmbral = await pedidos.aggregate([
                { $match: { estado: { $type: 'string' } } },
                calcularTotal,
                { $match: { $expr: { $gt: ['$total', promedio.importe] } } },
                {
                    $project: {
                        _id: 1,
                        estado: 1,
                        forma_pago: 1,
                        total: 1
                    }
                },
                { $sort: { total: -1 } }
            ]).toArray();
            console.dir(pedidosSobreUmbral, { depth: null });
        }
    } finally {
        await mongoose.disconnect();
    }
}

ejecutarConsultas().catch((error) => {
    console.error('Fallaron las consultas:', error.message);
    process.exitCode = 1;
});