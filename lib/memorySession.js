
'use strict';

var EventEmitter  = require('events').EventEmitter;
var util          = require('util');
var Message       = require('./message');

function MemoryChannel() {
  this._delayedMessages = [];

  this.on('newListener', function(event, listener) {
    var msg;
    if (event === 'request') {
      while ((msg = this._delayedMessages.pop())) {
        listener(msg);
      }
    }
  });
}

util.inherits(MemoryChannel, EventEmitter);

MemoryChannel.prototype.send = function send(msg) {
  msg._channel = this;

  var count = EventEmitter.listenerCount(this, 'request');

  if (count > 0) {
    this.emit('request', msg);
  } else {
    this._delayedMessages.push(msg);
  }

  return this;
};

MemoryChannel.prototype.reply = function reply(orig, data) {
  var msg = new Message(data);

  orig.emit('response', msg);

  return this;
};

function MemorySession(server) {
  if (!(this instanceof MemorySession)) {
    return new MemorySession(server);
  }

  this._delayedChannels = [];

  this.on('newListener', function(event, listener) {
    var chan;
    if (event === 'channel') {
      while ((chan = this._delayedChannels.pop())) {
        listener(chan);
      }
    }
  });

  if (server) {
    this.on('channel', server);
  }
}

util.inherits(MemorySession, EventEmitter);

MemorySession.prototype.sendChannel = function sendChannel() {
  var chan  = new MemoryChannel();
  var count = EventEmitter.listenerCount(this, 'channel');

  if (count > 0) {
    this.emit('channel', chan);
  } else {
    this._delayedChannels.push(chan);
  }

  return chan;
};

MemorySession.prototype.close = function close(cb) {
  if (cb) {
    cb(null);
  }
};

module.exports = MemorySession;
