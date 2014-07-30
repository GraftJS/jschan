
'use strict';

var EventEmitter  = require('events').EventEmitter;
var util          = require('util');
var spdy          = require('spdy');
var async         = require('async');
var Channel       = require('./channel').Channel;
var ReadChannel   = require('./channel').ReadChannel;
var WriteChannel  = require('./channel').WriteChannel;
var ByteStream    = require('./byteStream');
var encoder       = require('./encoder');

function ServerSession() {
  this.encoder = encoder(this);

  this._nextId = 0;
  this._channels = {};
  this._awayting = {};

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
}

util.inherits(ServerSession, EventEmitter);

function pushStream(parent, chan) {
  // parent._outStream is our response
  var pusher = parent._outStream;

  pusher.push('/', {
    'libchan-parent-ref': parent.id,
    'libchan-ref': chan.id
  }, function(err, stream) {
    if (err) {
      return chan.emit('error', err);
    }

    // the first chunk contains the HTTP headers
    // let's just skip it
    // FIXME is it sound??
    chan.skipFirstChunk = true;

    chan.handle(stream, stream);
  });
}

function createChannel(session, Klass, parent) {
  var id   = (session._nextId += 2);
  var chan = new Klass(session, id);

  session._channels[id] = chan;

  chan.on('close', function() {
    delete session._channels[id];
  });

  chan.on('error', session.emit.bind(session, 'error'));

  if (parent) {
    pushStream(parent, chan);
  }

  return chan;
}

ServerSession.prototype._createReadChannel = function(parent) {
  return createChannel(this, ReadChannel, parent);
};

ServerSession.prototype._createWriteChannel = function(parent) {
  return createChannel(this, WriteChannel, parent);
};

ServerSession.prototype._createDuplexStream = function(parent) {
  return createChannel(this, ByteStream, parent);
};

ServerSession.prototype._receive = function receive(req, res) {
  var chan;
  var id      = req.headers['libchan-ref'];
  var parent  = req.headers['libchan-parent-ref'];

  if (parent === '0') {
    chan = this._createReadChannel();
    this._channels[id] = chan;
    chan.handle(req, res);
    this.emit('channel', chan);
  } else if (this._channels[id]) {
    chan.parent = this._channels[parent];
    chan = this._channels[id];
    chan.handle(req, res);
  } else {
    this._awayting[id] = {
      req: req,
      res: res
    }
  }

  res._implicitHeader();
  res._send('');
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
    session._receive(req, res)
  });


  return server;
}

module.exports = spdyServer;
