
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

server.on('session', function(session) {
  session.on('channel', function(channel)  {
    channel.on('data', function(req) {
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
      })
    });
  })
});
