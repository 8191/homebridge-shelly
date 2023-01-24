
module.exports = homebridge => {
  const { Ability } = require('./base')(homebridge)
  const {
    ConsumptionCharacteristic,
    ElectricCurrentCharacteristic,
    VoltageCharacteristic,
    TotalConsumptionCharacteristic,
  } = require('../util/custom-characteristics')(homebridge)
  const { PowerMeterService } = require('../util/custom-services')(homebridge)
  const FakeGatoHistoryService = require('fakegato-history')(homebridge)

  class PowerMeterAbility extends Ability {
    /**
     * @param {string} consumptionProperty - The device property used to
     * indicate the current power consumption (Watt).
     * @param {string} electricCurrentProperty - The device property used to
     * indicate the amount of electric current (Ampere).
     * @param {string} voltageProperty - The device property used to indicate
     * the current voltage (Volt).
     */
    constructor(consumptionProperty, electricCurrentProperty = null,
      voltageProperty = null) {
      super()

      this._consumptionProperty = consumptionProperty
      this._electricCurrentProperty = electricCurrentProperty
      this._voltageProperty = voltageProperty
    }

    get service() {
      return this.platformAccessory.getService(PowerMeterService)
    }

    get consumption() {
      return Math.min(
        Math.max(this.device[this._consumptionProperty], 0),
        65535
      )
    }

    get electricCurrent() {
      return this.device[this._electricCurrentProperty]
    }

    get voltage() {
      return this.device[this._voltageProperty]
    }

    _createService() {
      const service = new PowerMeterService()
        .setCharacteristic(ConsumptionCharacteristic, this.consumption)

      if (this._electricCurrentProperty) {
        service.setCharacteristic(
          ElectricCurrentCharacteristic,
          this.electricCurrent
        )
      }

      if (this._voltageProperty) {
        service.setCharacteristic(VoltageCharacteristic, this.voltage)
      }

      return service
    }

    _setupEventHandlers() {
      super._setupEventHandlers()

      this.device.on(
        'change:' + this._consumptionProperty,
        this._consumptionChangeHandler,
        this
      )

      if (this._electricCurrentProperty) {
        this.device.on(
          'change:' + this._electricCurrentProperty,
          this._electricCurrentChangeHandler,
          this
        )
      }

      if (this._voltageProperty) {
        this.device.on(
          'change:' + this._voltageProperty,
          this._voltageChangeHandler,
          this
        )
      }
    }

    /**
     * Handles changes from the device to the consumption property.
     */
    _consumptionChangeHandler(newValue) {
      this.log.debug(
        this._consumptionProperty,
        'of device',
        this.device.type,
        this.device.id,
        'changed to',
        newValue
      )

      this.service
        .getCharacteristic(ConsumptionCharacteristic)
        .setValue(this.consumption)
    }

    /**
     * Handles changes from the device to the electric current property.
     */
    _electricCurrentChangeHandler(newValue) {
      this.log.debug(
        this._electricCurrentProperty,
        'of device',
        this.device.type,
        this.device.id,
        'changed to',
        newValue
      )

      this.service
        .getCharacteristic(ElectricCurrentCharacteristic)
        .setValue(this.electricCurrent)
    }

    /**
     * Handles changes from the device to the voltage property.
     */
    _voltageChangeHandler(newValue) {
      this.log.debug(
        this._voltageProperty,
        'of device',
        this.device.type,
        this.device.id,
        'changed to',
        newValue
      )

      this.service
        .getCharacteristic(VoltageCharacteristic)
        .setValue(this.voltage)
    }

    detach() {
      this.device.removeListener(
        'change:' + this._consumptionProperty,
        this._consumptionChangeHandler,
        this
      )

      if (this._electricCurrentProperty) {
        this.device.removeListener(
          'change:' + this._electricCurrentProperty,
          this._electricCurrentChangeHandler,
          this
        )
      }

      if (this._voltageProperty) {
        this.device.removeListener(
          'change:' + this._voltageProperty,
          this._voltageChangeHandler,
          this
        )
      }

      super.detach()
    }
  }

  class PowerConsumptionAbility extends Ability {
    /**
     * @param {string} consumptionProperty - The device property used to
     * indicate the current power consumption (Watt).
     */
    constructor(consumptionProperty) {
      super()

      this._consumptionProperty = consumptionProperty
    }

    get service() {
      return this._service
    }

    /**
     * Adds this ability to the given accessory.
     * @param {object} accessory - The accessory to add this ability to.
     */
    setup(accessory) {
      this.device = accessory.device
      this.accessory = accessory
      this.log = accessory.log
      this.platformAccessory = accessory.platformAccessory

      if (!(this._service instanceof FakeGatoHistoryService)) {
        this.log.info("Creating new FakeGatoHistoryService service.")

        for (const s of this.platformAccessory.services) {
          if (s.UUID == FakeGatoHistoryService.UUID) {
            this.platformAccessory.removeService(s)
          }
        }

        // Create service and add to platformAccessory
        // (done in FakeGatoHistoryService constructor)
        this._service = this._createService()
      }
      else {
        this.log.debug("FakeGatoHistoryService exists.")
      }

      this._setupEventHandlers()
    }

    get consumption() {
      return Math.min(
        Math.max(this.device[this._consumptionProperty], 0),
        65535
      )
    }

    _createService() {
      const service = new FakeGatoHistoryService(
        'energy',
        this.platformAccessory,
        {
          log: this.log,
          storage: 'fs',
          path: homebridge.user.storagePath() + '/accessories',
          filename: this.device.id + '_persist.json',
          minutes: 10
        })
      service.service.setCharacteristic(TotalConsumptionCharacteristic, this.consumption)
      return service
    }

    _setupEventHandlers() {
      super._setupEventHandlers()

      this.device.on(
        'change:' + this._consumptionProperty,
        this._consumptionChangeHandler,
        this
      )
    }

    /**
     * Handles changes from the device to the consumption property.
     */
    _consumptionChangeHandler(newValue) {
      this.log.debug(
        this._consumptionProperty,
        'of device',
        this.device.type,
        this.device.id,
        'changed to',
        newValue
      )

      this.service
        .getCharacteristic(TotalConsumptionCharacteristic)
        .setValue(this.consumption)

      this.service
        .addEntry({time: Math.round(new Date().valueOf() / 1000), power: this.consumption})
    }

    detach() {
      this.device.removeListener(
        'change:' + this._consumptionProperty,
        this._consumptionChangeHandler,
        this
      )

      super.detach()
    }
  }

  return {
    PowerMeterAbility,
    PowerConsumptionAbility,
  }
}
