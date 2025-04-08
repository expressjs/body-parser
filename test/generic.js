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

  it('should parse text body with custom parser', function (done) {
    const server = createServer(PARSERS.reverse)

    request(server)
      .post('/')
      .set('Content-Type', 'text/plain')
      .send('hello world')
      .expect(200, '"dlrow olleh"', done)
  })

  it('should handle Content-Length: 0', function (done) {
    const server = createServer(PARSERS.reverse)

    request(server)
      .get('/')
      .set('Content-Type', 'text/plain')
      .set('Content-Length', '0')
      .expect(200, '""', done)
  })

  it('should handle empty message-body', function (done) {
    const server = createServer(PARSERS.reverse)

    request(server)
      .get('/')
      .set('Content-Type', 'text/plain')
      .set('Transfer-Encoding', 'chunked')
      .expect(200, '""', done)
  })

  it('should 400 on parser error', function (done) {
    const server = createServer(function (buf) {
      throw new Error('parse error')
    })

    request(server)
      .post('/')
      .set('Content-Type', 'text/plain')
      .send('hello')
      .expect(400, '[entity.parse.failed] parse error', done)
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

  it('should match content-type correctly', function (done) {
    const server = createServer({ type: 'application/vnd.custom+plain' }, function (buf, charset) {
      return buf.toString(charset)
    })

    request(server)
      .post('/')
      .set('Content-Type', 'application/vnd.custom+plain')
      .send('custom format')
      .expect(200, '"custom format"', done)
  })

  it('should not parse when content-type does not match', function (done) {
    const server = createServer({ type: 'application/xml' }, function (buf, charset) {
      return buf.toString(charset)
    })

    request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{"hello":"world"}')
      .expect(200, 'undefined', done)
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

  describe('with verify option', function () {
    it('should verify request', function (done) {
      let verifyCalled = false

      const server = createServer({
        verify: function (req, res, buf) {
          verifyCalled = true
          if (buf[0] === 0x5b) throw new Error('no arrays')
        },
        type: 'application/json'
      }, PARSERS.json)

      request(server)
        .post('/')
        .set('Content-Type', 'application/json')
        .send('{"user":"tobi"}')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          assert.strictEqual(verifyCalled, true, 'verify function should be called')
          assert.strictEqual(res.text, '{"user":"tobi"}')
          done()
        })
    })

    it('should 403 when verification fails', function (done) {
      let verifyCalled = false

      const server = createServer({
        verify: function (req, res, buf) {
          verifyCalled = true
          if (buf[0] === 0x5b) throw new Error('no arrays')
        },
        type: 'application/json'
      }, PARSERS.json)

      request(server)
        .post('/')
        .set('Content-Type', 'application/json')
        .send('[1,2,3]')
        .expect(403)
        .end(function (err, res) {
          if (err) return done(err)
          assert.strictEqual(verifyCalled, true, 'verify function should be called')
          assert.strictEqual(res.text, '[entity.verify.failed] no arrays')
          done()
        })
    })

    it('should not call verify when content-type does not match', function (done) {
      let verifyCalled = false

      const server = createServer({
        verify: function (req, res, buf) {
          verifyCalled = true
        },
        type: 'application/json'
      }, PARSERS.json)

      request(server)
        .post('/')
        .set('Content-Type', 'text/plain')
        .send('hello world')
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          assert.strictEqual(verifyCalled, false, 'verify function should not be called')
          assert.strictEqual(res.text, 'undefined')
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

  // Default type for tests
  if (!opts.type) {
    opts.type = 'text/plain'
  }

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

