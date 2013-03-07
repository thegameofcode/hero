var express	= require('express')    	// basic framework
,	async	= require('async')      	// asynchronous management
,	q		= require('q')      		// deferred and promises management
,	rabbit	= require("./rabbit_manager.js")  	// queues management
,	mongodb	= require("mongodb")    	// document data store
,	redis	= require("redis")      	// key-value data store
,	assert	= require("assert")     	// unit test
,	fs		= require('fs')          	// filesystem
,	extend	= require('xtend')			// Merge object properties
,	app		= express()
;


var hero = this;

hero.dbType = {
 MONGODB : 'mongodb'
 ,	
 REDIS 	: 'redis'
};

hero.mqType = {
 RABBITMQ : 'rabbitmq'
};

var config = null;

function getParam (p_lbl, p_val) {
 var idx = p_val.indexOf(p_lbl);
 if ( idx > -1 ) {
  return p_val.substring( idx + p_lbl.length );
 }
 return null;
}

function error (){
 console.log('**ERROR**', arguments);
}

function db(p_config){
 var config = p_config;
 var self = this;

 self.client = null;

 function reset (f_callback){
  switch(config.type){
   case hero.dbType.MONGODB :				
    async.series(
     [
     function (callback){
      self.client.dropDatabase(callback);
     }
     ,	function (callback) {
      self.client.createCollection('trace', callback);
     }
     ]
     , f_callback
     );
    break;
   case hero.dbType.REDIS :
    self.client.flushdb(f_callback);
    break;
  }
 }

 function connection(f_callback) {
  if ( self.client ) {
   f_callback( null, self.client );
  }
  else {
   switch(config.type){
    case hero.dbType.MONGODB :
     if (p_config.uri) {
      mongodb.Db.connect( p_config.uri, p_config.params, function(err, client) {
       if(err) { 
        hero.error(err);;
       }
       self.client = client;
       f_callback( err, self.client );
    
      });
     } else {
      self.client = new mongodb.Db(
       p_config.name
       ,	new mongodb.Server(p_config.host, p_config.port)
       , 	p_config.params
       );
      self.client.open(
       function(err, p_client) {
        if(err) {
         hero.error(err);
        }
        f_callback( err, self.client );
       }
       );
     }
     break;
    case hero.dbType.REDIS :
     self.client = redis.createClient(p_config.port, p_config.host, p_config.params);
     f_callback(null, self.client);
     break;
    default:
     hero.error('database "'+p_type+'" is not supported');
     break;
   }
  }
 }

 function setup(f_callback){
  connection( f_callback );
 }

 self.setup = setup;
 self.reset = reset;

}

hero.worker =  function (f_class){
 var self = {};
	
 self.config = config;
 self.error  = error;

 var dbs = {};
 self.db = function ( p_label, p_config ){
  if ( !dbs[p_label] || arguments.length === 2 ) {
   dbs[p_label] = new db( p_config );
  }
  return dbs[p_label];
 };

 var mqs = {};
 self.mq = function ( p_label, p_config ){
  if ( !mqs[p_label] && arguments.length === 2 ) {
   mqs[p_label] = new rabbit( p_config );
  }
  return mqs[p_label];
 };

 f_class(self);

 return self;
}

function registerPath(p_path, p_method, f_handler){
 console.log("REGISTER", p_method, p_path);
 switch(p_method){
  case "GET": {
   app.get(p_path, f_handler);
   break;
  }
  case "POST": {
   app.post(p_path, f_handler);
   break;
  }
  case "PUT": {
   app.put(p_path, f_handler);
   break;
  }
  case "DELETE": {
   app.delete(p_path, f_handler);
   break;
  }
 }
}

function loadPath(p_item){
 registerPath(p_item.path, p_item.method, p_item.handler);
}

hero.error = error;
hero.config = function (){
 return config;
};

hero.init = function (p_paths, f_callback){
 for ( var f=0, F=p_paths.length; f<F; f++ ){
  loadPath(p_paths[f]);
 }
 f_callback();		
};

var paramEnv = null;
process.argv.forEach(
 function (val, index, array) {
  paramEnv = getParam("env=", val);
 }
 );
if ( paramEnv === null || paramEnv === '') {
 hero.error('"env" initial parameter is not found, it must specify some correct value');
}
else {	
 
 config = require('./config/'+paramEnv+'.json');
 if ( config === null ) {
  hero.error('environment '+paramEnv+' not found');
 }
}
hero.app = app;
module.exports = hero;
