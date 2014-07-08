/*
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
var assert = require('assert');
var data = require('../../lib/data/data');



describe('Data test', function() {

  beforeEach(function(done) {
    done();
  });



  afterEach(function(done) {
    done();
  });



  it('should correctly encode hello world', function(done){
    var input = 'hello world!';
	  var output = data.encodeString(input);
	  var expectedOutput = '12:hello world!,';
    assert(output === expectedOutput);
    done();
  });



  it('should correctly encode an empty string', function(done){
    var input = '';
	  var output = data.encodeString(input);
    var expectedOutput = '0:,';
    assert(output === expectedOutput);
    done();
  });



  it('should correctly encode an empty list', function(done){
    var input = [];
	  var output = data.encodeList(input);
    var expectedOutput = '0:,';
    assert(output === expectedOutput);
    done();
  });



  it('should correctly encode an empty map', function(done){
    var input = {};
	  var output = data.encode(input);
    var expectedOutput = '000;';
    assert(output === expectedOutput);
    done();
  });



  it('should correctly encode a single key single value map', function(done){
    this.timeout(10000000);
    var input = { hello: ['world'] };
	  var output = data.encode(input);
    var expectedOutput = '000;5:hello,8:5:world,,';
    assert(output === expectedOutput);
    done();
  });



  it('should correctly encode a single key multi value map', function(done){
    var input = { hello: ['beautiful', 'world'] };
	  var output = data.encode(input);
    var expectedOutput = '000;5:hello,20:9:beautiful,5:world,,';
    assert(output === expectedOutput);
    done();
  });



  it('should correctly encode an empty value map', function(done){
    var input = { foo: [] };
	  var output = data.encode(input);
    var expectedOutput = '000;3:foo,0:,';
    assert(output === expectedOutput);
    done();
  });



  it('should correctly encode a binary key', function(done){
    var input = { 'foo\x00bar\x7f': []};
	  var output = data.encode(input);
	  var expectedOutput = '000;8:foo\x00bar\x7f,0:,';
    assert(output === expectedOutput);
    done();
  });



  it('should correctly encode a binary key and value', function(done){
    var input = { 'foo\x00bar\x7f': ['\x01\x02\x03\x04']};
	  var output = data.encode(input);
	  var expectedOutput = '000;8:foo\x00bar\x7f,7:4:\x01\x02\x03\x04,,';
    assert(output === expectedOutput);
    done();
  });



  it('should correctly encode a multi key multi value map', function(done){
    var input = { hello: ['beautiful', 'world'],
                  what: ['is', 'this', 'all', 'about']};
	  var output = data.encode(input);
    var expectedOutput = '000;5:hello,20:9:beautiful,5:world,,4:what,26:2:is,4:this,3:all,5:about,,';
    assert(output === expectedOutput);
    done();
  });



  it('should correctly decode test strings', function(done) {
    var samples = [{input: '3:foo,', output: 'foo', skip: 6},
                   {input: '5:hello,', output: 'hello', skip: 8},
                   {input: '5:hello,5:world,', output: 'hello', skip: 8}];

    _.each(samples, function(sample) {
      var dc = data.decodeString(sample.input);
      assert(!dc.err);
      assert(dc.skip === sample.skip);
      assert(dc.blob === sample.output);
    });
    done();
  });



  it('should correctly decode a string with 1 key and 2 values', function(done) {
    var input = '000;5:hello,20:9:beautiful,5:world,,';
	  var output = data.decode(input);
    assert(output.hello);
    assert(output.hello[0] === 'beautiful');
    assert(output.hello[1] === 'world');
    done();
  });
});

