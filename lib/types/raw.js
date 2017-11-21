/*!
 * body-parser
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * Module dependencies.
 */

var assign = require('object-assign')
var genericParser = require('../generic-parser')

/**
 * Module exports.
 */

module.exports = raw

/**
 * Create a middleware to parse raw bodies.
 *
 * @param {object} [options]
 * @return {function}
 * @api public
 */

function raw (options) {
  var opts = options || {}

  var type = opts.type || 'application/octet-stream'

  return genericParser(assign({}, opts, {
    type: type
  }))
}
