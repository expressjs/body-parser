/*!
 * body-parser
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var bytes = require('bytes')
var isFinished = require('on-finished').isFinished
var read = require('./read')
var typer = require('media-typer')
var typeis = require('type-is')

/**
 * Module exports.
 */

module.exports = bodyParser

/**
 * Create a middleware to parse a request body.
 *
 * @param {string} type
 * @param {function} parse
 * @param {object} [options]
 * @return {function}
 * @api public
 */

function bodyParser(type, parse, options) {
  options = options || {}

  if (typeof type !== 'string') {
    throw new TypeError('argument type is required')
  }

  var charset = options.charset
  var limit = typeof options.limit !== 'number'
    ? bytes(options.limit || '100kb')
    : options.limit
  var inflate = options.inflate !== false
  var verify = options.verify || false

  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function')
  }

  return function bodyParser(req, res, next) {
    if (isFinished(req)) {
      return next()
    }

    if (!('body' in req)) {
      req.body = undefined
    }

    if (!typeis(req, type)) {
      return next()
    }

    // charset
    var encoding = charset !== false
      ? typer.parse(req).parameters.charset || charset
      : null

    // read
    read(req, res, next, parse, {
      encoding: encoding,
      inflate: inflate,
      limit: limit,
      verify: verify
    })
  }
}
