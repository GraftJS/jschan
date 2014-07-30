#! /usr/bin/env node

'use strict';

var usage = process.argv[0] + ' ' + process.argv[1] + ' command <args..>';

if (!process.argv[2]) {
  console.log(usage);
  process.exit(1);
}

var jschan = require('../../');
var session = jschan.spdyClientSession({
  host: 'localhost',
  port: 9323,
  rejectUnauthorized: false
});
var sender = session.createWriteChannel();

var cmd = {
  Args: process.argv.slice(3),
  Cmd: process.argv[2],
  StatusChan: sender.createReadChannel(),
  Stderr: sender.createByteStream(),
  Stdout: sender.createByteStream(),
  Stdin:  sender.createByteStream()
};

sender.write(cmd);

process.stdin.pipe(cmd.Stdin);

cmd.Stdout.pipe(process.stdout);

cmd.Stderr.pipe(process.stderr);

cmd.StatusChan.on('data', function(data) {
  sender.end();
  setImmediate(function() {
    console.log('ended with status', data.Status);
    process.exit(data.Status);
  });
});
