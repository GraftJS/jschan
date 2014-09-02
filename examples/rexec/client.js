#! /usr/bin/env node

'use strict';

var usage = process.argv[0] + ' ' + process.argv[1] + ' command <args..>';

if (!process.argv[2]) {
  console.log(usage);
  process.exit(1);
}

var jschan = require('../../');
var session = jschan.spdyClientSession({ port: 9323 });

var sender = session.WriteChannel();

var cmd = {
  Args: process.argv.slice(3),
  Cmd: process.argv[2],
  StatusChan: sender.ReadChannel(),
  Stderr: process.stderr,
  Stdout: process.stdout,
  Stdin: process.stdin
};

sender.write(cmd);

cmd.StatusChan.on('data', function(data) {
  sender.end();
  setTimeout(function() {
    console.log('ended with status', data.Status);
    process.exit(data.Status);
  }, 500);
});
