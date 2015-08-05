
'use strict';

var jschan                    = {};
module.exports                = jschan;

jschan.memorySession          = require('./memory/session');
jschan.streamSession          = require('./stream/session');
