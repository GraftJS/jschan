
'use strict';

var EventEmitter  = require('events').EventEmitter;
var util          = require('util');
var PassThrough   = require('readable-stream').PassThrough;

function MemoryChannel() {
  PassThrough.call(this, { objectMode: true });
}

util.inherits(MemoryChannel, PassThrough);

MemoryChannel.prototype.createReadChannel = function() {
  return new MemoryChannel();
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

module.exports = MemorySession;
