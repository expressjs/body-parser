
var http = require('http')
var methods = require('methods')
var request = require('supertest')

var bodyParser = require('..')

describe('bodyParser()', function () {
  before(function () {
    this.server = createServer()
  })

  it('should default to {}', function (done) {
    request(this.server)
      .post('/')
      .expect(200, '{}', done)
  })

  it('should parse JSON', function (done) {
    request(this.server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{"user":"tobi"}')
      .expect(200, '{"user":"tobi"}', done)
  })

  it('should parse x-www-form-urlencoded', function (done) {
    request(this.server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('user=tobi')
      .expect(200, '{"user":"tobi"}', done)
  })

  it('should handle duplicated middleware', function (done) {
    var _bodyParser = bodyParser()
    var server = http.createServer(function (req, res) {
      _bodyParser(req, res, function (err0) {
        _bodyParser(req, res, function (err1) {
          var err = err0 || err1
          res.statusCode = err ? (err.status || 500) : 200
          res.end(err ? err.message : JSON.stringify(req.body))
        })
      })
    })

    request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{"user":"tobi"}')
      .expect(200, '{"user":"tobi"}', done)
  })

  describe('http methods', function () {
    before(function () {
      var _bodyParser = bodyParser()

      this.server = http.createServer(function (req, res) {
        _bodyParser(req, res, function (err) {
          if (err) {
            res.statusCode = 500
            res.end(err.message)
            return
          }

          res.statusCode = req.headers['x-expect-method'] === req.method
            ? req.body.user === 'tobi'
              ? 201
              : 400
            : 405
          res.end()
        })
      })
    })

    function getMajorVersion (versionString) {
      return versionString.split('.')[0]
    }

    function shouldSkipQuery (versionString) {
      // Skipping HTTP QUERY tests on Node 21, it is reported in http.METHODS on 21.7.2 but not supported
      // update this implementation to run on supported versions of 21 once they exist
      // upstream tracking https://github.com/nodejs/node/issues/51562
      // express tracking issue: https://github.com/expressjs/express/issues/5615
      return getMajorVersion(versionString) === '21'
    }

    methods.slice().sort().forEach(function (method) {
      if (method === 'connect') return

      it('should support ' + method.toUpperCase() + ' requests', function (done) {
        if (method === 'query' && shouldSkipQuery(process.versions.node)) {
          this.skip()
        }
        request(this.server)[method]('/')
          .set('Content-Type', 'application/json')
          .set('Content-Length', '15')
          .set('X-Expect-Method', method.toUpperCase())
          .send('{"user":"tobi"}')
          .expect(201, done)
      })
    })
  })

  describe('with type option', function () {
    before(function () {
      this.server = createServer({ limit: '1mb', type: 'application/octet-stream' })
    })

    it('should parse JSON', function (done) {
      request(this.server)
        .post('/')
        .set('Content-Type', 'application/json')
        .send('{"user":"tobi"}')
        .expect(200, '{"user":"tobi"}', done)
    })

    it('should parse x-www-form-urlencoded', function (done) {
      request(this.server)
        .post('/')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('user=tobi')
        .expect(200, '{"user":"tobi"}', done)
    })
  })

  describe('with verify option', function () {
    it('should apply to json', function (done) {
      var server = createServer({
        verify: function (req, res, buf) {
          if (buf[0] === 0x20) throw new Error('no leading space')
        }
      })

      request(server)
        .post('/')
        .set('Content-Type', 'application/json')
        .send(' {"user":"tobi"}')
        .expect(403, '[entity.verify.failed] no leading space', done)
    })

    it('should apply to urlencoded', function (done) {
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
  })
})

function createServer (opts) {
  var _bodyParser = bodyParser(opts)

  return http.createServer(function (req, res) {
    _bodyParser(req, res, function (err) {
      res.statusCode = err ? (err.status || 500) : 200
      res.end(err ? ('[' + err.type + '] ' + err.message) : JSON.stringify(req.body))
    })
  })
}
