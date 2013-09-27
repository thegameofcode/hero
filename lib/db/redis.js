var redis	= require("redis")    	// document data store

var db = function(p_config, hero) {
	
	var self = this;

	function reset (f_callback){
		self.client.flushdb(f_callback);
	}

	function connection(f_callback) {
		if ( self.client ) {
			f_callback( null, self.client );
		} else {
			self.client = redis.createClient(p_config.port, p_config.host, p_config.params);
			f_callback(null, self.client);
		}
	}

	self.setup  = connection;
	self.reset  = reset;
}

module.exports = db;