/*!
 * body-parser
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * Module dependencies.
 */

var debug = require('debug')('body-parser:raw')
var read = require('../read')
var { normalizeOptions, passthrough } = require('../utils')

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
  var normalizedOptions = normalizeOptions(options, 'application/octet-stream')

  return function rawParser (req, res, next) {
    read(req, res, next, passthrough, debug, {
      ...normalizedOptions,

      // Skip charset validation and parse the body as is
      skipCharset: true
    })
  }
}
