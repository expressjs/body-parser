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
var debug = require('debug')('body-parser:generic')
var read = require('../read')
var typeis = require('type-is')

/**
 * Module exports.
 */

module.exports = generic

/**
 * Create a middleware to parse generic bodies.
 *
 * @param {object} [options]
 * @return {function}
 * @public
 */

function generic (opts) {
  var inflate = opts.inflate !== false
  var limit = typeof opts.limit !== 'number'
    ? bytes.parse(opts.limit || '100kb')
    : opts.limit
  var type = opts.type || 'application/x-www-form-urlencoded'
  var verify = opts.verify || false

  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function')
  }

  // create the appropriate type checking function
  var shouldParse = typeof type !== 'function'
    ? typeChecker(type)
    : type

  function parse (body) {
    return body.length
      ? opts.parser(body, opts.parserOptions || {})
      : {}
  }

  return function genericParser (req, res, next) {
    if (req._body) {
      debug('body already parsed')
      next()
      return
    }

    req.body = req.body || {}

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

    // read
    read(req, res, next, parse, debug, {
      debug: debug,
      encoding: getCharset(req) || 'utf-8',
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
    return contentType.parse(req).parameters.charset.toLowerCase()
  } catch (e) {
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
  return function checkType (req) {
    return Boolean(typeis(req, type))
  }
}
