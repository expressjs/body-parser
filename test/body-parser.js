
var assert = require('assert');
var zlib = require('zlib');
var http = require('http');
var request = require('supertest');

var bodyParser = require('..');

describe('bodyParser()', function(){

  var server;
  before(function(){
    server = createServer()
  })

  it('should support gzip', function(done){
    var data = '{"user":"tobi"}'
    zlib.gzip(data, function(err, compressedBuf) {
      var test = request(server)
        .post('/')
        .set('Content-Encoding', 'gzip')
        .set('Content-Type', 'application/json')
      test.write(compressedBuf)
      test.expect(200, data, done)
    })
  })

  it('should handle bad gzip', function(done){
    var test = request(server)
      .post('/')
      .set('Content-Encoding', 'gzip')
      .set('Content-Type', 'application/json')
    test.write('BOGUS_ZIP_DATA')
    test.expect(500, 'incorrect header check', done)
  })

  it('should handle short gzip', function(done){
    var data = '{"user":"tobi"}'
    zlib.gzip(data, function(err, compressedBuf) {
      var test = request(server)
        .post('/')
        .set('Content-Encoding', 'gzip')
        .set('X-CL', compressedBuf.length + 10)
        .set('Content-Type', 'application/json')
      test.write(compressedBuf)
      test.expect(400, 'compressed stream too short', done)
    })
  })

  it('should handle long gzip', function(done){
    var data = '{"user":"tobi"}'
    zlib.gzip(data, function(err, compressedBuf) {
      var test = request(server)
        .post('/')
        .set('Content-Encoding', 'gzip')
        .set('X-CL', compressedBuf.length - 10)
        .set('Content-Type', 'application/json')
      test.write(compressedBuf)
      test.expect(400, 'compressed stream too long', done)
    })
  })

  it('should support deflate', function(done){
    var data = '{"user":"tobi"}'
    zlib.deflate(data, function(err, compressedBuf) {
      var test = request(server)
        .post('/')
        .set('Content-Encoding', 'deflate')
        .set('Content-Type', 'application/json')
      test.write(compressedBuf)
      test.expect(200, data, done)
    })
  })

  it('should handle bad defalte', function(done){
    var test = request(server)
      .post('/')
      .set('Content-Encoding', 'deflate')
      .set('Content-Type', 'application/json')
    test.write('BOGUS_DEFLATE_DATA')
    test.expect(500, 'incorrect header check', done)
  })

  it('should handle short deflate', function(done){
    var data = '{"user":"tobi"}'
    zlib.deflate(data, function(err, compressedBuf) {
      var test = request(server)
        .post('/')
        .set('Content-Encoding', 'deflate')
        .set('X-CL', compressedBuf.length + 10)
        .set('Content-Type', 'application/json')
      test.write(compressedBuf)
      test.expect(400, 'compressed stream too short', done)
    })
  })

  it('should handle long deflate', function(done){
    var data = '{"user":"tobi"}'
    zlib.deflate(data, function(err, compressedBuf) {
      var test = request(server)
        .post('/')
        .set('Content-Encoding', 'deflate')
        .set('X-CL', compressedBuf.length - 10)
        .set('Content-Type', 'application/json')
      test.write(compressedBuf)
      test.expect(400, 'compressed stream too long', done)
    })
  })

  it('should detect pre-set encoding', function(done){
    var data = '{"user":"tobi"}'
    zlib.gzip(data, function(err, compressedBuf) {
      var test = request(server)
        .post('/')
        .set('Content-Encoding', 'gzip')
        .set('X-Set-Encoding', 'true')
        .set('Content-Type', 'application/json')
      test.write(compressedBuf)
      test.expect(500, 'stream encoding should not be set', done)
    })
  })

  it('should default to {}', function(done){
    request(server)
    .post('/')
    .expect(200, '{}', done)
  })

  it('should parse JSON', function(done){
    request(server)
    .post('/')
    .set('Content-Type', 'application/json')
    .send('{"user":"tobi"}')
    .expect(200, '{"user":"tobi"}', done)
  })

  it('should parse x-www-form-urlencoded', function(done){
    request(server)
    .post('/')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('user=tobi')
    .expect(200, '{"user":"tobi"}', done)
  })

  describe('with type option', function(){
    var server;
    before(function(){
      server = createServer({ type: 'application/octet-stream' })
    })

    it('should parse JSON', function(done){
      request(server)
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{"user":"tobi"}')
      .expect(200, '{"user":"tobi"}', done)
    })

    it('should parse x-www-form-urlencoded', function(done){
      request(server)
      .post('/')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('user=tobi')
      .expect(200, '{"user":"tobi"}', done)
    })
  })
})

function createServer(opts){
  var _bodyParser = bodyParser(opts)

  return http.createServer(function(req, res){
    if (req.headers['x-cl']) {
      req.headers['content-length'] = req.headers['x-cl']
      delete req.headers['x-cl']
    }
    if (req.headers['x-set-encoding']) {
      req.setEncoding('utf8')
      delete req.headers['x-set-encoding']
    }
    _bodyParser(req, res, function(err){
      res.statusCode = err ? (err.status || 500) : 200;
      res.end(err ? err.message : JSON.stringify(req.body));
    })
  })
}
