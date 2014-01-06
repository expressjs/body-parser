
var connect = require('connect');
var assert = require('assert');
var request = require('supertest');

var bodyParser = require('..');

var app = connect();

app.use(bodyParser.urlencoded({ limit: '1mb' }));

app.use(function(req, res){
  res.end(JSON.stringify(req.body));
});

describe('bodyParser.urlencoded()', function(){
  it('should support all http methods', function(done){
    request(app)
    .get('/')
    .set('Content-Type', 'application/x-www-form-urlencoded')
    .set('Content-Length', 'user=tobi'.length)
    .send('user=tobi')
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