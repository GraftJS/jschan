
'use strict';

var Duplexer = require('reduplexer');
var util     = require('util');

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
  })
}

util.inherits(ByteStream, Duplexer)

ByteStream.prototype.handle = function handle(inStream, outStream) {
  this.handleIn(inStream);
  this.handleOut(outStream);
  return this;
};

ByteStream.prototype.handleIn   = ByteStream.prototype.hookReadable;
ByteStream.prototype.handleOut  = ByteStream.prototype.hookWritable;

ByteStream.prototype.forceClose = function forceClose(cb) {
  if (cb) {
    this.on('finish', cb);
  }

  this.end()
}

module.exports = ByteStream;
