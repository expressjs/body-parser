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
 * @param {Function|boolean} [options.errorInterceptor] optional error transformer `(err, req, res)` used when forwarding errors to `next`
 * @private
 */
function read (req, res, next, parse, debug, options) {
  // Wrap `next` so parser errors can be intercepted before they reach the
  // downstream error handler (expressjs/body-parser#658). Successful no-error
  // continuations call `next()` directly and are never intercepted.
  const forwardError = createErrorInterceptor(next, req, res, debug, options.errorInterceptor)
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
      forwardError(createError(415, 'unsupported charset "' + encoding.toUpperCase() + '"', {
        charset: encoding,
        type: 'charset.unsupported'
      }))
      return
    }
  }

  let length
  let stream

  const verify = options.verify

  // assert charset is supported before creating the decompression stream, so an
  // unsupported charset cannot leave a decoder piped with no error listener
  if (verify && encoding !== null && !iconv.encodingExists(encoding)) {
    return forwardError(createError(415, 'unsupported charset "' + encoding.toUpperCase() + '"', {
      charset: encoding.toLowerCase(),
      type: 'charset.unsupported'
    }))
  }

  try {
    const contentEncoding = (req.headers['content-encoding'] || 'identity').toLowerCase()

    debug('content-encoding "%s"', contentEncoding)

    if (options.inflate === false && contentEncoding !== 'identity') {
      throw createError(415, 'content encoding unsupported', {
        encoding: contentEncoding,
        type: 'encoding.unsupported'
      })
    }

    // get the content stream
    if (contentEncoding === 'identity') {
      length = req.headers['content-length']
      stream = req
    } else {
      stream = createDecompressionStream(contentEncoding, debug)
      req.pipe(stream)
    }
  } catch (err) {
    return forwardError(err)
  }

  // set raw-body options
  const rawBodyOptions = {
    length,
    encoding: verify ? null : encoding,
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
        forwardError(createError(400, _error))
      })
      return
    }

    // detach and destroy the decompression stream to
    // avoid decompression errors on the finished stream
    if (stream !== req) {
      req.unpipe(stream)
      stream.on('error', () => {})
      stream.destroy()

      // consume any remaining bytes so the HTTP request can finish
      req.resume()
    }

    // verify
    if (verify) {
      try {
        debug('verify body')
        verify(req, res, body, encoding)
      } catch (err) {
        forwardError(createError(403, err, {
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
      str = typeof body !== 'string' && encoding !== null
        ? iconv.decode(body, encoding)
        : body
      req.body = parse(str, encoding)
    } catch (err) {
      forwardError(createError(400, err, {
        body: str,
        type: err.type || 'entity.parse.failed'
      }))
      return
    }

    next()
  })
}

/**
 * Wrap the middleware `next` callback with the optional `errorInterceptor`
 * option, which lets callers modify or replace parser errors before they are
 * passed on to the downstream `next(err)` / Express error handler.
 *
 * Only error calls are intercepted; the normal no-error `next()` continuation
 * is invoked directly by {@link read} and never reaches this wrapper, so the
 * interceptor cannot hijack request flow after successful parsing.
 *
 * @param {Function} next original middleware `next` callback
 * @param {Object} req the incoming request
 * @param {Object} res the server response
 * @param {Function} debug debug logger
 * @param {Function|boolean} interceptor `(err, req, res) => Error|undefined`
 * @returns {Function} forwards the original, transformed or replacement error to `next`
 * @private
 */
function createErrorInterceptor (next, req, res, debug, interceptor) {
  if (!interceptor) {
    return next
  }

  return function forwardError (err) {
    // tolerate accidental reuse of this wrapper for a no-error continuation
    if (!err) {
      return next()
    }

    let intercepted = err

    try {
      const result = interceptor(err, req, res)

      if (result instanceof Error) {
        intercepted = result
      } else if (result === undefined || result === null) {
        // forwarding the original error avoids hanging the request pipeline
        intercepted = err
      } else {
        const typeError = new TypeError('errorInterceptor must return an Error or undefined, got ' + typeof result)
        typeError.status = 500
        typeError.statusCode = 500
        typeError.type = 'error.interceptor.invalidResult'
        return next(typeError)
      }
    } catch (interceptorError) {
      // user-provided interceptor code must not swallow the parsing error;
      // keep forwarding it and surface the interceptor failure alongside it
      try {
        err.errorInterceptorError = interceptorError
      } catch { /* non-writable error object; ignore */ }
      debug('errorInterceptor threw: %s', interceptorError && interceptorError.message)
      intercepted = err
    }

    return next(intercepted)
  }
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
