
'use strict';

var expect    = require('must');
var concat    = require('concat-stream');
var fs        = require('fs');
var Readable  = require('readable-stream').Readable;
var Writable  = require('readable-stream').Writable;
var Duplex    = require('readable-stream').Duplex;
var WritableN = require('stream').Writable;
var DuplexN   = require('stream').Duplex;
var Transform = require('readable-stream').Transform;
var through   = require('through2');

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

    function client(data) {
      var chan   = outSession.WriteChannel();

      data = data || {
        hello: 'world'
      };

      chan.write(data);
    }

    function reply(done, msg) {
      expect(msg).to.eql({ hello: 'world' });
      done();
    }

    it('should receive a message', function(done) {
      inSession.on('channel', function server(chan) {
        chan.on('data', reply.bind(null, done));
      });

      client();
    });

    it('should receive 50 messages', function(done) {

      var chan  = outSession.WriteChannel();
      var count = 0;
      var max   = 50;
      var i;

      inSession.on('channel', function server(chan) {
        chan.on('data', function() {
          count++;
          if (count === max) {
            done();
          }
        });
      });

      for (i = 0; i < max; i++) {
        chan.write({ hello: 'world' });
      }
    });

    it('should receive 50 channels', function(done) {

      var chan;
      var count = 0;
      var max   = 50;
      var i;

      inSession.on('channel', function server(chan) {
        chan.resume();

        count++;
        if (count === max) {
          done();
        }
      });

      for (i = 0; i < max; i++) {
        chan = outSession.WriteChannel();
        chan.end({ hello: 'world' });
      }
    });

    it('should be a readChannel server side', function(done) {
      inSession.on('channel', function server(chan) {
        chan.on('data', function() {});
        expect(chan.isReadChannel).to.be.true();
        expect(chan.isWriteChannel).to.be.false();
        done();
      });

      client();
    });

    it('should receive a big message', function(done) {
      var i;
      var data = [];

      for (i = 0; i < 3000; i++) {
        data.push(i);
      }

      inSession.on('channel', function server(chan) {
        chan.on('data', function(msg) {
          expect(msg).to.eql(data);
          done();
        });
      });

      client(data);
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
      var chan   = outSession.WriteChannel();
      var ret    = chan.ReadChannel();

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

    it('should reply with a big chunk', function(done) {
      var i;
      var data = [];
      var chan = outSession.WriteChannel();
      var ret  = chan.ReadChannel();

      for (i = 0; i < 3000; i++) {
        data.push(i);
      }

      inSession.on('channel', function server(chan) {
        chan.on('data', function(msg) {
          msg.returnChannel.end(data);
        });
      });

      ret.on('data', function(res) {
        expect(res).to.eql(data);
        done();
      });

      chan.write({
        returnChannel: ret
      });
    });
  });

  describe('write subChannel', function() {

    function client() {
      var chan   = outSession.WriteChannel();
      var more   = chan.WriteChannel();

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
      var chan   = outSession.WriteChannel();
      var bin    = chan.ByteStream();

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

    it('should auto-pipe a node Readable', function(done) {
      var chan   = outSession.WriteChannel();
      var file   = __dirname + '/../package.json';
      var bin    = fs.createReadStream(file);

      chan.write({
        bin: bin
      });

      inSession.on('channel', function server(chan) {
        chan.on('data', function(msg) {
          msg.bin.pipe(concat(function(buf) {
            expect(buf.toString()).to.eql(fs.readFileSync(file).toString());
            done();
          }));
        });
      });
    });

    it('should auto-pipe a Readable from readable-stream', function(done) {
      var chan   = outSession.WriteChannel();
      var bin    = new Readable();

      bin._read = function() {
        this.push('hello world');
        this.push(null);
      };

      chan.write({
        bin: bin
      });

      inSession.on('channel', function server(chan) {
        chan.on('data', function(msg) {
          msg.bin.pipe(concat(function(buf) {
            expect(buf.toString()).to.eql('hello world');
            done();
          }));
        });
      });
    });

    it('should auto-pipe a Writable from readable-stream', function(done) {
      var chan   = outSession.WriteChannel();
      var bin    = new Writable();

      bin._write = function(chunk, enc, done) {
        expect(chunk.toString()).to.eql('hello world');
        done();
      };

      bin.on('finish', done);

      chan.write({
        bin: bin
      });

      inSession.on('channel', function server(chan) {
        chan.on('data', function(msg) {
          msg.bin.end('hello world');
        });
      });
    });

    it('should auto-pipe a Duplex from readable-stream', function(done) {
      var chan   = outSession.WriteChannel();
      var bin    = new Duplex();

      bin._read = function() {
        this.push('hello world');
        this.push(null);
      };

      bin._write = function(chunk, enc, done) {
        expect(chunk.toString()).to.eql('hello world');
        done();
      };

      bin.on('finish', done);

      chan.write({
        bin: bin
      });

      inSession.on('channel', function server(chan) {
        chan.on('data', function(msg) {
          msg.bin.pipe(msg.bin);
        });
      });
    });

    it('should auto-pipe a node Writable', function(done) {
      var chan   = outSession.WriteChannel();
      var bin    = new WritableN();

      bin._write = function(chunk, enc, done) {
        expect(chunk.toString()).to.eql('hello world');
        done();
      };

      bin.on('finish', done);

      chan.write({
        bin: bin
      });

      inSession.on('channel', function server(chan) {
        chan.on('data', function(msg) {
          msg.bin.end('hello world');
        });
      });
    });

    it('should auto-pipe a node core Duplex', function(done) {
      var chan   = outSession.WriteChannel();
      var bin    = new DuplexN();

      bin._read = function() {
        this.push('hello world');
        this.push(null);
      };

      bin._write = function(chunk, enc, done) {
        expect(chunk.toString()).to.eql('hello world');
        done();
      };

      bin.on('finish', done);

      chan.write({
        bin: bin
      });

      inSession.on('channel', function server(chan) {
        chan.on('data', function(msg) {
          msg.bin.pipe(msg.bin);
        });
      });
    });

    it('should error if the stream is a Transform', function(done) {
      var chan   = outSession.WriteChannel();
      var bin    = new Transform();

      outSession.once('error', function(err) {
        expect(err.message).to.eql('unable to auto-serialize a Transform stream not in object mode');
        done();

        outSession.on('error', function() {});
      });

      chan.end({
        bin: bin
      });

      inSession.on('channel', function server(chan) {
        chan.resume(); // skip all of it
      });
    });
  });

  describe('double nested channels', function() {

    it('should support receiving a ReadChannel through a ReadChannel', function(done) {

      var chan   = outSession.WriteChannel();
      var ret    = chan.ReadChannel();

      ret.on('data', function(res) {
        res.nested.on('data', function(msg) {
          expect(msg).to.eql({ some: 'stuff' });
          done();
        });
      });

      chan.write({
        hello:'world',
        returnChannel: ret
      });

      inSession.on('channel', function server(chan) {
        chan.on('data', function(msg) {
          var ret = msg.returnChannel;
          var nested = chan.WriteChannel();

          ret.write({ nested: nested });

          nested.write({ some: 'stuff' });
        });
      });
    });

    it('should auto-convert already piped transform streams in object mode into channels', function(done) {

      var chan   = outSession.WriteChannel();
      var ret    = through.obj();

      ret.pipe(through.obj()).on('data', function(res) {
        res.nested.on('data', function(msg) {
          expect(msg).to.eql({ some: 'stuff' });
          done();
        });
      });

      chan.write({
        hello:'world',
        returnChannel: ret
      });

      inSession.on('channel', function server(chan) {
        chan.on('data', function(msg) {
          var ret = msg.returnChannel;
          var nested = through.obj();
          var driver = through.obj();

          driver.pipe(nested);

          ret.write({ nested: nested });

          driver.write({ some: 'stuff' });
        });
      });
    });

    it('should auto-convert a Readable stream', function(done) {
      var chan   = outSession.WriteChannel();
      var more   = new Readable({ objectMode: true });

      more._read = function() {
        this.push({ 'hello': 'world' });
        this.push(null);
      };

      chan.write({
        hello:'world',
        more: more
      });

      inSession.on('channel', function server(chan) {
        chan.on('data', function(msg) {
          msg.more.on('data', function(data) {
            expect(data).to.eql({ 'hello': 'world' });
            done();
          });
        });
      });
    });

    it('should auto-convert a Writable stream', function(done) {
      var chan   = outSession.WriteChannel();
      var more   = new Writable({ objectMode: true });

      more._write = function(data, enc, cb) {
        expect(data).to.eql({ 'hello': 'world' });
        cb();
        done();
      };


      chan.write({
        hello:'world',
        more: more
      });

      inSession.on('channel', function server(chan) {
        chan.on('data', function(msg) {
          msg.more.end({ 'hello': 'world' });
        });
      });
    });

    it('should support receiving a WriteChannel through a ReadChannel', function(done) {

      var chan   = outSession.WriteChannel();
      var ret    = chan.ReadChannel();

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
          var nested = chan.ReadChannel();

          ret.end({ nested: nested });

          nested.on('data', function(data) {
            expect(data).to.eql({ some: 'stuff' });
            done();
          });
        });
      });
    });

    it('should support receiving a byte stream through a ReadChannel', function(done) {

      var chan   = outSession.WriteChannel();
      var ret    = chan.ReadChannel();

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
          var bin = chan.ByteStream();

          ret.write({ bin: bin });

          bin.write(new Buffer([1]));
          bin.write(new Buffer([2]));
          bin.write(new Buffer([3]));
          bin.end();
        });
      });
    });
  });

  describe('close event', function() {
    it('must be emitted by the server session', function(done) {
      inSession.once('close', done);
      inSession.close();
    });

    it('must be emitted by the client session', function(done) {
      outSession.once('close', done);
      outSession.close();
    });
  });

  describe('orchestration', function() {

    var inSession2;
    var outSession2;

    beforeEach(function buildSessions2(done) {
      builder(function(err, inS, out) {
        if (err) {
          return done(err);
        }

        inSession2 = inS;

        outSession2 = out;

        done();
      });
    });

    afterEach(function closeOutSession2(done) {
      outSession2.close(function() {
        // avoid errors
        done();
      });
    });

    afterEach(function closeInSession2(done) {
      inSession2.close(function() {
        // avoid errors
        done();
      });
    });

    it('should pass ReadChannel between sessions', function(done) {
      (function client1() {
        var chan = outSession.WriteChannel();
        var ret  = chan.ReadChannel();

        ret.on('data', function(data) {
          data.chan.end({ hello: 'world' });
        });

        chan.write({ ret: ret });
      })();

      function client2() {
        var chan = outSession2.WriteChannel();
        var ret  = chan.ReadChannel();

        ret.on('data', function(data) {
          expect(data).to.eql({ hello: 'world' });
          done();
        });

        chan.write({ chan: ret });
      }

      (function server() {
        inSession.once('channel', function(channel1) {
          client2();
          channel1.on('data', function(msg) {
            inSession2.once('channel', function(channel2) {
              channel2.pipe(msg.ret);
            });
          });
        });
      })();
    });

    it('should pass WriteChannel between sessions', function(done) {
      (function client1() {
        var chan = outSession.WriteChannel();
        var more = chan.WriteChannel();

        chan.write({ more: more });
        more.write({ hello: 'world' });
      })();

      function client2() {
        var chan = outSession2.WriteChannel();
        var ret  = chan.ReadChannel();

        ret.on('data', function(msg) {
          msg.more.on('data', function(data) {
            expect(data).to.eql({ hello: 'world' });
            done();
          });
        });

        chan.write({ ret: ret });
      }

      (function server() {
        inSession.once('channel', function(channel1) {
          client2();
          inSession2.once('channel', function(channel2) {
            channel2.on('data', function(msg) {
              channel1.pipe(msg.ret);
            });
          });
        });
      })();
    });

    it('should pass BinaryStream between sessions', function(done) {
      var file   = __dirname + '/../package.json';

      (function client1() {
        var chan   = outSession.WriteChannel();
        var bin    = fs.createReadStream(file);

        chan.write({
          bin: bin
        });
      })();

      function client2() {
        var chan = outSession2.WriteChannel();
        var ret  = chan.ReadChannel();

        ret.on('data', function(msg) {
          msg.bin.pipe(concat(function(buf) {
            expect(buf.toString()).to.eql(fs.readFileSync(file).toString());
            done();
          }));
        });

        chan.write({ ret: ret });
      }

      (function server() {
        inSession.once('channel', function(channel1) {
          client2();
          inSession2.once('channel', function(channel2) {
            channel2.on('data', function(msg) {
              channel1.pipe(msg.ret);
            });
          });
        });
      })();
    });
  });
};
