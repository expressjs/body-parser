# body-parser

[![NPM version](https://badge.fury.io/js/body-parser.svg)](https://badge.fury.io/js/body-parser)
[![Build Status](https://travis-ci.org/expressjs/body-parser.svg?branch=master)](https://travis-ci.org/expressjs/body-parser)
[![Coverage Status](https://img.shields.io/coveralls/expressjs/body-parser.svg?branch=master)](https://coveralls.io/r/expressjs/body-parser)

Node.js body parsing middleware.

This only handles `urlencoded` and `json` bodies.
For multipart bodies, you may be interested in the following modules:

- [busboy](https://www.npmjs.org/package/busboy#readme) and [connect-busboy](https://www.npmjs.org/package/connect-busboy#readme)
- [multiparty](https://www.npmjs.org/package/multiparty#readme) and [connect-multiparty](https://www.npmjs.org/package/connect-multiparty#readme)
- [formidable](https://www.npmjs.org/package/formidable#readme)
- [multer](https://www.npmjs.org/package/multer#readme)

Other body parsers you might be interested in:

- [body](https://www.npmjs.org/package/body#readme)
- [co-body](https://www.npmjs.org/package/co-body#readme)

## Installation

```sh
$ npm install body-parser
```

## API

```js
var express    = require('express')
var bodyParser = require('body-parser')

var app = express()

// parse application/json and application/x-www-form-urlencoded
app.use(bodyParser())

// parse application/vnd.api+json as json
app.use(bodyParser.json({ type: 'application/vnd.api+json' }))

app.use(function (req, res, next) {
  console.log(req.body) // populated!
  next()
})
```

### bodyParser(options)

Returns middleware that parses both `json` and `urlencoded`.
The `options` are passed to both middleware, except `type`.

### bodyParser.json(options)

Returns middleware that only parses `json`. The options are:

- `strict` - only parse objects and arrays. (default: `true`)
- `limit` - maximum request body size. (default: `<100kb>`)
- `reviver` - passed to `JSON.parse()`
- `type` - request content-type to parse (default: `json`)
- `verify` - function to verify body content

The `type` argument is passed directly to the [type-is](https://www.npmjs.org/package/type-is#readme) library. This can be an extension name (like `json`), a mime type (like `application/json`), or a mime time with a wildcard (like `*/json`).

The `verify` argument, if supplied, is called as `verify(req, res, buf, encoding)`, where `buf` is a `Buffer` of the raw request body and `encoding` is the encoding of the request. The parsing can be aborted by throwing an error.

The `reviver` argument is passed directly to `JSON.parse` as the second argument. You can find more information on this argument [in the MDN documentation about JSON.parse](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#Example.3A_Using_the_reviver_parameter).

### bodyParser.urlencoded(options)

Returns middleware that only parses `urlencoded` bodies. The options are:

- `extended` - parse extended syntax with the [qs](https://www.npmjs.org/package/qs#readme) module. (default: `true`)
- `limit` - maximum request body size. (default: `<100kb>`)
- `type` - request content-type to parse (default: `urlencoded`)
- `verify` - function to verify body content

The `extended` argument allows to choose between parsing the urlencoded data with the `querystring` library (when `false`) or the `qs` library (when `true`). The "extended" syntax allows for rich objects and arrays to be encoded into the urlencoded format, allowing for a JSON-like exterience with urlencoded. For more information, please [see the qs library](https://www.npmjs.org/package/qs#readme).

The `type` argument is passed directly to the [type-is](https://www.npmjs.org/package/type-is#readme) library. This can be an extension name (like `urlencoded`), a mime type (like `application/x-www-form-urlencoded`), or a mime time with a wildcard (like `*/x-www-form-urlencoded`).

The `verify` argument, if supplied, is called as `verify(req, res, buf, encoding)`, where `buf` is a `Buffer` of the raw request body and `encoding` is the encoding of the request. The parsing can be aborted by throwing an error.

### req.body

A new `body` object containing the parsed data is populated on the `request` object after the middleware.

## License

The MIT License (MIT)

Copyright (c) 2014 Jonathan Ong me@jongleberry.com

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
