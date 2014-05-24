
var assert = require('assert');
var stream = require('stream');
var zlib = require('zlib');
var http = require('http');
var request = require('supertest');
var mikealRequest = require('request');

var bodyParser = require('..');

describe('bodyParser()', function(){

  var server;
  before(function(){
    server = createServer();
  })

  testCompressed = function(contentEncoding, compressedStreamFactory, expectedStatusCode, expectedBody, done) {

    server.listen(0);
    var serverAddress = 'http://127.0.0.1:' + server.address().port;

    var data = '{"user":"tobi"}';
    var dataStream = new stream.Readable();
    dataStream._read = function() {};
    dataStream.push(data);
    dataStream.push(null);

    var requestOptions = {
      url: serverAddress + '/',
      headers: {
        'content-type': 'application/json',
        'content-encoding': contentEncoding,
      },
    };
    var req = mikealRequest.post(requestOptions, function(err, response, body) {
      if (err)
        return done(err);
      if (response.statusCode !== expectedStatusCode)
        return done(new Error('invalid status code: expected ' + expectedStatusCode + ' got ' + response.statusCode));
      if (expectedBody === null)
        expectedBody = data;
      if (body !== expectedBody)
        return done(new Error('invalid response body: expected ' + expectedBody + ', got ' + response.body));
      done();
    });

    dataStream
      .pipe(compressedStreamFactory())
      .pipe(req);
  }

  it('should support gzip', function(done){
    testCompressed('gzip', zlib.createGzip, 200, null, done);
  });

  it('should support deflate', function(done){
    testCompressed('deflate', zlib.createDeflate, 200, null, done);
  });

  it('should handle bad gzip', function(done){
    testCompressed('gzip', stream.PassThrough, 500, 'incorrect header check', done);
  });

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
    _bodyParser(req, res, function(err){
      res.statusCode = err ? (err.status || 500) : 200;
      res.end(err ? err.message : JSON.stringify(req.body));
    })
  })
}
