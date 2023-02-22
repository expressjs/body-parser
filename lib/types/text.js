/*!
 * body-parser
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * Module dependencies.
 */

const bytes = require('bytes')
const contentType = require('content-type')
const debug = require('debug')('body-parser:text')
const isFinished = require('on-finished').isFinished
const read = require('../read')
const typeis = require('type-is')

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
  const opts = options || {}

  const defaultCharset = opts.defaultCharset || 'utf-8'
  const inflate = opts.inflate !== false
  const limit = typeof opts.limit !== 'number'
    ? bytes.parse(opts.limit || '100kb')
    : opts.limit
  const type = opts.type || 'text/plain'
  const verify = opts.verify || false

  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function')
  }

  // create the appropriate type checking function
  const shouldParse = typeof type !== 'function'
    ? typeChecker(type)
    : type

  function parse (buf) {
    return buf
  }

  return function textParser (req, res, next) {
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

    // get charset
    const charset = getCharset(req) || defaultCharset

    // read
    read(req, res, next, parse, debug, {
      encoding: charset,
      inflate,
      limit,
      verify
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
