'use strict';

var jschan = require('../../');
var childProcess = require('child_process');
var server = jschan.spdyServer();
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
