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

var assert = require('assert');
var msg = require('../../lib/data/message');
var dat = require('../../lib/data/data');



describe('Message test', function() {

  beforeEach(function(done) {
    this.timeout(100000);
    done();
  });



  afterEach(function(done) {
    done();
  });



  it('should correctly encode an empty message', function(done){
    var m = msg.empty();
    assert(m.string() === '000;');
    done();
  });



  it('should correctly set a message', function(done){
    var m = msg.empty().set('foo', 'bar');
    var output = m.string();
	  var expectedOutput = '000;3:foo,6:3:bar,,';
    assert(output === expectedOutput);

    var decoded = dat.decode(output);
    assert(decoded.foo);
    assert(decoded.foo[0] === 'bar');
    done();
  });



  it('should correctly set a multi key message', function(done){
    var m = msg.empty().set('foo', 'bar').set('ga', 'bu');
    var output = m.string();
	  var expectedOutput = '000;3:foo,6:3:bar,,2:ga,5:2:bu,,';
    assert(output === expectedOutput);

    var decoded = dat.decode(output);
    assert(decoded.foo);
    assert(decoded.foo[0] === 'bar');
    assert(decoded.ga);
    assert(decoded.ga[0] === 'bu');
    done();
  });



  it('should correctly delete a value', function(done){
    var m = msg.empty().set('foo', 'bar').del('foo');
    var output = m.string();
    var expectedOutput = dat.encode(null);
    assert(output === expectedOutput);
    done();
  });
});

