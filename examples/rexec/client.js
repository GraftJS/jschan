
'use strict';

var usage = process.argv[0] + ' ' + process.argv[1] + ' command <args..>';

if (!process.argv[2]) {
  console.log(usage)
  process.exit(1)
}

var jschan = require('../../');
var session = jschan.spdyClientSession({
  host: 'localhost',
  port: 9323,
  rejectUnauthorized: false,
  spdy: {
    ssl: false
  }
});
var sender = session.createWriteChannel();

//type RemoteCommand struct {
//  Cmd        string
//  Args       []string
//  Stdin      io.Writer
//  Stdout     io.Reader
//  Stderr     io.Reader
//  StatusChan libchan.Sender
//}
//
//type CommandResponse struct {
//          Status int
//}

var cmd = {
  Args: process.argv.slice(3),
  Cmd: process.argv[2],
  StatusChan: sender.createReadChannel(),
  Stderr: sender.createDuplexStream(),
  Stdout: sender.createDuplexStream(),
  Stdin:  sender.createDuplexStream()
};

sender.write(cmd);

process.stdin.pipe(cmd.Stdin);

cmd.Stdout.pipe(process.stdout);

cmd.Stderr.pipe(process.stderr);

var status = 1;

cmd.StatusChan.on('data', function(data) {
  sender.end();
  status = data.Status;
  console.log('ended with status', status);
  setImmediate(function() {
    process.exit(status);
  });
})
