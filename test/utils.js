'use strict'

const assert = require('node:assert')
const { normalizeOptions } = require('../lib/utils.js')

describe('normalizeOptions(options, defaultType)', () => {
  it('should return default options when no options are provided', () => {
    for (const options of [undefined, null, {}]) {
      const result = normalizeOptions(options, 'application/json')
      assert.strictEqual(result.inflate, true)
      assert.strictEqual(result.limit, 100 * 1024) // 100kb in bytes
      assert.strictEqual(result.verify, false)
      assert.strictEqual(typeof result.shouldParse, 'function')
    }
  })

  it('should override default options with provided options', () => {
    const options = {
      inflate: false,
      limit: '200kb',
      type: 'application/xml',
      verify: () => {}
    }
    const result = normalizeOptions(options, 'application/json')
    assert.strictEqual(result.inflate, false)
    assert.strictEqual(result.limit, 200 * 1024) // 200kb in bytes
    assert.strictEqual(result.verify, options.verify)
    assert.strictEqual(typeof result.shouldParse, 'function')
  })

  it('should remove additional options', () => {
    const options = {
      inflate: false,
      limit: '200kb',
      type: 'application/xml',
      verify: () => {},
      additional: 'option',
      something: 'weird'
    }
    const result = normalizeOptions(options, 'application/json')
    assert.strictEqual(result.inflate, false)
    assert.strictEqual(result.limit, 200 * 1024) // 200kb in bytes
    assert.strictEqual(result.verify, options.verify)
    assert.strictEqual(typeof result.shouldParse, 'function')
    assert.strictEqual(result.additional, undefined)
    assert.strictEqual(result.something, undefined)
  })

  describe('options', () => {
    describe('verify', () => {
      it('should throw an error if verify is not a function', () => {
        assert.throws(() => {
          normalizeOptions({ verify: 'not a function' }, 'application/json')
        }, /option verify must be function/)
      })

      it('should accept a verify function', () => {
        const verify = () => {}
        const result = normalizeOptions({ verify }, 'application/json')
        assert.strictEqual(result.verify, verify)
      })
    })

    describe('limit', () => {
      it('should return the default limit if limit is not provided', () => {
        const result = normalizeOptions({}, 'application/json')
        assert.strictEqual(result.limit, 100 * 1024) // 100kb in bytes
      })

      it('should accept a number limit', () => {
        const result = normalizeOptions({ limit: 1234 }, 'application/json')
        assert.strictEqual(result.limit, 1234)
      })

      it('should parse a string limit', () => {
        const result = normalizeOptions({ limit: '200kb' }, 'application/json')
        assert.strictEqual(result.limit, 200 * 1024) // 200kb in bytes
      })

      it('should return null for an invalid limit', () => {
        const result = normalizeOptions({ limit: 'invalid' }, 'application/json')
        assert.strictEqual(result.limit, null)
      })
    })

    describe('type', () => {
      it('should return the default type if type is not provided', () => {
        const result = normalizeOptions({}, 'application/json')
        assert.strictEqual(result.shouldParse({ headers: { 'content-type': 'application/json', 'content-length': '1024' } }), true)
        assert.strictEqual(result.shouldParse({ headers: { 'content-type': 'application/xml', 'content-length': '1024' } }), false)
      })

      it('should accept a string type', () => {
        const result = normalizeOptions({ type: 'application/xml' }, 'application/json')
        assert.strictEqual(result.shouldParse({ headers: { 'content-type': 'application/xml', 'content-length': '1024' } }), true)
        assert.strictEqual(result.shouldParse({ headers: { 'content-type': 'application/json', 'content-length': '1024' } }), false)
      })

      it('should accept an array of strings type', () => {
        const result = normalizeOptions({ type: ['application/xml', 'application/*+json'] }, 'application/json')
        assert.strictEqual(result.shouldParse({ headers: { 'content-type': 'application/xml', 'content-length': '1024' } }), true)
        assert.strictEqual(result.shouldParse({ headers: { 'content-type': 'application/ld+json', 'content-length': '1024' } }), true)
        assert.strictEqual(result.shouldParse({ headers: { 'content-type': 'application/json', 'content-length': '1024' } }), false)
      })

      it('should accept a type checking function', () => {
        const result = normalizeOptions({ type: () => true }, 'application/json')
        assert.strictEqual(result.shouldParse({ headers: { 'content-type': 'application/xml' } }), true)
        assert.strictEqual(result.shouldParse({ headers: { 'content-type': 'application/json' } }), true)
      })
    })
  })

  describe('defaultType', () => {
    it('should throw an error if defaultType is not provided', () => {
      assert.throws(() => {
        normalizeOptions({})
      }, /defaultType must be provided/)
      assert.throws(() => {
        normalizeOptions({}, undefined)
      }, /defaultType must be provided/)
    })

    it('should convert string defaultType to a request content-type checking function', () => {
      const result = normalizeOptions({}, 'application/json')
      assert.strictEqual(typeof result.shouldParse, 'function')
      assert.strictEqual(result.shouldParse({ headers: { 'content-type': 'application/json', 'content-length': '1024' } }), true)
      assert.strictEqual(result.shouldParse({ headers: { 'content-type': 'application/xml', 'content-length': '100' } }), false)
    })

    it('should convert array of strings defaultType to a request content-type checking function', () => {
      const result = normalizeOptions({}, ['application/json', 'application/*+json'])
      assert.strictEqual(typeof result.shouldParse, 'function')
      assert.strictEqual(result.shouldParse({ headers: { 'content-type': 'application/json', 'content-length': '1024' } }), true)
      assert.strictEqual(result.shouldParse({ headers: { 'content-type': 'application/ld+json', 'content-length': '1024' } }), true)
      assert.strictEqual(result.shouldParse({ headers: { 'content-type': 'application/xml', 'content-length': '100' } }), false)
    })

    it('should use function defaultType directly as the request content-type checker', () => {
      const typeFunction = (req) => req.headers['content-type'].endsWith('+json')
      const result = normalizeOptions({}, typeFunction)
      assert.strictEqual(result.shouldParse, typeFunction)
      assert.strictEqual(result.shouldParse({ headers: { 'content-type': 'application/ld+json' } }), true)
      assert.strictEqual(result.shouldParse({ headers: { 'content-type': 'application/xml' } }), false)
    })
  })
})
