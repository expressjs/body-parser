
var bytes = require('bytes');
var getBody = require('raw-body');
var typeis = require('type-is');
var http = require('http');
var qs = require('qs');
var zlib = require('zlib');

var firstcharRegExp = /^\s*(.)/

exports = module.exports = bodyParser;
exports.json = json;
exports.urlencoded = urlencoded;

function bodyParser(options){
  var opts = {}

  options = options || {}

  // exclude type option
  for (var prop in options) {
    if ('type' !== prop) {
      opts[prop] = options[prop]
    }
  }

  var _urlencoded = urlencoded(opts)
  var _json = json(opts)

  return function bodyParser(req, res, next) {
    _json(req, res, function(err){
      if (err) return next(err);
      _urlencoded(req, res, next);
    });
  }
}

function json(options){
  options = options || {};

  var limit = typeof options.limit !== 'number'
    ? bytes(options.limit || '100kb')
    : options.limit;
  var reviver = options.reviver
  var strict = options.strict !== false;
  var type = options.type || 'json';
  var verify = options.verify || false

  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function')
  }

  function parse(str) {
    if (0 === str.length) {
      throw new Error('invalid json, empty body')
    }
    if (strict) {
      var first = firstchar(str)

      if (first !== '{' && first !== '[') {
        throw new Error('invalid json')
      }
    }

    return JSON.parse(str, reviver)
  }

  return function jsonParser(req, res, next) {
    if (req._body) return next();
    req.body = req.body || {}

    if (!typeis(req, type)) return next();

    // read
    read(req, res, next, parse, {
      limit: limit,
      verify: verify
    })
  }
}

function urlencoded(options){
  options = options || {};

  var limit = typeof options.limit !== 'number'
    ? bytes(options.limit || '100kb')
    : options.limit;
  var type = options.type || 'urlencoded';
  var verify = options.verify || false;

  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function')
  }

  function parse(str) {
    return str.length
      ? qs.parse(str)
      : {}
  }

  return function urlencodedParser(req, res, next) {
    if (req._body) return next();
    req.body = req.body || {}

    if (!typeis(req, type)) return next();

    // read
    read(req, res, next, parse, {
      limit: limit,
      verify: verify
    })
  }
}

function firstchar(str) {
  if (!str) return ''
  var match = firstcharRegExp.exec(str)
  return match ? match[1] : ''
}

function read(req, res, next, parse, options) {
  var length = req.headers['content-length']
  var waitend = true

  // flag as parsed
  req._body = true

  options = options || {}
  options.length = length

  var encoding = options.encoding || 'utf-8'
  var verify = options.verify

  options.encoding = verify
    ? null
    : encoding

  req.on('aborted', cleanup)
  req.on('end', cleanup)
  req.on('error', cleanup)

  var compressedReceived = 0;
  function onCompressedData(chunk) {
    compressedReceived += chunk.length;
  }
  function onCompressedEnd() {
    if (compressedReceived < length) {
      err = new Error('compressed stream too short')
      err.status = 400
      next(err)
      return
    } else if (compressedReceived > length) {
      err = new Error('compressed stream too long')
      err.status = 400
      next(err)
      return
    }
  }
  function setupCompressedStream() {
    // assert the stream encoding is buffer.
    var state = req._readableState;
    if (req._decoder || (state && (state.encoding || state.decoder))) {
      err = new Error('stream encoding should not be set')
      err.status = 500
      next(err)
      return
    }
    // delete length and setup expected-zipped-data-length check
    delete options.length
    delete req.headers['content-length']
    if (length !== null && !isNaN(length)) {
      length = parseInt(length, 10)
      req.on('data', onCompressedData)
      req.on('end', onCompressedEnd)
    }
  }

  var stream;
  switch (req.headers['content-encoding'] || 'identity') {
    case 'gzip':
      stream = req.pipe(zlib.createGunzip())
      setupCompressedStream()
      break
    case 'deflate':
      stream = req.pipe(zlib.createInflate())
      setupCompressedStream()
      break
    case 'identity':
      stream = req
      break
    default:
      var err = new Error('encoding not supported')
      err.status = 415
      next(err)
      return
  }

  // read body
  getBody(stream, options, function (err, body) {
    if (err && waitend && req.readable) {
      // read off entire request
      req.resume()
      req.once('end', function onEnd() {
        next(err)
      })
      return
    }

    if (err) {
      next(err)
      return
    }

    var str

    // verify
    if (verify) {
      try {
        verify(req, res, body, encoding)
      } catch (err) {
        if (!err.status) err.status = 403
        return next(err)
      }
    }

    // parse
    try {
      str = typeof body !== 'string'
        ? body.toString(encoding)
        : body
      req.body = parse(str)
    } catch (err){
      err.body = str
      err.status = 400
      return next(err)
    }

    next()
  })

  function cleanup() {
    waitend = false
    req.removeListener('aborted', cleanup)
    req.removeListener('end', cleanup)
    req.removeListener('error', cleanup)
  }
}
