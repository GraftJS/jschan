
'use strict';

var EventEmitter  = require('events').EventEmitter;
var util          = require('util');
var spdy          = require('spdy');
var Transform     = require('readable-stream').Transform;
var msgpack       = require('msgpack5');
var async         = require('async');


function ServerChannel(session, id) {
  Transform.call(this, { objectMode: true, highWaterMark: 16 });

  this._session = session;
  this._id = id;
}

util.inherits(ServerChannel, Transform);

function ServerReadChannel(session, id) {
  ServerChannel.call(this, session, id);

  this.on('end', function() {
    this._res.end();
    this.emit('close');
  });
}

util.inherits(ServerReadChannel, ServerChannel);

ServerReadChannel.prototype._transform = function transform(buf, enc, done) {
  var decoded = this._session.encoder.decode(buf);
  this.push(decoded);
  done();
};

ServerReadChannel.prototype._handle = function handle(req, res) {
  this._req = req;
  this._res = res;

  req.pipe(this);

  req.on('error', this.emit.bind(this, 'error'));
};

ServerReadChannel.prototype._forceClose = function forceClose(cb) {
  this._res.end();
  if (cb) {
    this.on('close', cb);
  }
};

function ServerWriteChannel(session, id) {
  ServerChannel.call(this, session, id);

  this.on('end', function() {
    this.emit('close');
  });
}

util.inherits(ServerWriteChannel, ServerChannel);

ServerWriteChannel.prototype._transform = function transform(buf, enc, done) {
  var encoded = this._session.encoder.encode(buf);
  this.push(encoded.slice(0, encoded.length));
  done();
};

ServerWriteChannel.prototype._handle = function handle(req, res) {
  this._req = req;
  this._res = res;

  this.pipe(res);

  req.on('error', this.emit.bind(this, 'error'));
  res.on('error', this.emit.bind(this, 'error'));
};

ServerWriteChannel.prototype._forceClose = function forceClose(cb) {
  if (cb) {
    this.on('close', cb);
  }
  this.end();
};

function ServerSession() {
  this.encoder = msgpack();

  this._nextId = 0;
  this._channels = {};
  this._awayting = {};

  var that = this;

  function encodeChannel(chan) {
    throw new Error('not implemented yet')
  }

  function decodeChannel(buf) {
    var id = buf.readUInt32BE(1);
    var chan;

    switch (buf.readUInt8(0)) {
      case 0x01:
        chan  = new ServerReadChannel(that, id);
        break;
      case 0x02:
        chan  = new ServerWriteChannel(that, id);
        break;
      default:
        throw new Error('unkown direction');
    }

    if (that._awayting[id]) {
      chan._handle(that._awayting[id].req, that._awayting[id].res);
      delete that._awayting[id];
    }

    chan.on('close', function() {
      delete that._channels[id];
    });

    that._channels[id] = chan;

    return chan;
  }

  // we encode a Read as an outbound (0x2)
  this.encoder.register(0x1, ServerChannel, encodeChannel, decodeChannel);

  // TODO auto close sessions when there are no more channels
}

util.inherits(ServerSession, EventEmitter);

function newChannel(session, id) {
  var chan = new ServerReadChannel(session);

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
    id = (this._nextId += 2);
    chan = newChannel(this, id);
    chan._handle(req, res);
    this.emit('channel', chan);
  } else if (this._channels[id]) {
    chan = this._channels[id];
    chan._handle(req, res);
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
    that._channels[id]._forceClose(cb);
  }, function(err) {
    if (cb) {
      return cb(err);
    }

    Object.keys(that._awayting).forEach(function(id) {
      that._awayting[id].res.end()
    })

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
      // there is no channel
      res.statusCode = 400;
      res.end();

      return;
    }
  });


  return server;
}

module.exports = spdyServer;
