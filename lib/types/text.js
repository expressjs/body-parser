/*!
 * body-parser
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var bytes = require('bytes')
var contentType = require('content-type')
var read = require('../read')
var typeis = require('type-is')

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
  options = options || {};

  var defaultCharset = options.defaultCharset || 'utf-8'
  var inflate = options.inflate !== false
  var limit = typeof options.limit !== 'number'
    ? bytes(options.limit || '100kb')
    : options.limit
  var type = options.type || 'text/plain'
  var verify = options.verify || false

  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function')
  }

  function parse(buf) {
    return buf
  }

  return function textParser(req, res, next) {
    if (req._body) return next()
    req.body = req.body || {}

    if (!typeis(req, type)) return next()

    // get charset
    var charset = contentType.parse(req).parameters.charset || defaultCharset

    // read
    read(req, res, next, parse, {
      encoding: charset,
      inflate: inflate,
      limit: limit,
      verify: verify
    })
  }
}
