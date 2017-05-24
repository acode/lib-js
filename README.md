# StdLib JavaScript (Web) Bindings

[StdLib Setup](https://github.com/stdlib/lib) |
[Node](https://github.com/stdlib/lib-node) |
[Python](https://github.com/stdlib/lib-python) |
[Ruby](https://github.com/stdlib/lib-ruby) |
**Web**

Basic JavaScript (Web) bindings for StdLib service accession.

Used to interface with services built using [StdLib](https://stdlib.com) and
the [StdLib Command Line Tools](https://github.com/stdlib/lib).
You can utilize any service on StdLib without installing any additional
dependencies, and when you've deployed services to StdLib, you have a pre-built
web-based SDK --- for example;

```javascript
lib.yourUsername.hostStatus({name: 'Dolores Abernathy'}, (err, result) => {

  // handle result

});
```

To discover StdLib services, visit https://stdlib.com/search. To build a service,
get started with [the StdLib CLI tools](https://github.com/stdlib/lib).

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

To learn more about StdLib, visit [stdlib.com](https://stdlib.com) or read the
[StdLib CLI documentation on GitHub](https://github.com/stdlib/lib).

You can follow the development team on Twitter, [@StdLibHQ](https://twitter.com/stdlibhq)

StdLib is &copy; 2016 - 2017 Polybit Inc.
