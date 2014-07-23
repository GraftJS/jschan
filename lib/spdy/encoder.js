
'use strict';

var EventEmitter  = require('events').EventEmitter;
var util          = require('util');
var msgpack       = require('msgpack5');
var Channel       = require('./channel').Channel;
var ReadChannel   = require('./channel').ReadChannel;
var WriteChannel  = require('./channel').WriteChannel;

function Encoder(session) {
  if (!(this instanceof Encoder)) {
    return new Encoder(session);
  }

  this._msgpack = msgpack();

  var that = this;

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
        throw new Error('unkown direction');
    }

    that.emit('channel', chan);

    return chan;
  }

  this._msgpack.register(0x1, Channel, encodeChannel, decodeChannel);
}

util.inherits(Encoder, EventEmitter);

Encoder.prototype.encode = function encode(obj) {
  return this._msgpack.encode(obj);
};

Encoder.prototype.decode = function decode(obj) {
  return this._msgpack.decode(obj);
};

module.exports = Encoder;
