
'use strict';

var EventEmitter  = require('events').EventEmitter;
var channels      = require('./channels');
var inherits      = require('inherits');
var through       = require('through2');
var ReadChannel   = channels.ReadChannel;
var WriteChannel  = channels.WriteChannel;
var ByteStream    = channels.ByteStream;
var encoder       = require('../encoder');
var PassThrough   = require('readable-stream').PassThrough;
var async         = require('async');

function StreamSession(inStream, outStream, opts, server) {
  if (!(this instanceof StreamSession)) {
    return new StreamSession(inStream, outStream, opts, server);
  }

  opts = opts || {};

  this._isServer = opts.server || false;

  if (opts.header === false) {
    this._haveHeaders = false;
  } else {
    this._haveHeaders = true;
  }

  this._inStream = inStream;
  this._outStream = outStream;
  this._delayedChannels = [];
  this._streams = {};
  this._nextId = this._isServer ? 0 : 1;
  this._toBeWritten = [];
  this._encoder = encoder(this, channels);

  var that = this;

  this._readPipe = inStream
    .pipe(this._encoder.decoder(opts))
    .pipe(through.obj(function(chunk, enc, done) {
      if (chunk.id === undefined) {
        that.emit('error', new Error('wrong message format, missing id'));
        return;
      }

      var count = EventEmitter.listenerCount(that, 'channel');
      var stream = that._streams[chunk.id];

      if (!stream && !chunk.parent) {
        stream = new ReadChannel(that, chunk.id);
        that._streams[stream.id] = stream;

        stream.on('close', function() {
          delete that._streams[stream.id];
        });

        if (count > 0 ) {
          that.emit('channel', stream);
        } else {
          that._delayedChannels.push(stream);
        }
      }

      if (!stream) {
        // we need to queue data
        stream = new PassThrough({
          objectMode: true,
          highWaterMark: 16
        });
        stream.id = chunk.id;
        that._streams[stream.id] = stream;
      }

      if (stream.dispatch) {
        stream.dispatch(chunk.data, done);
      } else if (chunk.data) {
        stream.write(chunk.data, null, done);
      } else {
        stream.end();
        done();
      }
    }));

  this.on('newListener', function(event, listener) {
    var chan;
    if (event === 'channel') {
      while ((chan = this._delayedChannels.pop())) {
        listener(chan);
      }
    }
  });

  this._encoder.on('channel', function(chan) {
    if (that._streams[chan.id]) {
      that._streams[chan.id].pipe(chan, { end: false });
    }
    that._streams[chan.id] = chan;
  });

  if (server) {
    this.on('channel', server);
  }

  this._inStream.on('error', this.emit.bind(this, 'error'));
  if (this._inStream !== this._outStream) {
    this._outStream.on('error', this.emit.bind(this, 'error'));
  }

  var count = 2;
  function complete() {
    /*jshint validthis:true */
    this.removeListener('finish', complete);
    this.removeListener('end', complete);
    this.removeListener('close', complete);
    if (--count === 0) {
      that._closing = false;
      that._closed = true;
      that.emit('close');
    }
  }

  that._inStream.on('end', complete);
  that._outStream.on('finish', complete);
  that._inStream.on('close', complete);
  that._outStream.on('close', complete);
}

inherits(StreamSession, EventEmitter);

function createChannel(session, Type, parent) {
  var chan  = new Type(session, session._nextId);

  if (parent) {
    chan.parentId = parent.id;
  }

  session._nextId += 2;
  session._streams[chan.id] = chan;

  chan.on('close', function() {
    delete session._streams[chan.id];
  });
  return chan;
}

StreamSession.prototype._createWriteChannel = function(parent) {
  return createChannel(this, WriteChannel, parent);
};
StreamSession.prototype._createReadChannel  = function(parent) {
  return createChannel(this, ReadChannel, parent);
};

StreamSession.prototype._createByteStream = function(parent) {
  return createChannel(this, ByteStream, parent);
};

StreamSession.prototype.WriteChannel = function WriteChannel() {
  return this._createWriteChannel();
};

StreamSession.prototype._dispatch = function dispatch(obj, chan, done) {
  if (this._closing) {
    if (done) {
      // we are closing everything anyway
      done();
    }
    return this;
  }

  try {
    var encoded = this._encoder.encode(obj, chan).slice(0);

    // header logic copied from msgpack5.encoder
    if (this._haveHeaders) {
      var header  = new Buffer(4);
      header.writeUInt32BE(encoded.length, 0);
      this._outStream.write(header);
    }

    if (this._outStream.write.length === 2 ) {
      this._outStream.write(encoded, done);
    } else {
      this._outStream.write(encoded);
      done();
    }
  } catch(err) {
    done();
    // swallow any closing error
    this.emit('error', err);
  }

  return this;
};

StreamSession.prototype.close = function close(done) {
  if (this._closing) {
    return done && this.on('close', done) || this;
  } else if (this._closed) {
    return done && done() || this;
  }

  var that = this;

  if (done) {
    this.on('close', done);
  }

  that._closing = true;

  async.forEach(Object.keys(this._streams), function(id, cb) {
    that._streams[id].forceClose(function() {
      cb();
    });
  }, function() {
    if (that._inStream.destroy) {
      that._inStream.destroy();
    } else if (that._inStream.end) {
      that._inStream.end();
    } else if (done) {
      done(new Error('unable to close inStream'));
    } else {
      throw new Error('unable to close inStream');
    }

    if (that._outStream.destroy) {
      that._outStream.destroy();
    } else if (that._outStream.end) {
      that._outStream.end();
    } else if (done) {
      done(new Error('unable to close outStream'));
    } else {
      throw new Error('unable to close outStream');
    }

    // consume all awaiting messages
    try {
      that._inStream.resume();
    } catch(err) {}

    try {
      that._outStream.resume();
    } catch(err) {}
  });


  return this;
};

module.exports = StreamSession;
