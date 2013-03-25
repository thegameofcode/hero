var express	= require('express')    	// basic framework
,	async	= require('async')      	// asynchronous management
,	q		= require('q')      		// deferred and promises management
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
,	REDIS 	: 'redis'
};

hero.mqType = {
	RABBITMQ : 'rabbitmq'
,	AMQP 	 : 'amqp'
};

var config = null;

function getParamValue (p_label) {
	var idx=-1;
	for ( var f=0, F=process.argv.length; f<F; f++ ) {
		idx = process.argv[f].indexOf( p_label+'=' )
		if ( idx !== -1 ){
			return process.argv[f].substring( idx + String(p_label+'=').length );
		}
	}
 	return null;
}

function error (){
	console.log('* * * * E R R O R * * * *', arguments);
}

function db(p_config){
	var config = p_config;
	var self = this;

	function reset (f_callback){
		switch(config.type){

			case hero.dbType.MONGODB :				
  				self.client.dropDatabase(f_callback);
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
				 		mongodb.Db.connect( 
				 			p_config.uri
				 		, 
				 			p_config.params
				 		, 
				 			function(err, client) {
				   				if(err) { 
									hero.error(err);;
				   				}
				   				self.client = client;
				   				f_callback( err, self.client );
				  			}
				  		);
				 	} 
				 	else {
				  		self.client = new mongodb.Db(
				   			p_config.name
				   		,	
				   			new mongodb.Server(p_config.host, p_config.port)
				   		, 	
				   			p_config.params
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
				 	hero.error('database "'+config.type+'" is not supported');
				 break;
			}
		}
	}

	function setup(f_callback){
 		connection( f_callback );
	}

	self.client = null;
	self.setup  = setup;
 	self.reset  = reset;

}

function mq(p_config){
	var _config 	= p_config
	,	_mqConn 	= null
	,	_exchange   = null
	,	_queue		= null
	;

	function _connection(f_callback) {

		switch(_config.type){

			case hero.mqType.AMQP :
				var host = 'amqp://' + _config.host + (!!_config.port && _config.port.length > 0 ? ':' + _config.port : '');
				if ( _mqConn === null ) {
					_mqConn = amqp.createConnection( { url : host } );
					_mqConn.on(
						'ready'
					, 
						function(){
							f_callback();
						}
					);
				}
				else {
					f_callback();
				}
				break;

			default :
				hero.error('mq "'+config.type+'" is not supported');
				break;

		}

	}

	function _on(f_callback) {
		_connection( 
			function () {
				if( _exchange === null ){
					_exchange = _mqConn.exchange( _config.exchange );
				}

				if( _self.queue === null ){
					_mqConn.queue(
						_config.queue
					, 
						function(q){
							_self.queue = q;
							q.bind(self.exchange, '*');
							q.subscribe(f_callback);
						}
					);
				}
			}
		);
	}

	function _notify(p_data) {
		_route(_config.queue, p_data);
	}

	function _route(p_key, p_data) {
		_connection(
			function () {
				if( !_exchange ){
					_exchange = self.connection.exchange( _config.exchange );
				}
				_exchange.publish(p_key, p_data);
			}
		);
	}

	function _reset() {
		if (_mqConn){
			_mqConn.end();
			_queue 		= null;
			_exchange 	= null;
			_mqConn 	= null;
		}
	}

	this.on 	= _on;
	this.notify = _notify;
	this.route 	= _route;
	this.reset 	= _reset;

}

hero.worker = function (f_class){
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
	   		mqs[p_label] = new mq( p_config );
	  	}
	  	return mqs[p_label];
	};

	f_class(self);

	return self;
}

function registerPath(p_path, p_method, f_handler){
	console.log("REGISTER", p_method, p_path);
 	switch(p_method) {
  		case "GET": 
   			app.get(p_path, f_handler);
   			break;
  		case "POST":
   			app.post(p_path, f_handler);
   			break;
  		case "PUT":
   			app.put(p_path, f_handler);
   			break;
  		case "DELETE":
   			app.delete(p_path, f_handler);
   		break;	
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

hero.getProcParam = getParamValue;

var paramPort = getParamValue('port');
var paramEnv  = getParamValue('env');

if ( paramEnv === null || paramEnv === '') {
 	hero.error('"env" initial parameter is not found, it must specify some correct value');
}
else {
	config = require('./config/'+paramEnv+'.json');
	if ( config === null ) {
		hero.error('environment '+paramEnv+' not found');
	}
}

if ( paramPort === null || paramPort === '') {
 	hero.error('"port" initial parameter is not found, it must specify some correct value');
}

hero.env = function (){
	return paramEnv;
}

hero.port = function (){
	return paramPort;
}

console.log('getting starting parameters -> environment['+paramEnv+'] port['+paramPort+']');

hero.app = app;
module.exports = hero;