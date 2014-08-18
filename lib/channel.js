
'use strict';

var util          = require('util');
var Transform     = require('readable-stream').Transform;

function Channel(session, id) {
  Transform.call(this, { objectMode: true, highWaterMark: 16 });

  this._session = session;
  this.id = id;
}

util.inherits(Channel, Transform);

Channel.prototype.createWriteChannel = function() {
  return this._session._createWriteChannel(this);
};

Channel.prototype.createReadChannel = function() {
  return this._session._createReadChannel(this);
};

Channel.prototype.createByteStream = function() {
  return this._session._createByteStream(this);
};

function ReadChannel(session, id) {
  Channel.call(this, session, id);

  this.on('end', function() {
    this.emit('close');
  });
}

util.inherits(ReadChannel, Channel);

ReadChannel.prototype._transform = function transform(buf, enc, done) {
  this.push(buf); // we are just passing through
  done();
};

ReadChannel.prototype.forceClose = function forceClose(cb) {
  if (cb) {
    this.on('close', cb);
  }
  this.end();
};

function WriteChannel(session, id) {
  Channel.call(this, session, id);

  this._finished = false;

  this.on('finish', function() {
    this._finished = true;
  });
}

util.inherits(WriteChannel, Channel);

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

module.exports.Channel = Channel;
module.exports.WriteChannel = WriteChannel;
module.exports.ReadChannel = ReadChannel;
