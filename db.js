const mysql = require('mysql2');

const pool = mysql.createPool({
    host: process.env.HOST,
    port: parseInt(process.env.DBPORT || '3307'),
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
    waitForConnections: process.env.WAITFORTCONNECTION === 'true',
    connectionLimit: parseInt(process.env.LIMIT || '10'),
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

const promisePool = pool.promise();

async function testConnection() {
    try {
        const connection = await promisePool.getConnection();
        console.log('✅ MySQL conectado exitosamente');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Error conectando a MySQL:');
        console.error(error.message);
        return false;
    }
}

testConnection();

module.exports = promisePool;