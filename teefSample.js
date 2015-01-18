var loki = require('./src/lokijs.js');

var db = new loki('commhub-devices.json',

  {

    autosave: true,

    autosaveInterval: 1000 * 60 * 10,

    /*autoload: true,

    autoloadCallback : this._dbLoadHandler.bind(this),*/

  });

 

  // TEST

  var dev1 = {

    deviceType: 'dimmer',

    deviceName: 'Dimmer',

    logicalAddr: 254,

    serialNumber: [ 54, 52, 16, 20, 0, 8, 0 ],

    serialNumberStr: '54521620000800' };

 

  var dev2 = {

    deviceType: 'dimmer',

    deviceName: 'Dimmer',

    logicalAddr: 20,

    serialNumber: [ 54, 53, 2, 31, 0, 12, 0 ],

    serialNumberStr: '54530231001200' };

 

  // EOF TEST

 

  // Create new collection

  var dbDevices = db.addCollection('devices');

  

  dev1.active = true;

  dbDevices.insert(dev1);

  dbDevices.insert(dev2);

 

  // Create dynamic view with active devices

  dbDevicesView = dbDevices.addDynamicView('aciveDevices');

  dbDevicesView.applyFind({'active': {'$eq': true}});

 

  console.log('DB dynamic view');

  console.log(dbDevicesView.data());

  

  db.save();

process.exit(code=0);