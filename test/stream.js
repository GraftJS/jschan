
'use strict';

var jschan          = require('../lib/jschan');
var abstractSession = require('./abstract_session');
var PassThrough     = require('readable-stream').PassThrough;

describe('stream session', function() {
  abstractSession(function(cb) {
    var inStream  = new PassThrough();
    var outStream = new PassThrough();
    var inSession = jschan.streamSession(inStream, outStream, { server: true });
    var outSession = jschan.streamSession(outStream, inStream);
    cb(null, inSession, outSession);
  });
});
