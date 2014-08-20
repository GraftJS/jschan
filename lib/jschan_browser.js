
'use strict';

// weird hack to work on browserify
// here we have a strange dependency loop
require('stream');
require('readable-stream');

var jschan                    = {};
module.exports                = jschan;

jschan.memorySession          = require('./memory/session');
jschan.streamSession          = require('./stream/session');
jschan.websocketClientSession = require('./websocket/client');
