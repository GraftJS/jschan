
'use strict';

var expect = require('must');
var jschan = require('../');

module.exports = function abstractSession(inBuilder, outBuilder) {

  var inSession;
  var outSession;

  beforeEach(function() {
    inSession = inBuilder();
    outSession = outBuilder(inSession);
  });

  function client(done) {
    var chan   = outSession.sendChannel();
    var msg    = jschan.msg({ hello: 'world' });

    msg.on('response', function(res) {
      expect(res.data).to.eql(msg.data);
      done();
    });

    chan.send(msg);
  }

  it('should send and reply', function(done) {
    inSession.on('channel', function server(chan) {
      chan.on('request', function(req) {
        req.reply(req.data);
      });
    });

    client(done);
  });

  it('should support late channel rande-vouz', function(done) {
    client(done);

    inSession.on('channel', function server(chan) {
      chan.on('request', function(req) {
        req.reply(req.data);
      });
    });
  });

  it('should support a simpler setup', function(done) {
    inSession = inBuilder(function server(chan) {
      chan.on('request', function(req) {
        req.reply(req.data);
      });
    });

    outSession = outBuilder(inSession);

    client(done);
  });
};
