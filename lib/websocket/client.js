
'use strict';

var websocket = require('websocket-stream');
var jschan    = require('../jschan');

function client(url) {
  if (typeof url === 'object') {
    url = 'ws://' + (url.host || 'localhost') + ':' + (url.port || '80');
  }

  var ws = websocket(url);
  var session = jschan.streamSession(ws, ws, { header: false });

  return session;
}

module.exports = client;
