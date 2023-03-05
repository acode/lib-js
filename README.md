# Autocode standard library JavaScript (web) bindings

Basic JavaScript (web) bindings for the Autocode standard library.

Used to interface with services built using [Autocode](https://autocode.com) and
the [Autocode CLI](https://github.com/acode/lib).

You can utilize any service on Autocode without installing any additional
dependencies, and when you've deployed services to the Autocode standard library,
you have a pre-built web-based SDK &mdash; for example;

```javascript
lib.yourUsername.hostStatus({name: 'Dolores Abernathy'}, (err, result) => {

  // handle result

});
```

To discover Autocode APIs, visit https://autocode.com/lib. To build a service,
get started with [the Autocode CLI tools](https://github.com/acode/lib).

## Installation

Simply save the `lib.js` file from this package anywhere in your web project,
and link it in the `<head>` element of an HTML file before any `<script>`s that
require it.

```html
<script src="path/to/lib.js"></script>
```

## Usage

Here are some fictional calling examples for a user named `user` with a
"hello world" service, `helloWorld`, that takes one parameter (named `name`)
and is released to both a `dev` and `release` environment (with version `0.1.1`).

```javascript
// Unnamed Parameters
lib.user.helloWorld('world', (err, result) => {});

// Named Parameters
lib.user.helloWorld({name: 'world'}, (err, result) => {});

// Environment Specified
lib.user.helloWorld['@dev']('world', (err, result) => {});

// Release Version (SemVer) Specified
lib.user.helloWorld['@0.1.1']('world', (err, result) => {});

// Promise
lib.user.helloWorld('world')
  .catch(err => {})
  .then(result => {});

// Async
let hello = await lib.user.helloWorld('world');

// For HTTP header information, use callback-style
lib.user.helloWorld('hello', (err, result, headers) => {});
```

## Additional Information

To learn more about Autocode, visit [autocode.com](https://autocode.com) or read the
[Autocode CLI documentation on GitHub](https://github.com/acode/lib).

You can follow the development team on Twitter, [@AutocodeHQ](https://twitter.com/AutocodeHQ)

Autocode is &copy; 2016 - 2023 Polybit Inc.
