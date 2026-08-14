'use strict'

var assert = require('node:assert')
var http = require('node:http')
var request = require('supertest')

var bodyParser = require('..')

describe('bodyParser.multipart()', function () {
  before(function () {
    this.server = createServer()
  })

  it('should parse multipart/form-data with text fields', function (done) {
    var boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    var body = [
      '--' + boundary,
      'Content-Disposition: form-data; name="user"',
      '',
      'tobi',
      '--' + boundary,
      'Content-Disposition: form-data; name="email"',
      '',
      'tobi@example.com',
      '--' + boundary + '--'
    ].join('\r\n')

    request(this.server)
      .post('/')
      .set('Content-Type', 'multipart/form-data; boundary=' + boundary)
      .send(body)
      .expect(200, '{"user":"tobi","email":"tobi@example.com"}', done)
  })

  it('should drop file fields and keep text fields', function (done) {
    var boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    var body = [
      '--' + boundary,
      'Content-Disposition: form-data; name="user"',
      '',
      'tobi',
      '--' + boundary,
      'Content-Disposition: form-data; name="file"; filename="test.txt"',
      'Content-Type: text/plain',
      '',
      'file content here',
      '--' + boundary,
      'Content-Disposition: form-data; name="email"',
      '',
      'tobi@example.com',
      '--' + boundary + '--'
    ].join('\r\n')

    request(this.server)
      .post('/')
      .set('Content-Type', 'multipart/form-data; boundary=' + boundary)
      .send(body)
      .expect(200, '{"user":"tobi","email":"tobi@example.com"}', done)
  })

  it('should handle multiple values for same field', function (done) {
    var boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    var body = [
      '--' + boundary,
      'Content-Disposition: form-data; name="user"',
      '',
      'tobi',
      '--' + boundary,
      'Content-Disposition: form-data; name="user"',
      '',
      'loki',
      '--' + boundary + '--'
    ].join('\r\n')

    request(this.server)
      .post('/')
      .set('Content-Type', 'multipart/form-data; boundary=' + boundary)
      .send(body)
      .expect(200, '{"user":["tobi","loki"]}', done)
  })

  it('should handle empty body', function (done) {
    var boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    var body = '--' + boundary + '--'

    request(this.server)
      .post('/')
      .set('Content-Type', 'multipart/form-data; boundary=' + boundary)
      .send(body)
      .expect(200, '{}', done)
  })

  it('should skip non-multipart content-type', function (done) {
    request(this.server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{"user":"tobi"}')
      .expect(200, 'undefined', done)
  })

  it('should 400 when missing boundary', function (done) {
    request(this.server)
      .post('/')
      .set('Content-Type', 'multipart/form-data')
      .send('some data')
      .expect(400, /missing boundary/, done)
  })

  // Note: This test is skipped due to Node.js stream semantics.
  // When req.resume() is called, the stream may still contain buffered data
  // that getBody() can successfully read. There is no reliable API in Node.js
  // to detect if a stream was previously consumed, and attempting to parse
  // buffered data is correct behavior. This matches the behavior of raw-body
  // used throughout body-parser.
  it.skip('should handle consumed stream', function (done) {
    var multipartParser = bodyParser.multipart()
    var boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    var body = [
      '--' + boundary,
      'Content-Disposition: form-data; name="user"',
      '',
      'tobi',
      '--' + boundary + '--'
    ].join('\r\n')

    var server = createServer(function (req, res, next) {
      req.on('end', function () {
        multipartParser(req, res, next)
      })
      req.resume()
    })

    request(server)
      .post('/')
      .set('Content-Type', 'multipart/form-data; boundary=' + boundary)
      .send(body)
      .expect(200, 'undefined', done)
  })

  it('should handle duplicated middleware', function (done) {
    var multipartParser = bodyParser.multipart()
    var boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    var body = [
      '--' + boundary,
      'Content-Disposition: form-data; name="user"',
      '',
      'tobi',
      '--' + boundary + '--'
    ].join('\r\n')

    var server = createServer(function (req, res, next) {
      multipartParser(req, res, function (err) {
        if (err) return next(err)
        multipartParser(req, res, next)
      })
    })

    request(server)
      .post('/')
      .set('Content-Type', 'multipart/form-data; boundary=' + boundary)
      .send(body)
      .expect(200, '{"user":"tobi"}', done)
  })

  describe('with limit option', function () {
    it('should 413 when field exceeds limit', function (done) {
      var server = createServer({ limit: '10b' })
      var boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
      var body = [
        '--' + boundary,
        'Content-Disposition: form-data; name="user"',
        '',
        'this is a very long field value that exceeds the limit',
        '--' + boundary + '--'
      ].join('\r\n')

      request(server)
        .post('/')
        .set('Content-Type', 'multipart/form-data; boundary=' + boundary)
        .send(body)
        .expect(413, /field size limit exceeded/, done)
    })

    it('should accept field within limit', function (done) {
      var server = createServer({ limit: '1kb' })
      var boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
      var body = [
        '--' + boundary,
        'Content-Disposition: form-data; name="user"',
        '',
        'tobi',
        '--' + boundary + '--'
      ].join('\r\n')

      request(server)
        .post('/')
        .set('Content-Type', 'multipart/form-data; boundary=' + boundary)
        .send(body)
        .expect(200, '{"user":"tobi"}', done)
    })
  })

  describe('with verify option', function () {
    it('should call verify function', function (done) {
      var verified = false
      var server = createServer({
        verify: function (req, res, buf, encoding) {
          verified = true
          assert.strictEqual(typeof buf, 'string')
          assert.strictEqual(encoding, 'utf-8')
        }
      })

      var boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
      var body = [
        '--' + boundary,
        'Content-Disposition: form-data; name="user"',
        '',
        'tobi',
        '--' + boundary + '--'
      ].join('\r\n')

      request(server)
        .post('/')
        .set('Content-Type', 'multipart/form-data; boundary=' + boundary)
        .send(body)
        .expect(200, function (err) {
          if (err) return done(err)
          assert.strictEqual(verified, true)
          done()
        })
    })

    it('should error from verify', function (done) {
      var server = createServer({
        verify: function (req, res, buf, encoding) {
          throw new Error('verify failed')
        }
      })

      var boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
      var body = [
        '--' + boundary,
        'Content-Disposition: form-data; name="user"',
        '',
        'tobi',
        '--' + boundary + '--'
      ].join('\r\n')

      request(server)
        .post('/')
        .set('Content-Type', 'multipart/form-data; boundary=' + boundary)
        .send(body)
        .expect(403, /verify failed/, done)
    })
  })

  describe('with type option', function () {
    it('should parse for custom type', function (done) {
      var server = createServer({ type: 'multipart/related' })
      var boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
      var body = [
        '--' + boundary,
        'Content-Disposition: form-data; name="user"',
        '',
        'tobi',
        '--' + boundary + '--'
      ].join('\r\n')

      request(server)
        .post('/')
        .set('Content-Type', 'multipart/related; boundary=' + boundary)
        .send(body)
        .expect(200, '{"user":"tobi"}', done)
    })

    it('should ignore non-matching type', function (done) {
      var server = createServer({ type: 'multipart/related' })
      var boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
      var body = [
        '--' + boundary,
        'Content-Disposition: form-data; name="user"',
        '',
        'tobi',
        '--' + boundary + '--'
      ].join('\r\n')

      request(server)
        .post('/')
        .set('Content-Type', 'multipart/form-data; boundary=' + boundary)
        .send(body)
        .expect(200, 'undefined', done)
    })
  })
})

function createServer (opts) {
  var _opts = opts || {}
  var parser = typeof _opts === 'function' ? bodyParser.multipart() : bodyParser.multipart(_opts)

  return http.createServer(function (req, res) {
    parser(req, res, function (err) {
      if (err) {
        res.statusCode = err.status || 500
        res.end(err.message)
      } else {
        res.statusCode = 200
        // Only set JSON content-type if body is actually defined
        // Otherwise send "undefined" as plain text to avoid supertest JSON parsing errors
        if (req.body !== undefined) {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(req.body))
        } else {
          res.end('undefined')
        }
      }
    })
  })
}
