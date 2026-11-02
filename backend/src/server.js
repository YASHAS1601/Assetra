const app = require('./app');
const config = require('./config');

const server = app.listen(config.port, () => {
  console.log(`[Assetra Backend] Listening on http://localhost:${config.port} (${config.env} mode)`);
});

module.exports = server;
