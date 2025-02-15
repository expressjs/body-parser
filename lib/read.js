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
var getBody = require('raw-body')
var iconv = require('iconv-lite')
var onFinished = require('on-finished')
var zlib = require('node:zlib')
var hasBody = require('type-is').hasBody
var { getCharset } = require('./utils')

/**
 * Module exports.
 */

module.exports = read

/**
 * Read a request into a buffer and parse.
 *
 * @param {object} req
 * @param {object} res
 * @param {function} next
 * @param {function} parse
 * @param {function} debug
 * @param {object} options
 * @private
 */

function read (req, res, next, parse, debug, options) {
  if (onFinished.isFinished(req)) {
    debug('body already parsed')
    next()
    return
  }

  if (!('body' in req)) {
    req.body = undefined
  }

  // skip requests without bodies
  if (!hasBody(req)) {
    debug('skip empty body')
    next()
    return
  }

  debug('content-type %j', req.headers['content-type'])

  // determine if request should be parsed
  if (!options.shouldParse(req)) {
    debug('skip parsing')
    next()
    return
  }

  var charset = null
  if (options?.skipCharset !== true) {
    charset = getCharset(req) || options.defaultCharset

    // validate charset
    if (!!options?.isValidCharset && !options.isValidCharset(charset)) {
      debug('invalid charset')
      next(createError(415, 'unsupported charset "' + charset.toUpperCase() + '"', {
        charset,
        type: 'charset.unsupported'
      }))
      return
    }
  }

  // get the content stream
  const contentEncoding = (req.headers['content-encoding'] || 'identity').toLowerCase()
  debug('content-encoding "%s"', contentEncoding)

  if (options.inflate === false && contentEncoding !== 'identity') {
    return next(createError(415, 'content encoding unsupported', {
      encoding: contentEncoding,
      type: 'encoding.unsupported'
    }))
  }

  let stream
  if (contentEncoding === 'identity') {
    // set raw-body expected length
    stream = req
    options.length = req.headers['content-length']
  } else {
    try {
      stream = createDecompressionStream(contentEncoding, debug)
      req.pipe(stream)
      options.length = undefined
    } catch (err) {
      return next(err)
    }
  }

  // assert charset is supported
  if (options.verify && charset !== null && !iconv.encodingExists(charset)) {
    return next(createError(415, 'unsupported charset "' + charset.toUpperCase() + '"', {
      charset: charset.toLowerCase(),
      type: 'charset.unsupported'
    }))
  }

  // set raw-body encoding
  options.encoding = options.verify ? null : charset

  // read body
  debug('read body')
  getBody(stream, options, function (error, body) {
    if (error) {
      var _error

      if (error.type === 'encoding.unsupported') {
        // echo back charset
        _error = createError(415, 'unsupported charset "' + charset.toUpperCase() + '"', {
          charset: charset.toLowerCase(),
          type: 'charset.unsupported'
        })
      } else {
        // set status code on error
        _error = createError(400, error)
      }

      // unpipe from stream and destroy
      if (stream !== req) {
        req.unpipe()
        stream.destroy()
      }

      // read off entire request
      dump(req, function onfinished () {
        next(createError(400, _error))
      })
      return
    }

    // verify
    if (options.verify) {
      try {
        debug('verify body')
        options.verify(req, res, body, charset)
      } catch (err) {
        next(createError(403, err, {
          body: body,
          type: err.type || 'entity.verify.failed'
        }))
        return
      }
    }

    // parse
    var str = body
    try {
      debug('parse body')
      str = typeof body !== 'string' && charset !== null
        ? iconv.decode(body, charset)
        : body
      req.body = parse(str, charset)
    } catch (err) {
      next(createError(400, err, {
        body: str,
        type: err.type || 'entity.parse.failed'
      }))
      return
    }

    next()
  })
}

/**
 * Create a decompression stream for the given encoding.
 * @param {string} encoding
 * @param {function} debug
 * @return {object}
 * @api private
 */
function createDecompressionStream (encoding, debug) {
  switch (encoding) {
    case 'deflate':
      debug('inflate body')
      return zlib.createInflate()
    case 'gzip':
      debug('gunzip body')
      return zlib.createGunzip()
    case 'br':
      debug('brotli decompress body')
      return zlib.createBrotliDecompress()
    default:
      throw createError(415, 'unsupported content encoding "' + encoding + '"', {
        encoding: encoding,
        type: 'encoding.unsupported'
      })
  }
}

/**
 * Dump the contents of a request.
 *
 * @param {object} req
 * @param {function} callback
 * @api private
 */

function dump (req, callback) {
  if (onFinished.isFinished(req)) {
    callback(null)
  } else {
    onFinished(req, callback)
    req.resume()
  }
}
