
'use strict';

var EventEmitter  = require('events').EventEmitter;
var util          = require('util');
var spdy          = require('spdy');
var msgpack       = require('msgpack5');
var async         = require('async');
var Channel       = require('./channel').Channel;
var ReadChannel   = require('./channel').ReadChannel;
var WriteChannel  = require('./channel').WriteChannel;

var encodeChannel = require('./utils').buildChannelEncoder(ReadChannel, WriteChannel);

function ServerSession() {
  this.encoder = msgpack();

  this._nextId = 0;
  this._channels = {};
  this._awayting = {};

  var that = this;

  function decodeChannel(buf) {
    var id = buf.readUInt32BE(1);
    var chan;

    switch (buf.readUInt8(0)) {
      case 0x01:
        chan  = new ReadChannel(that, id);
        break;
      case 0x02:
        chan  = new WriteChannel(that, id);
        break;
      default:
        throw new Error('unkown direction');
    }

    if (that._awayting[id]) {
      chan.handle(that._awayting[id].req, that._awayting[id].res);
      delete that._awayting[id];
    }

    chan.on('close', function() {
      delete that._channels[id];
    });

    that._channels[id] = chan;

    return chan;
  }

  // we encode a Read as an outbound (0x2)
  this.encoder.register(0x1, Channel, encodeChannel, decodeChannel);

  // TODO auto close sessions when there are no more channels
}

util.inherits(ServerSession, EventEmitter);

function createChannel(session, Klass) {
  var id   = (session._nextId += 2);
  var chan = new Klass(session, id);

  session._channels[id] = chan;

  chan.on('close', function() {
    delete session._channels[id];
  });

  chan.on('error', session.emit.bind(session, 'error'));

  return chan;
}

ServerSession.prototype._createReadChannel = function() {
  return createChannel(this, ReadChannel);
};

ServerSession.prototype._createWriteChannel = function() {
  return createChannel(this, WriteChannel);
};

ServerSession.prototype._receive = function receive(req, res) {
  var chan;
  var id   = req.headers['libchan-ref'];

  if (!id) {
    chan = this._createReadChannel();
    chan.handle(req, res);
    this.emit('channel', chan);
  } else if (this._channels[id]) {
    chan = this._channels[id];
    chan.handle(req, res);
  } else {
    this._awayting[id] = {
      req: req,
      res: res
    }
  }

  return true;
};

ServerSession.prototype.close = function close(cb) {
  var that = this;

  if (cb) {
    this.on('close', cb);
  }

  async.each(Object.keys(this._channels), function(id, cb) {
    that._channels[id].forceClose(cb);
  }, function(err) {
    if (cb) {
      return cb(err);
    }

    Object.keys(that._awayting).forEach(function(id) {
      that._awayting[id].res.end()
    })

    if (err) {
      that.emit('error', err);
    }

    that.emit('close');
  });

  return this;
};

function spdyServer(opts) {
  var nextId    = 1;
  var sessions  = {};
  var server    = spdy.createServer(opts);

  server.on('connection', function(socket) {
    // creates a new ServerSession per new connection
    var session = new ServerSession();
    session.id = nextId++;
    sessions[session.id] = session;
    session.on('close', function() {
      delete sessions[session.id];
    });
    socket.session = session;
    server.emit('session', session);

  });

  server.on('request', function(req, res) {

    // this is the crappiest hack ever
    // I'm not sure if this is ever going to change in node-spdy
    var session = req.connection.socket.socket.session;

    if (!session._receive(req, res)) {
      // there is no channel
      res.statusCode = 400;
      res.end();

      return;
    }
  });


  return server;
}

module.exports = spdyServer;
