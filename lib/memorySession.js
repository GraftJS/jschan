
'use strict';

var EventEmitter  = require('events').EventEmitter;
var util          = require('util');
var Transform     = require('readable-stream').Transform;
var PassThrough   = require('readable-stream').PassThrough;
var duplexer      = require('reduplexer');

function MemoryChannel(session) {
  Transform.call(this, { objectMode: true, highWaterMark: 16 });

  this._session = session;
}

util.inherits(MemoryChannel, Transform);

MemoryChannel.prototype.createReadChannel = function() {
  return new MemoryChannel(this._session);
};

MemoryChannel.prototype.createWriteChannel = function() {
  return new MemoryChannel(this._session);
};

MemoryChannel.prototype.createBinaryStream = function() {
  var inStream  = new PassThrough();
  var outStream = new PassThrough();
  var id        = ++this._session._nextId;
  var result    = duplexer(inStream, outStream);
  var other     = duplexer(outStream, inStream);

  result._libchanRef = id;
  this._session._streams[id] = other;

  return result;
};

function traverse(session, obj) {
  if (typeof obj !== 'object') {
    return;
  }

  for (var key in obj) {
    if (obj[key] && obj.hasOwnProperty(key)) {
      if (obj[key]._libchanRef) {
        obj[key] = session._streams[obj[key]._libchanRef];
      } else if (obj[key] instanceof MemoryChannel) {
        // no recursion
        traverse(session, obj[key]);
      }
    }
  }
}

MemoryChannel.prototype._transform = function(obj, enc, done) {
  traverse(this._session, obj);
  this.push(obj);
  done();
};

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

util.inherits(MemorySession, EventEmitter);

MemorySession.prototype.createWriteChannel = function createWriteChannel() {
  var chan  = new MemoryChannel(this);
  var count = EventEmitter.listenerCount(this, 'channel');

  if (count > 0) {
    this.emit('channel', chan);
  } else {
    this._delayedChannels.push(chan);
  }

  return chan;
};

module.exports = MemorySession;
