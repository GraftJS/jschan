
'use strict';

var spdy = require('spdy');
var fs = require('fs');
var http = require('http');

var options = {
  key: fs.readFileSync(__dirname + '/certificates/key.pem'),
  cert: fs.readFileSync(__dirname + '/certificates/cert.pem'),
  ca: fs.readFileSync(__dirname + '/certificates/csr.pem'),
  rejectUnauthorized: false
};

var server = spdy.createServer(options, function(req, res) {

  var stream = res.push('/hello', {});

  console.log('pushing', stream._spdyState.id);

  stream.write('hello world');

  res.writeHead(200);
  res.end('hello world!');


});

var agent = spdy.createAgent({
  host: 'localhost',
  port: 1443,
  rejectUnauthorized: false
});

agent.on('push', function(stream) {
  console.log('push received!', stream.connection._spdyState.id);

  console.log('parent', stream.connection._spdyState.associated);
});

function startConn() {

  var req = http.request({
    host: 'localhost',
    method: 'GET',
    agent: agent,
    path: '/'
  }, function(response) {
    console.log('Received stream', response.connection._spdyState.id);

    console.log('----');

    // And once we're done - we may close TCP connection to server
    // NOTE: All non-closed requests will die!
    // agent.close();
  });

  req.on('socket', function() {
    console.log('sending', req.connection._spdyState.id);
  });

  req.end();
}

server.listen(1443, function() {
  console.log('server started');

  startConn();
  startConn();
});
