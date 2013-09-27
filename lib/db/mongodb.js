var mongodb	= require("mongodb")    	// document data store

var db = function(p_config, hero) {
	
	var self = this;

	function reset (f_callback){
		self.client.dropDatabase(f_callback);
	}

	function connection(f_callback) {
		if ( self.client ) {
			f_callback( null, self.client );
		} else {
			if (p_config.replicaSet) {
				var servers = [];
				var s,S = p_config.replicaSet.servers.length, server;
				for(s=0;s<S;s++){
					server = p_config.replicaSet.servers[s];
					servers.push(new mongodb.Server(server.host,server.port));
				}
				var replSet = new mongodb.ReplSet( servers,{rs_name:p_config.replicaSet.name});
				p_config.params.replSet = replSet;
			}

			var uri = p_config.uri || 'mongodb://' + p_config.host + ':' + p_config.port + "/" + p_config.name;
			mongodb.Db.connect(
				uri
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
	}

	self.setup  = connection;
	self.reset  = reset;
}

module.exports = db;