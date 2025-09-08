/*!
 * body-parser
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * Module dependencies.
 */

var debug = require('debug')('body-parser:text')
var read = require('../read')
var { normalizeOptions } = require('../utils')

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
  var normalizedOptions = normalizeOptions(options, 'text/plain')

  function parse (buf) {
    return buf
  }

  return function textParser (req, res, next) {
    read(req, res, next, parse, debug, normalizedOptions)
  }
}
