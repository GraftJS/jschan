
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

  var re = null;

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
        if (obj[key]._readableState.objectMode && obj[key]._readableState.pipesCount > 0) {
          // so this is ReadChannel
          re = session._createWriteChannel();
          re.pair.pipe(obj[key]);
          obj[key] = re;
        } else if (obj[key]._writableState.objectMode) {
          // so this is a WriteChannel
          re = session._createWriteChannel();
          obj[key].pipe(re);
          obj[key] = re.pair;
        } else {
          throw new Error('unable to auto-serialize a Transform stream not in object mode');
        }
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
