
var assert = require('assert');
var http = require('http');
var request = require('supertest');

var bodyParser = require('..');

describe('into', function() {
  describe('should default to body', function() {
    var server;
    before(function(){
      server = createServer(bodyParser)
    })

    it('for JSON', function(done){
      request(server)
      .post('/body')
      .set('Content-Type', 'application/json')
      .send('{"user":"tobi"}')
      .expect(200, '{"user":"tobi"}', done)
    })

    it('for x-www-form-urlencoded', function(done){
      request(server)
      .post('/body')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('user=tobi')
      .expect(200, '{"user":"tobi"}', done)
    })
  })

  describe('should allow custom targets', function() {
    var server;
    before(function(){
      server = createServer(bodyParser, { into: 'data' })
    })

    it('for JSON', function(done){
      request(server)
      .post('/data')
      .set('Content-Type', 'application/json')
      .send('{"user":"tobi"}')
      .expect(200, '{"user":"tobi"}', done)
    })

    it('for x-www-form-urlencoded', function(done){
      request(server)
      .post('/data')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('user=tobi')
      .expect(200, '{"user":"tobi"}', done)
    })
  })

  describe('should support fall-through parsing', function() {
    var server;
    before(function() {
      var _textParser = bodyParser.text({ into: 'text' });
      var _jsonParser = bodyParser.json({ into: 'json' });
      server = http.createServer(function(req, res){
        _textParser(req, res, function(err) {
          if(err) { res.statusCode = err.status || 500; return res.end(err.message); }

          _jsonParser(req, res, function(err) {
            res.statusCode = err ? (err.status || 500) : 200;
            res.end(err ? err.message : JSON.stringify(req[req.url.replace('/','')]));
          })
        })
      })
    })

    it('should correctly set the first parser\'s data', function(done) {
      request(server)
      .post('/text')
      .set('Content-Type', 'text/plain')
      .send('{"user":"tobi"}')
      .expect(200, '"{\\"user\\":\\"tobi\\"}"', done)
    })

    it('should correctly set the second parser\'s data', function(done) {
      request(server)
      .post('/json')
      .set('Content-Type', 'application/json')
      .send('{"user":"tobi"}')
      .expect(200, '{"user":"tobi"}', done)
    })
  })
})

function createServer(parser, opts){
  var _bodyParser = parser(opts)

  return http.createServer(function(req, res){
    _bodyParser(req, res, function(err){
      res.statusCode = err ? (err.status || 500) : 200;
      res.end(err ? err.message : JSON.stringify(req[req.url.replace('/','')]));
    })
  })
}
