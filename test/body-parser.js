
var connect = require('connect');
var assert = require('assert');
var request = require('supertest');

var bodyParser = require('..');

var app = connect();

app.use(bodyParser());

app.use(function(req, res){
  res.end(JSON.stringify(req.body));
});

describe('bodyParser()', function(){
  it('should default to {}', function(done){
    request(app)
    .post('/')
    .end(function(err, res){
      res.text.should.equal('{}');
      done();
    })
  })

  it('should parse JSON', function(done){
    request(app)
    .post('/')
    .set('Content-Type', 'application/json')
    .send('{"user":"tobi"}')
    .end(function(err, res){
      res.text.should.equal('{"user":"tobi"}');
      done();
    });
  })

  it('should parse x-www-form-urlencoded', function(done){
    request(app)
    .post('/')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .send('user=tobi')
    .end(function(err, res){
      res.text.should.equal('{"user":"tobi"}');
      done();
    });
  })
})
