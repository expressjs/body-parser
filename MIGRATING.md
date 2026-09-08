# Migrating from body-parser v1 to v2

This guide covers the breaking changes introduced in `body-parser` v2.0.0 and
how to update your application accordingly.

## Table of Contents

- [Node.js version requirement](#nodejs-version-requirement)
- [req.body is no longer initialized to {}](#reqbody-is-no-longer-initialized-to-)
- [bodyParser() combination middleware removed](#bodyparsercombination-middleware-removed)
- [urlencoded parser: extended now defaults to false](#urlencoded-parser-extended-now-defaults-to-false)
- [urlencoded simple parser now uses qs instead of querystring](#urlencoded-simple-parser-now-uses-qs-instead-of-querystring)
- [New features in v2](#new-features-in-v2)

---

## Node.js version requirement

**v1:** Supported Node.js 0.8 and above.

**v2:** Requires Node.js **18 or higher**.

If you are running an older version of Node.js, upgrade before migrating to v2.

---

## req.body is no longer initialized to {}

This is the most common breaking change that will affect existing applications.

**v1 behavior:** `req.body` was always initialized to an empty object `{}`,
even when no body was present in the request.

**v2 behavior:** `req.body` is `undefined` unless a body is actually parsed.

### Before (v1)

```js
app.use(bodyParser.json());

app.post('/login', (req, res) => {
  // In v1, req.body was always {}, so this was safe
  if (req.body.username) {
    // handle login
  }
});
```

### After (v2)

```js
app.use(bodyParser.json());

app.post('/login', (req, res) => {
  // In v2, req.body may be undefined - use optional chaining
  if (req.body?.username) {
    // handle login
  }
});
```

Alternatively, provide a fallback:

```js
const body = req.body ?? {};
if (body.username) {
  // handle login
}
```

---

## bodyParser() combination middleware removed

**v1:** A deprecated `bodyParser()` shorthand was available that applied both
json and urlencoded middleware at once.

**v2:** This combination middleware has been **removed**. You must use the
individual parsers explicitly.

### Before (v1)

```js
const bodyParser = require('body-parser');

// Deprecated in v1, removed in v2
app.use(bodyParser());
```

### After (v2)

```js
const bodyParser = require('body-parser');

// Use individual parsers explicitly
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
```

---

## urlencoded parser: extended now defaults to false

**v1:** The `extended` option in the `urlencoded` parser defaulted to `true`,
which used the `qs` module for richer parsing (nested objects, arrays).

**v2:** The `extended` option now defaults to **`false`**, using the simpler
`querystring` module.

### If you relied on extended parsing

Explicitly set `extended: true` to preserve the v1 behavior:

```js
// Before (implicit in v1)
app.use(bodyParser.urlencoded());

// After (explicit in v2 to keep same behavior)
app.use(bodyParser.urlencoded({ extended: true }));
```

### If simple parsing is sufficient

```js
// This is now the default in v2
app.use(bodyParser.urlencoded({ extended: false }));
```

---

## urlencoded simple parser now uses qs instead of querystring

**v2:** Even when `extended: false`, the urlencoded parser now uses the `qs`
module instead of Node.js's built-in `querystring` module. This may produce
slightly different results for edge cases in query string parsing.

If you depend on exact `querystring` module behavior, test your application
after upgrading to verify query parsing results are as expected.

---

## New features in v2

Along with the breaking changes, v2 also introduces several improvements:

- **Brotli support**: The parsers now support brotli-compressed request bodies
  automatically alongside gzip and deflate.

  ```js
  // Brotli decompression is now handled automatically
  app.use(bodyParser.json());
  ```

- **urlencoded depth option**: You can now configure the parsing depth for
  nested objects in urlencoded bodies (defaults to `32`).

  ```js
  app.use(bodyParser.urlencoded({ extended: true, depth: 5 }));
  ```

- **Subpath exports**: Individual parsers can now be imported directly.

  ```js
  // Import only the json parser
  const { json } = require('body-parser/json');
  ```

---

## Summary of changes

| Change | v1 | v2 |
|---|---|---|
| Minimum Node.js | 0.8 | 18 |
| `req.body` default | `{}` | `undefined` |
| `bodyParser()` shorthand | Deprecated | Removed |
| `urlencoded` `extended` default | `true` | `false` |
| Brotli support | No | Yes |
| `depth` option for urlencoded | No | Yes (default: 32) |
