
'use strict';

var EventEmitter  = require('events').EventEmitter;
var util          = require('util');
var spdy          = require('spdy');
var http          = require('http');
var msgpack       = require('msgpack5');
var Transform     = require('readable-stream').Transform;
var async         = require('async');
var Channel       = require('./channel').Channel;
var ReadChannel   = require('./channel').ReadChannel;
var WriteChannel  = require('./channel').WriteChannel;

var encodeChannel = require('./utils').buildChannelEncoder(ReadChannel, WriteChannel);

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

  function decodeChannel() {
    throw new Error('not implemented yet');
  }

  this.encoder.register(0x1, Channel, encodeChannel, decodeChannel);
}

util.inherits(ClientSession, EventEmitter);

ClientSession.prototype._createNewStream = function newStream(channel, chan, skipId, cb) {
  var headers = {};

  if (!skipId) {
    headers = {
      'libchan-ref': chan.id
    };
  }

  var req = http.request({
    host: this.opts.host,
    port: this.opts.port,
    path: '/',
    headers: headers,
    method: 'POST',
    agent: this.agent
  }, function(res) {
    chan.handleIn(res);
  });

  // needed to avoid nasty node-spdy issue
  // with chunked encoding
  // TODO submit issue
  req.useChunkedEncodingByDefault = false;

  chan.handleOut(req);

  return req;
};

function createChannel(session, Klass) {
  var id   = (session._nextId += 2);
  var chan = new Klass(session, id);

  session.channels.push(chan);

  chan.on('close', function() {
    var i;

    for (i = 0; i < session.channels.length; i++) {
      if (session.channels[i] === chan) {
        session.channels.splice(i, 1);
        i--;
      }
    }
  });

  chan.on('error', session.emit.bind(session, 'error'));

  return chan;
}

ClientSession.prototype._createReadChannel = function() {
  var chan  = createChannel(this, ReadChannel);
  this._createNewStream(this, chan, false)
  return chan;
}

ClientSession.prototype._createWriteChannel = function(topLevel) {
  var chan  = createChannel(this, WriteChannel);
  this._createNewStream(this, chan, topLevel);
  return chan;
};

ClientSession.prototype.createWriteChannel = function() {
  return this._createWriteChannel(true)
};

ClientSession.prototype.close = function close(done) {
  var agent = this.agent;

  async.forEach(this.channels, function(channel, cb) {
    channel.forceClose(cb);
  }, function(err) {
    agent.close(done);
  });

  return this;
};

module.exports = ClientSession;
