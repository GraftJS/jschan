
'use strict';

var EventEmitter  = require('events').EventEmitter;
var util          = require('util');
var Message       = require('./message');

function MemoryChannel() {
}

util.inherits(MemoryChannel, EventEmitter);

MemoryChannel.prototype.send = function send(msg) {
  msg._channel = this;
  this.emit('request', msg);
  return this;
};

MemoryChannel.prototype.reply = function reply(orig, data) {
  var msg = new Message(data);

  orig.emit('response', msg);

  return this;
};

function MemorySession() {
  if (!(this instanceof MemorySession)) {
    return new MemorySession();
  }
}

util.inherits(MemorySession, EventEmitter);

MemorySession.prototype.sendChannel = function sendChannel() {
  var chan = new MemoryChannel();

  this.emit('channel', chan);

  return chan;
};

module.exports = MemorySession;
