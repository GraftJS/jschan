
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

  // write an head after opening a stream
  // means the client receives the pushed stream before
  // move it before res.push to try
  res.writeHead(200);

  res.write('hello world!');
  res.write('hello world 2!');
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
  }, function(res) {
    console.log('Received response', myid);

    res.on('data', function(data) {
      console.log(myid, '-->', data.toString())
    })

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
