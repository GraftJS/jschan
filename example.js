
'use strict';

var jschan  = require('./');
var session = jschan.memorySession();
var assert  = require('assert');

session.on('channel', function server(chan) {
  chan.on('data', function(msg) {
    var returnChannel  = msg.returnChannel;

    returnChannel.write({ hello: 'world' });
  });
});

function client() {
  var chan = session.createWriteChannel();
  var ret  = chan.createReadChannel();
  var called = false;

  ret.on('data', function(res) {
    called = true;
    console.log('response', res);
  });

  chan.write({ returnChannel: ret });

  setTimeout(function() {
    assert(called, 'no response');
  }, 200);
}

client();
