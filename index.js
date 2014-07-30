
'use strict';

var jschan                = {};
module.exports            = jschan;

jschan.memorySession      = require('./lib/memorySession');
jschan.spdyServer         = require('./lib/spdy/server');
jschan.spdyClientSession  = require('./lib/spdy/client');
