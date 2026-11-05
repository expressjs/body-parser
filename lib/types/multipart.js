/*!
 * body-parser
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * Module dependencies.
 * @private
 */

var createError = require('http-errors')
var debug = require('debug')('body-parser:multipart')
var read = require('../read')
var { normalizeOptions } = require('../utils')

/**
 * Module exports.
 */

module.exports = multipart

/**
 * Create a middleware to parse multipart/form-data bodies.
 * This parser only extracts text fields and drops file fields.
 *
 * @param {Object} [options]
 * @returns {Function}
 * @public
 */
function multipart (options) {
  const normalizedOptions = normalizeOptions(options, 'multipart/form-data')

  var limit = normalizedOptions.limit
  var verify = normalizedOptions.verify

  function parse (body, encoding) {
    var req = this
    if (!body || body.length === 0) {
      return {}
    }

    var contentType = req.headers && req.headers['content-type']
    if (!contentType) {
      throw createError(400, 'missing content-type header', {
        type: 'multipart.content-type.missing'
      })
    }

    if (!contentType.toLowerCase().includes('multipart')) {
      debug('non-multipart content-type in parse function - should have been skipped')
      return undefined
    }

    var boundary = extractBoundary(contentType)
    var bodyStr = typeof body === 'string' ? body : body.toString('utf-8')
    var parts = bodyStr.split('--' + boundary)
    var result = {}

    for (var i = 1; i < parts.length - 1; i++) {
      var field = parsePart(parts[i], limit, req, encoding)
      if (field) {
        addField(result, field.name, field.value)
      }
    }

    return result
  }

  var readLimit = normalizedOptions.limit
  var overallLimit = Math.max(readLimit * 100, 100 * 1024 * 1024)

  const readOptions = {
    ...normalizedOptions,
    limit: overallLimit,
    skipCharset: true,
    verify: false
  }

  return function multipartParser (req, res, next) {
    req._multipartVerify = verify
    read(req, res, next, parse.bind(req), debug, readOptions)
  }
}

/**
 * Extract boundary from content-type header.
 *
 * @param {string} contentType
 * @returns {string}
 * @private
 */
function extractBoundary (contentType) {
  var boundaryMatch = contentType.match(/boundary=([^;]+)/i)
  if (!boundaryMatch) {
    throw createError(400, 'missing boundary in content-type', {
      type: 'multipart.boundary.missing'
    })
  }
  return boundaryMatch[1].replace(/^["']|["']$/g, '')
}

/**
 * Parse a single multipart part.
 *
 * @param {string} part
 * @param {number} limit
 * @param {Object} req
 * @param {string} encoding
 * @returns {Object|null}
 * @private
 */
function parsePart (part, limit, req, encoding) {
  var trimmed = part.trim()
  if (trimmed === '--' || trimmed === '') {
    return null
  }

  var headerEnd = trimmed.indexOf('\r\n\r\n')
  if (headerEnd === -1) {
    headerEnd = trimmed.indexOf('\n\n')
    if (headerEnd === -1) {
      debug('invalid part format')
      return null
    }
    headerEnd += 1
  } else {
    headerEnd += 4
  }

  var headers = trimmed.substring(0, headerEnd)
  var bodyContent = trimmed.substring(headerEnd).replace(/\r\n$/, '')

  var contentDisposition = headers.match(/Content-Disposition:\s*([^\r\n]+)/i)
  if (!contentDisposition) {
    debug('missing Content-Disposition header')
    return null
  }

  var disposition = contentDisposition[1]

  if (/filename\s*=/i.test(disposition)) {
    debug('dropping file field')
    return null
  }

  var nameMatch = disposition.match(/name\s*=\s*"([^"]+)"|name\s*=\s*([^;,\s]+)/i)
  if (!nameMatch) {
    debug('missing field name')
    return null
  }

  var fieldName = nameMatch[1] || nameMatch[2]

  if (bodyContent.length > limit) {
    var err = createError(413, 'field size limit exceeded', {
      type: 'entity.too.large',
      limit: limit
    })
    err.expose = true
    throw err
  }

  var fieldVerify = req._multipartVerify
  if (fieldVerify) {
    try {
      fieldVerify(req, null, bodyContent, encoding || 'utf-8')
    } catch (err) {
      throw createError(403, err, {
        type: err.type || 'entity.verify.failed'
      })
    }
  }

  return { name: fieldName, value: bodyContent }
}

/**
 * Add field to result object, handling multiple values.
 *
 * @param {Object} result
 * @param {string} name
 * @param {string} value
 * @private
 */
function addField (result, name, value) {
  if (result[name]) {
    if (Array.isArray(result[name])) {
      result[name].push(value)
    } else {
      result[name] = [result[name], value]
    }
  } else {
    result[name] = value
  }
}
