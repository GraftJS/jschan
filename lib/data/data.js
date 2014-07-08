/*
 * netstrings node implementation
 *
 * spec available at - http://cr.yp.to/proto/netstrings.txt
 *
 * THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESSED OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
 * STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING
 * IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

var _ = require('lodash');
var fmt = require('sprintf-js');



var encodeHeader = function encodeHeader(msgType) {
  return fmt.sprintf('%03.3d;', msgType);
};



var encodeString = function encodeString(string) {
  return fmt.sprintf('%d:%s,', string.length, string);
};



var encodeList = function encodeList(list) {
  var values = '';
  _.each(list, function(element) {
    values += encodeString(element);
  });
  return encodeString(values);
};



var encodeNamedList = function encodeNamedList(name, list) {
	return encodeString(name) + encodeList(list);
};



var encode = function encode(obj) {
  var msg = '';
  msg += encodeHeader(0);
  _.each(_.keys(obj), function(key) {
    msg += encodeNamedList(key, obj[key]);
  });
  return msg;
};



var decodeHeader = function decodeHeader(msg) {
	if (msg.length < 4) {
		return {msgtype: 0, skip: 0, err: 'message too small'};
	}
  var msgType = parseInt(msg.substring(0, 3), 10);

  if (isNaN(msgType)) {
    return {msgType: 0, skip: 0, err: 'parseInt failed'};
  }
	return {msgType: msgType, skip: 4, err: null};
};



var goesqueSplit = function(string, ch) {
  var parts = string.split(ch);
  var rest = _.rest(parts).join(':');
  return [parts[0], rest];
};



var decodeString = function decodeString(msg) {
  var parts = goesqueSplit(msg, ':');
  var length;
  var payload;

  if (parts.length !== 2) {
		return {blob: '', skip: 0, err: 'invalid format: no column'};
  }

  length = parseInt(parts[0], 10);
  if (isNaN(length)) {
		return {blob: '', skip: 0, err: 'invalid format: no column'};
  }

  if (parts[1].length < length + 1) {
		return {blob: '', skip: 0, err: fmt.sprintf('message "%s" is %d bytes, expected at least %d', parts[1], parts[1].length, length + 1)};
  }

	payload = parts[1].substring(0, length + 1);
	if (payload[length] !== ',') {
		return {blob: '', skip: 0, err: 'message is not comma-terminated'};
	}
	return {blob: payload.substring(0, length), skip: parts[0].length + 1 + length + 1, err: null};
};



var decodeList = function decodeList(msg) {
  var bse = decodeString(msg);
  var l = [];
  var blob;

  if (bse.err) {
    return bse;
  }

  blob = bse.blob;
  while (blob.length > 0) {
    var nextBse = decodeString(blob);
    if (nextBse.err) {
      return nextBse;
    }
    l.push(nextBse.blob);
    blob = blob.substring(nextBse.skip);
  }
  return {values: l, skip: bse.skip, err: null};
};



var decode = function(msg) {
  var header = decodeHeader(msg);
  if (header.err) {
    return {data: null, err: header.err};
  }
  if (header.msgType !== 0) {
		return {data: null, err: 'unknown message type: ' + header.msgType};
	}
  msg = msg.substring(header.skip);
  var obj = {};
  while (msg.length > 0) {
    var dc = decodeString(msg);
    if (dc.err) {
      return dc;
    }
    msg = msg.substring(dc.skip);
    var vals = decodeList(msg);
    if (vals.err) {
      return vals;
    }
    msg = msg.substring(vals.skip);
    obj[dc.blob] = vals.values;
  }
  return obj;
};



exports.encodeString = encodeString;
exports.encodeList = encodeList;
exports.encode = encode;
exports.decodeString = decodeString;
exports.decode = decode;

