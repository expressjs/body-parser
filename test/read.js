'use strict'

const { describe, it, before, after } = require('mocha')
const assert = require('node:assert')
const http = require('node:http')
const request = require('supertest')

describe('read', function () {
  describe('with raw-body loaded as an ES module namespace', function () {
    let bodyParser

    before(function () {
      // raw-body >= 4 is ESM-only. On Node.js >= 22 require() of an ESM
      // package returns the module namespace object, not the function.
      const rawBodyPath = require.resolve('raw-body')
      const realGetRawBody = require(rawBodyPath)
      require.cache[rawBodyPath].exports = {
        __esModule: true,
        default: realGetRawBody,
        getRawBody: realGetRawBody
      }

      clearBodyParserCache()
      bodyParser = require('..')
    })

    after(function () {
      const rawBodyPath = require.resolve('raw-body')
      delete require.cache[rawBodyPath]
      clearBodyParserCache()
    })

    it('should parse json', function (done) {
      request(createServer(bodyParser.json()))
        .post('/')
        .set('Content-Type', 'application/json')
        .send('{"user":"tobi"}')
        .expect(200, '{"user":"tobi"}', done)
    })

    it('should parse urlencoded', function (done) {
      request(createServer(bodyParser.urlencoded({ extended: false })))
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('user=tobi')
        .expect(200, '{"user":"tobi"}', done)
    })

    it('should parse text', function (done) {
      request(createServer(bodyParser.text()))
        .post('/')
        .set('Content-Type', 'text/plain')
        .send('user is tobi')
        .expect(200, '"user is tobi"', done)
    })

    it('should parse raw', function (done) {
      request(createServer(bodyParser.raw()))
        .post('/')
        .set('Content-Type', 'application/octet-stream')
        .send('the user is tobi')
        .expect(200, 'buf:746865207573657220697320746f6269', done)
    })

    it('should decode a non-UTF-8 charset with iconv-lite', function (done) {
      const test = request(createServer(bodyParser.json())).post('/')
      test.set('Content-Type', 'application/json; charset=utf-16')
      test.write(Buffer.from('feff007b0022006e0061006d00650022003a00228bba0022007d', 'hex'))
      test.expect(200, '{"name":"论"}', done)
    })

    it('should pass the original bytes to verify and decoded text to the parser', function (done) {
      const body = Buffer.from('user is café', 'latin1')
      let verified

      const parser = bodyParser.text({
        verify: function (req, res, buf, encoding) {
          verified = { buf, encoding }
        }
      })

      const test = request(createServer(parser)).post('/')
      test.set('Content-Type', 'text/plain; charset=iso-8859-1')
      test.write(body)
      test.expect(200, '"user is café"').end(function (err) {
        if (err) return done(err)
        assert.ok(Buffer.isBuffer(verified.buf))
        assert.strictEqual(verified.buf.toString('hex'), body.toString('hex'))
        assert.strictEqual(verified.encoding, 'iso-8859-1')
        done()
      })
    })

    it('should 415 on an unsupported charset', function (done) {
      request(createServer(bodyParser.json()))
        .post('/')
        .set('Content-Type', 'application/json; charset=x-bogus')
        .send('{"user":"tobi"}')
        .expect(415, '[charset.unsupported] unsupported charset "X-BOGUS"', done)
    })
  })
})

function clearBodyParserCache () {
  const root = require.resolve('..').replace(/index\.js$/, '')
  Object.keys(require.cache).forEach(function (key) {
    if (key.indexOf(root) === 0 && key.indexOf('node_modules') === -1) {
      delete require.cache[key]
    }
  })
}

function createServer (parser) {
  return http.createServer(function (req, res) {
    parser(req, res, function (err) {
      if (err) {
        res.statusCode = err.status || 500
        res.end('[' + err.type + '] ' + err.message)
        return
      }

      res.statusCode = 200
      res.end(Buffer.isBuffer(req.body)
        ? 'buf:' + req.body.toString('hex')
        : JSON.stringify(req.body))
    })
  })
}
