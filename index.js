
var App = require('./lib/app');

module.exports.createApp = function () {
  var options = {
    mqtt: {
      host: "localhost" || process.env.MQTT_HOST,
      port: 1883 || process.env.MQTT_PORT
    }
  };
  return new App(options);
}
