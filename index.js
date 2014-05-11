
var bytes = require('bytes');
var getBody = require('raw-body');
var typeis = require('type-is');
var http = require('http');
var qs = require('qs');

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
  var strict = options.strict !== false;
  var type = options.type || 'json';

  return function jsonParser(req, res, next) {
    if (req._body) return next();
    req.body = req.body || {};

    if (!typeis(req, type)) return next();

    // flag as parsed
    req._body = true;

    // parse
    getBody(req, {
      limit: limit,
      length: req.headers['content-length'],
      encoding: 'utf8'
    }, function (err, str) {
      if (err) return next(err);

      if (0 == str.length) {
        return next(error(400, 'invalid json, empty body'));
      }

      var first = firstchar(str)

      if (strict && '{' != first && '[' != first) {
        return next(error(400, 'invalid json'));
      }

      try {
        req.body = JSON.parse(str, options.reviver);
      } catch (err){
        err.body = str;
        err.status = 400;
        return next(err);
      }
      next();
    })
  };
}

function urlencoded(options){
  options = options || {};

  var limit = typeof options.limit !== 'number'
    ? bytes(options.limit || '100kb')
    : options.limit;
  var type = options.type || 'urlencoded';

  return function urlencodedParser(req, res, next) {
    if (req._body) return next();
    req.body = req.body || {};

    if (!typeis(req, type)) return next();

    // flag as parsed
    req._body = true;

    // parse
    getBody(req, {
      limit: limit,
      length: req.headers['content-length'],
      encoding: 'utf8'
    }, function (err, buf) {
      if (err) return next(err);

      try {
        req.body = buf.length
          ? qs.parse(buf)
          : {};
      } catch (err){
        err.body = buf;
        return next(err);
      }
      next();
    })
  }
}

function error(code, msg) {
  var err = new Error(msg || http.STATUS_CODES[code]);
  err.status = code;
  return err;
}

function firstchar(str) {
  if (!str) return ''
  var match = firstcharRegExp.exec(str)
  return match ? match[1] : ''
}
