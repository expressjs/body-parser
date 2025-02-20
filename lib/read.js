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

const createError = require('http-errors')
const getBody = require('raw-body')
const iconv = require('iconv-lite')
const onFinished = require('on-finished')
const zlib = require('node:zlib')

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
  // read options
  const charset = options.charset

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
      let _error

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
    let str = body
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
