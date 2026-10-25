# Trabajo Práctico N.º 8: NoSQL y Mongoose - Food Store

**Asignatura:** Bases de Datos II  
**Carrera:** Tecnicatura Universitaria en Programación (UTN FRM)  
**Proyecto:** Food Store  

<br>

### Descripción del Proyecto

Este proyecto implementa el modelado documental y la migración de un subconjunto de datos (pedidos, sus líneas de detalle y clientes) desde PostgreSQL (Food Store) hacia MongoDB utilizando Mongoose como ODM.

<br>

### Estructura del Repositorio

```text
Guzmán_Agustina_TP8/
├── config/
│   └── db.js                   # Conexión a MongoDB con Mongoose
├── models/
│   └── Pedido.js               # Esquema de Pedido (Cliente y Detalles embebidos)
├── data/
│   └── seed.js                 # Script de migración y carga inicial
├── .env                        # Variables de entorno (MONGO_URI)
├── .env.example                # Plantilla de variables de entorno
├── .gitignore                  # Exclusión de node_modules y .env
├── package.json                # Dependencias del proyecto
├── package-lock.json
├── consultas_mongodb.js        # Consultas solicitadas para MongoDB
├── consultas_postgresql.sql    # Sentencias SQL equivalentes
└── README.md                   # Documentación del proyecto

```

<br>

### Requisitos e Instalación

1. Requisitos: Node.js (v18+), MongoDB Server local o Atlas, y VS Code con la extensión MongoDB for VS Code.
2. Clonar el repositorio e instalar dependencias:
```bash
npm install

```


3. Crear el archivo `.env` basado en `.env.example`:
```env
MONGO_URI=mongodb://127.0.0.1:27017/foodstore_nosql

```



<br>

### Guía de Ejecución

1. Migración / carga inicial de datos (seed):


```bash
node data/seed.js

```


2. Ejecución de consultas en MongoDB (consigna 4):


```bash
node consultas_mongodb.js

```


3. Verificación en PostgreSQL (consigna 5):
Ejecutar `consultas_postgresql.sql` en PostgreSQL para comparar registros e identificadores con los de MongoDB.



<br>

### Archivos de Entrega

* `consultas_mongodb.js`: Consultas con sintaxis Mongoose.


* `consultas_postgresql.sql`: Consultas SQL equivalentes.


* Informe en PDF: documento con la descripción del modelo, evidencias, tabla comparativa, análisis de IA y conclusión técnica.
