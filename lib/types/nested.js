/*!
 * body-parser
 * Copyright(c) 2016 Daniel Röhers Moura
 * MIT Licensed
 */

'use strict'

/**
 * Module exports.
 */

module.exports = nested

/**
 * Create a middleware to parse nested bodies.
 *
 * @param {object} [options]
 * @return {function}
 * @api public
 */

function nested (options) {
  var opts = { body: true, query: true }
  opts = Object.assign(opts, options)
  return function nestedParser (req, res, next) {
    if (opts.body && req.body) req.body = parse(req.body)
    if (opts.query && req.query) req.query = parse(req.query)
    next()
  }
};

/**
 * Parse nested bodies.
 *
 * @param {object} [object]
 * @return {object}
 * @api private
 */

function parse (object) {
  object = object || {}
  var result = {}
  Object.keys(object).forEach(function (key) {
    var list = splitKey(key)
    var parsed = toObject(list, object[key])
    result = merge(result, parsed)
  })
  return result
};

/**
 * Split object key.
 *
 * @param {string} key
 * @return {array}
 * @api private
 */

function splitKey (key) {
  return key.split('.')
}

/**
 * Mount list on object.
 *
 * @param {array} list
 * @param {*} value
 * @return {object}
 * @api private
 */

function toObject (list, value) {
  var first = true
  var object
  for (var i = list.length - 1, l = 0; i >= l; i--) {
    var temp = {}
    var key = list[i]
    temp[key] = first ? value : object
    first = false
    object = temp
  }
  return object
}

/**
 * Merge objects.
 *
 * @param {object} object
 * @param {object} parsed
 * @return {object}
 * @api private
 */

function merge (object, parsed) {
  if (!isObject(parsed)) {
    object = parsed
    return object
  }
  for (var key in parsed) {
    var parent = object[key]
    if (parent && !isObject(parent)) parent = {}
    object[key] = parent ? merge(parent, parsed[key]) : parsed[key]
  }
  return object
}

/**
 * Test object.
 *
 * @param {*} attr
 * @return {boolean}
 * @api private
 */

function isObject (attr) {
  return typeof attr === 'object'
}
