
'use strict';

var channels = require('../channels');
var inherits = require('inherits');
var Duplex   = require('readable-stream').Duplex;

module.exports = Object.create(channels);

function StreamWriteChannel(session, id) {
  if (!(this instanceof StreamWriteChannel)) {
    return new StreamWriteChannel(session, id);
  }
  channels.WriteChannel.call(this, session, id);

  this._firstChunk = true;
}

inherits(StreamWriteChannel, channels.WriteChannel);

function dispatchData(obj, enc, done) {
  /*jshint validthis:true */
  var msg = {
    id: this.id,
    data: obj
  };

  if (this._firstChunk) {
    msg.parent = this.parentId || null;
    this._firstChunk = false;
  }

  this._session._dispatch(msg, done);
}

StreamWriteChannel.prototype._transform = dispatchData;

StreamWriteChannel.prototype._flush = function(done) {
  this._session._dispatch({
    id: this.id
  }, done);
};

module.exports.WriteChannel = StreamWriteChannel;

function ByteStream(session, id) {
  if (!(this instanceof ByteStream)) {
    return new ByteStream(session, id);
  }

  this._session = session;
  this.id = id;

  this._lastDone = null;

  Duplex.call(this);

  this.on('finish', function() {
    session._dispatch({
      id: id
    });
  });
}

inherits(ByteStream, Duplex);

ByteStream.prototype._read = function() {
  var done = this._lastDone;
  if (done) {
    this._lastDone = null;
    done();
  }
  return null;
};

ByteStream.prototype._write = dispatchData;

ByteStream.prototype.dispatch = function(chunk, done) {
  var keepOn = this.push(chunk || null);

  if (keepOn) {
    done();
  } else {
    this._lastDone = done;
  }
};

ByteStream.prototype.forceClose = function forceClose(cb) {
  if (cb) {
    this.on('finish', cb);
  }

  this.end();
};

module.exports.ByteStream = ByteStream;
