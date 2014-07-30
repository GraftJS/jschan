
'use strict';

var jschan = require('../../');
var childProcess = require('child_process');
var fs = require('fs');
var server = jschan.spdyServer({
  key: fs.readFileSync(__dirname + '/../../test/certificates/key.pem'),
  cert: fs.readFileSync(__dirname + '/../../test/certificates/cert.pem'),
  ca: fs.readFileSync(__dirname + '/../../test/certificates/csr.pem')
});

server.listen(9323);

function handleReq(req) {
  var child = childProcess.spawn(
    req.Cmd,
    req.Args,
    {
      stdio: [
        'pipe',
        'pipe',
        'pipe'
      ]
    }
  );

  req.Stdin.pipe(child.stdin);
  child.stdout.pipe(req.Stdout);
  child.stderr.pipe(req.Stderr);

  child.on('exit', function(status) {
    req.StatusChan.write({ Status: status });
  });
}

function handleChannel(channel) {
  channel.on('data', handleReq);
}

function handleSession(session) {
  session.on('channel', handleChannel);
}

server.on('session', handleSession);
