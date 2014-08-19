
'use strict';

var jschan          = require('../lib/jschan');
var abstractSession = require('./abstract_session');
var PassThrough     = require('readable-stream').PassThrough;

describe('stream session with standard mode', function() {
  abstractSession(function(cb) {
    var inStream  = new PassThrough();
    var outStream = new PassThrough();
    var inSession = jschan.streamSession(inStream, outStream, { server: true });
    var outSession = jschan.streamSession(outStream, inStream);
    cb(null, inSession, outSession);
  });
});

describe('stream session with object mode and no headers', function() {
  abstractSession(function(cb) {
    var inStream  = new PassThrough({ objectMode: true });
    var outStream = new PassThrough({ objectMode: true });
    var inSession = jschan.streamSession(inStream, outStream, { server: true, header: false });
    var outSession = jschan.streamSession(outStream, inStream, { header: false });
    cb(null, inSession, outSession);
  });
});
