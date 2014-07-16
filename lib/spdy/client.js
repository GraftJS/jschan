
'use strict';

var EventEmitter  = require('events').EventEmitter;
var util          = require('util');
var spdy          = require('spdy');
var xtend         = require('xtend');
var http          = require('http');
var msgpack       = require('msgpack');
var Message       = require('../message');
var defaults      = {
  host: 'localhost',
  port: 1443
};

function ClientChannel(session) {
  if (!(this instanceof ClientChannel)) {
    return new ClientChannel(this);
  }

  this._session = session;
}

util.inherits(ClientChannel, EventEmitter);

ClientChannel.prototype.send = function send(msg) {
  var headers = {};
  if (msg.data) {
    headers['data']
  }

  var req = http.request({
    host: this._session.opts.host,
    port: this._session.opts.port,
    path: '/',
    method: 'POST',
    agent: this._session.agent,
  }, function(res) {
    res.on('data', function(data) {
      msg
    })
    res.resume(); // nothing to do with the response
    console.log('response!!');
  });

  req.on('socket', function() {
    req.connection._msg = msg;
  });

  req.on('error', this.emit.bind(this, 'error'));

  req.end();

  // TODO fix error handling, there is a case (counterpart down)
  // where I don't known where to catch - @mcollina

  msg._req = req;

  return this;
};

function ClientSession(opts) {
  if (!(this instanceof ClientSession)) {
    return new ClientSession(opts);
  }

  opts = xtend(defaults, opts);

  this.opts = opts;

  this.agent = spdy.createAgent(opts);

  this.agent.on('error', this.emit.bind(this, 'error'));
}

util.inherits(ClientSession, EventEmitter);

ClientSession.prototype.sendChannel = ClientChannel;

ClientSession.prototype.close = function close(cb) {
  this.agent.close(cb);
  return this;
};

module.exports = ClientSession;
