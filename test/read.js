
var http = require('http')
var request = require('supertest')

describe('read', function () {
  describe('with raw-body loaded as an ES module namespace', function () {
    var bodyParser

    before(function () {
      // raw-body >= 4 is ESM-only. On Node.js >= 22 require() of an ESM
      // package returns the module namespace object, not the function.
      var rawBodyPath = require.resolve('raw-body')
      var realGetRawBody = require(rawBodyPath)
      require.cache[rawBodyPath].exports = {
        __esModule: true,
        default: realGetRawBody,
        getRawBody: realGetRawBody
      }

      clearBodyParserCache()
      bodyParser = require('..')
    })

    after(function () {
      var rawBodyPath = require.resolve('raw-body')
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
  })
})

function clearBodyParserCache () {
  var root = require.resolve('..').replace(/index\.js$/, '')
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
