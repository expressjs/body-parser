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

var bytes = require('bytes')
var contentType = require('content-type')
var createError = require('http-errors')
var isFinished = require('on-finished').isFinished
var read = require('./read')
var typeis = require('type-is')

/**
 * Module exports.
 */

module.exports = createBodyParser

/**
 * Use this to create a middleware that parses request bodies
 *
 * @param {function} parse
 * @param {object} options
 * @param {object} defaultOptions
 * @return {function}
 * @public
 */

function createBodyParser (parse, debug, options, defaultOptions) {
  // Squash the options and the overrides down into one object
  var opts = { ...defaultOptions, ...options }

  var limit = typeof opts.limit !== 'number'
    ? bytes.parse(opts.limit || '100kb')
    : opts.limit
  var charset = opts.charset
  var inflate = opts.inflate !== false
  var verify = opts.verify || false
  var defaultReqCharset = opts.defaultCharset || 'utf-8'
  var type = opts.type

  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function')
  }

  // create the appropriate type checking function
  var shouldParse = typeof type !== 'function'
    ? typeChecker(type)
    : type

  // create the appropriate charset validating function
  var validCharset = typeof charset !== 'function'
    ? charsetValidator(charset)
    : charset

  return function (req, res, next) {
    if (isFinished(req)) {
      debug('body already parsed')
      next()
      return
    }

    if (!('body' in req)) {
      req.body = undefined
    }

    // skip requests without bodies
    if (!typeis.hasBody(req)) {
      debug('skip empty body')
      next()
      return
    }

    debug('content-type %j', req.headers['content-type'])

    // determine if request should be parsed
    if (!shouldParse(req)) {
      debug('skip parsing')
      next()
      return
    }

    // assert charset per RFC 7159 sec 8.1
    var reqCharset = null
    if (charset !== undefined) {
      reqCharset = getCharset(req) || defaultReqCharset
      if (!validCharset(reqCharset)) {
        debug('invalid charset')
        next(createError(415, 'unsupported charset "' + reqCharset.toUpperCase() + '"', {
          charset: reqCharset,
          type: 'charset.unsupported'
        }))
        return
      }
    }

    // read
    read(req, res, next, parse, debug, {
      encoding: reqCharset,
      inflate: inflate,
      limit: limit,
      verify: verify
    })
  }
}

/**
 * Get the charset of a request.
 *
 * @param {object} req
 * @api private
 */

function getCharset (req) {
  try {
    return (contentType.parse(req).parameters.charset || '').toLowerCase()
  } catch {
    return undefined
  }
}

/**
 * Get the simple type checker.
 *
 * @param {string} type
 * @return {function}
 */

function typeChecker (type) {
  return function (req) {
    return Boolean(typeis(req, type))
  }
}

/**
 * Get the simple charset validator.
 *
 * @param {string} type
 * @return {function}
 */

function charsetValidator (charset) {
  return function (reqCharset) {
    return charset === reqCharset
  }
}
