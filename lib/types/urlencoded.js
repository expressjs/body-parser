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
var debug = require('debug')('body-parser:urlencoded')
var deprecate = require('depd')('body-parser')
var read = require('../read')
var typeis = require('type-is')
var qs = require('qs')

/**
 * Module exports.
 */

module.exports = urlencoded

var charsetBySentinel = {
  // This is what browsers will submit when the ✓ character occurs in an
  // application/x-www-form-urlencoded body and the encoding of the page containing
  // the form is iso-8859-1, or when the submitted form has an accept-charset
  // attribute of iso-8859-1. Presumably also with other charsets that do not contain
  // the ✓ character, such as us-ascii.
  '%26%2310003%3B': 'iso-8859-1', // encodeURIComponent('&#10003;')
  // These are the percent-encoded utf-8 octets representing a checkmark, indicating
  // that the request actually is utf-8 encoded.
  '%E2%9C%93': 'utf-8' // encodeURIComponent('✓')
}

/**
 * Helper for creating a decoder function that interprets percent-encoded octets
 * in a certain charset
 */
function getDecoder (charset, interpretNumericEntities) {
  return function decoder (str) {
    var decodedStr = str.replace(/\+/g, ' ')
    if (charset === 'iso-8859-1') {
      // unescape never throws, no try...catch needed:
      return decodedStr.replace(/%[0-9a-f]{2}/gi, unescape)
    } else {
      // utf-8
      try {
        decodedStr = decodeURIComponent(decodedStr)
      } catch (e) {
        // URIError, keep encoded
      }
    }
    if (interpretNumericEntities) {
      decodedStr = decodedStr.replace(/&#(\d+);/g, function ($0, numberStr) {
        return String.fromCharCode(parseInt(numberStr, 10))
      })
    }
    return decodedStr
  }
}

/**
 * Helper for creating a decoder for the application/x-www-url-encoded body given
 * the parsing options
 */
function createBodyDecoder (queryparse, charset, charsetSentinel, interpretNumericEntities) {
  var correctedCharset = charset
  return function bodyDecoder (body) {
    var modifiedBody = body
    if (charsetSentinel) {
      modifiedBody = modifiedBody.replace(/(^|&)utf8=([^&]+)($|&)/, function ($0, ampBefore, value, ampAfter) {
        if (charsetBySentinel[value]) {
          correctedCharset = charsetBySentinel[value]
        }
        // Make sure that we only leave an ampersand when replacing in the middle of the query string
        // as the simple parser will add an empty string parameter if it gets &&
        return ampBefore && ampAfter ? '&' : ''
      })
    }
    return modifiedBody.length
      ? queryparse(modifiedBody, getDecoder(correctedCharset, interpretNumericEntities))
      : {}
  }
}

/**
 * Create a middleware to parse urlencoded bodies.
 *
 * @param {object} [options]
 * @return {function}
 * @public
 */

function urlencoded (options) {
  var opts = options || {}

  // notice because option default will flip in next major
  if (opts.extended === undefined) {
    deprecate('undefined extended: provide extended option')
  }

  var extended = opts.extended !== false
  var inflate = opts.inflate !== false
  var limit = typeof opts.limit !== 'number'
    ? bytes.parse(opts.limit || '100kb')
    : opts.limit
  var type = opts.type || 'application/x-www-form-urlencoded'
  var verify = opts.verify || false
  var charsetSentinel = opts.charsetSentinel
  var interpretNumericEntities = opts.interpretNumericEntities

  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function')
  }

  var defaultCharset = opts.defaultCharset || 'utf-8'
  if (defaultCharset !== 'utf-8' && defaultCharset !== 'iso-8859-1') {
    throw new TypeError('option defaultCharset must be either utf-8 or iso-8859-1')
  }

  // create the appropriate query parser
  var queryparse = createQueryParser(opts, extended)

  // create the appropriate type checking function
  var shouldParse = typeof type !== 'function'
    ? typeChecker(type)
    : type

  return function urlencodedParser (req, res, next) {
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

    // assert charset
    var charset = getCharset(req) || defaultCharset
    if (charset !== 'utf-8' && charset !== 'iso-8859-1') {
      debug('invalid charset')
      next(createError(415, 'unsupported charset "' + charset.toUpperCase() + '"', {
        charset: charset,
        type: 'charset.unsupported'
      }))
      return
    }

    // read
    read(req, res, next, createBodyDecoder(queryparse, charset, charsetSentinel, interpretNumericEntities), debug, {
      encoding: charset,
      inflate: inflate,
      limit: limit,
      verify: verify
    })
  }
}

/**
 * Get the extended query parser.
 *
 * @param {object} options
 */

function createQueryParser (options, extended) {
  var parameterLimit = options.parameterLimit !== undefined
    ? options.parameterLimit
    : 1000
  var charsetSentinel = options.charsetSentinel
  var interpretNumericEntities = options.interpretNumericEntities

  if (isNaN(parameterLimit) || parameterLimit < 1) {
    throw new TypeError('option parameterLimit must be a positive number')
  }

  if (isFinite(parameterLimit)) {
    parameterLimit = parameterLimit | 0
  }

  var depth = extended ? Infinity : 0

  return function queryparse (body, decoder) {
    var paramCount = parameterCount(body, parameterLimit)

    if (paramCount === undefined) {
      debug('too many parameters')
      throw createError(413, 'too many parameters', {
        type: 'parameters.too.many'
      })
    }

    var arrayLimit = extended ? Math.max(100, paramCount) : 0

    debug('parse ' + (extended ? 'extended ' : '') + 'urlencoding')

    return qs.parse(body, {
      allowPrototypes: true,
      arrayLimit: arrayLimit,
      depth: depth,
      parameterLimit: parameterLimit,
      decoder: decoder,
      charsetSentinel: charsetSentinel,
      interpretNumericEntities: interpretNumericEntities
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
