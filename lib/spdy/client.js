
'use strict';

var EventEmitter  = require('events').EventEmitter;
var util          = require('util');
var spdy          = require('spdy');
var xtend         = require('xtend');
var http          = require('http');
var msgpack       = require('msgpack5');
var Transform     = require('readable-stream').Transform;
var async         = require('async');
var defaults      = {
  host: 'localhost',
  port: 1443
};

function ClientChannel(session) {
  if (!(this instanceof ClientChannel)) {
    return new ClientChannel(this);
  }

  Transform.call(this, { objectMode: true, highWaterMark: 16 });

  this._session = session;

  this._session.channels.push(this);

  var that = this;

  var req = http.request({
    host: this._session.opts.host,
    port: this._session.opts.port,
    path: '/',
    method: 'POST',
    agent: this._session.agent,
  }, function(res) {
    res.resume(); // nothing to do with the response
    res.on('end', function() {
      that.emit('close');
    });
  });

  // needed to avoid nasty node-spdy issue
  // with chunked encoding
  // TODO submit issue
  req.useChunkedEncodingByDefault = false;

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

  opts = xtend(defaults, opts);

  this.opts = opts;

  this.encoder = msgpack();

  this.agent = spdy.createAgent(opts);

  this.agent.on('error', this.emit.bind(this, 'error'));

  this.channels = [];
}

util.inherits(ClientSession, EventEmitter);

ClientSession.prototype.createWriteChannel = ClientChannel;

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
