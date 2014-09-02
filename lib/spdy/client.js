
'use strict';

var EventEmitter  = require('events').EventEmitter;
var inherits      = require('inherits');
var spdy          = require('spdy');
var http          = require('http');
var async         = require('async');
var channels      = require('./channels');
var ReadChannel   = channels.ReadChannel;
var WriteChannel  = channels.WriteChannel;
var ByteStream    = channels.ByteStream;
var encoder       = require('../encoder');

function ClientSession(opts) {
  if (!(this instanceof ClientSession)) {
    return new ClientSession(opts);
  }

  opts = opts || {};

  if (opts.rejectUnauthorized !== true) {
    opts.rejectUnauthorized = false;
  }

  this.opts = opts;

  this.encoder = encoder(this, channels);

  opts.spdy = opts.spdy || {};
  opts.spdy.maxChunk = Math.pow(2, 53);

  this.agent = spdy.createAgent(opts);

  this._nextId = 1;
  this._channels = {};
  this._awayting = {};

  var that = this;

  this.agent.on('error', function(err) {
    // if we force close an agent, some broken connection might occur
    if (err.code === 'ECONNRESET' && (that._closing || that._closed)) {
      return;
    }
    that.emit('error', err);
  });
  this.encoder.on('error', this.emit.bind(this, 'error'));

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
      res.statusCode = 500;
      res.end();
      that.emit('error', new Error('Unknown request coming from the server'));
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

inherits(ClientSession, EventEmitter);

ClientSession.prototype._createNewStream = function newStream(chan, parentId) {
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
};

ClientSession.prototype._createWriteChannel = function(parent) {
  return createChannel(this, WriteChannel, parent.id);
};

ClientSession.prototype.WriteChannel = function() {
  return createChannel(this, WriteChannel, '0');
};

ClientSession.prototype._createByteStream = function() {
  // duplex streams have no parents
  return createChannel(this, ByteStream, '');
};

ClientSession.prototype.close = function close(done) {
  if (this._closing) {
    return done && this.on('close', done) || this;
  } else if (this._closed) {
    return done && done() || this;
  }

  this._closing = true;
  var agent = this.agent;
  var that  = this;

  async.eachSeries(Object.keys(this._channels), function(id, cb) {
    var channel = that._channels[id];
    channel.forceClose(cb);
  }, function(err) {
    if (err && done) {
      done(err);
    } else if (err) {
      that.emit('error', err);
    }
    agent.close(function(err) {
      if (done) {
        done(err);
      } else if (err) {
        that.emit('error', err);
      }
      that.emit('close');
      that._closed = true;
      that._closing = false;
    });
  });

  return this;
};

module.exports = ClientSession;
