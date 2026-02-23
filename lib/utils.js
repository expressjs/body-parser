'use strict'

/**
 * Module dependencies.
 */

var bytes = require('bytes')
var typeis = require('type-is')

/**
 * Module exports.
 */
module.exports = {
  normalizeOptions,
  passthrough
}

/**
 * Get the simple type checker.
 *
 * @param {string | string[]} type
 * @returns {Function}
 * @private
 */
function typeChecker (type) {
  return function checkType (req) {
    return Boolean(typeis(req, type))
  }
}

/**
 * Normalizes the common options for all parsers.
 *
 * @param {Object} options options to normalize
 * @param {string | string[] | Function} defaultType default content type(s) or a function to determine it
 * @returns {Object}
 * @private
 */
function normalizeOptions (options, defaultType) {
  if (!defaultType) {
    // Parsers must define a default content type
    throw new TypeError('defaultType must be provided')
  }

  var inflate = options?.inflate !== false
  var limit = typeof options?.limit !== 'number'
    ? bytes.parse(options?.limit || '100kb')
    : options?.limit
  var type = options?.type || defaultType
  var verify = options?.verify || false
  var defaultCharset = options?.defaultCharset || 'utf-8'

  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function')
  }

  // create the appropriate type checking function
  var shouldParse = typeof type !== 'function'
    ? typeChecker(type)
    : type

  return {
    inflate,
    limit,
    verify,
    defaultCharset,
    shouldParse
  }
}

/**
 * Passthrough function that returns input unchanged.
 * Used by parsers that don't need to transform the data.
 *
 * @param {*} value
 * @returns {*}
 * @private
 */
function passthrough (value) {
  return value
}
