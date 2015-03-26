/*!
 * body-parser
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var getBody = require('raw-body')
var iconv = require('iconv-lite')
var onFinished = require('on-finished')
var zlib = require('zlib')
var stream = require('stream')
var util = require('util')

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
 * @param {object} [options]
 * @api private
 */

function read(req, res, next, parse, debug, options) {
  var length
  var stream

  // flag as parsed
  req._body = true
  var opts = options || {}

  var encoding = opts.encoding !== null
    ? opts.encoding || 'utf-8'
    : null
  var verify = opts.verify
  var decrypt = opts.decrypt

  opts.encoding = verify
    ? null
    : encoding

  try {
    stream = contentstream(req, debug, opts.inflate, decrypt)
    length = stream.length
    delete stream.length
  } catch (err) {
    return next(err)
  }
  opts.length = length

  // read body
  debug('read body')
  getBody(stream, opts, function (err, body) {
    if (err) {
      if (!err.status) {
        err.status = 400
      }

      // echo back charset
      if (err.type === 'encoding.unsupported') {
        err = new Error('unsupported charset "' + encoding.toUpperCase() + '"')
        err.charset = encoding.toLowerCase()
        err.status = 415
      }

      // read off entire request
      stream.resume()
      onFinished(req, function onfinished() {
        next(err)
      })
      return
    }

    // verify
    if (verify) {
      try {
        debug('verify body')
        verify(req, res, body, encoding)
      } catch (err) {
        if (!err.status) err.status = 403
        return next(err)
      }
    }


    // parse
    try {
      debug('parse body')
      body = typeof body !== 'string' && encoding !== null
        ? iconv.decode(body, encoding)
        : body
      req.body = parse(body)
    } catch (err) {
      if (!err.status) {
        err.body = body
        err.status = 400
      }
      return next(err)
    }

    next()
  })
}

/**
 * Get the content stream of the request.
 *
 * @param {object} req
 * @param {function} debug
 * @param {boolean} [inflate=true]
 * @param {function} decrypt
 * @return {object}
 * @api private
 */

function contentstream(req, debug, inflate, decrypt) {
  var encoding = (req.headers['content-encoding'] || 'identity').toLowerCase()
  var err
  var length = req.headers['content-length']
  var stream

  debug('content-encoding "%s"', encoding)

  if (inflate === false && encoding !== 'identity') {
    err = new Error('content encoding unsupported')
    err.status = 415
    throw err
  }

  switch (encoding) {
    case 'deflate':
      stream = zlib.createInflate()
      debug('inflate body')
      req.pipe(stream)
      break
    case 'gzip':
      stream = zlib.createGunzip()
      debug('gunzip body')
      req.pipe(stream)
      break
    case 'identity':
      stream = req
      stream.length = length
      break
    default:
      err = new Error('unsupported content encoding "' + encoding + '"')
      err.encoding = encoding
      err.status = 415
      throw err
  }

  return decrypt ? decryptstream(stream, debug, decrypt) : stream
}

/**
 * Get the content stream of the request.
 *
 * @param {object} input
 * @param {function} debug
 * @param {function} decrypt
 * @return {object}
 * @api private
 */
function decryptstream(input, debug, decrypt) {
  var decrypt = decrypt || false
  if (decrypt !== false && typeof decrypt !== 'function') {
    throw new TypeError('decrypt must be function')
  }
  if (decrypt) {
    debug('decrypt body stream')
    var output = new Decryptor(decrypt)
    input.pipe(output)
    return output
  } else {
    return input
  }
}

var Transform = stream.Transform || require('readable-stream').Transform
/*
 * Decrypt an object stream
 *
 * @param {object} options
 */
function Decryptor(decrypt) {
  if (!(this instanceof Decryptor)) {
    return new Decryptor(filterProps, decrypt)
  }
  this.decrypt =  decrypt || false
  if (this.decrypt !== false && typeof this.decrypt !== 'function') {
    throw new TypeError('decrypt must be function')
  }
  Transform.call(this, decrypt)
}
util.inherits(Decryptor, Transform)

Decryptor.prototype._transform = function (chunk, enc, cb) {
  if (this.decrypt) {
    try {
      chunk = decrypt(chunk.toString().toUpperCase())
    } catch (err) {
      if (!err.status) err.status = 403
      throw err
    }
  }
  this.push(chunk, enc)
  cb()
}

