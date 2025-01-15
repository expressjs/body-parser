/*!
 * body-parser
 * Copyright(c) 2014 Jonathan Ong
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * Module dependencies.
 * @private
 */

var genericParser = require('../generic-parser')
var debug = require('debug')('body-parser:json')

/**
 * Module exports.
 */

module.exports = json

/**
 * RegExp to match the first non-space in a string.
 *
 * Allowed whitespace is defined in RFC 7159:
 *
 *    ws = *(
 *            %x20 /              ; Space
 *            %x09 /              ; Horizontal tab
 *            %x0A /              ; Line feed or New line
 *            %x0D )              ; Carriage return
 */

var FIRST_CHAR_REGEXP = /^[\x20\x09\x0a\x0d]*([^\x20\x09\x0a\x0d])/ // eslint-disable-line no-control-regex

var JSON_SYNTAX_CHAR = '#'
var JSON_SYNTAX_REGEXP = /#+/g

/**
 * Create a middleware to parse JSON bodies.
 *
 * @param {object} [options]
 * @return {function}
 * @public
 */

function json (options) {
  var opts = options || {}

  var reviver = opts.reviver
  var strict = opts.strict !== false
  var parser = opts.parser || JSON.parse
  var type = opts.type || 'application/json'

  console.log(typeof genericParser)

  return genericParser(opts, {
    type: type,

    charset: function validateCharset (charset) {
      return charset.slice(0, 4) === 'utf-'
    },

    parse: function parse (buf) {
      if (buf.length === 0) {
        // special-case empty json body, as it's a common client-side mistake
        // TODO: maybe make this configurable or part of "strict" option
        return {}
      }

      if (strict) {
        var first = firstchar(buf)

        if (first !== '{' && first !== '[') {
          debug('strict violation')
          throw createStrictSyntaxError(parser, reviver, buf, first)
        }
      }

      try {
        debug('parse json')
        return parser(buf, reviver)
      } catch (e) {
        throw normalizeJsonSyntaxError(e, {
          message: e.message,
          stack: e.stack
        })
      }
    }
  })
}

/**
 * Create strict violation syntax error matching native error.
 *
 * @param {string} str
 * @param {string} char
 * @return {Error}
 * @private
 */

function createStrictSyntaxError (parser, reviver, str, char) {
  var index = str.indexOf(char)
  var partial = ''

  if (index !== -1) {
    partial = str.substring(0, index) + JSON_SYNTAX_CHAR

    for (var i = index + 1; i < str.length; i++) {
      partial += JSON_SYNTAX_CHAR
    }
  }

  try {
    parser(partial, reviver); /* istanbul ignore next */ throw new SyntaxError('strict violation')
  } catch (e) {
    return normalizeJsonSyntaxError(e, {
      message: e.message.replace(JSON_SYNTAX_REGEXP, function (placeholder) {
        return str.substring(index, index + placeholder.length)
      }),
      stack: e.stack
    })
  }
}

/**
 * Get the first non-whitespace character in a string.
 *
 * @param {string} str
 * @return {function}
 * @private
 */

function firstchar (str) {
  var match = FIRST_CHAR_REGEXP.exec(str)

  return match
    ? match[1]
    : undefined
}

/**
 * Normalize a SyntaxError for JSON.parse.
 *
 * @param {SyntaxError} error
 * @param {object} obj
 * @return {SyntaxError}
 */

function normalizeJsonSyntaxError (error, obj) {
  var keys = Object.getOwnPropertyNames(error)

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]
    if (key !== 'stack' && key !== 'message') {
      delete error[key]
    }
  }

  // replace stack before message for Node.js 0.10 and below
  error.stack = obj.stack.replace(error.message, obj.message)
  error.message = obj.message

  return error
}
