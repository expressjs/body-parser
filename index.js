/*!
 * body-parser
 * Copyright(c) 2014 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var bodyParser = require('./lib/body-parser')
var fs = require('fs')
var path = require('path')

/**
 * @typedef Parsers
 * @type {function}
 * @property {function} json
 * @property {function} raw
 * @property {function} text
 * @property {function} urlencoded
 */

/**
 * Module exports.
 * @type {Parsers}
 */

module.exports = bodyParser

/**
 * Path to the parser modules.
 */

var parsersDir = path.join(__dirname, 'lib', 'types')

/**
 * Auto-load bundled parsers with getters.
 */

fs.readdirSync(parsersDir).forEach(function onfilename(filename) {
  if (!/\.js$/.test(filename)) return

  var loc = path.resolve(parsersDir, filename)
  var mod
  var name = path.basename(filename, '.js')

  function load() {
    if (mod) {
      return mod
    }

    return mod = require(loc)
  }

  Object.defineProperty(module.exports, name, {
    configurable: true,
    enumerable: true,
    get: load
  })
})
