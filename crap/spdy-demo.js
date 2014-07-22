
'use strict';

var spdy = require('spdy');
var fs = require('fs');
var https = require('https');
var Writable = require('readable-stream').Writable;

var options = {
  key: fs.readFileSync(__dirname + '/../test/certificates/key.pem'),
  cert: fs.readFileSync(__dirname + '/../test/certificates/cert.pem'),
  ca: fs.readFileSync(__dirname + '/../test/certificates/csr.pem'),
  rejectUnauthorized: false
};

var server = spdy.createServer(options);

server.on('request', function(req, res) {
  console.log(req.connection.socket.socket.setted);

  var w = new Writable();

  w._write = function write(buf, enc, done) {
    console.log(buf.toString());
    done();
  };

  req.pipe(w);

  var stream = res.push('/hello', {});

  // write an head after opening a stream
  // means the client receives the pushed stream before
  // move it before res.push to try
  res.writeHead(200);

  res.end('hello world!');
  stream.write('hello world');
});

server.on('connection', function(socket) {
  console.log('muahhaa');
  socket.setted = 'aaa';
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

  var req = https.request({
    host: 'localhost',
    method: 'POST',
    agent: agent,
    path: '/'
  }, function() {
    console.log('Received response', myid);

    // And once we're done - we may close TCP connection to server
    // NOTE: All non-closed requests will die!
    // agent.close();
  });

  req.useChunkedEncodingByDefault = false;

  req.on('socket', function() {
    req.connection.myid = myid;
  });

  req.write(new Buffer('aaaa'));
  req.write(new Buffer('bbb'));
  req.end();
}


server.listen(1443, function() {
  console.log('server started');

  startConn('a');
  startConn('b');
});
