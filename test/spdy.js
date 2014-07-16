
'use strict';

var jschan          = require('../');
var abstractSession = require('./abstract_session');
var fs = require('fs');

describe('spdy session', function() {
  var builder = jschan.spdyServerSession.bind(jschan, {
    key: fs.readFileSync(__dirname + '/certificates/key.pem'),
    cert: fs.readFileSync(__dirname + '/certificates/cert.pem'),
    ca: fs.readFileSync(__dirname + '/certificates/csr.pem'),
  });

  abstractSession(builder, function(session) {
    return jschan.spdyClientSession({
      host: session.host,
      port: session.port,
      rejectUnauthorized: false
    });
  });
});
