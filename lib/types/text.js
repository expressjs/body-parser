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

module.exports = text

/**
 * Create a middleware to parse text bodies.
 *
 * @param {object} [options]
 * @return {function}
 * @api public
 */

function text (options) {
  var opts = options || {}

  var defaultCharset = opts.defaultCharset || 'utf-8'
  var type = opts.type || 'text/plain'

  return genericParser(assign({}, opts, {
    type: type,
    charset: function validateCharset () { return true },
    defaultCharset: defaultCharset
  }))
}
