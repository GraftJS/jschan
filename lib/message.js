
'use strict';

var EventEmitter  = require('events').EventEmitter;
var util          = require('util');
var assert        = require('assert');

function Message(data) {
  if (!(this instanceof Message)) {
    return new Message(data);
  }

  this.data = data;
}

util.inherits(Message, EventEmitter);

Message.prototype.reply = function reply(data) {
  assert(this._channel, 'no channel to reply to');

  this._channel.reply(this, data);

  return this;
};

module.exports = Message;
