const app = require('./app');
const config = require('./config');

const HOST = '0.0.0.0';
const server = app.listen(config.port, HOST, () => {
  console.log(`[Assetra Backend] Listening on http://${HOST}:${config.port} (${config.env} mode)`);
});

module.exports = server;
