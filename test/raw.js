
var assert = require('assert')
var Buffer = require('safe-buffer').Buffer
var http = require('http')
var request = require('supertest')

var bodyParser = require('..')

describe('bodyParser.raw()', function () {
  var server
  before(function () {
    server = createServer()
  })

  it('should parse application/octet-stream', function (done) {
    request(server)
    .post('/')
    .set('Content-Type', 'application/octet-stream')
    .send('the user is tobi')
    .expect(200, 'buf:746865207573657220697320746f6269', done)
  })

  it('should 400 when invalid content-length', function (done) {
    var rawParser = bodyParser.raw()
    var server = createServer(function (req, res, next) {
      req.headers['content-length'] = '20' // bad length
      rawParser(req, res, next)
    })

    request(server)
    .post('/')
    .set('Content-Type', 'application/octet-stream')
    .send('stuff')
    .expect(400, /content length/, done)
  })

  it('should handle Content-Length: 0', function (done) {
    request(server)
    .post('/')
    .set('Content-Type', 'application/octet-stream')
    .set('Content-Length', '0')
    .expect(200, 'buf:', done)
  })

  it('should handle empty message-body', function (done) {
    request(server)
    .post('/')
    .set('Content-Type', 'application/octet-stream')
    .set('Transfer-Encoding', 'chunked')
    .send('')
    .expect(200, 'buf:', done)
  })

  it('should handle duplicated middleware', function (done) {
    var rawParser = bodyParser.raw()
    var server = createServer(function (req, res, next) {
      rawParser(req, res, function (err) {
        if (err) return next(err)
        rawParser(req, res, next)
      })
    })

    request(server)
    .post('/')
    .set('Content-Type', 'application/octet-stream')
    .send('the user is tobi')
    .expect(200, 'buf:746865207573657220697320746f6269', done)
  })

  describe('with limit option', function () {
    it('should 413 when over limit with Content-Length', function (done) {
      var buf = Buffer.alloc(1028, '.')
      var server = createServer({ limit: '1kb' })
      var test = request(server).post('/')
      test.set('Content-Type', 'application/octet-stream')
      test.set('Content-Length', '1028')
      test.write(buf)
      test.expect(413, done)
    })

    it('should 413 when over limit with chunked encoding', function (done) {
      var buf = Buffer.alloc(1028, '.')
      var server = createServer({ limit: '1kb' })
      var test = request(server).post('/')
      test.set('Content-Type', 'application/octet-stream')
      test.set('Transfer-Encoding', 'chunked')
      test.write(buf)
      test.expect(413, done)
    })

    it('should accept number of bytes', function (done) {
      var buf = Buffer.alloc(1028, '.')
      var server = createServer({ limit: 1024 })
      var test = request(server).post('/')
      test.set('Content-Type', 'application/octet-stream')
      test.write(buf)
      test.expect(413, done)
    })

    it('should not change when options altered', function (done) {
      var buf = Buffer.alloc(1028, '.')
      var options = { limit: '1kb' }
      var server = createServer(options)

      options.limit = '100kb'

      var test = request(server).post('/')
      test.set('Content-Type', 'application/octet-stream')
      test.write(buf)
      test.expect(413, done)
    })

    it('should not hang response', function (done) {
      var buf = Buffer.alloc(10240, '.')
      var server = createServer({ limit: '8kb' })
      var test = request(server).post('/')
      test.set('Content-Type', 'application/octet-stream')
      test.write(buf)
      test.write(buf)
      test.write(buf)
      test.expect(413, done)
    })
  })

  describe('with inflate option', function () {
    describe('when false', function () {
      var server
      before(function () {
        server = createServer({ inflate: false })
      })

      it('should not accept content-encoding', function (done) {
        var test = request(server).post('/')
        test.set('Content-Encoding', 'gzip')
        test.set('Content-Type', 'application/octet-stream')
        test.write(Buffer.from('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'))
        test.expect(415, 'content encoding unsupported', done)
      })
    })

    describe('when true', function () {
      var server
      before(function () {
        server = createServer({ inflate: true })
      })

      it('should accept content-encoding', function (done) {
        var test = request(server).post('/')
        test.set('Content-Encoding', 'gzip')
        test.set('Content-Type', 'application/octet-stream')
        test.write(Buffer.from('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'))
        test.expect(200, 'buf:6e616d653de8aeba', done)
      })
    })
  })

  describe('with type option', function () {
    describe('when "application/vnd+octets"', function () {
      var server
      before(function () {
        server = createServer({ type: 'application/vnd+octets' })
      })

      it('should parse for custom type', function (done) {
        var test = request(server).post('/')
        test.set('Content-Type', 'application/vnd+octets')
        test.write(Buffer.from('000102', 'hex'))
        test.expect(200, 'buf:000102', done)
      })

      it('should ignore standard type', function (done) {
        var test = request(server).post('/')
        test.set('Content-Type', 'application/octet-stream')
        test.write(Buffer.from('000102', 'hex'))
        test.expect(200, '{}', done)
      })
    })

    describe('when a function', function () {
      it('should parse when truthy value returned', function (done) {
        var server = createServer({ type: accept })

        function accept (req) {
          return req.headers['content-type'] === 'application/vnd.octet'
        }

        var test = request(server).post('/')
        test.set('Content-Type', 'application/vnd.octet')
        test.write(Buffer.from('000102', 'hex'))
        test.expect(200, 'buf:000102', done)
      })

      it('should work without content-type', function (done) {
        var server = createServer({ type: accept })

        function accept (req) {
          return true
        }

        var test = request(server).post('/')
        test.write(Buffer.from('000102', 'hex'))
        test.expect(200, 'buf:000102', done)
      })

      it('should not invoke without a body', function (done) {
        var server = createServer({ type: accept })

        function accept (req) {
          throw new Error('oops!')
        }

        request(server)
        .get('/')
        .expect(200, done)
      })
    })
  })

  describe('with verify option', function () {
    it('should assert value is function', function () {
      assert.throws(createServer.bind(null, { verify: 'lol' }),
        /TypeError: option verify must be function/)
    })

    it('should error from verify', function (done) {
      var server = createServer({verify: function (req, res, buf) {
        if (buf[0] === 0x00) throw new Error('no leading null')
      }})

      var test = request(server).post('/')
      test.set('Content-Type', 'application/octet-stream')
      test.write(Buffer.from('000102', 'hex'))
      test.expect(403, 'no leading null', done)
    })

    it('should allow custom codes', function (done) {
      var server = createServer({verify: function (req, res, buf) {
        if (buf[0] !== 0x00) return
        var err = new Error('no leading null')
        err.status = 400
        throw err
      }})

      var test = request(server).post('/')
      test.set('Content-Type', 'application/octet-stream')
      test.write(Buffer.from('000102', 'hex'))
      test.expect(400, 'no leading null', done)
    })

    it('should allow pass-through', function (done) {
      var server = createServer({verify: function (req, res, buf) {
        if (buf[0] === 0x00) throw new Error('no leading null')
      }})

      var test = request(server).post('/')
      test.set('Content-Type', 'application/octet-stream')
      test.write(Buffer.from('0102', 'hex'))
      test.expect(200, 'buf:0102', done)
    })
  })

  describe('charset', function () {
    var server
    before(function () {
      server = createServer()
    })

    it('should ignore charset', function (done) {
      var test = request(server).post('/')
      test.set('Content-Type', 'application/octet-stream; charset=utf-8')
      test.write(Buffer.from('6e616d6520697320e8aeba', 'hex'))
      test.expect(200, 'buf:6e616d6520697320e8aeba', done)
    })
  })

  describe('encoding', function () {
    var server
    before(function () {
      server = createServer({ limit: '10kb' })
    })

    it('should parse without encoding', function (done) {
      var test = request(server).post('/')
      test.set('Content-Type', 'application/octet-stream')
      test.write(Buffer.from('6e616d653de8aeba', 'hex'))
      test.expect(200, 'buf:6e616d653de8aeba', done)
    })

    it('should support identity encoding', function (done) {
      var test = request(server).post('/')
      test.set('Content-Encoding', 'identity')
      test.set('Content-Type', 'application/octet-stream')
      test.write(Buffer.from('6e616d653de8aeba', 'hex'))
      test.expect(200, 'buf:6e616d653de8aeba', done)
    })

    it('should support gzip encoding', function (done) {
      var test = request(server).post('/')
      test.set('Content-Encoding', 'gzip')
      test.set('Content-Type', 'application/octet-stream')
      test.write(Buffer.from('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'))
      test.expect(200, 'buf:6e616d653de8aeba', done)
    })

    it('should support deflate encoding', function (done) {
      var test = request(server).post('/')
      test.set('Content-Encoding', 'deflate')
      test.set('Content-Type', 'application/octet-stream')
      test.write(Buffer.from('789ccb4bcc4db57db16e17001068042f', 'hex'))
      test.expect(200, 'buf:6e616d653de8aeba', done)
    })

    it('should be case-insensitive', function (done) {
      var test = request(server).post('/')
      test.set('Content-Encoding', 'GZIP')
      test.set('Content-Type', 'application/octet-stream')
      test.write(Buffer.from('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'))
      test.expect(200, 'buf:6e616d653de8aeba', done)
    })

    it('should fail on unknown encoding', function (done) {
      var test = request(server).post('/')
      test.set('Content-Encoding', 'nulls')
      test.set('Content-Type', 'application/octet-stream')
      test.write(Buffer.from('000000000000', 'hex'))
      test.expect(415, 'unsupported content encoding "nulls"', done)
    })
  })
})

function createServer (opts) {
  var _bodyParser = typeof opts !== 'function'
    ? bodyParser.raw(opts)
    : opts

  return http.createServer(function (req, res) {
    _bodyParser(req, res, function (err) {
      if (err) {
        res.statusCode = err.status || 500
        res.end(err.message)
        return
      }

      if (Buffer.isBuffer(req.body)) {
        res.end('buf:' + req.body.toString('hex'))
        return
      }

      res.end(JSON.stringify(req.body))
    })
  })
}
