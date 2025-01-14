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

var createError = require('http-errors')
var debug = require('debug')('body-parser:urlencoded')
var qs = require('qs')
var createBodyParser = require('../factory')

/**
 * Module exports.
 */

module.exports = urlencoded

/**
 * Create a middleware to parse urlencoded bodies.
 *
 * @param {object} [options]
 * @return {function}
 * @public
 */
function urlencoded (options) {
  var extended = Boolean(options?.extended)
  var parser = options?.parser || createQueryParser(options, extended)

  return createBodyParser(
    function (body, encoding) {
      return body.length ? parser(body, encoding) : {}
    },
    debug,
    options,
    {
      type: 'application/x-www-form-urlencoded',
      charset: function (charset) {
        return charset === 'utf-8' || charset === 'iso-8859-1'
      }
    }
  )
}

/**
 * Get the extended query parser.
 *
 * @param {object} options
 * @return {function}
 */

function createQueryParser (options, extended) {
  var parameterLimit = options?.parameterLimit !== undefined
    ? options.parameterLimit
    : 1000
  var charsetSentinel = options?.charsetSentinel
  var interpretNumericEntities = options?.interpretNumericEntities
  var depth = extended ? (options?.depth !== undefined ? options.depth : 32) : 0

  if (isNaN(parameterLimit) || parameterLimit < 1) {
    throw new TypeError('option parameterLimit must be a positive number')
  }

  if (isNaN(depth) || depth < 0) {
    throw new TypeError('option depth must be a zero or a positive number')
  }

  if (isFinite(parameterLimit)) {
    parameterLimit = parameterLimit | 0
  }

  return function queryparse (body, encoding) {
    var paramCount = parameterCount(body, parameterLimit)

    if (paramCount === undefined) {
      debug('too many parameters')
      throw createError(413, 'too many parameters', {
        type: 'parameters.too.many'
      })
    }

    var arrayLimit = extended ? Math.max(100, paramCount) : 0

    debug('parse ' + (extended ? 'extended ' : '') + 'urlencoding')
    try {
      return qs.parse(body, {
        allowPrototypes: true,
        arrayLimit: arrayLimit,
        depth: depth,
        charsetSentinel: charsetSentinel,
        interpretNumericEntities: interpretNumericEntities,
        charset: encoding,
        parameterLimit: parameterLimit,
        strictDepth: true
      })
    } catch (err) {
      if (err instanceof RangeError) {
        throw createError(400, 'The input exceeded the depth', {
          type: 'querystring.parse.rangeError'
        })
      } else {
        throw err
      }
    }
  }
}

/**
 * Count the number of parameters, stopping once limit reached
 *
 * @param {string} body
 * @param {number} limit
 * @api private
 */

function parameterCount (body, limit) {
  var count = 0
  var index = 0

  while ((index = body.indexOf('&', index)) !== -1) {
    count++
    index++

    if (count === limit) {
      return undefined
    }
  }

  return count
}
