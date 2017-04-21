var lib = (function() {

  function appendVersion(names, str) {
    if (!str.match(/^@[A-Z0-9\-\.]+$/gi)) {
      throw new Error(names.join('.') + ' invalid version: ' + str);
    }
    return names.concat(str);
  }

  function appendPath(names, str) {
    if (!str.match(/^[A-Z0-9\-]+$/gi)) {
      if (str.indexOf('@') !== -1) {
        throw new Error(names.join('.') + ' invalid name: ' + str + ', please specify versions and environments with [@version]');
      }
      throw new Error(names.join('.') + ' invalid name: ' + str);
    }
    return names.concat(str);
  }

  function appendLibPath(names, str) {

    names = names ? names.slice() : [];
    var defaultVersion = '@release';

    if (names.length === 0 && str === '') {

      return names.concat(str);

    } else if (names.length === 0 && str.indexOf('.') !== -1) {

      var versionMatch = str.match(/^[^\.]+?\.[^\.]*?(\[@[^\[\]]*?\])(\.|$)/);
      var arr;

      if (versionMatch) {
        version = versionMatch[1];
        version = version.replace(/^\[?(.*?)\]?$/, '$1');
        str = str.replace(versionMatch[1], '');
        arr = str.split('.');
        arr = arr.slice(0, 2).concat(version, arr.slice(2));
      } else {
        arr = str === '.' ? [''] : str.split('.');
      }

      while (arr.length && (names = appendLibPath(names, arr.shift())));
      return names;

    } else if (names.length === 2 && names[0] !== '') {

      return str[0] === '@' ?
        appendVersion(names, str) :
        appendPath(appendVersion(names, defaultVersion), str);

    } else {

      return appendPath(names, str);

    }

  }

  function parseParameters(args) {

    var kwargs = {};
    var body;
    var content;
    var callback = typeof args[args.length - 1] === 'function' ? args.pop() : function() {};

    if ((args.length === 1 || args.length === 2) && args[0] instanceof Blob) {
      body = args.shift();
      kwargs = args.shift();
      kwargs = typeof kwargs === 'object' && kwargs !== null ? kwargs : {};
    } else {
      kwargs = typeof args[args.length - 1] === 'object' && args[args.length - 1] !== null ? args.pop() : {};
      body = {args: args, kwargs: kwargs};
    }

    args.forEach(function(arg) {
      if (
        arg !== null &&
        typeof arg !== 'boolean' &&
        typeof arg !== 'string' &&
        typeof arg !== 'number'
      ) {
        var err = new TypeError(names.join('.') + ': All arguments must be Boolean, Number, String or null');
        var stack = err.stack.split('\n');
        stack = stack.slice(0, 1).concat(stack.slice(5));
        stack[1] = stack[1].replace('Object.<anonymous>', names.join('.'));
        err.stack = stack.join('\n');
        throw err;
      }
    });

    return {
      args: args,
      kwargs: kwargs,
      body: body,
      callback: callback
    };

  };

  var HOST = 'f.stdlib.com';
  var PORT = 443;
  var PATH = '/';

  function execute(cfg, names, args, kwargs, body, callback) {

    cfg = cfg || {};
    cfg.host = cfg.host || HOST;
    cfg.port = cfg.port || PORT;
    cfg.path = cfg.path || PATH;

    var pathname = names.slice(0, 2).join('/') + names.slice(2).join('/') + '/';
    var headers = {};

    if (body instanceof Blob) {
      headers['Content-Type'] = 'application/octet-stream';
      pathname += '?' + Object.keys(kwargs)
        .map(function(key) { return encodeURI(key) + '=' + encodeURI(kwargs[key]); })
        .join('&');
    } else {
      headers['Content-Type'] = 'application/json';
      body = new Blob([JSON.stringify(body)]);
    }

    var xhr = new XMLHttpRequest();
    xhr.open(
      'POST',
      '//' + cfg.host +
      (cfg.port ? ':' + cfg.port : '') +
      cfg.path + pathname
    );
    xhr.responseType = 'blob';
    Object.keys(headers).forEach(function(h) { xhr.setRequestHeader(h, headers[h]); });
    xhr.addEventListener('readystatechange', function() {

      if (xhr.readyState === 0) {
        return callback(new Error('Request aborted.'));
      }

      if (xhr.readyState === 4) {

        if (xhr.status === 0) {
          return callback(new Error('Could not run function.'));
        }

        var response = xhr.response;
        var contentType = response.type;
        var resheaders = xhr.getAllResponseHeaders();

        if (
          contentType === 'application/json' ||
          contentType.match(/^text\/.*$/i) ||
          ((xhr.status / 100) | 0) !== 2
        ) {
          var reader = new FileReader();
          reader.addEventListener('loadend', function() {
            var result = reader.result;
            if (((xhr.status / 100) | 0) !== 2) {
              return callback(new Error(result));
            } else if (contentType === 'application/json') {
              try {
                result = JSON.parse(reader.result);
              } catch(e) {
                return callback(new Error('Invalid Response JSON'));
              }
            }
            return callback(null, result, resheaders);
          });
          reader.readAsText(response);
        } else {
          return callback(null, response, resheaders);
        }

      }

    });

    xhr.send(body);

  };

  var LibGen = function(cfg, names) {
    cfg = cfg || {};
    names = names || [];
    return new Proxy(
      function __call__() {

        var args = [].slice.call(arguments);
        var p = parseParameters(args);
        execute(cfg, names, p.args, p.kwargs, p.body, p.callback);

      },
      {
        get: function(target, name) { return LibGen(cfg, appendLibPath(names, name)); }
      }
    );
  };

  return LibGen();

})();
