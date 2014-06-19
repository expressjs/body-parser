/*!
 * body-parser
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var bytes = require('bytes')
var qs = require('qs')
var querystring = require('querystring')
var read = require('../read')
var typer = require('media-typer')
var typeis = require('type-is')

/**
 * Module exports.
 */

module.exports = urlencoded

/**
 * Create a middleware to parse urlencoded bodies.
 *
 * @param {object} [options]
 * @return {function}
 * @api public
 */

function urlencoded(options){
  options = options || {};

  var extended = options.extended !== false
  var limit = typeof options.limit !== 'number'
    ? bytes(options.limit || '100kb')
    : options.limit
  var type = options.type || 'urlencoded'
  var verify = options.verify || false

  if (verify !== false && typeof verify !== 'function') {
    throw new TypeError('option verify must be function')
  }

  var queryparse = extended
    ? qs.parse
    : querystring.parse

  function parse(body) {
    return body.length
      ? queryparse(body)
      : {}
  }

  return function urlencodedParser(req, res, next) {
    if (req._body) return next();
    req.body = req.body || {}

    if (!typeis(req, type)) return next();

    var charset = typer.parse(req).parameters.charset || 'utf-8'
    if (charset.toLowerCase() !== 'utf-8') {
      var err = new Error('unsupported charset')
      err.status = 415
      next(err)
      return
    }

    // read
    read(req, res, next, parse, {
      encoding: charset,
      limit: limit,
      verify: verify
    })
  }
}
