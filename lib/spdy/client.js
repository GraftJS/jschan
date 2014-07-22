
'use strict';

var EventEmitter  = require('events').EventEmitter;
var util          = require('util');
var spdy          = require('spdy');
var http          = require('http');
var msgpack       = require('msgpack5');
var Transform     = require('readable-stream').Transform;
var async         = require('async');

function ClientChannel(session, id) {
  Transform.call(this, { objectMode: true, highWaterMark: 16 });

  this._session = session;
  this.id = id;

  this._session.channels.push(this);
}

util.inherits(ClientChannel, Transform);

function ClientWriteChannel(session, id) {
  if (!(this instanceof ClientWriteChannel)) {
    return new ClientWriteChannel(this, id);
  }

  ClientChannel.call(this, session, id);

  var that = this;

  var req = this._session._createNewStream(this, id, function(res) {
    res.resume(); // nothing to do with the response
    res.on('end', function() {
      that.emit('close');
    });

    // TODO fix error handling, there is a case (counterpart down)
    // where I don't known where to catch - @mcollina
    res.on('error', that.emit.bind(that, 'error'));
  });

  // TODO fix error handling, there is a case (counterpart down)
  // where I don't known where to catch - @mcollina
  req.on('error', this.emit.bind(this, 'error'));

  this.pipe(req);
}

util.inherits(ClientWriteChannel, ClientChannel);

ClientWriteChannel.prototype._forceClose = function(cb) {
  this.end()
  if (cb) {
    this.on('close', cb);
  }
};

ClientWriteChannel.prototype._transform = function transform(obj, enc, done) {
  var encoded = this._session.encoder.encode(obj);
  this.push(encoded.slice(0, encoded.length));
  done();
};

function ClientReadChannel(session, id) {
  if (!(this instanceof ClientReadChannel)) {
    return new ClientReadChannel(session, id);
  }

  ClientChannel.call(this, session, id);

  var that = this;

  var req = this._session._createNewStream(this, id, function(res) {
    res.pipe(that);

    that._res = res;

    // TODO fix error handling, there is a case (counterpart down)
    // where I don't known where to catch - @mcollina
    res.on('error', that.emit.bind(that, 'error'));
  });

  // TODO fix error handling, there is a case (counterpart down)
  // where I don't known where to catch - @mcollina
  req.on('error', this.emit.bind(this, 'error'));

  req.end();
}

util.inherits(ClientReadChannel, ClientChannel);

ClientReadChannel.prototype._forceClose = function(cb) {
  this._res.destroy();
  if (cb) {
    this.on('close', cb);
  }
  this.emit('close');
};

ClientReadChannel.prototype._transform = function transform(buf, enc, done) {
  var decoded = this._session.encoder.decode(buf);
  this.push(decoded);
  done();
};

ClientChannel.prototype.createReadChannel = function() {
  var id    = (this._session._nextId += 2);

  return new ClientReadChannel(this._session, id);
};

ClientChannel.prototype.createWriteChannel = function() {
  var id    = (this._session._nextId += 2);

  return new ClientWriteChannel(this._session, id);
};

function ClientSession(opts) {
  if (!(this instanceof ClientSession)) {
    return new ClientSession(opts);
  }

  this.opts = opts;

  this.encoder = msgpack();

  this.agent = spdy.createAgent(opts);

  this._nextId = 1;
  this._streams = {};

  this.agent.on('error', this.emit.bind(this, 'error'));

  this.channels = [];

  function encodeChannel(chan) {
    // hack, let's just use 4 bytes
    var buf = new Buffer(5);
    if (chan instanceof ClientReadChannel) {
      // let's encode is as outbound
      buf[0] = 0x2;
    } else if (chan instanceof ClientWriteChannel) {
      // let's encode is as inbound
      buf[0] = 0x1;
    }
    buf.writeUInt32BE(chan.id, 1);
    return buf;
  }

  function decodeChannel() {
    throw new Error('not implemented yet');
  }

  this.encoder.register(0x1, ClientChannel, encodeChannel, decodeChannel);
}

util.inherits(ClientSession, EventEmitter);

ClientSession.prototype.createWriteChannel = ClientWriteChannel;

ClientSession.prototype._createNewStream = function newStream(channel, id, cb) {
  var headers = {};

  if (id) {
    headers = {
      'libchan-ref': id
    };
  }

  var req = http.request({
    host: this.opts.host,
    port: this.opts.port,
    path: '/',
    headers: headers,
    method: 'POST',
    agent: this.agent
  }, cb);

  // needed to avoid nasty node-spdy issue
  // with chunked encoding
  // TODO submit issue
  req.useChunkedEncodingByDefault = false;

  return req;
};

ClientSession.prototype.close = function close(done) {
  var agent = this.agent;

  async.forEach(this.channels, function(channel, cb) {
    channel._forceClose(cb);
  }, function() {
    agent.close(done);
  });

  return this;
};

module.exports = ClientSession;
