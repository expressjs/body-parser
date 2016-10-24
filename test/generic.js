
var assert = require('assert')
var http = require('http')
var request = require('supertest')
var objectAssign = require('object-assign')

var bodyParser = require('..')

describe('bodyParser.generic()', function () {
  var server
  before(function () {
    server = createServer()
  })

  it('should parse x-www-form-urlencoded', function (done) {
    request(server)
    .post('/')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('user=tobi')
    .expect(200, '{"user":"tobi"}', done)
  })

  it('should 400 when invalid content-length', function (done) {
    var genericParser = bodyParser.generic({
      parser: require('qs').parse
    })
    var server = createServer(function (req, res, next) {
      req.headers['content-length'] = '20' // bad length
      genericParser(req, res, next)
    })

    request(server)
    .post('/')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('str=')
    .expect(400, /content length/, done)
  })

  it('should handle Content-Length: 0', function (done) {
    request(server)
    .post('/')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .set('Content-Length', '0')
    .send('')
    .expect(200, '{}', done)
  })

  it('should handle empty message-body', function (done) {
    request(createServer({ limit: '1kb' }))
    .post('/')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .set('Transfer-Encoding', 'chunked')
    .send('')
    .expect(200, '{}', done)
  })

  it('should handle duplicated middleware', function (done) {
    var genericParser = bodyParser.generic({
      parser: require('qs').parse
    })
    var server = createServer(function (req, res, next) {
      genericParser(req, res, function (err) {
        if (err) return next(err)
        genericParser(req, res, next)
      })
    })

    request(server)
    .post('/')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('user=tobi')
    .expect(200, '{"user":"tobi"}', done)
  })

  describe('with parserOptions', function () {
    var server
    before(function () {
      server = createServer({
        parserOptions: {
          allowDots: true
        }
      })
    })

    it('should pass on parserOptions', function (done) {
      request(server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('users.0.name=tobi')
        .expect(200, '{"users":[{"name":"tobi"}]}', done)
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
        test.set('Content-Type', 'application/x-www-form-urlencoded')
        test.write(new Buffer('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'))
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
        test.set('Content-Type', 'application/x-www-form-urlencoded')
        test.write(new Buffer('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'))
        test.expect(200, '{"name":"论"}', done)
      })
    })
  })

  describe('with limit option', function () {
    it('should 413 when over limit with Content-Length', function (done) {
      var buf = allocBuffer(1024, '.')
      request(createServer({ limit: '1kb' }))
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .set('Content-Length', '1028')
      .send('str=' + buf.toString())
      .expect(413, done)
    })

    it('should 413 when over limit with chunked encoding', function (done) {
      var buf = allocBuffer(1024, '.')
      var server = createServer({ limit: '1kb' })
      var test = request(server).post('/')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.set('Transfer-Encoding', 'chunked')
      test.write('str=')
      test.write(buf.toString())
      test.expect(413, done)
    })

    it('should accept number of bytes', function (done) {
      var buf = allocBuffer(1024, '.')
      request(createServer({ limit: 1024 }))
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('str=' + buf.toString())
      .expect(413, done)
    })

    it('should not change when options altered', function (done) {
      var buf = allocBuffer(1024, '.')
      var options = { limit: '1kb' }
      var server = createServer(options)

      options.limit = '100kb'

      request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('str=' + buf.toString())
      .expect(413, done)
    })

    it('should not hang response', function (done) {
      var buf = allocBuffer(10240, '.')
      var server = createServer({ limit: '8kb' })
      var test = request(server).post('/')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(buf)
      test.write(buf)
      test.write(buf)
      test.expect(413, done)
    })
  })

  describe('with type option', function () {
    describe('when "application/vnd.x-www-form-urlencoded"', function () {
      var server
      before(function () {
        server = createServer({ type: 'application/vnd.x-www-form-urlencoded' })
      })

      it('should parse for custom type', function (done) {
        request(server)
        .post('/')
        .set('Content-Type', 'application/vnd.x-www-form-urlencoded')
        .send('user=tobi')
        .expect(200, '{"user":"tobi"}', done)
      })

      it('should ignore standard type', function (done) {
        request(server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('user=tobi')
        .expect(200, '{}', done)
      })
    })

    describe('when a function', function () {
      it('should parse when truthy value returned', function (done) {
        var server = createServer({ type: accept })

        function accept (req) {
          return req.headers['content-type'] === 'application/vnd.something'
        }

        request(server)
        .post('/')
        .set('Content-Type', 'application/vnd.something')
        .send('user=tobi')
        .expect(200, '{"user":"tobi"}', done)
      })

      it('should work without content-type', function (done) {
        var server = createServer({ type: accept })

        function accept (req) {
          return true
        }

        var test = request(server).post('/')
        test.write('user=tobi')
        test.expect(200, '{"user":"tobi"}', done)
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
    it('should assert value if function', function () {
      assert.throws(createServer.bind(null, { verify: 'lol' }),
        /TypeError: option verify must be function/)
    })

    it('should error from verify', function (done) {
      var server = createServer({verify: function (req, res, buf) {
        if (buf[0] === 0x20) throw new Error('no leading space')
      }})

      request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(' user=tobi')
      .expect(403, 'no leading space', done)
    })

    it('should allow custom codes', function (done) {
      var server = createServer({verify: function (req, res, buf) {
        if (buf[0] !== 0x20) return
        var err = new Error('no leading space')
        err.status = 400
        throw err
      }})

      request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(' user=tobi')
      .expect(400, 'no leading space', done)
    })

    it('should allow pass-through', function (done) {
      var server = createServer({verify: function (req, res, buf) {
        if (buf[0] === 0x5b) throw new Error('no arrays')
      }})

      request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('user=tobi')
      .expect(200, '{"user":"tobi"}', done)
    })
  })

  describe('encoding', function () {
    var server
    before(function () {
      server = createServer({ limit: '10kb' })
    })

    it('should parse without encoding', function (done) {
      var test = request(server).post('/')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(new Buffer('6e616d653de8aeba', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should support identity encoding', function (done) {
      var test = request(server).post('/')
      test.set('Content-Encoding', 'identity')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(new Buffer('6e616d653de8aeba', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should support gzip encoding', function (done) {
      var test = request(server).post('/')
      test.set('Content-Encoding', 'gzip')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(new Buffer('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should support deflate encoding', function (done) {
      var test = request(server).post('/')
      test.set('Content-Encoding', 'deflate')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(new Buffer('789ccb4bcc4db57db16e17001068042f', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should be case-insensitive', function (done) {
      var test = request(server).post('/')
      test.set('Content-Encoding', 'GZIP')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(new Buffer('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should fail on unknown encoding', function (done) {
      var test = request(server).post('/')
      test.set('Content-Encoding', 'nulls')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(new Buffer('000000000000', 'hex'))
      test.expect(415, 'unsupported content encoding "nulls"', done)
    })
  })
})

function allocBuffer (size, fill) {
  if (Buffer.alloc) {
    return Buffer.alloc(size, fill)
  }

  var buf = new Buffer(size)
  buf.fill(fill)
  return buf
}

function createServer (opts) {
  var _bodyParser = typeof opts !== 'function'
    ? bodyParser.generic(objectAssign({}, {
      parser: require('qs').parse
    }, opts))
    : opts

  return http.createServer(function (req, res) {
    _bodyParser(req, res, function (err) {
      res.statusCode = err ? (err.status || 500) : 200
      res.end(err ? err.message : JSON.stringify(req.body))
    })
  })
}
