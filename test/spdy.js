
'use strict';

var jschan          = require('../');
var abstractSession = require('./abstract_session');
var fs = require('fs');

describe('spdy session', function() {

  var server;

  abstractSession(function(cb) {
    server = jschan.spdyServer({
      key: fs.readFileSync(__dirname + '/certificates/key.pem'),
      cert: fs.readFileSync(__dirname + '/certificates/cert.pem'),
      ca: fs.readFileSync(__dirname + '/certificates/csr.pem')
    });

    server.listen(0);

    var outSession;

    server.on('listening', function() {
      outSession = jschan.spdyClientSession({
        host: server.address().host,
        port: server.address().port,
        rejectUnauthorized: false
      });
    });

    server.on('session', function(session) {
      console.log('new session!');
      cb(null, session, outSession);
    });
  });

  afterEach(function(done) {
    server.close(done);
  });
});
