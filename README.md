# body-parser [![Build Status](https://travis-ci.org/expressjs/body-parser.svg?branch=master)](https://travis-ci.org/expressjs/body-parser) [![NPM version](https://badge.fury.io/js/body-parser.svg)](https://badge.fury.io/js/body-parser)

Connect's body parsing middleware.  No longer supports enctype="multipart/form-data", for that purpose, please see: (https://github.com/expressjs/multer)

`npm install body-parser`

## API

```js
var express    = require('express')
var bodyParser = require('body-parser')

var app = express()

app.use(bodyParser())

app.use(function (req, res, next) {
  console.log(req.body) // populated!
  next()
})
```

### bodyParser(options)

Returns middleware that parses both `json` and `urlencoded`. The `options` are passed to both middleware.

Please see [multer](https://github.com/expressjs/multer) for `multipart/form-data` support.

### bodyParser.json(options)

Returns middleware that only parses `json`. The options are:

- `strict` - only parse objects and arrays. (default: `true`)
- `limit` - maximum request body size. (default: `<1mb>`)
- `reviver` - passed to `JSON.parse()`

### bodyParser.urlencoded(options)

Returns middleware that only parses `urlencoded` with the [qs](https://github.com/visionmedia/node-querystring) module. The options are:

- `limit` - maximum request body size. (default: `<1mb>`)

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
