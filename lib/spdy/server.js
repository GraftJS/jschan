
'use strict';

var EventEmitter  = require('events').EventEmitter;
var util          = require('util');
var xtend         = require('xtend');
var spdy          = require('spdy');
var Transform     = require('readable-stream').Transform;
var msgpack       = require('msgpack5');
var defaults      = {
  host: 'localhost'
};

function ServerChannel(session, req, res) {

  Transform.call(this, { objectMode: true, highWaterMark: 16 });

  this._session = session;
  this._req = req;
  this._res = res;

  req.pipe(this);

  req.on('error', this.emit.bind(this, 'error'));

  req.on('end', function() {
    res.end();
  });
}

util.inherits(ServerChannel, Transform);

ServerChannel.prototype._transform = function transform(buf, enc, done) {
  var decoded = this._session.encoder.decode(buf);
  this.push(decoded);
  done();
};

function ServerSession(opts, newChannel) {
  if (!(this instanceof ServerSession)) {
    return new ServerSession(opts, newChannel);
  }

  opts = xtend(defaults, opts);

  this.opts = opts;
  this.host = opts.host;
  this.port = opts.port;

  this.encoder = msgpack();

  this._refCounter = 0;
  this._refs = {};

  if (newChannel) {
    this.on('channel', newChannel);
  }

  var that = this;

  this._server = spdy.createServer(opts, function(req, res) {
    var ref = req.headers['libchan-ref'];
    var chan;

    if (!ref) {
      chan = new ServerChannel(that, req, res);
      that.emit('channel', chan);
    } else if (that._refs[ref]) {
      chan = that._refs[ref];
      throw new Error('not implemented yet');
    } else {
      // there is no channel
      res.statusCode = 400;
      res.end();

      return;
    }
  });

  this._server.listen(opts.port || 0);

  that.port = that._server.address().port;
}

util.inherits(ServerSession, EventEmitter);

ServerSession.prototype.close = function close(cb) {
  this._server.close(cb);
  return this;
};

module.exports = ServerSession;
