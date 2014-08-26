
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


internal.checkDevices = function (callback) {
    var context = this;
    telldus.getDevices(function (err, devices) {
        if(err) {
            console.error('Error getting devices', err);
            return callback(err);
        }
        context.publish('devices', JSON.stringify(devices), {retain:true});
        debug('published devices');
        context.devices = devices;
        callback(null);
    });
};


internal.publishDeviceValue = function (deviceId, key, value) {
    var topic = util.format('device/%s/%s', deviceId, key);
    this.publish(topic, value, {retain: true});
};


internal.listenRaw = function () {
    var context = this;
    var listener = telldus.addRawDeviceEventListener(function (controllerId, data) {
        var parsed = internal.parseRaw(data);
        var topic = util.format('raw/%s/other', controllerId);
        
        if (parsed.class == 'command' ) {
            topic = util.format('raw/%s/command/%s', controllerId, parsed.method);
            
            delete parsed.class;
            delete parsed.method;
        }
        
        context.publish(topic, parsed);
        //debug('published raw message from controller', controllerId, topic);
    });
};


internal.publish = function (topic, message, options, callback) {
    topic = util.format('telldus/%s', topic);
    if(typeof(message) === 'object') {
        message = JSON.stringify(message);
    }
    this.client.publish(topic, message, options, callback);
}

var App = module.exports = function () {
    var self = this;
    var context = {};

    var checkDevices = internal.checkDevices.bind(context);
    var listenRaw = internal.listenRaw.bind(context);
    var publishDeviceValue = internal.publishDeviceValue.bind(context);
    var publish = internal.publish.bind(context);
    context.publish = publish;

    this.listen = function (cb) {
        context.client = mqtt.createClient(1883, 'localhost');
        checkDevices(function (err) {

            telldus.addDeviceEventListener(function (deviceId, status) {

                var device = context.devices[deviceId - 1];

                publishDeviceValue(device.name, 'status', status.name);
            });
        });
        listenRaw();
        process.nextTick(function () {
            cb();
        });
    };
};
