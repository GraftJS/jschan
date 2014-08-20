
'use strict';

var jschan = require('../../lib/jschan.js');
var server = jschan.websocketServer();

function handleMsg(msg) {
  var stream = msg.returnChannel;
  delete msg.returnChannel;
  stream.end(msg);
}

function handleChannel(chan) {
  chan.on('data', handleMsg);
}

function handleSession(session) {
  session.on('channel', handleChannel);
}

server.on('session', handleSession);

if (process.env.ZUUL_PORT) {
  server.listen(process.env.ZUUL_PORT);
}
