
'use strict';

var inherits  = require('inherits');
var Transform = require('readable-stream').Transform;
var Duplexer  = require('reduplexer');

function Channel(session, id) {
  Transform.call(this, { objectMode: true, highWaterMark: 16 });

  this._session = session;
  this.id = id;
}

inherits(Channel, Transform);

Channel.prototype.WriteChannel = function() {
  return this._session._createWriteChannel(this);
};

Channel.prototype.ReadChannel = function() {
  return this._session._createReadChannel(this);
};

Channel.prototype.ByteStream = function() {
  return this._session._createByteStream(this);
};

function ReadChannel(session, id) {
  Channel.call(this, session, id);

  this._finished = false;

  this.on('end', function() {
    this._finished = true;
    this.emit('close');
  });
}

inherits(ReadChannel, Channel);

ReadChannel.prototype._transform = function transform(buf, enc, done) {
  this.push(buf); // we are just passing through
  done();
};

ReadChannel.prototype.forceClose = function forceClose(cb) {
  if (cb && !this._finished) {
    this.on('end', cb);
  } else if (cb) {
    cb();
  }

  this.end();
};

ReadChannel.prototype.isReadChannel = true;
ReadChannel.prototype.isWriteChannel = false;

function WriteChannel(session, id) {
  Channel.call(this, session, id);

  this._finished = false;

  this.on('finish', function() {
    this._finished = true;
    this.emit('close');
  });
}

inherits(WriteChannel, Channel);

WriteChannel.prototype._transform = function transform(buf, enc, done) {
  this.push(buf);
  done();
};

WriteChannel.prototype.forceClose = function forceClose(cb) {
  if (cb && !this._finished) {
    this.on('finish', cb);
  } else if (cb) {
    cb();
  }
  this.end();
};

WriteChannel.prototype.isWriteChannel = true;
WriteChannel.prototype.isReadChannel = false;

function ByteStream(session, id) {
  if (!(this instanceof ByteStream)) {
    return new ByteStream(session, id);
  }

  this._session = session;
  this.id = id;

  Duplexer.call(this);

  this.on('finish', function() {
    this.removeAllListeners('error');
    this.on('error', function() {});
    this.emit('close');
  });
}

inherits(ByteStream, Duplexer);

ByteStream.prototype.forceClose = function forceClose(cb) {
  if (cb) {
    this.on('finish', cb);
  }

  this.end();
};

module.exports.Channel = Channel;
module.exports.WriteChannel = WriteChannel;
module.exports.ReadChannel = ReadChannel;
module.exports.ByteStream = ByteStream;
