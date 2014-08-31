# jschan&nbsp;&nbsp;[![Build Status](https://travis-ci.org/GraftJS/jschan.png)](https://travis-ci.org/GraftJS/jschan)

__jschan__ is a JavaScript port of docker/libchan based around node streams

## Status

The jschan API should be stable at this point, but libchan is a developing standard and there may be breaking changes in future.  

When used over the standard SPDY transport, jschan is compatible with the current Go reference implementation.  

We also have a websocket transport to allow us to run jschan on the browser. This feature is not covered by the spec, and is not compatible with other implementations.  


## Install

```bash
npm install jschan --save
```

## Example

This example exposes a service over SPDY.
It is built to be interoperable with the original libchan version
[rexec](https://github.com/dmcgowan/libchan/tree/rexec_tls_support/examples/rexec).

### Server

The server opens up a jschan server to accept new sessions, and then
execute the requests that comes through the channel.

```js
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
```

### Client

```js
'use strict';

var usage = process.argv[0] + ' ' + process.argv[1] + ' command <args..>';

if (!process.argv[2]) {
  console.log(usage)
  process.exit(1)
}

var jschan = require('jschan');
var session = jschan.spdyClientSession({ port: 9323 });
var sender = session.createWriteChannel();

var cmd = {
  Args: process.argv.slice(3),
  Cmd: process.argv[2],
  StatusChan: sender.createReadChannel(),
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
})
```

<a name="api"></a>
## API

  * <a href="#session">Session Interface</a>
  * <a href="#sessionCreateWriteChannel"><code>session.<b>createWriteChannel()</b></code></a>
  * <a href="#channel">Channel Interface</a>
  * <a href="#channelCreateReadChannel"><code>channel.<b>createReadChannel()</b></code></a>
  * <a href="#channelCreateWriteChannel"><code>channel.<b>createWriteChannel()</b></code></a>
  * <a href="#channelCreateWriteChannel"><code>channel.<b>createBinaryStream()</b></code></a>
  * <a href="#memorySession"><code>jschan.<b>memorySession()</b></code></a>
  * <a href="#streamSession"><code>jschan.<b>streamSession()</b></code></a>
  * <a href="#spdyClientSession"><code>jschan.<b>spdyClientSession()</b></code></a>
  * <a href="#spdyServer"><code>jschan.<b>spdyServer()</b></code></a>
  * <a href="#websocketClientSession"><code>jschan.<b>websocketClientSession()</b></code></a>
  * <a href="#websocketServer"><code>jschan.<b>websocketServer()</b></code></a>

-------------------------------------------------------
<a name="session"></a>
### Session Interface

A session identifies an exchange of channels between two parties: an
initiator and a recipient. Top-level channels can only be created by the
initiator in 'write' mode, with
<a href="#sessionCreateWriteChannel"><code>createWriteChannel()</code></a>.


Channels are unidirectional, but they can be nested (more on that
later).

<a name="session.createWriteChannel"></a>
#### session.createWriteChannel()

Creates a Channel in 'write mode', e.g. a `streams.Writable`.
The channel follows the interface defined in
<a href="#channel">Channel Interface</a>. The stream is in `objectMode`
with an `highWaterMark` of 16.

#### Event: 'channel'

`function (channel) { }`

Emitted each time there is a new Channel. The channel will __always__ be
a Readable stream.

-------------------------------------------------------
<a name="channel"></a>
### Channel Interface

A Channel is a Stream and can be a `Readable` or `Writable` depending on
which side of the communication you are. A Channel is __never__ a
duplex.

In order to send messages through a Channel, you can use standards
streams methods. Moreover, you can nest channels by including them
in a message, like so:

```js
var chan = session.createWriteChannel();
var ret  = chan.createReadChannel();

ret.on('data', function(res) {
  console.log('response', res);
});

chan.write({ returnChannel: ret });
```

<a name="channel.createReadChannel"></a>
#### channel.createReadChannel()

Returns a nested read channel, this channel will wait for data from the
other party.

<a name="channel.createWriteChannel"></a>
#### channel.createWriteChannel()

Returns a nested write channel, this channel will buffer data up until
is received by the other party. It fully respect backpressure.

<a name="channel.createBinaryStream"></a>
### channel.createBinaryStream()

Returns a nested duplex binary stream. It fully respect backpressure.

-------------------------------------------------------
<a name="memorySession"></a>
### jschan.memorySession()

Returns a session that works only through the current node process
memory.

This is an examples that uses the in memory session:

```js
'use strict';

var jschan  = require('jschan');
var session = jschan.memorySession();
var assert  = require('assert');

session.on('channel', function server(chan) {
  // chan is a Readable stream
  chan.on('data', function(msg) {
    var returnChannel  = msg.returnChannel;

    returnChannel.write({ hello: 'world' });
  });
});

function client() {
  // chan is a Writable stream
  var chan = session.createWriteChannel();
  var ret  = chan.createReadChannel();
  var called = false;

  ret.on('data', function(res) {
    called = true;
    console.log('response', res);
  });

  chan.write({ returnChannel: ret });

  setTimeout(function() {
    assert(called, 'no response');
  }, 200);
}

client();
```

-------------------------------------------------------
<a name="streamSession"></a>
### jschan.streamSession(readable, writable, opts)

Returns a session that works over any pair of readable and
writable streams. This session encodes all messages in msgpack,
and sends them over. It can work on top of TCP, websocket or
other transports.

_`streamSession` is not compatible with libchan._

Supported options:

- `header`: `true` or `false` (default true), specifies if
  we want to prefix every msgPack message with its length.
  This is not needed if the underlining streams have their own
  framing.
- `server`: `true` or `false` (default false), specifies if
  this is the server component or the client component.

-------------------------------------------------------
<a name="spdyClientSession"></a>
### jschan.spdyClientSession(options)

Creates a new SPDY client session, it supports the same options of
[`spdy.Agent`](https://github.com/indutny/node-spdy).
This session can only be used to create new top-level write channels.

The only option that have a different default than `spdy.Agent` is
`rejectUnauthorized` which defaults to `false` to support ease of usage.

-------------------------------------------------------
<a name="spdyServer"></a>
### jschan.spdyServer(options)

Creates a new SPDY server, it supports the same options of
[spdy.createServer](https://github.com/indutny/node-spdy).
It also return a SPDY server, which is configured to emit the `'session'`
event when a new [`Session`](#session) is started.

If the certificate needed by SPDY is not passed through, a new
key pair is created on the fly using
[self-signed](http://npm.im/self-signed).

-------------------------------------------------------
<a name="websocketClientSession"></a>
### jschan.websocketClientSession(url)

Creates a new websocket session. The url can be in the form
'ws://localhost' or passes as an object.
It is based on [`streamSession`](#streamSession).

_`websocketClientSession` is not compatible with libchan._

This method can also work in the browser thanks to
[Browserify](http://npm.im/browserify).

Example:

```js
var jschan  = require('jschan');
var session = jschan.websocketClientSession('ws://localhost:3000');
var chan    = session.createWriteChannel();
var ret     = chan.createReadChannel();

ret.on('data', function(res) {
  console.log(res);
  session.close();
});

chan.end({
  hello:'world',
  returnChannel: ret
});
```

-------------------------------------------------------
<a name="websocketServer"></a>
### jschan.websocketServer(options)

Creates a new websocketServer, or attach the websocket handler to the
passed-through `httpServer` object.
It is based on [`streamSession`](#streamSession).

_`websocketServer` is not compatible with libchan._

If a new http server is created, remeber to call listen, like so:

```js

'use strict';

var jschan = require('jschan');
var server = jschan.websocketServer();

function handleMsg(msg) {
  var stream = msg.returnChannel;
  delete msg.returnChannel;
  stream.end(msg);
}

function handleChannel(chan) {
  chan.on('data', handleMsg);
}

function handleSession(session) {
  session.on('channel', handleChannel);
}

server.on('session', handleSession);

server.listen(3000);
```

## About LibChan

It's most unique characteristic is that it replicates the semantics of go channels across network connections, while allowing for nested channels to be transferred in messages. This would let you to do things like attach a reference to a remote file on an HTTP response, that could be opened on the client side for reading or writing.

The protocol uses SPDY as it's default transport with MSGPACK as it's default serialization format. Both are able to be switched out, with http1+websockets and protobuf fallbacks planned.
SPDY is encrypted over TLS by default.

While the RequestResponse pattern is the primary focus, Asynchronous Message Passing is still possible, due to the low level nature of the protocol.

![Graft](https://rawgit.com/GraftJS/graft.io/master/static/images/graft_logo.svg)

The Graft project is formed to explore the possibilities of a web where servers and clients are able to communicate freely through a microservices architecture.

> "instead of pretending everything is a local function even over the network (which turned out to be a bad idea), what if we did it the other way around? Pretend your components are communicating over a network even when they aren't."
> [Solomon Hykes](http://github.com/shykes) (of Docker fame) on LibChan - [[link]](https://news.ycombinator.com/item?id=7874317)

[Find out more about Graft](https://github.com/GraftJS/graft)

## Contributors

* [Adrian Rossouw](http://github.com/Vertice)
* [Peter Elgers](https://github.com/pelger)
* [Matteo Collina](https://github.com/mcollina)

## License

MIT
