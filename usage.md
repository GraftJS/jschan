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

## @mcollina proposal

```js

var jschan = require('jschan');

var chan = jschan.memChan();

// High level API, probably for Seneca-like frameworks
chan.send({ hello: 'world' }, function(err, res, stream) {
  if (stream) {
    console.log('we have streams!');
  }
  console.log(res);
});

chan.receive(function(req, done) {

  var stream = new stream.PassThrough();

  done(null, req, stream);
});

// streams API

var msg = jschan.msg({ hello: 'world' });

var Writable = require('streams').Writable;

console.log(msg.data); // prints { hello: 'world' }

chan.write(msg);

msg.on('response', function(res) {

  if (res.stream) {
    console.log('we have streams!');
  }

  console.log(res.data);
});

var dest = new Writable({ objectMode: true });

dest._write = function(msg, enc, done) {

  var stream = new stream.PassThrough();
  msg.reply(msg.data, // echo
            stream);

  done();
};

chan.pipe(dest);
```


