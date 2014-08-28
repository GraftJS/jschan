
'use strict';

var WriteChannel  = require('../channels').WriteChannel;
var inherits      = require('inherits');

function MemoryChannel(session, id) {
  WriteChannel.call(this, session, id);
}

inherits(MemoryChannel, WriteChannel);

function traverse(session, obj) {
  if (typeof obj !== 'object') {
    return;
  }

  for (var key in obj) {
    if (obj[key] && obj.hasOwnProperty(key)) {
      if (obj[key]._libchanRef) {
        obj[key] = session._streams[obj[key]._libchanRef];
      } else if (!(obj[key] instanceof MemoryChannel)) {
        // no recursion
        traverse(session, obj[key]);
      }
    } else if (key === '_transform') {
      throw new Error('unable to auto-serialize a Transform stream');
    }
  }
}

MemoryChannel.prototype._transform = function(obj, enc, done) {
  try {
    traverse(this._session, obj);
    this.push(obj);
  } catch(err) {
    this.emit('error', err);
  }
  done();
};

module.exports = MemoryChannel;
