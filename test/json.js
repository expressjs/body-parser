
var assert = require('assert');
var http = require('http');
var request = require('supertest');

var bodyParser = require('..');

describe('bodyParser.json()', function(){
  it('should parse JSON', function(done){
    var server = createServer({ limit: '1mb' })

    request(server)
    .post('/')
    .set('Content-Type', 'application/json')
    .send('{"user":"tobi"}')
    .expect(200, '{"user":"tobi"}', done)
  })

  it('should fail gracefully', function(done){
    var server = createServer({ limit: '1mb' })

    request(server)
    .post('/')
    .set('Content-Type', 'application/json')
    .send('{"user"')
    .expect(400, 'Unexpected end of input', done)
  })

  it('should handle Content-Length: 0', function(done){
    var server = createServer()

    request(server)
    .get('/')
    .set('Content-Type', 'application/json')
    .set('Content-Length', '0')
    .expect(200, '{}', done)
  })

  it('should handle no message-body', function(done){
    var server = createServer()

    request(server)
    .get('/')
    .set('Content-Type', 'application/json')
    .unset('Transfer-Encoding')
    .expect(200, '{}', done)
  })

  it('should 400 on malformed JSON', function(done){
    var server = createServer()

    request(server)
    .post('/')
    .set('Content-Type', 'application/json')
    .send('{"foo')
    .expect(400, done);
  })

  it('should 400 when no body is given', function(done){
    var server = createServer()

    request(server)
    .post('/')
    .set('Content-Type', 'application/json')
    .set('Transfer-Encoding', 'chunked')
    .expect(400, 'invalid json, empty body', done)
  })

  it('should support all http methods', function(done){
    var server = createServer()

    request(server)
    .get('/')
    .set('Content-Type', 'application/json')
    .set('Content-Length', '["foo"]'.length)
    .send('["foo"]')
    .expect(200, '["foo"]', done);
  })

  describe('when strict is false', function(){
    it('should parse primitives', function(done){
      var server = createServer({ strict: false })

      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('true')
      .expect(200, 'true', done);
    })
  })

  describe('when strict is true', function(){
    var server;
    before(function(){
      server = createServer({ strict: true })
    })

    it('should not parse primitives', function(done){
      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('true')
      .expect(400, 'invalid json', done)
    })

    it('should allow leading whitespaces in JSON', function(done){
      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('   { "user": "tobi" }')
      .expect(200, '{"user":"tobi"}', done)
    })
  })

  describe('by default', function(){
    it('should 400 on primitives', function(done){
      var server = createServer()

      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('true')
      .expect(400, done);
    })
  })

  describe('with limit option', function(){
    var server;
    var options;
    before(function(){
      options = { limit: '1kb' }
      server = createServer(options)
    })

    it('should 413 when over limit', function(done){
      var buf = new Buffer(1024)
      buf.fill('.')

      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ str: buf.toString() }))
      .expect(413, done)
    })

    it('should not change when options altered', function(done){
      var buf = new Buffer(1024)
      buf.fill('.')
      options.limit = '100kb'

      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ str: buf.toString() }))
      .expect(413, done)
    })

    it('should not hang response', function(done){
      var buf = new Buffer(1024 * 10)
      buf.fill('.')

      var server = createServer({ limit: '8kb' })
      var test = request(server).post('/')
      test.set('Content-Type', 'application/json')
      test.write(buf)
      test.write(buf)
      test.write(buf)
      test.expect(413, done)
    })
  })

  describe('with type option', function(){
    var server;
    before(function(){
      server = createServer({ type: 'application/vnd.api+json' })
    })

    it('should parse JSON for custom type', function(done){
      request(server)
      .post('/')
      .set('Content-Type', 'application/vnd.api+json')
      .send('{"user":"tobi"}')
      .expect(200, '{"user":"tobi"}', done)
    })

    it('should ignore standard type', function(done){
      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{"user":"tobi"}')
      .expect(200, '{}', done)
    })
  })

  describe('with verify option', function(){
    var server;
    before(function(){
      server = createServer({verify: function(req, res, buf){
        if (buf[0] === 0x5b) throw new Error('no arrays')
      }})
    })

    it('should error from verify', function(done){
      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('["tobi"]')
      .expect(403, 'no arrays', done)
    })
  })

  it('should support utf-8', function(done){
    var server = createServer()

    request(server)
    .post('/')
    .set('Content-Type', 'application/json; charset=utf-8')
    .send('{"name":"论"}')
    .expect(200, '{"name":"论"}', done);
  })

  it('should support {"test":"å"}', function (done) {
    // https://github.com/visionmedia/express/issues/1816
    var server = createServer();

    request(server)
    .post('/')
    .set('Content-Type', 'application/json; charset=utf-8')
    .set('Content-Length', '13')
    .send('{"test":"å"}')
    .expect(200, '{"test":"å"}', done);
  })
})

function createServer(opts){
  var _bodyParser = bodyParser.json(opts)

  return http.createServer(function(req, res){
    _bodyParser(req, res, function(err){
      res.statusCode = err ? (err.status || 500) : 200;
      res.end(err ? err.message : JSON.stringify(req.body));
    })
  })
}
