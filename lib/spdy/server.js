
'use strict';

var EventEmitter  = require('events').EventEmitter;
var util          = require('util');
var spdy          = require('spdy');
var Transform     = require('readable-stream').Transform;
var msgpack       = require('msgpack5');
var async         = require('async');

function ServerChannel(session) {
  Transform.call(this, { objectMode: true, highWaterMark: 16 });
  this._session = session;

  var that = this;

  this.on('end', function() {
    this._res.end();
    that.emit('close');
  });
}

util.inherits(ServerChannel, Transform);

ServerChannel.prototype._transform = function transform(buf, enc, done) {
  var decoded = this._session.encoder.decode(buf);
  this.push(decoded);
  done();
};

ServerChannel.prototype._handle = function handle(req, res) {
  this._req = req;
  this._res = res;

  req.pipe(this);

  req.on('error', this.emit.bind(this, 'error'));
};

ServerChannel.prototype._forceClose = function forceClose(cb) {
  this._res.end();
  if (cb) {
    this.on('close', cb);
  }
};

function ServerSession() {
  this.encoder = msgpack();

  this._refCounter = 0;
  this._channels = {};


  // TODO auto close sessions when there are no more channels
}

util.inherits(ServerSession, EventEmitter);

function newChannel(session, id) {
  var chan = new ServerChannel(session);

  session._channels[id] = chan;

  chan.on('close', function() {
    delete session._channels[id];
  });

  chan.on('error', session.emit.bind(session, 'error'));

  return chan;
}

ServerSession.prototype._receive = function receive(req, res) {
  var chan;
  var id   = req.headers['libchan-ref'];

  if (!id) {
    id = 'i' + this._refCounter++;

    chan = newChannel(this, id);

    chan._handle(req, res);

    this.emit('channel', chan);
  } else {
    throw new Error('not implemented yet');
  }
};

ServerSession.prototype.close = function close(cb) {
  var that = this;

  async.each(Object.keys(this._channels), function(id, cb) {
    that._channels[id]._forceClose(cb);
  }, function(err) {
    if (cb) {
      return cb(err);
    }

    that.emit('error', err);
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
    } else {
      // there is no channel
      res.statusCode = 400;
      res.end();

      return;
    }
  });


  return server;
}

module.exports = spdyServer;
