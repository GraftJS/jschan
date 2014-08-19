
'use strict';

var WebSocketServer = require('ws').Server;
var websocket       = require('websocket-stream');
var http            = require('http');
var jschan          = require('../jschan');

function server(httpServer) {

  httpServer = httpServer || http.createServer();

  var wss = new WebSocketServer({ server: httpServer });
  wss.on('connection', function(ws) {
    var stream = websocket(ws);
    var session = jschan.streamSession(stream, stream, { server: true, header: false });

    httpServer.emit('session', session);
  });

  return httpServer;
}

module.exports = server;
