
'use strict';

if (!process.browser) {
  // this is a browser test
  return;
}

var jschan = require('../lib/jschan');
var expect = require('must');

describe('websocket client on browserify', function() {
  var session;

  beforeEach(function() {
    session = jschan.websocketClientSession('ws://localhost:8080');
  });

  afterEach(function(done) {
    if (!session) {
      return done();
    }

    session.close(done);
  });

  it('should work with an echo server', function(done) {
    var chan   = session.WriteChannel();
    var ret    = chan.ReadChannel();

    ret.on('data', function(res) {
      expect(res).to.eql({ hello: 'world' });
      done();
    });

    chan.end({
      hello:'world',
      returnChannel: ret
    });
  });
});
