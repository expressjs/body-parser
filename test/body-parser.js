'use strict'

const { describe, it } = require('mocha')
const assert = require('node:assert')

const bodyParser = require('..')

describe('bodyParser()', function () {
  it('should throw an error', function () {
    assert.throws(bodyParser, /bodyParser\(\) generic has been split/)
  })
})
