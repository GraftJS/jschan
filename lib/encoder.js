
'use strict';

var EventEmitter  = require('events').EventEmitter;
var inherits      = require('inherits');
var msgpack       = require('msgpack5');

function Encoder(session, channels) {
  if (!(this instanceof Encoder)) {
    return new Encoder(session, channels);
  }

  this._msgpack     = msgpack();

  var that          = this;
  var Channel       = channels.Channel;
  var ReadChannel   = channels.ReadChannel;
  var WriteChannel  = channels.WriteChannel;
  var ByteStream    = channels.ByteStream;

  function encodeChannel(chan) {
    // hack, let's just use 4 bytes
    var buf = new Buffer(5);
    if (chan instanceof ReadChannel) {
      // let's encode is as outbound
      buf[0] = 0x2;
    } else if (chan instanceof WriteChannel) {
      // let's encode is as inbound
      buf[0] = 0x1;
    }

    buf.writeUInt32BE(chan.id, 1);
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
    // hack, let's just use 4 bytes
    var buf = new Buffer(4);
    buf.writeUInt32BE(stream.id, 0);
    return buf;
  }

  function decodeByteStream(buf) {
    var id = buf.readUInt32BE(0);
    var stream = new ByteStream(session, id);
    that.emit('channel', stream);

    return stream;
  }

  this._msgpack.register(0x1, Channel, encodeChannel, decodeChannel);
  this._msgpack.register(0x2, ByteStream, encodeByteStream, decodeByteStream);
}

inherits(Encoder, EventEmitter);

Encoder.prototype.encode = function encode(obj) {
  return this._msgpack.encode(obj);
};

Encoder.prototype.decode = function decode(obj) {
  return this._msgpack.decode(obj);
};

Encoder.prototype.encoder = function (opts) {
  return this._msgpack.encoder(opts);
};

Encoder.prototype.decoder = function (opts) {
  return this._msgpack.decoder(opts);
};

module.exports = Encoder;
