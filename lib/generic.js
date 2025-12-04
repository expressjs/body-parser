/*!
 * body-parser
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * Module dependencies.
 * @private
 */

const contentType = require('content-type')
const createError = require('http-errors')
const debug = require('debug')('body-parser:generic')
const { isFinished } = require('on-finished')
const read = require('./read')
const typeis = require('type-is')
const utils = require('./utils')

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
 * @param {String|Function} [options.type] Request content-type to match (required)
 * @param {String|Number} [options.limit] Maximum request body size
 * @param {Boolean} [options.inflate] Enable handling compressed bodies
 * @param {Function} [options.verify] Verify body content
 * @param {String} [options.defaultCharset] Default charset when not specified
 * @param {String} [options.charset] Expected charset (will respond with 415 if not matched)
 * @return {Function} middleware
 * @public
 */

function generic (options) {
  // === STEP 0: VALIDATE OPTIONS ===
  const opts = options || {}

  if (typeof opts.parse !== 'function') {
    throw new TypeError('option parse must be a function')
  }

  // For generic parser, type is a required option
  if (opts.type === undefined) {
    throw new TypeError('option type must be specified for generic parser')
  }

  // === CONFIGURE PARSER OPTIONS ===
  const defaultCharset = opts.defaultCharset || 'utf-8'

  // Use the common options normalization function
  const { inflate, limit, verify, shouldParse } = utils.normalizeOptions(opts, opts.type)

  debug('creating parser with options %j', {
    limit,
    inflate,
    defaultCharset
  })

  return function genericParser (req, res, next) {
    // === STEP 1: REQUEST EVALUATION ===
    if (isFinished(req)) {
      debug('request already finished')
      next()
      return
    }

    // Initialize body property if not exists
    if (!('body' in req)) {
      debug('initializing body property')
      req.body = undefined
    }

    // Skip empty bodies
    if (!typeis.hasBody(req)) {
      debug('skip empty body')
      next()
      return
    }

    // === STEP 2: CONTENT TYPE MATCHING ===
    debug('content-type %j', req.headers['content-type'])

    if (!shouldParse(req)) {
      debug('skip parsing: content-type mismatch')
      next()
      return
    }

    // === STEP 3: CHARSET DETECTION ===
    let charset
    try {
      const ct = contentType.parse(req)
      charset = (ct.parameters.charset || defaultCharset).toLowerCase()
      debug('charset %s', charset)
    } catch (err) {
      debug('charset error: %s', err.message)
      charset = defaultCharset
    }

    // Check if charset is supported
    if (opts.charset !== undefined && opts.charset !== charset) {
      debug('unsupported charset %s (expecting %s)', charset, opts.charset)
      next(createError(415, 'unsupported charset "' + charset.toUpperCase() + '"', {
        charset: charset,
        type: 'charset.unsupported'
      }))
      return
    }

    // === STEP 4 & 5: BODY READING AND PARSING ===
    // The read function handles the actual body reading
    // and passes the result to our parse function
    read(req, res, next, function parseBody (buf) {
      debug('parse %d byte body', buf.length)

      try {
        // Call the parse function
        const result = opts.parse(buf, charset)
        debug('parsed as %o', result)
        return result
      } catch (err) {
        debug('parse error: %s', err.message)

        throw createError(400, err.message, {
          body: buf.toString().substring(0, 100),
          charset,
          type: 'entity.parse.failed'
        })
      }
    }, debug, {
      encoding: charset,
      inflate,
      limit,
      verify
    })
  }
}
