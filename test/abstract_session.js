
'use strict';

var expect = require('must');
var concat = require('concat-stream');

module.exports = function abstractSession(inBuilder, outBuilder) {

  var inSession;
  var outSession;

  beforeEach(function() {
    inSession = inBuilder();
    outSession = outBuilder(inSession);
  });

  describe('basic reply subChannel', function() {

    function client(done) {
      var chan   = outSession.sendChannel();
      var ret    = chan.createReadChannel();

      ret.on('data', function(res) {
        expect(res).to.eql({ hello: 'world' });
      });

      ret.on('end', done);

      chan.write({
        hello:'world',
        returnChannel: ret
      });
    }

    function reply(msg) {
      var stream = msg.returnChannel;
      delete msg.returnChannel;
      stream.end(msg);
    }

    it('should send and reply', function(done) {
      inSession.on('channel', function server(chan) {
        chan.on('data', reply);
      });

      client(done);
    });

    it('should support late channel rande-vouz', function(done) {
      client(done);

      inSession.on('channel', function server(chan) {
        chan.on('data', reply);
      });
    });

    it('should support a simpler setup', function(done) {
      inSession = inBuilder(function server(chan) {
        chan.on('data', reply);
      });

      outSession = outBuilder(inSession);

      client(done);
    });
  });

  describe('write subChannel', function() {

    function client() {
      var chan   = outSession.sendChannel();
      var more   = chan.createWriteChannel();

      chan.write({
        hello: 'world',
        more: more
      });

      more.write(1);
      more.write(2);
      more.end(3);
    }

    function reply(done, msg) {
      var more = msg.more;
      var count = 0;

      delete msg.more;
      expect(msg).to.eql({ hello: 'world' });

      more.on('data', function(msg) {
        expect(msg).to.eql(++count);
      });

      more.on('end', done);
    }

    it('should receive some more update through the substream', function(done) {
      inSession.on('channel', function server(chan) {
        chan.on('data', reply.bind(null, done));
      });

      client();
    });

    it('should support late channel rande-vouz', function(done) {
      client();

      inSession.on('channel', function server(chan) {
        chan.on('data', reply.bind(null, done));
      });
    });

    it('should support a simpler setup', function(done) {
      inSession = inBuilder(function server(chan) {
        chan.on('data', reply.bind(null, done));
      });

      outSession = outBuilder(inSession);

      client(done);
    });
  });

  describe('binaryStream', function() {

    function client(done) {
      var chan   = outSession.sendChannel();
      var bin    = chan.createBinaryStream();

      chan.write({
        hello: 'world',
        bin: bin
      });

      bin.write(new Buffer([1]));
      bin.write(new Buffer([2]));
      bin.end(new Buffer([3]));

      bin.pipe(concat(function(buf) {
        expect(buf.length).to.eql(3);
        expect(buf[0]).to.eql(1);
        expect(buf[1]).to.eql(2);
        expect(buf[2]).to.eql(3);
        done();
      }));
    }

    function reply(msg) {
      var bin = msg.bin;

      delete msg.bin;
      expect(msg).to.eql({ hello: 'world' });

      // echo mode
      bin.pipe(bin);
    }

    it('should receive some more update through the substream', function(done) {
      inSession.on('channel', function server(chan) {
        chan.on('data', reply);
      });

      client(done);
    });

    it('should support late channel rande-vouz', function(done) {
      client(done);

      inSession.on('channel', function server(chan) {
        chan.on('data', reply);
      });
    });

    it('should support a simpler setup', function(done) {
      inSession = inBuilder(function server(chan) {
        chan.on('data', reply);
      });

      outSession = outBuilder(inSession);

      client(done);
    });
  });
};
