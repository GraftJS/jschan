
'use strict';

var jschan          = require('../');
var abstractSession = require('./abstract_session');

describe('memory session', function() {
  abstractSession(jschan.memorySession, function(session) {
    return session;
  });
});
