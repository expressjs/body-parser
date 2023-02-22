
var assert = require('assert')

var bodyParser = require('..')

describe('bodyParser()', function () {
  it('should throw an error', function () {
    assert.throws(bodyParser, /bodyParser\(\) generic has been split/)
  })
})
