
'use strict';

var inherits      = require('inherits');
var Channel       = require('../channels').Channel;
var ReadChannel   = require('../channels').ReadChannel;
var WriteChannel  = require('../channels').WriteChannel;
var ByteStream    = require('../channels').ByteStream;

function handle(inStream, outStream) {
  /*jshint validthis:true */
  this.handleIn(inStream);
  this.handleOut(outStream);
  return this;
}

function SPDYReadChannel(session, id) {
  ReadChannel.call(this, session, id);
}

inherits(SPDYReadChannel, ReadChannel);

SPDYReadChannel.prototype.handle = handle;

SPDYReadChannel.prototype._transform = function transform(buf, enc, done) {
  if (this.skipFirstChunk) {
    delete this.skipFirstChunk;
    return done();
  }

  var decoded = this._session.encoder.decode(buf);
  this.push(decoded);
  done();
};

SPDYReadChannel.prototype.handleIn = function handleIn(inStream) {
  this._inStream = inStream;

  this._inStream.pipe(this);

  this._inStream.on('error', this.emit.bind(this, 'error'));
};

SPDYReadChannel.prototype.handleOut = function handleOut(outStream) {
  this._outStream = outStream;

  this._outStream.on('error', this.emit.bind(this, 'error'));
};

function SPDYWriteChannel(session, id) {
  WriteChannel.call(this, session, id);
}

inherits(SPDYWriteChannel, WriteChannel);

SPDYWriteChannel.prototype.handle = handle;

SPDYWriteChannel.prototype._transform = function transform(buf, enc, done) {
  try {
    var encoded = this._session.encoder.encode(buf, this);
    this.push(encoded.slice(0, encoded.length));
  } catch(err) {
    this.emit('error', err);
  }
  done();
};

SPDYWriteChannel.prototype.handleIn = function handle(inStream) {
  this._inStream = inStream;

  // nothing to do with the input
  inStream.resume();

  inStream.on('error', this.emit.bind(this, 'error'));

  this.on('finish', function() {
    // skip all errors
    inStream.removeAllListeners('error');
    inStream.on('error', function() {});
  });
};

SPDYWriteChannel.prototype.handleOut = function handle(outStream) {
  this._outStream = outStream;
  this.pipe(outStream);

  outStream.on('error', this.emit.bind(this, 'error'));

  this.on('finish', function() {
    // skip all errors
    outStream.removeAllListeners('error');
    outStream.on('error', function() {});
  });
};

function SPDYByteStream(session, id) {
  ByteStream.call(this, session, id);
}

inherits(SPDYByteStream, ByteStream);

SPDYByteStream.prototype.handle     = handle;
SPDYByteStream.prototype.handleIn   = ByteStream.prototype.hookReadable;
SPDYByteStream.prototype.handleOut  = ByteStream.prototype.hookWritable;

module.exports = {
  Channel: Channel,
  ReadChannel: SPDYReadChannel,
  WriteChannel: SPDYWriteChannel,
  ByteStream: SPDYByteStream
};
