
var mqtt = require('mqtt');
var telldus = require('telldus');
var debug = require('debug')('tellmqtt:lib:app');

var util = require('util');


var internal = {};


internal.parseRaw = function (data) {
  var result = {};
  var pairs = data.split(';');
  //all pairs end with ; including last
  for (var i = 0; i < pairs.length - 1; i++) {
    var keyval = pairs[i].split(':');
    result[keyval[0]] = keyval[1];
  }
  return result;
};

internal.checkDevices = function (client) {
    telldus.getDevices(function (err, devices) {
        if(err) {
            console.error('Error getting devices', err);
            return;
        }
        client.publish('telldus/devices', JSON.stringify(devices), {retain:true});
        debug('published devices');
        internal.listenDevices(client, devices);
    });
}

internal.listenDevices = function (client, devices) {
    telldus.addDeviceEventListener(function (deviceId, status) {
        internal.publishDeviceStatus(client, deviceId, status);
    });
}

internal.publishDeviceStatus = function (client, deviceId, status) {
    var topic = util.format('telldus/device/%s/status', deviceId);
    client.publish(topic, status.name);
}

internal.listenRaw = function (client) {
    var listener = telldus.addRawDeviceEventListener(function (controllerId, data) {
        var parsed = internal.parseRaw(data);
        var topic = util.format('telldus/raw/%s/other', controllerId);
        
        if (parsed.class == 'command' ) {
            topic = util.format('telldus/raw/%s/command/%s', controllerId, parsed.method);
            
            delete parsed.class;
            delete parsed.method;
        }
        
        client.publish(topic, JSON.stringify(parsed));
        debug('published raw message from controller', controllerId, topic);
    });
}

var App = module.exports = function () {
    var self = this;
    var client;

    this.listen = function (cb) {
        client = mqtt.createClient(1883, 'localhost');
        internal.checkDevices(client);
        internal.listenRaw(client);
        process.nextTick(function () {
            cb();
        });
    };
};
