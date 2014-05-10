
var assert = require('assert');
var http = require('http');
var request = require('supertest');

var bodyParser = require('..');

describe('bodyParser()', function(){
  var server;
  before(function(){
    server = createServer()
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
})

function createServer(){
  var _bodyParser = bodyParser()

  return http.createServer(function(req, res){
    _bodyParser(req, res, function(err){
      res.statusCode = err ? (err.status || 500) : 200;
      res.end(err ? err.message : JSON.stringify(req.body));
    })
  })
}
