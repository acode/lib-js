window['lib'] = (function (window) {

  function base64ToByteArrays(b64data, sliceSize) {
    sliceSize = sliceSize || 512;
    var byteCharacters = window.atob(b64data);
    var byteArrays = [];
    for (var offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      var slice = byteCharacters.slice(offset, offset + sliceSize);
      var byteNumbers = new Array(slice.length);
      for (var i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      var byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return byteArrays;
  };

  function base64ToBlob (b64data, contentType, sliceSize) {
    var byteArrays = base64ToByteArrays(b64data, sliceSize);
    contentType = contentType || 'application/octet-stream';
    var blob = new Blob(byteArrays, {type: contentType});
    return blob;
  };

  function readListeners (obj) {
    var copyObj = typeof obj === 'object'
      ? Array.isArray(obj)
        ? {}
        : obj || {}
      : {};
    var listeners = {};
    Object.keys(copyObj).forEach(function (key) {
      if (typeof copyObj[key] === 'function') {
        listeners[key] = copyObj[key];
      } else {
        listeners[key] = (function () {});
      }
    });
    return listeners;
  };

  function SSEHandler (streamListeners, debugListeners, responseListener) {
    this.processing = '';
    this.streamListeners = readListeners(streamListeners);
    this.debugListeners = readListeners(debugListeners);
    this.responseListeners = readListeners({'@response': responseListener});
    this.events = {};
  }

  SSEHandler.prototype.process = function (text) {
    var entries = [];
    if (text) {
      this.processing = this.processing + text;
      entries = this.processing.split('\n\n');
      var lastEntry = entries.pop();
      this.processing = lastEntry;
    }
    entries
      .filter(entry => !!entry)
      .forEach(entry => {
        var id = null;
        var event = 'message';
        var time = new Date().toISOString();
        var data = '';
        var lines = entry.split('\n').map((line, i) => {
          var lineData = line.split(':');
          var type = lineData[0];
          var contents = lineData.slice(1).join(':');
          if (contents[0] === ' ') {
            contents = contents.slice(1);
          }
          if (type === 'event' && !data) {
            event = contents;
          } else if (type === 'data') {
            if (data) {
              data = data + '\n' + contents;
            } else {
              data = contents;
            }
          } else if (type === 'id') {
            id = contents;
            var date = new Date(id.split('/')[0]);
            if (date.toString() !== 'Invalid Date') {
              time = date.toISOString();
            }
          }
        });
        this.events[event] = this.events[event] || [];
        var name = event;
        var value = JSON.parse(data);
        var eventData = {
          id: id,
          event: name,
          data: value,
          time: time,
          index: this.events[event].length
        };
        this.events[event].push(eventData);
        if (this.streamListeners[event]) {
          this.streamListeners[event].call(
            null,
            name,
            value,
            eventData
          );
        }
        if (this.streamListeners['*'] && !event.startsWith('@')) {
          this.streamListeners['*'].call(
            null,
            name,
            value,
            eventData
          );
        }
        if (this.debugListeners[event]) {
          this.debugListeners[event].call(
            null,
            name,
            value,
            eventData
          );
        }
        if (this.debugListeners['*'] && event !== '@response') {
          this.debugListeners['*'].call(
            null,
            name,
            value,
            eventData
          );
        }
        if (this.responseListeners[event]) {
          this.responseListeners[event].call(
            null,
            name,
            value,
            eventData
          );
        }
      })
  };

  function responseHandler (statusCode, headers, response, callback) {
    var contentType = response.type;
    if (contentType === 'application/json') {
      var reader = new FileReader();
      reader.addEventListener('error', function() {
        return callback(new Error('Could not read response'), response, headers);
      });
      reader.addEventListener('load', function() {
        var response = reader.result;
        if (contentType === 'application/json') {
          try {
            response = JSON.parse(response);
          } catch(e) {
            return callback(new Error('Invalid Response JSON'));
          }
        }
        if (((statusCode / 100) | 0) !== 2) {
          var message = typeof response === 'object' ?
            (response && response.error && response.error.message) || 'Unspecified Error' :
            response;
          var error = new Error(message);
          if (response.error && typeof response.error === 'object') {
            Object.keys(response.error).forEach(function (key) {
              error[key] = response.error[key];
            });
          }
          return callback(error, response, headers);
        } else
        return callback(null, response, headers);
      });
      reader.readAsText(response);
    } else {
      return callback(null, response, headers);
    }
  }

  function formatBlobAsync(blob, callback) {
    return blob instanceof Blob ?
      (function (blob) {
        var reader = new FileReader();
        reader.addEventListener('error', function (err) {
          return callback(err);
        });
        reader.addEventListener('load', function() {
          return callback(null, {_base64: reader.result.split(',')[1]});
        });
        reader.readAsDataURL(blob);
      })(blob) :
      callback(null, blob);
  }

  function formatParamsObjectAsync(params, callback) {
    params = Object.keys(params || {}).reduce(function (obj, key) {
      obj[key] = params[key];
      return obj;
    }, {});
    var formattedParams = {};
    if (!Object.keys(params).length) {
      return callback(null, formattedParams);
    }
    var error = null;
    var complete = function (key) {
      return function(err, result) {
        if (error || !Object.keys(params).length) {
          return;
        }
        if (err) {
          error = err;
          return callback(err);
        }
        delete params[key];
        formattedParams[key] = result;
        return Object.keys(params).length || callback(null, formattedParams);
      };
    };
    Object.keys(params).forEach(function(key, i) { formatBlobAsync(params[key], complete(key)); });
  };

  function containsKeywords(params) {
    return typeof params[0] === 'object' &&
      !Array.isArray(params[0]) &&
      !(params[0] instanceof Blob);
  }

  function formatParams(params) {
    var src = params[0] || {};
    var dst = {};
    return Object.keys(params[0] || {}).reduce(function (dst, name) {
      dst[name] = src[name];
      return dst;
    }, dst);
  }

  function parseParameters(names, params) {

    var callback;

    if (typeof params[params.length - 1] === 'function') {
      callback = params.pop();
    }

    if (params.length > 1) {
      throw new Error('No more than one optional argument containing an object of key-value pairs expected.');
    } else if (params.length && !containsKeywords(params)) {
      throw new Error('Argument must be an object of key-value pairs that act as function parameters.');
    }

    return {
      params: formatParams(params),
      callback: callback
    };

  };

  function appendVersion(names, str) {
    return names.concat(str);
  }

  function appendPath(names, str) {
    if (!str.match(/^[A-Z0-9\-\_]+$/gi)) {
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
        var version = versionMatch[1];
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

  var HOST = 'api.stdlib.com';
  var PORT = 443;
  var PATH = '/';

  var LOCALENV = 'local';
  var LOCALPORT = window.STDLIB_LOCAL_PORT || 8170;

  function executeRemote(cfg, names, params, callback) {

    formatParamsObjectAsync(params, function (err, params) {

      if (err) {
        return callback(err, null, {});
      }

      cfg = cfg || {};
      cfg = Object.keys(cfg).reduce(function (ncfg, key) {
        ncfg[key] = cfg[key];
        return ncfg
      }, {});
      cfg.host = cfg.host || HOST;
      cfg.port = parseInt(cfg.port || PORT) || 80;
      cfg.path = cfg.path || PATH;
      cfg.debug = !!cfg.debug;

      cfg.token = cfg.token || null;
      cfg.keys = cfg.keys || null;
      cfg.convert = !!cfg.convert;

      var pathname;
      if ((names[2] || '').split(':')[0] === '@' + LOCALENV) {
        cfg.host = 'localhost';
        cfg.port = parseInt((names[2] || '').split(':')[1]) || LOCALPORT;
        names[2] = '';
        if (cfg.port !== LOCALPORT) {
          pathname = names.slice(3).join('/');
        } else {
          // It's a root server
          pathname = names.slice(0, 2).join('/') + names.slice(2).join('/');
        }
      } else {
        cfg.host = names.slice(0, 1).concat(cfg.host).join('.');
        pathname = names.slice(1, 2).join('/') + names.slice(2).join('/');
      }

      pathname = pathname + '/';
      if (params.hasOwnProperty('__path')) {
        if (params.__path.startsWith('/')) {
          params.__path = params.__path.slice(1);
        }
        pathname = pathname + params.__path;
        if (!pathname.endsWith('/')) {
          pathname = pathname + '/';
        }
        delete params.__path;
      }
      var headers = {};
      var body;

      if (params.hasOwnProperty('__headers')) {
        if (
          params.__headers &&
          typeof params.__headers === 'object' &&
          !Array.isArray(params.__headers) &&
          !Buffer.isBuffer(params.__headers)
        ) {
          Object.keys(params.__headers).forEach(key => {
            headers[key] = params.__headers[key];
          });
        } else {
          throw new Error(`Invalid headers provided: Must be an object`);
        }
        delete params.__headers;
      }

      if (params.hasOwnProperty('__providers')) {
        headers['X-Authorization-Providers'] = typeof params.__providers === 'string'
          ? params.__providers
          : JSON.stringify(params.__providers);
        delete params.__providers;
      }

      headers['Content-Type'] = 'application/json';
      headers['X-Faaslang'] = 'true';
      body = new Blob([JSON.stringify(params)]);

      cfg.token && (headers['Authorization'] = headers['Authorization'] || 'Bearer ' + cfg.token);
      cfg.keys && (headers['X-Authorization-Keys'] = JSON.stringify(cfg.keys));
      cfg.convert && (headers['X-Convert-Strings'] = 'true');
      cfg.bg && (pathname += ':bg' + (typeof cfg.bg === 'string' ? '=' + encodeURIComponent(cfg.bg) : ''));

      var xhr = new XMLHttpRequest();
      xhr.open(
        'POST',
        (cfg.port === 443 ? 'https' : 'http') +
        '://' + cfg.host +
        ((cfg.port === 80 || cfg.port === 443) ? '' : ':' + cfg.port) +
        cfg.path + pathname
      );
      var lastResponseText = '';
      var serverSentEvent = null;
      if (
        (params._stream || params._stream === '') ||
        (params._debug || params._debug === '')
      ) {
        serverSentEvent = new SSEHandler(
          params._stream,
          params._debug,
          function (name, value, eventData) {
            var headers = {};
            var body = null;
            Object.keys(value.headers).forEach(function (key) {
              headers[key.toLowerCase()] = value.headers[key];
            });
            if (headers['content-type'] !== 'application/json') {
              var json;
              try {
                json = JSON.parse(value.body);
                if (
                  Object.keys(json).length === 1 &&
                  json._base64
                ) {
                  body = base64ToBlob(json._base64, headers['content-type'])
                }
              } catch (e) {
                // do nothing
              }
            }
            if (!body) {
              body = new Blob([value.body], {type: headers['content-type']});
            }
            responseHandler(
              value.statusCode,
              headers,
              body,
              callback
            );
          }
        );
        xhr.responseType = 'text';
      } else {
        xhr.responseType = 'blob';
      }
      Object.keys(headers).forEach(function (header) {
        xhr.setRequestHeader(header, headers[header]);
      });
      xhr.addEventListener('readystatechange', function() {
        var resheaders = xhr.getAllResponseHeaders()
          .split('\r\n')
          .reduce(function (headers, line) {
            var key = line.split(':')[0];
            var value = line.split(':').slice(1).join(':').trim();
            headers[key] = value;
            return headers;
          }, {});
        if (xhr.readyState === 0) {
          return callback(new Error('Request aborted.'), null, {});
        } else if (
          resheaders['content-type'] === 'text/event-stream' &&
          serverSentEvent &&
          (
            xhr.readyState === 3 ||
            xhr.readyState === 4
          )
        ) {
          var text = xhr.responseText.slice(lastResponseText.length);
          lastResponseText = xhr.responseText;
          serverSentEvent.process(text);
        } else if (xhr.readyState === 4) {
          if (xhr.status === 0) {
            return callback(new Error('HTTP request returned status code 0. This usually means the request is being blocked.'), null, {});
          }
          var response;
          if (xhr.responseType === 'text') {
            response = new Blob(
              [xhr.responseText],
              {type: resheaders['content-type']}
            );
          } else {
            response = xhr.response;
          }
          responseHandler(xhr.status, resheaders, response, callback);
        }
      });

      xhr.send(body);

    });

  };


  var LibGen = function (rootCfg, cfg, names) {
    rootCfg = Object.assign(cfg || {}, rootCfg || {});
    names = names || [];
    var __call__ = function __call__ (s) {
      var args = [].slice.call(arguments);
      if (names.length === 0) {
        if (typeof args[0] === 'string') {
          return LibGen(rootCfg, {}, appendLibPath(names, args[0]));
        } else {
          return LibGen(rootCfg, (typeof args[0] === 'object' ? args[0] : null) || {}, names);
        }
      } else if (names.length === 1) {
        return LibGen(rootCfg, {keys: (typeof args[0] === 'object' ? args[0] : {})}, names);
      } else {
        var p = parseParameters(names, args);
        var execute = executeRemote.bind(null, cfg, names, p.params);
        if (p.callback) {
          return execute(p.callback);
        } else {
          return new Promise(function (resolve, reject) {
            return execute(function (err, result) {
              return err ? reject(err) : resolve(result);
            });
          });
        }
      }
    };
    var Proxy = window.Proxy;
    if (!Proxy) {
      return __call__;
    } else {
      return new Proxy(
        __call__,
        {
          get: function (target, name) {
            return LibGen(rootCfg, {}, appendLibPath(names, name));
          }
        }
      );
    }
  };

  return LibGen();

})(window);
