
var mqtt = require('mqtt');
var telldus = require('telldus');
var debug = require('debug')('tellmqtt:lib:app');

var util = require('util');


var internal = {};


internal.parseRaw = function (data) {
  //debug('parseRaw', data);
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
    debug('publishing %s to %s', value, topic);
    this.publish(topic, value, {retain: true});
};


internal.listenRaw = function () {
    var context = this;
    debug('listening to raw events');
    var listener = telldus.addRawDeviceEventListener(function (controllerId, data) {
        var parsed = internal.parseRaw(data);
        var topic = util.format('raw/%s/other', controllerId);
        
        if (parsed.class == 'command' ) {
            topic = util.format('raw/%s/command/%s', controllerId, parsed.method);
            
            delete parsed.class;
            delete parsed.method;
        }
        
        context.publish(topic, parsed);
        debug('published raw message from controller', controllerId, topic);
    });
};

internal.listenSensor = function () {
	var context = this;
	debug('listening to sensor events');
	var listener = telldus.addSensorEventListener(function (deviceId, protocol, model, type, value, ts) {
		debug('sensor %s, protocol: %s, type: %s, value:%s', deviceId, protocol, type, value);
		switch(protocol) {
			case 'temperaturehumidity':
				switch(type){
					case 1:
						type='temperature';
						break;
					case 2:
						type='humidity';
						break;
				}
				break; //-- temperaturehumidity
		}
		
		var topic = util.format('sensor/%s/%s/', deviceId, type);
		context.publish(topic + 'value', value, {retain:true});
		context.publish(topic + 'timestamp', ts, {retain:true});
	});

}


internal.publish = function (topic, message, options, callback) {
    topic = util.format('tellmqtt/%s', topic);
    if(typeof(message) === 'object') {
        message = JSON.stringify(message);
    }
    else {
    	message = message.toString();
    }
    debug('publishing %s to %s', topic, message);
    this.client.publish(topic, message, options, callback);
}

var App = module.exports = function (options) {
    var self = this;
    var context = {};

    var checkDevices = internal.checkDevices.bind(context);
    var listenRaw = internal.listenRaw.bind(context);
    var listenSensor = internal.listenSensor.bind(context);
    var publishDeviceValue = internal.publishDeviceValue.bind(context);
    var publish = internal.publish.bind(context);
    
    context.publish = publish;

    this.listen = function (cb) {
        context.client = mqtt.createClient(1883, options.mqtt.host);
        checkDevices(function (err) {

            telldus.addDeviceEventListener(function (deviceId, status) {

                var device = context.devices[deviceId - 1];

                publishDeviceValue(device.name, 'status', status.name);
            });
        });
        listenRaw();
        listenSensor();
        process.nextTick(function () {
            cb();
        });
    };
};
