'use strict'

var assert = require('assert')
var asyncHooks = tryRequire('async_hooks')
var Buffer = require('safe-buffer').Buffer
var http = require('http')
var request = require('supertest')

var bodyParser = require('..')

var describeAsyncHooks = typeof asyncHooks.AsyncLocalStorage === 'function'
  ? describe
  : describe.skip

describe('bodyParser.urlencoded()', function () {
  before(function () {
    this.server = createServer()
  })

  it('should parse x-www-form-urlencoded', function (done) {
    request(this.server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('user=tobi')
      .expect(200, '{"user":"tobi"}', done)
  })

  it('should 400 when invalid content-length', function (done) {
    var urlencodedParser = bodyParser.urlencoded()
    var server = createServer(function (req, res, next) {
      req.headers['content-length'] = '20' // bad length
      urlencodedParser(req, res, next)
    })

    request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('str=')
      .expect(400, /content length/, done)
  })

  it('should handle Content-Length: 0', function (done) {
    request(this.server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .set('Content-Length', '0')
      .send('')
      .expect(200, '{}', done)
  })

  var extendedValues = [true, false]
  extendedValues.forEach(function (extended) {
    describe('in ' + (extended ? 'extended' : 'simple') + ' mode', function () {
      it.skip('should parse x-www-form-urlencoded with an explicit iso-8859-1 encoding', function (done) {
        var server = createServer({ extended: extended })
        request(server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded; charset=iso-8859-1')
          .send('%A2=%BD')
          .expect(200, '{"¢":"½"}', done)
      })

      it('should parse x-www-form-urlencoded with unspecified iso-8859-1 encoding when the defaultCharset is set to iso-8859-1', function (done) {
        var server = createServer({ defaultCharset: 'iso-8859-1', extended: extended })
        request(server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('%A2=%BD')
          .expect(200, '{"¢":"½"}', done)
      })

      it('should parse x-www-form-urlencoded with an unspecified iso-8859-1 encoding when the utf8 sentinel has a value of %26%2310003%3B', function (done) {
        var server = createServer({ charsetSentinel: true, extended: extended })
        request(server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('utf8=%26%2310003%3B&user=%C3%B8')
          .expect(200, '{"user":"Ã¸"}', done)
      })

      it('should parse x-www-form-urlencoded with an unspecified utf-8 encoding when the utf8 sentinel has a value of %E2%9C%93 and the defaultCharset is iso-8859-1', function (done) {
        var server = createServer({ charsetSentinel: true, extended: extended })
        request(server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('utf8=%E2%9C%93&user=%C3%B8')
          .expect(200, '{"user":"ø"}', done)
      })

      it('should not leave an empty string parameter when removing the utf8 sentinel from the start of the string', function (done) {
        var server = createServer({ charsetSentinel: true, extended: extended })
        request(server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('utf8=%E2%9C%93&foo=bar')
          .expect(200, '{"foo":"bar"}', done)
      })

      it('should not leave an empty string parameter when removing the utf8 sentinel from the middle of the string', function (done) {
        var server = createServer({ charsetSentinel: true, extended: extended })
        request(server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('foo=bar&utf8=%E2%9C%93&baz=quux')
          .expect(200, '{"foo":"bar","baz":"quux"}', done)
      })

      it('should not leave an empty string parameter when removing the utf8 sentinel from the end of the string', function (done) {
        var server = createServer({ charsetSentinel: true, extended: extended })
        request(server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('foo=bar&baz=quux&utf8=%E2%9C%93')
          .expect(200, '{"foo":"bar","baz":"quux"}', done)
      })
    })
  })

  it('should handle empty message-body', function (done) {
    request(createServer({ limit: '1kb' }))
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .set('Transfer-Encoding', 'chunked')
      .send('')
      .expect(200, '{}', done)
  })

  it('should handle consumed stream', function (done) {
    var urlencodedParser = bodyParser.urlencoded()
    var server = createServer(function (req, res, next) {
      req.on('end', function () {
        urlencodedParser(req, res, next)
      })
      req.resume()
    })

    request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('user=tobi')
      .expect(200, 'undefined', done)
  })

  it('should handle duplicated middleware', function (done) {
    var urlencodedParser = bodyParser.urlencoded()
    var server = createServer(function (req, res, next) {
      urlencodedParser(req, res, function (err) {
        if (err) return next(err)
        urlencodedParser(req, res, next)
      })
    })

    request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('user=tobi')
      .expect(200, '{"user":"tobi"}', done)
  })

  it('should not parse extended syntax', function (done) {
    request(this.server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('user[name][first]=Tobi')
      .expect(200, '{"user[name][first]":"Tobi"}', done)
  })

  describe('with extended option', function () {
    describe('when false', function () {
      before(function () {
        this.server = createServer({ extended: false })
      })

      it('should not parse extended syntax', function (done) {
        request(this.server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('user[name][first]=Tobi')
          .expect(200, '{"user[name][first]":"Tobi"}', done)
      })

      it('should parse multiple key instances', function (done) {
        request(this.server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('user=Tobi&user=Loki')
          .expect(200, '{"user":["Tobi","Loki"]}', done)
      })
    })

    describe('when true', function () {
      before(function () {
        this.server = createServer({ extended: true })
      })

      it('should parse multiple key instances', function (done) {
        request(this.server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('user=Tobi&user=Loki')
          .expect(200, '{"user":["Tobi","Loki"]}', done)
      })

      it('should parse extended syntax', function (done) {
        request(this.server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('user[name][first]=Tobi')
          .expect(200, '{"user":{"name":{"first":"Tobi"}}}', done)
      })

      it('should parse parameters with dots', function (done) {
        request(this.server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('user.name=Tobi')
          .expect(200, '{"user.name":"Tobi"}', done)
      })

      it('should parse fully-encoded extended syntax', function (done) {
        request(this.server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('user%5Bname%5D%5Bfirst%5D=Tobi')
          .expect(200, '{"user":{"name":{"first":"Tobi"}}}', done)
      })

      it('should parse array index notation', function (done) {
        request(this.server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('foo[0]=bar&foo[1]=baz')
          .expect(200, '{"foo":["bar","baz"]}', done)
      })

      it('should parse array index notation with large array', function (done) {
        var str = 'f[0]=0'

        for (var i = 1; i < 500; i++) {
          str += '&f[' + i + ']=' + i.toString(16)
        }

        request(this.server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send(str)
          .expect(function (res) {
            var obj = JSON.parse(res.text)
            assert.strictEqual(Object.keys(obj).length, 1)
            assert.strictEqual(Array.isArray(obj.f), true)
            assert.strictEqual(obj.f.length, 500)
          })
          .expect(200, done)
      })

      it('should parse array of objects syntax', function (done) {
        request(this.server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('foo[0][bar]=baz&foo[0][fizz]=buzz&foo[]=done!')
          .expect(200, '{"foo":[{"bar":"baz","fizz":"buzz"},"done!"]}', done)
      })

      it('should parse deep object', function (done) {
        var str = 'foo'

        for (var i = 0; i < 32; i++) {
          str += '[p]'
        }

        str += '=bar'

        request(this.server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send(str)
          .expect(function (res) {
            var obj = JSON.parse(res.text)
            assert.strictEqual(Object.keys(obj).length, 1)
            assert.strictEqual(typeof obj.foo, 'object')

            var depth = 0
            var ref = obj.foo
            while ((ref = ref.p)) { depth++ }
            assert.strictEqual(depth, 32)
          })
          .expect(200, done)
      })
    })
  })

  describe('with depth option', function () {
    describe('when custom value set', function () {
      it('should reject non positive numbers', function () {
        assert.throws(createServer.bind(null, { extended: true, depth: -1 }),
          /TypeError: option depth must be a zero or a positive number/)
        assert.throws(createServer.bind(null, { extended: true, depth: NaN }),
          /TypeError: option depth must be a zero or a positive number/)
        assert.throws(createServer.bind(null, { extended: true, depth: 'beep' }),
          /TypeError: option depth must be a zero or a positive number/)
      })

      it('should parse up to the specified depth', function (done) {
        this.server = createServer({ extended: true, depth: 10 })
        request(this.server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('a[b][c][d]=value')
          .expect(200, '{"a":{"b":{"c":{"d":"value"}}}}', done)
      })

      it('should not parse beyond the specified depth', function (done) {
        this.server = createServer({ extended: true, depth: 1 })
        request(this.server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('a[b][c][d][e]=value')
          .expect(400, '[querystring.parse.rangeError] The input exceeded the depth', done)
      })
    })

    describe('when default value', function () {
      before(function () {
        this.server = createServer({ extended: true })
      })

      it('should parse deeply nested objects', function (done) {
        var deepObject = 'a'
        for (var i = 0; i < 32; i++) {
          deepObject += '[p]'
        }
        deepObject += '=value'

        request(this.server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send(deepObject)
          .expect(function (res) {
            var obj = JSON.parse(res.text)
            var depth = 0
            var ref = obj.a
            while ((ref = ref.p)) { depth++ }
            assert.strictEqual(depth, 32)
          })
          .expect(200, done)
      })

      it('should not parse beyond the specified depth', function (done) {
        var deepObject = 'a'
        for (var i = 0; i < 33; i++) {
          deepObject += '[p]'
        }
        deepObject += '=value'

        request(this.server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send(deepObject)
          .expect(400, '[querystring.parse.rangeError] The input exceeded the depth', done)
      })
    })
  })

  describe('with inflate option', function () {
    describe('when false', function () {
      before(function () {
        this.server = createServer({ inflate: false })
      })

      it('should not accept content-encoding', function (done) {
        var test = request(this.server).post('/')
        test.set('Content-Encoding', 'gzip')
        test.set('Content-Type', 'application/x-www-form-urlencoded')
        test.write(Buffer.from('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'))
        test.expect(415, '[encoding.unsupported] content encoding unsupported', done)
      })
    })

    describe('when true', function () {
      before(function () {
        this.server = createServer({ inflate: true })
      })

      it('should accept content-encoding', function (done) {
        var test = request(this.server).post('/')
        test.set('Content-Encoding', 'gzip')
        test.set('Content-Type', 'application/x-www-form-urlencoded')
        test.write(Buffer.from('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'))
        test.expect(200, '{"name":"论"}', done)
      })
    })
  })

  describe('with limit option', function () {
    it('should 413 when over limit with Content-Length', function (done) {
      var buf = Buffer.alloc(1024, '.')
      request(createServer({ limit: '1kb' }))
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .set('Content-Length', '1028')
        .send('str=' + buf.toString())
        .expect(413, done)
    })

    it('should 413 when over limit with chunked encoding', function (done) {
      var buf = Buffer.alloc(1024, '.')
      var server = createServer({ limit: '1kb' })
      var test = request(server).post('/')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.set('Transfer-Encoding', 'chunked')
      test.write('str=')
      test.write(buf.toString())
      test.expect(413, done)
    })

    it('should 413 when inflated body over limit', function (done) {
      var server = createServer({ limit: '1kb' })
      var test = request(server).post('/')
      test.set('Content-Encoding', 'gzip')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(Buffer.from('1f8b080000000000000a2b2e29b2d51b05a360148c580000a0351f9204040000', 'hex'))
      test.expect(413, done)
    })

    it('should accept number of bytes', function (done) {
      var buf = Buffer.alloc(1024, '.')
      request(createServer({ limit: 1024 }))
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('str=' + buf.toString())
        .expect(413, done)
    })

    it('should not change when options altered', function (done) {
      var buf = Buffer.alloc(1024, '.')
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
      var buf = Buffer.alloc(10240, '.')
      var server = createServer({ limit: '8kb' })
      var test = request(server).post('/')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(buf)
      test.write(buf)
      test.write(buf)
      test.expect(413, done)
    })

    it('should not error when inflating', function (done) {
      var server = createServer({ limit: '1kb' })
      var test = request(server).post('/')
      test.set('Content-Encoding', 'gzip')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(Buffer.from('1f8b080000000000000a2b2e29b2d51b05a360148c580000a0351f92040400', 'hex'))
      test.expect(413, done)
    })
  })

  describe('with parameterLimit option', function () {
    describe('with extended: false', function () {
      it('should reject 0', function () {
        assert.throws(createServer.bind(null, { extended: false, parameterLimit: 0 }),
          /TypeError: option parameterLimit must be a positive number/)
      })

      it('should reject string', function () {
        assert.throws(createServer.bind(null, { extended: false, parameterLimit: 'beep' }),
          /TypeError: option parameterLimit must be a positive number/)
      })

      it('should 413 if over limit', function (done) {
        request(createServer({ extended: false, parameterLimit: 10 }))
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send(createManyParams(11))
          .expect(413, '[parameters.too.many] too many parameters', done)
      })

      it('should work when at the limit', function (done) {
        request(createServer({ extended: false, parameterLimit: 10 }))
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send(createManyParams(10))
          .expect(expectKeyCount(10))
          .expect(200, done)
      })

      it('should work if number is floating point', function (done) {
        request(createServer({ extended: false, parameterLimit: 10.1 }))
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send(createManyParams(11))
          .expect(413, /too many parameters/, done)
      })

      it('should work with large limit', function (done) {
        request(createServer({ extended: false, parameterLimit: 5000 }))
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send(createManyParams(5000))
          .expect(expectKeyCount(5000))
          .expect(200, done)
      })

      it('should work with Infinity limit', function (done) {
        request(createServer({ extended: false, parameterLimit: Infinity }))
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send(createManyParams(10000))
          .expect(expectKeyCount(10000))
          .expect(200, done)
      })
    })

    describe('with extended: true', function () {
      it('should reject 0', function () {
        assert.throws(createServer.bind(null, { extended: true, parameterLimit: 0 }),
          /TypeError: option parameterLimit must be a positive number/)
      })

      it('should reject string', function () {
        assert.throws(createServer.bind(null, { extended: true, parameterLimit: 'beep' }),
          /TypeError: option parameterLimit must be a positive number/)
      })

      it('should 413 if over limit', function (done) {
        request(createServer({ extended: true, parameterLimit: 10 }))
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send(createManyParams(11))
          .expect(413, '[parameters.too.many] too many parameters', done)
      })

      it('should work when at the limit', function (done) {
        request(createServer({ extended: true, parameterLimit: 10 }))
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send(createManyParams(10))
          .expect(expectKeyCount(10))
          .expect(200, done)
      })

      it('should work if number is floating point', function (done) {
        request(createServer({ extended: true, parameterLimit: 10.1 }))
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send(createManyParams(11))
          .expect(413, /too many parameters/, done)
      })

      it('should work with large limit', function (done) {
        request(createServer({ extended: true, parameterLimit: 5000 }))
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send(createManyParams(5000))
          .expect(expectKeyCount(5000))
          .expect(200, done)
      })

      it('should work with Infinity limit', function (done) {
        request(createServer({ extended: true, parameterLimit: Infinity }))
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send(createManyParams(10000))
          .expect(expectKeyCount(10000))
          .expect(200, done)
      })
    })
  })

  describe('with type option', function () {
    describe('when "application/vnd.x-www-form-urlencoded"', function () {
      before(function () {
        this.server = createServer({ type: 'application/vnd.x-www-form-urlencoded' })
      })

      it('should parse for custom type', function (done) {
        request(this.server)
          .post('/')
          .set('Content-Type', 'application/vnd.x-www-form-urlencoded')
          .send('user=tobi')
          .expect(200, '{"user":"tobi"}', done)
      })

      it('should ignore standard type', function (done) {
        request(this.server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('user=tobi')
          .expect(200, 'undefined', done)
      })
    })

    describe('when ["urlencoded", "application/x-pairs"]', function () {
      before(function () {
        this.server = createServer({
          type: ['urlencoded', 'application/x-pairs']
        })
      })

      it('should parse "application/x-www-form-urlencoded"', function (done) {
        request(this.server)
          .post('/')
          .set('Content-Type', 'application/x-www-form-urlencoded')
          .send('user=tobi')
          .expect(200, '{"user":"tobi"}', done)
      })

      it('should parse "application/x-pairs"', function (done) {
        request(this.server)
          .post('/')
          .set('Content-Type', 'application/x-pairs')
          .send('user=tobi')
          .expect(200, '{"user":"tobi"}', done)
      })

      it('should ignore application/x-foo', function (done) {
        request(this.server)
          .post('/')
          .set('Content-Type', 'application/x-foo')
          .send('user=tobi')
          .expect(200, 'undefined', done)
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
      var server = createServer({
        verify: function (req, res, buf) {
          if (buf[0] === 0x20) throw new Error('no leading space')
        }
      })

      request(server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(' user=tobi')
        .expect(403, '[entity.verify.failed] no leading space', done)
    })

    it('should allow custom codes', function (done) {
      var server = createServer({
        verify: function (req, res, buf) {
          if (buf[0] !== 0x20) return
          var err = new Error('no leading space')
          err.status = 400
          throw err
        }
      })

      request(server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(' user=tobi')
        .expect(400, '[entity.verify.failed] no leading space', done)
    })

    it('should allow custom type', function (done) {
      var server = createServer({
        verify: function (req, res, buf) {
          if (buf[0] !== 0x20) return
          var err = new Error('no leading space')
          err.type = 'foo.bar'
          throw err
        }
      })

      request(server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(' user=tobi')
        .expect(403, '[foo.bar] no leading space', done)
    })

    it('should allow pass-through', function (done) {
      var server = createServer({
        verify: function (req, res, buf) {
          if (buf[0] === 0x5b) throw new Error('no arrays')
        }
      })

      request(server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('user=tobi')
        .expect(200, '{"user":"tobi"}', done)
    })

    it('should 415 on unknown charset prior to verify', function (done) {
      var server = createServer({
        verify: function (req, res, buf) {
          throw new Error('unexpected verify call')
        }
      })

      var test = request(server).post('/')
      test.set('Content-Type', 'application/x-www-form-urlencoded; charset=x-bogus')
      test.write(Buffer.from('00000000', 'hex'))
      test.expect(415, '[charset.unsupported] unsupported charset "X-BOGUS"', done)
    })
  })

  describeAsyncHooks('async local storage', function () {
    before(function () {
      var urlencodedParser = bodyParser.urlencoded()
      var store = { foo: 'bar' }

      this.server = createServer(function (req, res, next) {
        var asyncLocalStorage = new asyncHooks.AsyncLocalStorage()

        asyncLocalStorage.run(store, function () {
          urlencodedParser(req, res, function (err) {
            var local = asyncLocalStorage.getStore()

            if (local) {
              res.setHeader('x-store-foo', String(local.foo))
            }

            next(err)
          })
        })
      })
    })

    it('should presist store', function (done) {
      request(this.server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('user=tobi')
        .expect(200)
        .expect('x-store-foo', 'bar')
        .expect('{"user":"tobi"}')
        .end(done)
    })

    it('should presist store when unmatched content-type', function (done) {
      request(this.server)
        .post('/')
        .set('Content-Type', 'application/fizzbuzz')
        .send('buzz')
        .expect(200)
        .expect('x-store-foo', 'bar')
        .expect('undefined')
        .end(done)
    })

    it('should presist store when inflated', function (done) {
      var test = request(this.server).post('/')
      test.set('Content-Encoding', 'gzip')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(Buffer.from('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'))
      test.expect(200)
      test.expect('x-store-foo', 'bar')
      test.expect('{"name":"论"}')
      test.end(done)
    })

    it('should presist store when inflate error', function (done) {
      var test = request(this.server).post('/')
      test.set('Content-Encoding', 'gzip')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(Buffer.from('1f8b080000000000000bcb4bcc4db57db16e170099a4bad6080000', 'hex'))
      test.expect(400)
      test.expect('x-store-foo', 'bar')
      test.end(done)
    })

    it('should presist store when limit exceeded', function (done) {
      request(this.server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('user=' + Buffer.alloc(1024 * 100, '.').toString())
        .expect(413)
        .expect('x-store-foo', 'bar')
        .end(done)
    })
  })

  describe('charset', function () {
    before(function () {
      this.server = createServer()
    })

    it('should parse utf-8', function (done) {
      var test = request(this.server).post('/')
      test.set('Content-Type', 'application/x-www-form-urlencoded; charset=utf-8')
      test.write(Buffer.from('6e616d653de8aeba', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should parse when content-length != char length', function (done) {
      var test = request(this.server).post('/')
      test.set('Content-Type', 'application/x-www-form-urlencoded; charset=utf-8')
      test.set('Content-Length', '7')
      test.write(Buffer.from('746573743dc3a5', 'hex'))
      test.expect(200, '{"test":"å"}', done)
    })

    it('should default to utf-8', function (done) {
      var test = request(this.server).post('/')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(Buffer.from('6e616d653de8aeba', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should fail on unknown charset', function (done) {
      var test = request(this.server).post('/')
      test.set('Content-Type', 'application/x-www-form-urlencoded; charset=koi8-r')
      test.write(Buffer.from('6e616d653dcec5d4', 'hex'))
      test.expect(415, '[charset.unsupported] unsupported charset "KOI8-R"', done)
    })
  })

  describe('encoding', function () {
    before(function () {
      this.server = createServer({ limit: '10kb' })
    })

    it('should parse without encoding', function (done) {
      var test = request(this.server).post('/')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(Buffer.from('6e616d653de8aeba', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should support identity encoding', function (done) {
      var test = request(this.server).post('/')
      test.set('Content-Encoding', 'identity')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(Buffer.from('6e616d653de8aeba', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should support gzip encoding', function (done) {
      var test = request(this.server).post('/')
      test.set('Content-Encoding', 'gzip')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(Buffer.from('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should support deflate encoding', function (done) {
      var test = request(this.server).post('/')
      test.set('Content-Encoding', 'deflate')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(Buffer.from('789ccb4bcc4db57db16e17001068042f', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should support brotli encoding', function (done) {
      var test = request(this.server).post('/')
      test.set('Content-Encoding', 'br')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(Buffer.from('8b03806e616d653de8aeba03', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should be case-insensitive', function (done) {
      var test = request(this.server).post('/')
      test.set('Content-Encoding', 'GZIP')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(Buffer.from('1f8b080000000000000bcb4bcc4db57db16e170099a4bad608000000', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should 415 on unknown encoding', function (done) {
      var test = request(this.server).post('/')
      test.set('Content-Encoding', 'nulls')
      test.set('Content-Type', 'application/x-www-form-urlencoded')
      test.write(Buffer.from('000000000000', 'hex'))
      test.expect(415, '[encoding.unsupported] unsupported content encoding "nulls"', done)
    })
  })
})

function createManyParams (count) {
  var str = ''

  if (count === 0) {
    return str
  }

  str += '0=0'

  for (var i = 1; i < count; i++) {
    var n = i.toString(36)
    str += '&' + n + '=' + n
  }

  return str
}

function createServer (opts) {
  var _bodyParser = typeof opts !== 'function'
    ? bodyParser.urlencoded(opts)
    : opts

  return http.createServer(function (req, res) {
    _bodyParser(req, res, function (err) {
      if (err) {
        res.statusCode = err.status || 500
        res.end('[' + err.type + '] ' + err.message)
      } else {
        res.statusCode = 200
        res.end(JSON.stringify(req.body) || typeof req.body)
      }
    })
  })
}

function expectKeyCount (count) {
  return function (res) {
    assert.strictEqual(Object.keys(JSON.parse(res.text)).length, count)
  }
}

function tryRequire (name) {
  try {
    return require(name)
  } catch (e) {
    return {}
  }
}
