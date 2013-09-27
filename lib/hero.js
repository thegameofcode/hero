var express	= require('express')    	// basic framework
,	extend	= require('xtend')			// Merge object properties
,	request = require('request')		// Request library
,   amqp    = require('amqp')			// AMQP implementation for rabbit
, 	qlog 	= require('qlog-node')
,	app		= express()
,	db1		= require('./db/mongodb.js')
;

var hero = this;

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

function log() {
	console.log('<---- [ LOG ] ---->', arguments);
}

function db(p_config){
	var config = p_config;
	var self = this;
	try {
		require('./db/' + p_config.type + '.js').call(self, p_config, hero);
	} catch (e) {
		hero.error("Error: " + e);
		hero.error('database "'+p_config.type+'" is not supported');
	}
	self.client = null;
}

function mq(p_config){
	var defaults = 	{
			"host"      : "localhost"
		,   "port"      : "5672"
		,   "exchange"  : ""
		,   "exchange_opts"   : {}
		,	"routing_key" : "*"
		,	"routing_opts" : {}
		,   "queue"     : "defQue"
		,   "queue_opts"   : {"type" : "topic"}
		,   "type"      : "amqp"
	};

	var _config 	= extend(defaults,p_config);
	var auth = (_config.user || "");
	if(auth.length > 0) {
		if(_config.password) {
			auth += ":"+_config.password + "@";
		} else {
			auth += "@";
		}
	}
	_config.url = (_config.url ? _config.url : 'amqp://' + auth + _config.host + (!!_config.port && _config.port.length > 0 ? ':' + _config.port : ''));
	
	var	_mqConn 	= null
	,	_exchange   = null
	,	_queue		= null
	;

	function _connection(f_callback) {

		switch(_config.type){

			case hero.mqType.AMQP :

				if ( _mqConn === null ) {
					_mqConn = amqp.createConnection( { url : _config.url } );
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
				if(_exchange === null && _config.exchange.length > 0) {
					_exchange = _mqConn.exchange(_config.exchange, _config.exchange_opts);
				}

				if( _queue === null ){
					_mqConn.queue(
						_config.queue
					, 
						_config.queue_opts
					,
						function(q){
							_queue = q;
							_config.exchange.length > 0 ? q.bind(_config.exchange, _config.routing_key) : q.bind(_config.routing_key);
							q.subscribe(f_callback);
						}
					);
				}
			}
		);
	}

	function _notify(p_data) {
		_route(_config.routing_key, p_data);
	}

	function _route(p_key, p_data) {
		_connection(
			function () {
				if( !_exchange ){
					_exchange = _mqConn.exchange( _config.exchange, _config.exchange_opts );
				}
				_exchange.publish(p_key, p_data, _config.routing_opts);
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
	app[p_method.toLowerCase()](p_path, f_handler);
}

hero.error = error;
hero.log = log;
hero.config = function (){
	return config;
};

hero.init = function (p_paths, f_callback){
	for ( var f=0, F=p_paths.length; f<F; f++ ){
		var item = p_paths[f];
		registerPath(item.path, item.method, item.handler);
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
	config = require(process.cwd() + '/lib/config/'+paramEnv+'.json');
	if ( config === null ) {
		hero.error('environment '+paramEnv+' not found');
	}
}

if (config.qlog) {
	qlog.config(config.qlog, function(err){
		if ( !err ){
			hero.error = function(message, tags) {
				error(arguments);
				qlog.notify(message, 'error,' + tags);
			};

			hero.log = function(message, tags){
				log(arguments);
				qlog.notify(message, tags);
			}
		} else {
			hero.error("QLog service not available", err);
		}
	});
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