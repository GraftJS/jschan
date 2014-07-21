# jsChan

__jsChan__ is a Node.js port for docker/libchan based around node streams

__Warning: This project is still in the very early stages of development, and not production ready yet__

## Install

```bash
npm install jschan --save
```

## Example

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

<a name="api"></a>
## API

  * <a href="#session">Session Interface</a>
  * <a href="#channel">Channel Interface</a>
  * <a href="#memorySession"><code>jschan.<b>memorySession()</b></code></a>
  * <a href="#sessionCreateWriteChannel"><code>session.<b>createWriteChannel()</b></code></a>
  * <a href="#channelCreateReadChannel"><code>channel.<b>createReadChannel()</b></code></a>
  * <a href="#channelCreateWriteChannel"><code>channel.<b>createWriteChannel()</b></code></a>
  * <a href="#channelCreateWriteChannel"><code>channel.<b>createBinaryStream()</b></code></a>

-------------------------------------------------------
<a name="session"></a>
### Session Interface

-------------------------------------------------------
<a name="channel"></a>
### Channel Interface

-------------------------------------------------------
<a name="memorySession"></a>
### jschan.memorySession()

-------------------------------------------------------
<a name="session.createWriteChannel"></a>
### session.createWriteChannel()

-------------------------------------------------------
<a name="channel.createReadChannel"></a>
### channel.createReadChannel()

-------------------------------------------------------
<a name="channel.createWriteChannel"></a>
### channel.createWriteChannel()

-------------------------------------------------------
<a name="channel.createBinaryStream"></a>
### channel.createBinaryStream()

## About LibChan

It's most unique characteristic is that it replicates the semantics of go channels across network connections, while allowing for nested channels to be transferred in messages. This would let you to do things like attach a reference to a remote file on an HTTP response, that could be opened on the client side for reading or writing.

The protocol uses SPDY as it's default transport with MSGPACK as it's default serialization format. Both are able to be switched out, with http1+websockets and protobuf fallbacks planned.

While the RequestResponse pattern is the primary focus, Asynchronous Message Passing is still possible, due to the low level nature of the protocol.

## About Graft

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
