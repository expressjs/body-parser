'use strict'

const assert = require('node:assert')
const http = require('node:http')
const request = require('supertest')

const { generic } = require('..')

const PARSERS = {
  // Reverses the input string
  reverse: (buf, charset) => buf.toString(charset).split('').reverse().join(''),

  json: (buf, charset) => JSON.parse(buf.toString(charset))
}

// Tracks if a function was called
function trackCall (fn) {
  let called = false
  const wrapped = function (...args) {
    called = true
    return fn?.(...args)
  }
  wrapped.called = () => called
  return wrapped
}

describe('generic()', function () {
  it('should reject without parse function', function () {
    assert.throws(function () {
      generic()
    }, /option parse must be a function/)
  })

  it('should reject without type option', function () {
    assert.throws(function () {
      generic({ parse: function () {} })
    }, /option type must be specified for generic parser/)
  })

  describe('core functionality', function () {
    it('should provide request body to parse function and use result as req.body', function (done) {
      const testResult = { parsed: true, id: Date.now() }
      const testBody = 'hello parser'

      const parseFn = trackCall(function (body, charset) {
        const content = body.toString(charset)
        assert.strictEqual(content, testBody, 'should receive request body content')
        return testResult
      })

      const server = createServer(parseFn)

      request(server)
        .post('/')
        .set('Content-Type', 'text/plain')
        .send(testBody)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          assert(parseFn.called(), 'parse function should be called')
          const body = JSON.parse(res.text)
          assert.deepStrictEqual(body, testResult, 'parse result should become req.body')
          done()
        })
    })

    describe('request body handling', function () {
      it('should call parse function with empty buffer for Content-Length: 0', function (done) {
        const parseFn = trackCall(function (buf, _charset) {
          assert.strictEqual(buf.length, 0, 'buffer should be empty')
          // Return empty object like JSON/URL-encoded parsers do
          return { empty: true }
        })

        const server = createServer(parseFn)

        request(server)
          .post('/')  // Using POST with empty body
          .set('Content-Type', 'text/plain')
          .set('Content-Length', '0')
          .expect(200, '{"empty":true}')
          .end(function (err) {
            if (err) return done(err)
            assert(parseFn.called(), 'parse function should be called for empty body')
            done()
          })
      })

      it('should call parse function with empty buffer for chunked encoding', function (done) {
        const parseFn = trackCall(function (buf, _charset) {
          assert.strictEqual(buf.length, 0, 'buffer should be empty')
          // Return empty object like JSON/URL-encoded parsers do
          return { empty: true }
        })

        const server = createServer(parseFn)

        request(server)
          .post('/')  // Using POST with empty body
          .set('Content-Type', 'text/plain')
          .set('Transfer-Encoding', 'chunked')
          .expect(200, '{"empty":true}')
          .end(function (err) {
            if (err) return done(err)
            assert(parseFn.called(), 'parse function should be called for empty body')
            done()
          })
      })

      it('should NOT call parse function for requests with no body concept', function (done) {
        const parseFn = trackCall(function (buf, _charset) {
          return { called: true }
        })

        const server = createServer(parseFn)
        
        request(server)
          .get('/')  // GET with no body concept
          .expect(200, 'undefined')
          .end(function (err) {
            if (err) return done(err)
            assert.strictEqual(parseFn.called(), false, 'parse function should not be called for no-body requests')
            done()
          })
      })
    })
  })

  describe('error handling', function () {
    it('should return 400 for parsing errors', function (done) {
      const server1 = createServer(function (_buf) {
        throw new Error('parse error')
      })

      const server2 = createServer({
        type: 'application/json'
      }, PARSERS.json)

      request(server1)
        .post('/')
        .set('Content-Type', 'text/plain')
        .send('hello')
        .expect(400, '[entity.parse.failed] parse error')
        .end(function (err) {
          if (err) return done(err)

          request(server2)
            .post('/')
            .set('Content-Type', 'application/json')
            .send('{"broken": "json')
            .expect(400)
            .expect(function (res) {
              assert(res.text.includes('entity.parse.failed'))
            })
            .end(done)
        })
    })

    it('should 413 when body too large', function (done) {
      const server = createServer({ limit: '1kb' }, function (buf, charset) {
        return buf.toString(charset)
      })

      const largeText = new Array(1024 * 10 + 1).join('x')

      request(server)
        .post('/')
        .set('Content-Type', 'text/plain')
        .send(largeText)
        .expect(413, '[entity.too.large] request entity too large', done)
    })
  })

  describe('content-type matching', function () {
    it('should match exact content type', function (done) {
      const server = createServer({
        type: 'text/markdown'
      }, _buf => 'markdown matched')

      request(server)
        .post('/')
        .set('Content-Type', 'text/markdown')
        .send('# heading')
        .expect(200, '"markdown matched"', done)
    })

    it('should match custom media type', function (done) {
      const server = createServer({
        type: 'application/vnd.custom+plain'
      }, function (buf, charset) {
        return buf.toString(charset)
      })

      request(server)
        .post('/')
        .set('Content-Type', 'application/vnd.custom+plain')
        .send('custom format')
        .expect(200, '"custom format"', done)
    })

    it('should not parse when content-type does not match', function (done) {
      const server = createServer({
        type: 'text/markdown'
      }, _buf => 'should not be called')

      request(server)
        .post('/')
        .set('Content-Type', 'text/html')
        .send('<h1>heading</h1>')
        .expect(200, 'undefined', done)
    })

    it('should handle content-type with parameters besides charset', function (done) {
      const server = createServer({
        type: 'text/plain'
      }, function (buf, charset) {
        return buf.toString(charset)
      })

      request(server)
        .post('/')
        .set('Content-Type', 'text/plain; version=1.0; boundary=something')
        .send('hello with params')
        .expect(200, '"hello with params"', done)
    })

    it('should 415 when charset does not match', function (done) {
      const server = createServer({
        charset: 'utf-8',
        type: 'text/plain'
      }, function (buf, charset) {
        return buf.toString(charset)
      })

      request(server)
        .post('/')
        .set('Content-Type', 'text/plain; charset=iso-8859-1')
        .send('hello world')
        .expect(415, '[charset.unsupported] unsupported charset "ISO-8859-1"', done)
    })

    describe('with array of types', function () {
      it('should match first type in array', function (done) {
        const server = createServer({
          type: ['application/x-foo', 'application/x-bar']
        }, _buf => 'multi-type matched')

        request(server)
          .post('/')
          .set('Content-Type', 'application/x-foo')
          .send('foo data')
          .expect(200, '"multi-type matched"', done)
      })

      it('should match second type in array', function (done) {
        const server = createServer({
          type: ['application/x-foo', 'application/x-bar']
        }, _buf => 'multi-type matched')

        request(server)
          .post('/')
          .set('Content-Type', 'application/x-bar')
          .send('bar data')
          .expect(200, '"multi-type matched"', done)
      })
    })

    describe('with function type checker', function () {
      it('should match when function returns true', function (done) {
        const typeCheckFn = trackCall(function (req) {
          assert(req && req.headers, 'should be called with request object')
          return /^text\//.test(req.headers['content-type'])
        })

        const server = createServer({
          type: typeCheckFn
        }, function (buf, charset) {
          return buf.toString(charset)
        })

        request(server)
          .post('/')
          .set('Content-Type', 'text/plain')
          .send('custom format')
          .expect(200)
          .end(function (err, _res) {
            if (err) return done(err)
            assert(typeCheckFn.called(), 'type check function should be called')
            done()
          })
      })

      it('should support custom matching logic', function (done) {
        const server = createServer({
          type: req => req.headers['content-type']?.includes('custom')
        }, _buf => 'function match')

        request(server)
          .post('/')
          .set('Content-Type', 'application/custom+type')
          .send('custom data')
          .expect(200, '"function match"', done)
      })
    })
  })

  describe('with verify option', function () {
    it('should verify request', function (done) {
      const verifyFn = trackCall(function (_req, _res, buf) {
        if (buf[0] === 0x5b) throw new Error('no arrays')
      })

      const server = createServer({
        verify: verifyFn,
        type: 'application/json'
      }, PARSERS.json)

      request(server)
        .post('/')
        .set('Content-Type', 'application/json')
        .send('{"user":"tobi"}')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          assert.strictEqual(verifyFn.called(), true, 'verify function should be called')
          assert.strictEqual(res.text, '{"user":"tobi"}')
          done()
        })
    })

    it('should 403 when verification fails', function (done) {
      const verifyFn = trackCall(function (_req, _res, buf) {
        if (buf[0] === 0x5b) throw new Error('no arrays')
      })

      const server = createServer({
        verify: verifyFn,
        type: 'application/json'
      }, PARSERS.json)

      request(server)
        .post('/')
        .set('Content-Type', 'application/json')
        .send('[1,2,3]')
        .expect(403)
        .end(function (err, res) {
          if (err) return done(err)
          assert.strictEqual(verifyFn.called(), true, 'verify function should be called')
          assert.strictEqual(res.text, '[entity.verify.failed] no arrays')
          done()
        })
    })

    it('should not call verify when content-type does not match', function (done) {
      const verifyFn = trackCall()

      const server = createServer({
        verify: verifyFn,
        type: 'application/json'
      }, PARSERS.json)

      request(server)
        .post('/')
        .set('Content-Type', 'text/plain')
        .send('hello world')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          assert.strictEqual(verifyFn.called(), false, 'verify function should not be called')
          assert.strictEqual(res.text, 'undefined')
          done()
        })
    })

    it('should not call verify when request has no body', function (done) {
      const verifyFn = trackCall()

      const server = createServer({
        verify: verifyFn,
        type: 'application/json'
      }, PARSERS.json)

      request(server)
        .get('/')
        .set('Content-Type', 'application/json')
        .expect(200)
        .end(function (err, _res) {
          if (err) return done(err)
          assert.strictEqual(verifyFn.called(), false, 'verify function should not be called')
          done()
        })
    })

    // Skipped environment-specific test

    it('should not call verify when charset is not supported', function (done) {
      const verifyFn = trackCall()

      const server = createServer({
        verify: verifyFn,
        charset: 'utf-8',
        type: 'application/json'
      }, PARSERS.json)

      request(server)
        .post('/')
        .set('Content-Type', 'application/json; charset=iso-8859-1')
        .send('{"test":"value"}')
        .expect(415)
        .end(function (err, _res) {
          if (err) return done(err)
          assert.strictEqual(verifyFn.called(), false, 'verify function should not be called')
          done()
        })
    })
  })
})

function createServer (options, parserImpl) {
  let parser = parserImpl
  let opts = options
  if (typeof options === 'function') {
    parser = options
    opts = {}
  }

  const _parser = parser || PARSERS.json
  if (!opts.type) opts.type = 'text/plain'

  return http.createServer(function (req, res) {
    generic({ ...opts, parse: _parser })(req, res, function (err) {
      if (err) {
        res.statusCode = err.status || 500
        res.end(err.message ? '[' + err.type + '] ' + err.message : err.type)
        return
      }

      res.statusCode = 200
      res.setHeader('Content-Type', 'text/plain')
      res.end(typeof req.body === 'undefined' ? 'undefined' : JSON.stringify(req.body))
    })
  })
}
