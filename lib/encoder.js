
'use strict';

var EventEmitter  = require('events').EventEmitter;
var inherits      = require('inherits');
var msgpack       = require('msgpack5');

function encodeAsChannel(obj) {
  return obj &&
         ( obj.isReadChannel ||
           obj.isWriteChannel ||
           ( obj._readableState &&
             obj._readableState.objectMode
           ) ||
           ( obj._writableState &&
             obj._writableState.objectMode
           )
         );
}

function encodeAsByteStream(obj) {
  return obj &&
         (
           (obj._readableState && !obj._readableState.objectMode) ||
           (obj._writableState && !obj._writableState.objectMode)
         ) &&
         !(obj.isReadChannel || obj.isWriteChannel);
}

function Encoder(session, channels) {
  if (!(this instanceof Encoder)) {
    return new Encoder(session, channels);
  }

  this._msgpack     = msgpack();
  this._session     = session;

  var that          = this;
  var ReadChannel   = channels.ReadChannel;
  var WriteChannel  = channels.WriteChannel;
  var ByteStream    = channels.ByteStream;

  function encodeChannel(chan) {
    chan = that._rewriteChannel(chan);

    // hack, let's just use 4 bytes
    var buf = new Buffer(6);
    var pos = 0;

    // the channel type is 0x1
    buf.writeUInt8(0x1, pos++);

    if (chan.isReadChannel) {
      // let's encode is as outbound
      buf.writeUInt8(0x2, pos++);
    } else if (chan.isWriteChannel) {
      // let's encode is as inbound
      buf.writeUInt8(0x1, pos++);
    }

    buf.writeUInt32BE(chan.id, pos++);

    return buf;
  }

  function decodeChannel(buf) {
    var id = buf.readUInt32BE(1);
    var chan;

    switch (buf.readUInt8(0)) {
      case 0x01:
        chan  = new ReadChannel(session, id);
        break;
      case 0x02:
        chan  = new WriteChannel(session, id);
        break;
      default:
        return that.emit('error', new Error('unkown direction'));
    }

    that.emit('channel', chan);

    return chan;
  }

  function encodeByteStream(stream) {
    stream = that._rewriteStream(stream);

    // hack, let's just use 4 bytes
    var buf = new Buffer(5);
    buf.writeUInt8(0x2, 0);
    buf.writeUInt32BE(stream.id, 1);

    return buf;
  }

  function decodeByteStream(buf) {
    var id = buf.readUInt32BE(0);
    var stream = new ByteStream(session, id);
    that.emit('channel', stream);

    return stream;
  }

  this._msgpack.registerEncoder(encodeAsChannel, encodeChannel);
  this._msgpack.registerDecoder(0x1, decodeChannel);

  this._msgpack.registerEncoder(encodeAsByteStream, encodeByteStream);
  this._msgpack.registerDecoder(0x2, decodeByteStream);
}

inherits(Encoder, EventEmitter);

Encoder.prototype.encode = function encode(obj, channel) {
  this.encodingChannel = channel;
  return this._msgpack.encode(obj);
};

Encoder.prototype.decode = function decode(obj) {
  return this._msgpack.decode(obj);
};

Encoder.prototype.decoder = function (opts) {
  return this._msgpack.decoder(opts);
};

var transformErrorString = 'unable to auto-serialize a Transform stream not in object mode';

Encoder.prototype._rewriteChannel = function rewriteChannel(chan) {
  var newChan;

  if (chan._session === this._session) {
    return chan;
  }

  // auto fix transform streams into channels
  if (!chan.isReadChannel && !chan.isWriteChannel && chan._transform) {
    if (chan._readableState.objectMode && chan._readableState.pipesCount > 0) {
      // so this should be mapped to a WriteChannel
      chan.isWriteChannel = true;
    } else if (chan._writableState.objectMode) {
      // so this should be mapped to a ReadChannel
      chan.isReadChannel = true;
    } else {
      throw new Error(transformErrorString);
    }
  }

  if (!chan.isReadChannel && !chan.isWriteChannel) {
    if (chan._readableState && chan._readableState.objectMode) {
      // so this should be mapped to a ReadChannel
      chan.isReadChannel = true;
    } else if (chan._writableState.objectMode) {
      // so this should be mapped to a WriteChannel
      chan.isWriteChannel = true;
    } else {
      throw new Error('this should not happen');
    }
  }

  if (chan.isReadChannel) {
    newChan = this.encodingChannel.WriteChannel();
    chan.pipe(newChan);
  } else if (chan.isWriteChannel) {
    newChan = this.encodingChannel.ReadChannel();
    newChan.pipe(chan);
  } else {
    throw new Error('specify readChannel or writeChannel property for streams not in the current channels');
  }

  return newChan;
};

Encoder.prototype._rewriteStream = function rewriteBinaryStream(stream) {
  if (stream._session === this._session) {
    return stream;
  }

  var byteStream = this._session._createByteStream(this.encodingChannel);

  if (stream._transform) {
    throw new Error(transformErrorString);
  }

  if (stream.readable) {
    stream.pipe(byteStream);
  }

  if (stream.writable) {
    byteStream.pipe(stream);
  }

  return byteStream;
};

module.exports = Encoder;
