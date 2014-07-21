
'use strict';

var EventEmitter  = require('events').EventEmitter;
var util          = require('util');
var xtend         = require('xtend');
var spdy          = require('spdy');
var defaults      = {
  host: 'localhost',
  port: 1443
};

function ServerChannel(session, ref, req, res) {
  this._session = session;
  this._ref = ref;

  this._req = req;
  this._res = res;


}

util.inherits(ServerChannel, EventEmitter);

ServerChannel.prototype._newStream = function newStream(req, res) {
  res.statusCode = 400;
  res.end();
  this.emit('error', new Error('not implemented yet'));
};

function ServerSession(opts, newChannel) {
  if (!(this instanceof ServerSession)) {
    return new ServerSession(opts, newChannel);
  }
  opts = xtend(defaults, opts);
  this.opts = opts;
  this.host = opts.host;
  this.port = opts.port;

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
      ref = that._refCounter++ + '';
      chan = new ServerChannel(this, ref, req, res);
      that._refs[ref] = chan;
      that.emit('channel', chan);
    } else if (that._refs[ref]) {
      chan = that._refs[ref];
      chan._newStream(req, res);
    } else {
      // there is no channel
      res.statusCode = 400;
      res.end();

      return;
    }
  });

  this._server.listen(opts.port);
}

util.inherits(ServerSession, EventEmitter);

ServerSession.prototype.close = function close(cb) {
  this._server.close(cb);
  return this;
};

module.exports = ServerSession;
