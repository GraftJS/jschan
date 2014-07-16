
'use strict';

var spdy = require('spdy');
var fs = require('fs');
var http = require('http');

var options = {
  key: fs.readFileSync(__dirname + '/../test/certificates/key.pem'),
  cert: fs.readFileSync(__dirname + '/../test/certificates/cert.pem'),
  ca: fs.readFileSync(__dirname + '/../test/certificates/csr.pem'),
  rejectUnauthorized: false
};

var server = spdy.createServer(options, function(req, res) {

  var stream = res.push('/hello', {});

  // write an head after opening a stream
  // means the client receives the pushed stream before
  // move it before res.push to try
  res.writeHead(200);

  res.end('hello world!');
  stream.write('hello world');
});

var agent = spdy.createAgent({
  host: 'localhost',
  port: 1443,
  rejectUnauthorized: false
});

agent.on('push', function(stream) {
  console.log('Push received from parent request', stream.connection.associated.myid);
});

function startConn(myid) {

  var req = http.request({
    host: 'localhost',
    method: 'GET',
    agent: agent,
    path: '/'
  }, function() {
    console.log('Received response', myid);

    // And once we're done - we may close TCP connection to server
    // NOTE: All non-closed requests will die!
    // agent.close();
  });

  req.on('socket', function() {
    req.connection.myid = myid;
  });

  req.end();
}

server.listen(1443, function() {
  console.log('server started');

  startConn('a');
  startConn('b');
});
