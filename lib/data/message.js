/*
 * jschan message encode / decode
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
var _ns = require('./data');


exports.empty = function() {

  var parse = function parse(args) {
    var data = {};
    _.each(args, function(word) {
      if (-1 !== word.indexOf('=')){
        var kv = word.split('=');
        var key = kv[0];
        var val;
        if (kv.length === 2) {
          val = kv[1];
        }
        data[key] = [val];
      }
    });
    _d = _ns.encode(data);
    return this;
  };



  var add = function add(key, value) {
    var data = _ns.decode(_d);

    if (!data.err) {
      if (data[key]) {
        data[key] = data[key].push(value);
      }
      else {
        data[key] = [value];
      }
      _d = _ns.encode(data);
    }
    else {
    }
    return this;
  };



  var set = function set(key, value) {
    var data = _ns.decode(_d);
    if (!data.err) {
      data[key] = [value];
    }
    else {
      throw data.err; // change this to idiomatic node
    }
    _d = _ns.encode(data);
    return this;
  };



  var del = function del(key) {
    var data = _ns.decode(_d);
    if (!data.err) {
      delete data[key];
    }
    else {
      throw data.err; // change this to idiomatic node
    }
    _d = _ns.encode(data);
    return this;
  };



  var get = function get(key) {
    var data = _ns.decode(_d);
    var result = null;
    if (!data.err) {
      result = data[key];
    }
    return result;
  };



  var pretty = function pretty() {
    var out = JSON.stringify(_d, null, 2);
    return out.substring(1, out.length - 1);
  };



  var string = function string() {
    var out = JSON.stringify(_d);
    return out.substring(1, out.length - 1);
  };



  var bytes = function bytes() {
    //??
  };



  var _d = _ns.encode(null);

  return {
    bytes: bytes,
    string: string,
    pretty: pretty,
    get: get,
    del: del,
    set: set,
    add: add,
    parse: parse
  };
};

