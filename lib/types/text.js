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
var createBodyParser = require('../factory')

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
  return createBodyParser(
    function (buf) { return buf },
    debug,
    options,
    {
      type: 'text/plain',
      charset: function () { return true },
      defaultCharset: 'utf-8'
    }
  )
}
