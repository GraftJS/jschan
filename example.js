
'use strict';

var jschan  = require('./');
var session = jschan.memorySession();
var assert  = require('assert');

session.on('channel', function server(chan) {
  chan.on('request', function(req) {
    req.reply(req.data);
  });
});


function client() {
  var chan   = session.sendChannel();
  var msg    = jschan.msg({ hello: 'world' });
  var called = false;

  msg.on('response', function(res) {
    called = true;
    console.log('response', res.data);
  });

  chan.send(msg);

  setTimeout(function() {
    assert(called, 'no response');
  }, 200);
}

client();
