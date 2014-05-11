# body-parser [![Build Status](https://travis-ci.org/expressjs/body-parser.svg?branch=master)](https://travis-ci.org/expressjs/body-parser) [![NPM version](https://badge.fury.io/js/body-parser.svg)](https://badge.fury.io/js/body-parser)

Node.js body parsing middleware.

This only handles `urlencoded` and `json` bodies.
For multipart bodies, you may be interested in the following modules:

- [busboy](https://github.com/mscdex/busboy) and [connect-busboy](https://github.com/mscdex/connect-busboy)
- [multiparty](https://github.com/andrewrk/node-multiparty) and [connect-multiparty](https://github.com/andrewrk/connect-multiparty)
- [formidable](https://github.com/felixge/node-formidable)
- [multer](https://github.com/expressjs/multer)

Other body parsers you might be interested in:

- [body](https://github.com/raynos/body)
- [co-body](https://github.com/visionmedia/co-body)

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

The `type` argument is passed directly to the [type-is](https://github.com/expressjs/type-is) library. This can be an extension name (like `json`), a mime type (like `application/json`), or a mime time with a wildcard (like `*/json`).

The `reviver` argument is passed directly to `JSON.parse` as the second argument. You can find more information on this argument [in the MDN documentation about JSON.parse](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#Example.3A_Using_the_reviver_parameter).

### bodyParser.urlencoded(options)

Returns middleware that only parses `urlencoded` with the [qs](https://github.com/visionmedia/node-querystring) module. The options are:

- `limit` - maximum request body size. (default: `<100kb>`)
- `type` - request content-type to parse (default: `urlencoded`)

The `type` argument is passed directly to the [type-is](https://github.com/expressjs/type-is) library. This can be an extension name (like `urlencoded`), a mime type (like `application/x-www-form-urlencoded`), or a mime time with a wildcard (like `*/x-www-form-urlencoded`).

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
