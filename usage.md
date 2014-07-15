Example usage (to be ported to js)

Here's an example implementing basic RPC-style request/response. We gloss over error handling to tersely demonstrate the core concepts.

On the client:

    var ch libchan.Sender

    // Send a message, indicate that we want a return channel to be automatically created
    ret1, err := ch.Send(&libchan.Message{Data: []byte("request 1!"), Ret: libchan.RetPipe})

    // Send another message on the same channel
    ret2, err := ch.Send(&libchan.Message{Data: []byte("request 2!"), Ret: libchan.RetPipe})

    // Wait for an answer from the first request.  Set flags to zero
    // to indicate we don't want a nested return channel.
    msg, err := ret1.Receive(0)


On the server:

    var ch libchan.Receiver

    // Wait for messages in a loop
    // Set the return channel flag to indicate that we
    // want to receive nested channels (if any).
    // Note: we don't send a nested return channel, but we could.
    for {
        msg, err := ch.Receive(libchan.Ret)
        msg.Ret.Send(&libchan.Message{Data: []byte("this is an extremely useful response")});
    }

__Note__ The API is proposed to change in https://github.com/docker/libchan/pull/38.

## @mcollina proposal

```js

var jschan  = require('jschan');
var session = jschan.memorySession();

session.on('channel', function server(chan) {
  chan.on('request', function(req) {
    req.reply(req.data)
  })
})


function client() {
  var chan = session.sendChannel();
  var msg  = jschan.msg({ hello: 'world' });

  msg.on('response', function(res) {
    console.log('response', res.data);
  });

  chan.send(msg);
}

client();
```
