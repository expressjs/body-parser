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
const { TextDecoder } = require('node:util')
const zlib = require('node:zlib')
const hasBody = require('type-is').hasBody
const contentType = require('content-type')

/**
 * Module exports.
 */

module.exports = read

/**
 * @const
 * whether current node version has zstandard support
 */
const hasZstandardSupport = 'createZstdDecompress' in zlib

/**
 * Read a request into a buffer and parse.
 *
 * @param {Object} req
 * @param {Object} res
 * @param {Function} next
 * @param {Function} parse
 * @param {Function} debug
 * @param {Object} options
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

  let encoding = null
  if (options?.skipCharset !== true) {
    encoding = getCharset(req) || options.defaultCharset

    // validate charset
    if (!!options?.isValidCharset && !options.isValidCharset(encoding)) {
      debug('invalid charset')
      next(createError(415, 'unsupported charset "' + encoding.toUpperCase() + '"', {
        charset: encoding,
        type: 'charset.unsupported'
      }))
      return
    }
  }

  let length
  let stream

  const verify = options.verify

  try {
    // get the content stream
    stream = contentstream(req, debug, options.inflate)
    length = stream.length
    stream.length = undefined
  } catch (err) {
    return next(err)
  }

  // assert charset is supported
  if (encoding !== null && !isEncodingSupported(encoding)) {
    return next(createError(415, 'unsupported charset "' + encoding.toUpperCase() + '"', {
      charset: encoding.toLowerCase(),
      type: 'charset.unsupported'
    }))
  }

  // set raw-body options
  const rawBodyOptions = {
    length,
    encoding: null,
    limit: options.limit
  }

  // read body
  debug('read body')
  getBody(stream, rawBodyOptions, function (error, body) {
    if (error) {
      let _error

      if (error.type === 'encoding.unsupported') {
        // echo back charset
        _error = createError(415, 'unsupported charset "' + encoding.toUpperCase() + '"', {
          charset: encoding.toLowerCase(),
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
    if (verify) {
      try {
        debug('verify body')
        verify(req, res, body, encoding)
      } catch (err) {
        next(createError(403, err, {
          body,
          type: err.type || 'entity.verify.failed'
        }))
        return
      }
    }

    // parse
    let str = body
    try {
      debug('parse body')
      str = decodeBody(body, encoding)
      req.body = parse(str, encoding)
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
 * Decode a request body.
 *
 * @param {Buffer|string} body
 * @param {string|null} encoding
 * @returns {string|Buffer}
 * @private
 */
function decodeBody (body, encoding) {
  if (typeof body === 'string' || encoding === null) {
    return body
  }

  const decoder = getTextDecoder(encoding)

  return decoder !== null
    ? decoder.decode(body)
    : iconv.decode(body, encoding)
}

/**
 * Create a WHATWG text decoder for the given encoding.
 *
 * @param {string} encoding
 * @returns {TextDecoder|null}
 * @private
 */
function getTextDecoder (encoding) {
  if (encoding === 'utf-16') {
    return null
  }

  try {
    return new TextDecoder(encoding)
  } catch {
    return null
  }
}

/**
 * Determine if an encoding is supported.
 *
 * @param {string} encoding
 * @returns {boolean}
 * @private
 */
function isEncodingSupported (encoding) {
  return getTextDecoder(encoding) !== null || iconv.encodingExists(encoding)
}

/**
 * Get the content stream of the request.
 *
 * @param {Object} req
 * @param {Function} debug
 * @param {boolean} inflate
 * @returns {Object}
 * @private
 */
function contentstream (req, debug, inflate) {
  const encoding = (req.headers['content-encoding'] || 'identity').toLowerCase()
  const length = req.headers['content-length']

  debug('content-encoding "%s"', encoding)

  if (inflate === false && encoding !== 'identity') {
    throw createError(415, 'content encoding unsupported', {
      encoding,
      type: 'encoding.unsupported'
    })
  }

  if (encoding === 'identity') {
    req.length = length
    return req
  }

  const stream = createDecompressionStream(encoding, debug)
  req.pipe(stream)
  return stream
}

/**
 * Create a decompression stream for the given encoding.
 * @param {string} encoding
 * @param {Function} debug
 * @returns {Object}
 * @private
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
    case 'zstd':
      if (hasZstandardSupport) {
        debug('zstd decompress body')
        return zlib.createZstdDecompress()
      }
  }
  throw createError(415, 'unsupported content encoding "' + encoding + '"', {
    encoding,
    type: 'encoding.unsupported'
  })
}

/**
 * Dump the contents of a request.
 *
 * @param {Object} req
 * @param {Function} callback
 * @private
 */
function dump (req, callback) {
  if (onFinished.isFinished(req)) {
    callback(null)
  } else {
    onFinished(req, callback)
    req.resume()
  }
}

/**
 * Get the charset of a request.
 *
 * @param {Object} req
 * @returns {string | undefined}
 * @private
 */
function getCharset (req) {
  const header = req.headers['content-type']
  if (!header) return undefined
  return contentType.parse(header).parameters.charset?.toLowerCase()
}
