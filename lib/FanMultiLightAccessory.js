const BaseAccessory = require('./BaseAccessory');

class FanMultiLightAccessory extends BaseAccessory {
    static getCategory(Categories) {
        return Categories.FANLIGHT;
    }

    constructor(...props) {
        super(...props);
    }

    _registerPlatformAccessory() {
        const {Service} = this.hap;
        this.accessory.addService(Service.Fan, this.device.context.name);
        this.accessory.addService(Service.Lightbulb, this.device.context.name + " Light 1", "light1");
        this.accessory.addService(Service.Lightbulb, this.device.context.name + " Light 2", "light2");
        this.accessory.addService(Service.Lightbulb, this.device.context.name + " Light 3", "light3");
        super._registerPlatformAccessory();
    }

    _registerCharacteristics(dps) {
        const {Service, Characteristic} = this.hap;
        const serviceFan = this.accessory.getService(Service.Fan);
        const serviceLight1 = this.accessory.getServiceByUUIDAndSubType(Service.Lightbulb, "light1");
        const serviceLight2 = this.accessory.getServiceByUUIDAndSubType(Service.Lightbulb, "light2");
        const serviceLight3 = this.accessory.getServiceByUUIDAndSubType(Service.Lightbulb, "light3");
        
        this._checkServiceName(serviceFan, this.device.context.name);
        this._checkServiceName(serviceLight1, this.device.context.name + " Light 1");
        this._checkServiceName(serviceLight2, this.device.context.name + " Light 2");
        this._checkServiceName(serviceLight3, this.device.context.name + " Light 3");
        
        // Configure DPs
        this.dpFanOn = this._getCustomDP(this.device.context.dpFanOn) || '142';
        this.dpRotationSpeed = this._getCustomDP(this.device.context.dpRotationSpeed) || '141';
        this.dpLight1On = this._getCustomDP(this.device.context.dpLight1On) || '1';
        this.dpLight2On = this._getCustomDP(this.device.context.dpLight2On) || '2';
        this.dpLight3On = this._getCustomDP(this.device.context.dpLight3On) || '3';
        
        this.maxSpeed = parseInt(this.device.context.maxSpeed) || 4;
        this.fanDefaultSpeed = parseInt(this.device.context.fanDefaultSpeed) || 1;
        this.fanCurrentSpeed = 0;
        this.useStrings = this._coerceBoolean(this.device.context.useStrings, true);

        // Fan characteristics
        const characteristicFanOn = serviceFan.getCharacteristic(Characteristic.On)
            .updateValue(this._getFanOn(dps[this.dpFanOn]))
            .on('get', this.getFanOn.bind(this))
            .on('set', this.setFanOn.bind(this));

        const characteristicRotationSpeed = serviceFan.getCharacteristic(Characteristic.RotationSpeed)
            .setProps({
                minValue: 0,
                maxValue: 100,
                minStep: Math.max(100 / this.maxSpeed)
            })
            .updateValue(this.convertRotationSpeedFromTuyaToHomeKit(dps[this.dpRotationSpeed]))
            .on('get', this.getSpeed.bind(this))
            .on('set', this.setSpeed.bind(this));

        // Light 1 characteristics
        const characteristicLight1On = serviceLight1.getCharacteristic(Characteristic.On)
            .updateValue(this._getLightOn(dps[this.dpLight1On]))
            .on('get', this.getLight1On.bind(this))
            .on('set', this.setLight1On.bind(this));

        // Light 2 characteristics
        const characteristicLight2On = serviceLight2.getCharacteristic(Characteristic.On)
            .updateValue(this._getLightOn(dps[this.dpLight2On]))
            .on('get', this.getLight2On.bind(this))
            .on('set', this.setLight2On.bind(this));

        // Light 3 characteristics
        const characteristicLight3On = serviceLight3.getCharacteristic(Characteristic.On)
            .updateValue(this._getLightOn(dps[this.dpLight3On]))
            .on('get', this.getLight3On.bind(this))
            .on('set', this.setLight3On.bind(this));

        // Handle state changes
        this.device.on('change', (changes, state) => {
            if (changes.hasOwnProperty(this.dpFanOn) && characteristicFanOn.value !== changes[this.dpFanOn])
                characteristicFanOn.updateValue(changes[this.dpFanOn]);

            if (changes.hasOwnProperty(this.dpRotationSpeed) && this.convertRotationSpeedFromHomeKitToTuya(characteristicRotationSpeed.value) !== changes[this.dpRotationSpeed])
                characteristicRotationSpeed.updateValue(this.convertRotationSpeedFromTuyaToHomeKit(changes[this.dpRotationSpeed]));

            if (changes.hasOwnProperty(this.dpLight1On) && characteristicLight1On.value !== changes[this.dpLight1On])
                characteristicLight1On.updateValue(changes[this.dpLight1On]);

            if (changes.hasOwnProperty(this.dpLight2On) && characteristicLight2On.value !== changes[this.dpLight2On])
                characteristicLight2On.updateValue(changes[this.dpLight2On]);

            if (changes.hasOwnProperty(this.dpLight3On) && characteristicLight3On.value !== changes[this.dpLight3On])
                characteristicLight3On.updateValue(changes[this.dpLight3On]);

            this.log.debug('FanMultiLight changed: ' + JSON.stringify(state));
        });
    }

    /*************************** FAN ***************************/
    getFanOn(callback) {
        this.getState(this.dpFanOn, (err, dp) => {
            if (err) return callback(err);
            callback(null, this._getFanOn(dp));
        });
    }

    _getFanOn(dp) {
        const {Characteristic} = this.hap;
        return dp;
    }

    setFanOn(value, callback) {
        const {Characteristic} = this.hap;
        if (value == false) {
            this.fanCurrentSpeed = 0;
            return this.setState(this.dpFanOn, false, callback);
        } else {
            if (this.fanCurrentSpeed === 0) {
                if (this.useStrings) {
                    return this.setMultiStateLegacy({[this.dpFanOn]: value, [this.dpRotationSpeed]: this.fanDefaultSpeed.toString()}, callback);
                } else {
                    return this.setMultiStateLegacy({[this.dpFanOn]: value, [this.dpRotationSpeed]: this.fanDefaultSpeed}, callback);
                }
            } else {
                if (this.useStrings) {
                    return this.setMultiStateLegacy({[this.dpFanOn]: value, [this.dpRotationSpeed]: this.fanCurrentSpeed.toString()}, callback);
                } else {
                    return this.setMultiStateLegacy({[this.dpFanOn]: value, [this.dpRotationSpeed]: this.fanCurrentSpeed}, callback);
                }
            }
        }
        callback();
    }

    getSpeed(callback) {
        this.getState(this.dpRotationSpeed, (err, dp) => {
            if (err) return callback(err);
            callback(null, this.convertRotationSpeedFromTuyaToHomeKit(this.device.state[this.dpRotationSpeed]));
        });
    }

    setSpeed(value, callback) {
        const {Characteristic} = this.hap;
        if (value === 0) {
            if (this.useStrings) {
                return this.setMultiStateLegacy({[this.dpFanOn]: false, [this.dpRotationSpeed]: this.fanDefaultSpeed.toString()}, callback);
            } else {
                return this.setMultiStateLegacy({[this.dpFanOn]: false, [this.dpRotationSpeed]: this.fanDefaultSpeed}, callback);
            }
        } else {
            this.fanCurrentSpeed = this.convertRotationSpeedFromHomeKitToTuya(value);
            if (this.useStrings) {
                return this.setMultiStateLegacy({[this.dpFanOn]: true, [this.dpRotationSpeed]: this.convertRotationSpeedFromHomeKitToTuya(value).toString()}, callback);
            } else {
                return this.setMultiStateLegacy({[this.dpFanOn]: true, [this.dpRotationSpeed]: this.convertRotationSpeedFromHomeKitToTuya(value)}, callback);
            }
        }
        callback();
    }

    /*************************** LIGHTS ***************************/
    // Light 1
    getLight1On(callback) {
        this.getState(this.dpLight1On, (err, dp) => {
            if (err) return callback(err);
            callback(null, this._getLightOn(dp));
        });
    }

    _getLightOn(dp) {
        const {Characteristic} = this.hap;
        return dp;
    }

    setLight1On(value, callback) {
        return this.setState(this.dpLight1On, value, callback);
    }

    // Light 2
    getLight2On(callback) {
        this.getState(this.dpLight2On, (err, dp) => {
            if (err) return callback(err);
            callback(null, this._getLightOn(dp));
        });
    }

    setLight2On(value, callback) {
        return this.setState(this.dpLight2On, value, callback);
    }

    // Light 3
    getLight3On(callback) {
        this.getState(this.dpLight3On, (err, dp) => {
            if (err) return callback(err);
            callback(null, this._getLightOn(dp));
        });
    }

    setLight3On(value, callback) {
        return this.setState(this.dpLight3On, value, callback);
    }
}

module.exports = FanMultiLightAccessory;
