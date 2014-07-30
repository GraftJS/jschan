
'use strict';

var expect = require('must');
var concat = require('concat-stream');

module.exports = function abstractSession(builder) {

  var inSession;
  var outSession;

  beforeEach(function buildSessions(done) {
    builder(function(err, inS, out) {
      if (err) {
        return done(err);
      }

      inSession = inS;

      outSession = out;

      done();
    });
  });

  afterEach(function closeOutSession(done) {
    outSession.close(function() {
      // avoid errors
      done();
    });
  });

  afterEach(function closeInSession(done) {
    inSession.close(function() {
      // avoid errors
      done();
    });
  });

  describe('one-direction', function() {

    function client() {
      var chan   = outSession.createWriteChannel();

      chan.write({
        hello: 'world'
      });
    }

    function reply(done, msg) {
      expect(msg).to.eql({ hello: 'world' });
      done();
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
  });

  describe('basic reply subChannel', function() {

    function client(done) {
      var chan   = outSession.createWriteChannel();
      var ret    = chan.createReadChannel();

      ret.on('data', function(res) {
        expect(res).to.eql({ hello: 'world' });
        done();
      });

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
  });

  describe('write subChannel', function() {

    function client() {
      var chan   = outSession.createWriteChannel();
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
  });

  describe('binaryStream', function() {

    function client(done) {
      var chan   = outSession.createWriteChannel();
      var bin    = chan.createDuplexStream();

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
  });

  describe('double nested channels', function() {

    it('should support receiving a ReadChannel through a ReadChannel', function(done) {

      var chan   = outSession.createWriteChannel();
      var ret    = chan.createReadChannel();

      ret.on('data', function(res) {
        res.nested.on('data', function(msg) {
          expect(msg).to.eql({ some: 'stuff' })
          done();
        })
      });

      chan.write({
        hello:'world',
        returnChannel: ret
      });

      inSession.on('channel', function server(chan) {
        chan.on('data', function(msg) {
          var ret = msg.returnChannel;
          var nested = chan.createWriteChannel();

          ret.write({ nested: nested });

          nested.write({ some: 'stuff' });
        })
      });
    });

    it('should support receiving a WriteChannel through a ReadChannel', function(done) {

      var chan   = outSession.createWriteChannel();
      var ret    = chan.createReadChannel();

      ret.on('data', function(res) {
        res.nested.end({ some: 'stuff' });
      });

      chan.write({
        hello:'world',
        returnChannel: ret
      });

      inSession.on('channel', function server(chan) {
        chan.on('data', function(msg) {
          var ret = msg.returnChannel;
          var nested = chan.createReadChannel();

          ret.end({ nested: nested });

          nested.on('data', function(data) {
            expect(data).to.eql({ some: 'stuff' });
            done();
          });
        })
      });
    });

    it('should support receiving a byte stream through a ReadChannel', function(done) {

      var chan   = outSession.createWriteChannel();
      var ret    = chan.createReadChannel();

      ret.on('data', function(res) {
        res.bin.pipe(concat(function(buf) {
          expect(buf.length).to.eql(3);
          expect(buf[0]).to.eql(1);
          expect(buf[1]).to.eql(2);
          expect(buf[2]).to.eql(3);
          done();
        }));
      });

      chan.write({
        hello: 'world',
        returnChannel: ret
      });

      inSession.on('channel', function server(chan) {
        chan.on('data', function(msg) {
          var ret = msg.returnChannel;
          var bin = chan.createDuplexStream();

          ret.write({ bin: bin });

          bin.write(new Buffer([1]));
          bin.write(new Buffer([2]));
          bin.write(new Buffer([3]));
          bin.end();
        });
      });
    });
  });
};
