
'use strict';

var jschan                = {};
module.exports            = jschan;

jschan.memorySession      = require('./memory/session');
jschan.spdyServer         = require('./spdy/server');
jschan.spdyClientSession  = require('./spdy/client');
