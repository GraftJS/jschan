
'use strict';

var EventEmitter  = require('events').EventEmitter;
var util          = require('util');
var spdy          = require('spdy');
var http          = require('http');
var Transform     = require('readable-stream').Transform;
var async         = require('async');
var Channel       = require('./channel').Channel;
var ReadChannel   = require('./channel').ReadChannel;
var WriteChannel  = require('./channel').WriteChannel;
var ByteStream    = require('./byteStream');
var encoder       = require('./encoder');

function ClientSession(opts) {
  if (!(this instanceof ClientSession)) {
    return new ClientSession(opts);
  }

  this.opts = opts;

  this.encoder = encoder(this);

  this.agent = spdy.createAgent(opts);

  this._nextId = 1;
  this._channels = {};
  this._awayting = {};

  this.agent.on('error', this.emit.bind(this, 'error'));
  this.encoder.on('error', this.emit.bind(this, 'error'));

  var that = this;
  this.encoder.on('channel', function (chan) {
    var id = chan.id;

    if (that._awayting[id]) {
      chan.handle(that._awayting[id].req, that._awayting[id].res);
      delete that._awayting[id];
    }

    chan.on('close', function() {
      delete that._channels[id];
    });

    that._channels[id] = chan;

    return chan;
  });

  this.agent.on('push', function() {
    // weird hack, do not remove
  });

  this.agent._spdyState.pushServer.on('request', function receive(req, res) {

    var chan;
    var id   = req.headers['libchan-ref'];

    res.useChunkedEncodingByDefault = false;

    if (!id) {
      // FIXME what should we do?
      // this should never ever happen
      res.end();
    } else if (that._channels[id]) {
      chan = that._channels[id];
      chan.handle(req, res);
    } else {
      that._awayting[id] = {
        req: req,
        res: res
      };
    }
  });
}

util.inherits(ClientSession, EventEmitter);

ClientSession.prototype._createNewStream = function newStream(chan, parentId, cb) {
  var headers = {};

  headers['libchan-ref'] = chan.id;
  headers['libchan-parent-ref'] = parentId;

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

  req._implicitHeader();
  req._send('');

  return req;
};

function createChannel(session, Klass, parent) {
  var id   = session._nextId;
  var chan = new Klass(session, id);

  session._nextId += 2;

  session._channels[id] = chan;

  chan.on('close', function() {
    delete session._channels[id];
  });

  chan.on('error', session.emit.bind(session, 'error'));

  session._createNewStream(chan, parent);

  return chan;
}

ClientSession.prototype._createReadChannel = function(parent) {
  return createChannel(this, ReadChannel, parent.id);
}

ClientSession.prototype._createWriteChannel = function(parent) {
  return createChannel(this, WriteChannel, parent.id);
};

ClientSession.prototype.createWriteChannel = function() {
  return createChannel(this, WriteChannel, '0')
};

ClientSession.prototype._createDuplexStream = function() {
  // duplex streams have no parents
  return createChannel(this, ByteStream, '');
};

ClientSession.prototype.close = function close(done) {
  var agent = this.agent;
  var that  = this;

  async.eachSeries(Object.keys(this._channels), function(id, cb) {
    var channel = that._channels[id];
    channel.forceClose(cb);
  }, function(err) {
    agent.close(done);
  });

  return this;
};

module.exports = ClientSession;
