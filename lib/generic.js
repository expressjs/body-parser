'use strict'

/**
 * Module dependencies.
 * @private
 */

const createError = require('http-errors')
const debug = require('debug')('body-parser:generic')
const read = require('./read')
const { normalizeOptions } = require('./utils')

/**
 * Module exports.
 * @public
 */

module.exports = generic

/**
 * Create a middleware to parse request bodies.
 *
 * @param {Object} [options]
 * @param {Function} [options.parse] Function to parse body (required). This function:
 *   - Receives (buffer, charset) as arguments
 *   - Must be synchronous (cannot be async or return a Promise)
 *   - Will be called for requests with empty bodies (zero-length buffer)
 *   - Will NOT be called for requests with no body at all (e.g., typical GET requests)
 *   - Return value becomes req.body
 * @param {String|String[]|Function} [options.type] Request content-type to match (required)
 * @param {String|Number} [options.limit] Maximum request body size
 * @param {Boolean} [options.inflate] Enable handling compressed bodies
 * @param {Function} [options.verify] Verify body content
 * @param {String} [options.defaultCharset] Default charset when not specified
 * @param {String|String[]|Function} [options.charset] Expected charset(s) or function which returns a boolean (will respond with 415 if not matched)
 * @returns {Function} middleware
 * @public
 */

function generic (options) {
  const opts = options || {}

  if (typeof opts.parse !== 'function') {
    throw new TypeError('option parse must be a function')
  }

  // For generic parser, type is a required option
  if (opts.type === undefined || (typeof opts.type !== 'string' && typeof opts.type !== 'function' && !Array.isArray(opts.type))) {
    throw new TypeError('option type must be specified for generic parser')
  }

  // Use the common options normalization function
  const normalizedOptions = normalizeOptions(opts, opts.type)

  debug('creating parser with options %j', {
    limit: normalizedOptions.limit,
    inflate: normalizedOptions.inflate,
    defaultCharset: normalizedOptions.defaultCharset
  })

  let isValidCharset
  if (typeof opts.charset === 'string') {
    const expectedCharset = opts.charset.toLowerCase()
    isValidCharset = function isValidCharset (charset) {
      return charset === expectedCharset
    }
  } else if (Array.isArray(opts.charset)) {
    const expectedCharsets = opts.charset.map((v) => String(v).toLowerCase())
    isValidCharset = function isValidCharset (charset) {
      return expectedCharsets.includes(charset)
    }
  } else if (typeof opts.charset === 'function') {
    isValidCharset = opts.charset
  }

  const readOptions = {
    ...normalizedOptions,
    isValidCharset,
    returnBuffer: true
  }

  function wrappedParse (body, charset) {
    debug('parse %d byte body', body.length)

    try {
      // Call the parse function
      const result = opts.parse(body, charset)
      debug('parsed as %o', result)
      return result
    } catch (err) {
      debug('parse error: %s', err.message)

      throw createError(400, err.message, {
        body: body.toString().substring(0, 100),
        charset,
        type: 'entity.parse.failed'
      })
    }
  }

  return function genericParser (req, res, next) {
    read(req, res, next, wrappedParse, debug, readOptions)
  }
}
