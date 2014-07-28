
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

Channel.prototype.createDuplexStream = function() {
  return this._session._createDuplexStream(this);
};

Channel.prototype.handle = function handle(inStream, outStream) {
  this.handleIn(inStream);
  this.handleOut(outStream);
  return this;
};

function ReadChannel(session, id) {
  Channel.call(this, session, id);

  this.on('end', function() {
    this.emit('close');
  });
}

util.inherits(ReadChannel, Channel);

ReadChannel.prototype._transform = function transform(buf, enc, done) {
  if (this.skipFirstChunk) {
    delete this.skipFirstChunk;
    return done();
  }

  //console.log('read', buf.toString('hex'), this.skipFirstChunk);

  var decoded = this._session.encoder.decode(buf);
  this.push(decoded);
  done();
};

ReadChannel.prototype.handleIn = function handleIn(inStream) {
  this._inStream = inStream;

  this._inStream.pipe(this);

  this._inStream.on('error', this.emit.bind(this, 'error'));
};

ReadChannel.prototype.handleOut = function handleOut(outStream) {
  this._outStream = outStream;

  this._outStream.on('error', this.emit.bind(this, 'error'));
};

ReadChannel.prototype.forceClose = function forceClose(cb) {
  if (cb) {
    this.on('close', cb);
  }
  this._outStream.end();
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
  var encoded = this._session.encoder.encode(buf);
  console.log('written', encoded.length);
  this.push(encoded.slice(0, encoded.length));
  done();
};

WriteChannel.prototype.handleIn = function handle(inStream) {
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

WriteChannel.prototype.handleOut = function handle(outStream) {
  this._outStream = outStream;
  this.pipe(outStream);

  outStream.on('error', this.emit.bind(this, 'error'));

  this.on('finish', function() {
    // skip all errors
    outStream.removeAllListeners('error');
    outStream.on('error', function() {});
  });
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
