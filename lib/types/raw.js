/*!
 * body-parser
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var bodyParser = require('../body-parser')
var merge = require('utils-merge')

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

function raw(options) {
  var opts = merge({}, options)

  // default type
  var type = opts.type || 'application/octet-stream'

  // no charset (raw)
  opts.charset = false

  return bodyParser(type, parse, opts)
}

/**
 * Parse text body.
 *
 * @api private
 */

function parse(body) {
  // no need to do anything
  return body
}
