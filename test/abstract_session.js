
'use strict';

var expect = require('must');

module.exports = function abstractSession(inBuilder, outBuilder) {

  var inSession;
  var outSession;

  beforeEach(function() {
    inSession = inBuilder();
    outSession = outBuilder(inSession);
  });

  function client(done) {
    var chan   = outSession.sendChannel();
    var ret    = chan.createReadChannel();

    ret.on('data', function(res) {
      expect(res).to.eql({ hello: 'world' });
      done();
    });

    chan.write({
      hello:'world',
      returnChannel: ret
    });
  }

  function reply(msg) {
    var stream = msg.returnChannel;
    delete msg.returnChannel;
    stream.write(msg);
  }

  it('should send and reply', function(done) {
    inSession.on('channel', function server(chan) {
      chan.on('data', reply);
    });

    client(done);
  });

  it('should support late channel rande-vouz', function(done) {
    client(done);

    inSession.on('channel', function server(chan) {
      chan.on('data', reply);
    });
  });

  it('should support a simpler setup', function(done) {
    inSession = inBuilder(function server(chan) {
      chan.on('data', reply);
    });

    outSession = outBuilder(inSession);

    client(done);
  });
};
