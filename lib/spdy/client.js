
'use strict';

var EventEmitter  = require('events').EventEmitter;
var util          = require('util');
var spdy          = require('spdy');
var http          = require('http');
var msgpack       = require('msgpack5');
var Transform     = require('readable-stream').Transform;
var async         = require('async');

function ClientChannel(session) {
  if (!(this instanceof ClientChannel)) {
    return new ClientChannel(this);
  }

  Transform.call(this, { objectMode: true, highWaterMark: 16 });

  this._session = session;

  this._session.channels.push(this);

  var that = this;

  var req = this._session._createNewStream(this, false, function(res) {
    res.resume(); // nothing to do with the response
    res.on('end', function() {
      that.emit('close');
    });
  });

  // TODO fix error handling, there is a case (counterpart down)
  // where I don't known where to catch - @mcollina
  req.on('error', this.emit.bind(this, 'error'));

  this.pipe(req);
}

util.inherits(ClientChannel, Transform);

ClientChannel.prototype._transform = function transform(obj, enc, done) {
  var encoded = this._session.encoder.encode(obj);
  this.push(encoded.slice(0, encoded.length));
  done();
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
}

util.inherits(ClientSession, EventEmitter);

ClientSession.prototype.createWriteChannel = ClientChannel;

ClientSession.prototype._createNewStream = function newStream(channel, addId, cb) {
  var id;
  var headers = {};

  if (addId) {
    id = this._nextId++;
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

  req.id = id;

  // needed to avoid nasty node-spdy issue
  // with chunked encoding
  // TODO submit issue
  req.useChunkedEncodingByDefault = false;

  return req;
};

ClientSession.prototype.close = function close(done) {
  var agent = this.agent;

  async.forEach(this.channels, function(channel, cb) {
    channel.end();
    channel.on('close', cb);
  }, function() {
    agent.close(done);
  });

  return this;
};

module.exports = ClientSession;
