const mysql = require('mysql2/promise');

const connection = mysql.createPool({
    host: '213.239.217.56',
    user: 'gamerock_jhnibvcfgddfv',
    password: 'bhgh5345sdfdf',
    database: 'gamerock_jhnibvcfgddfv'
});

// const connection = mysql.createPool({
//     host: 'localhost',
//     user: 'root',
//     password: '',
//     database: 'gamerock_jhnibvcfgddfv'
// });
   // "start": "pm2 start src/server.js"

export default connection; 