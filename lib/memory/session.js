
'use strict';

var EventEmitter        = require('events').EventEmitter;
var inherits            = require('inherits');
var duplexer            = require('reduplexer');
var MemoryWriteChannel  = require('./channel');
var PassThrough         = require('readable-stream').PassThrough;

function MemorySession(server) {
  if (!(this instanceof MemorySession)) {
    return new MemorySession(server);
  }

  this._delayedChannels = [];
  this._streams = {};
  this._nextId = 0;

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

inherits(MemorySession, EventEmitter);

MemorySession.prototype._createWriteChannel = function() {
  var chan  = new MemoryWriteChannel(this, this._nextId++);
  this._streams[chan.id] = chan;
  chan.on('error', this.emit.bind(this, 'error'));
  return chan;
};

MemorySession.prototype._createReadChannel  = function() {
  return this._createWriteChannel().pair;
};

MemorySession.prototype._createByteStream = function() {
  var inStream  = new PassThrough();
  var outStream = new PassThrough();
  var id        = ++this._nextId;
  var result    = duplexer(inStream, outStream);
  var other     = duplexer(outStream, inStream);

  result._libchanRef = id;
  this._streams[id] = other;

  return result;
};

MemorySession.prototype.WriteChannel = function WriteChannel() {
  var count = EventEmitter.listenerCount(this, 'channel');
  var chan  = this._createWriteChannel();

  if (count > 0) {
    this.emit('channel', chan.pair);
  } else {
    this._delayedChannels.push(chan.pair);
  }

  return chan;
};

MemorySession.prototype.close = function close(cb) {
  if (cb) {
    this.once('close', cb);
  }
  this.emit('close');
  return this;
};

MemorySession.prototype.forceClose = MemorySession.prototype.close;

module.exports = MemorySession;
