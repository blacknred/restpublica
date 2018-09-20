const http = require('http');
const debug = require('debug')('users-api:server');

const app = require('./app');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';

function normalizePort(val) {
    const port = parseInt(val, 10);
    if (isNaN(port)) return val;
    if (port >= 0) return port;
    return false;
}

const port = normalizePort(process.env.PORT || '3004');

app.set('port', port);

function onError(error) {
    if (error.syscall !== 'listen') { throw error; }
    switch (error.code) {
        case 'EACCES':
            process.exit(1);
            break;
        case 'EADDRINUSE':
            process.exit(1);
            break;
        default:
            throw error;
    }
}

const server = http.createServer(app);

function onListening() {
    const addr = server.address();
    const bind = typeof addr === 'string' ? `Pipe ${port}` : `Port ${port}`;
    debug('Listening on %s', bind);
}

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);
