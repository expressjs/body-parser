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

module.exports = text

/**
 * Create a middleware to parse text bodies.
 *
 * @param {object} [options]
 * @return {function}
 * @api public
 */

function text(options) {
  var opts = merge({}, options)

  // default type
  var type = opts.type || 'text/plain'

  // default charset
  opts.charset = opts.defaultCharset || opts.charset || 'utf-8'

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
