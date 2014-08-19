
'use strict';

var jschan          = require('../lib/jschan');
var abstractSession = require('./abstract_session');

describe('websocket session', function() {

  var server;

  abstractSession(function(cb) {
    server = jschan.websocketServer();

    server.listen(0);

    var outSession;

    server.on('listening', function() {
      outSession = jschan.websocketClientSession({
        host: server.address().host,
        port: server.address().port
      });
    });

    server.on('session', function(session) {
      cb(null, session, outSession);
    });
  });

  afterEach(function shutdownServer(done) {
    server.close(done);
  });
});
