/*!
 * body-parser
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict'

/**
 * JSON parser.
 * @public
 */
exports.json = require('./lib/types/json')

/**
 * Raw parser.
 * @public
 */
exports.raw = require('./lib/types/raw')

/**
 * Text parser.
 * @public
 */
exports.text = require('./lib/types/text')

/**
 * URL-encoded parser.
 * @public
 */
exports.urlencoded = require('./lib/types/urlencoded')
