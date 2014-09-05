
'use strict';

var Channel       = require('../channels').Channel;
var WriteChannel  = require('../channels').WriteChannel;
var ReadChannel   = require('../channels').ReadChannel;
var inherits      = require('inherits');
var EventEmitter  = require('events').EventEmitter;

function MemoryReadChannel(session, id) {
  ReadChannel.call(this, session, id);
}

inherits(MemoryReadChannel, ReadChannel);

function MemoryWriteChannel(session, id) {
  WriteChannel.call(this, session, id);

  this.pair = new MemoryReadChannel(session, id);
  this.pair.pair = this;
  this.pipe(this.pair);
}

inherits(MemoryWriteChannel, WriteChannel);

function traverse(session, obj) {
  if (typeof obj !== 'object') {
    return;
  }

  for (var key in obj) {
    if (obj[key] && obj.hasOwnProperty(key)) {
      if (obj[key]._libchanRef) {
        obj[key] = session._streams[obj[key]._libchanRef];
      } else if (obj[key] instanceof MemoryWriteChannel && obj[key]._session === session) {
        obj[key] = obj[key].pair;
      } else if (obj[key] instanceof MemoryReadChannel && obj[key]._session === session) {
        obj[key] = obj[key].pair;
      } else if (!(obj[key] instanceof Channel) && !(obj[key] instanceof EventEmitter)) {
        // no recursion for channels and streams
        traverse(session, obj[key]);
      }

      if (!(obj[key] instanceof Channel) && obj[key]._transform) {
        throw new Error('unable to auto-serialize a Transform stream');
      }
    }
  }
}

MemoryWriteChannel.prototype._transform = function(obj, enc, done) {
  try {
    traverse(this._session, obj);
    this.push(obj);
  } catch(err) {
    this.emit('error', err);
  }
  done();
};

module.exports = MemoryWriteChannel;
