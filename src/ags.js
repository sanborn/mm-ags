MM.merge = function (base, ext) {
  for (var prop in ext) {
    base[prop] = ext[prop];
  }
};

AGS = {};

AGS.Security = function (url, options, callback) {
  this.token = {};
  this.url = url;
  this.options = options || {};
  this.callback = callback;

  if (typeof this.options.username !== 'undefined' && typeof this.options.password !== 'undefined') {
    this.fetchToken(this.options.username, this.options.password);
  } else {
    this.getUserInfo();
  }
};

AGS.Security.prototype = {
  getUserInfo: function(msg) {
    var _t = this;
    var container = document.createElement('div');
    container.className += 'esri_user_info';
    container.id = 'esri_user_info';
    document.body.appendChild(container);
    var form = document.createElement('form');
    container.appendChild(form);
    var login = document.createElement('input');
    login.id = 'esri_username';
    login.type = 'text';
    if (typeof this.options.username !== 'undefined') {
      login.value = this.options.username;
    }
    form.appendChild(login);
    var pass = document.createElement('input');
    pass.id = 'esri_password';
    pass.type = 'password';
    form.appendChild(pass);
    var submit = document.createElement('input');
    submit.id = 'submit';
    submit.type = 'submit';
    form.appendChild(submit);
    var width = window.innerWidth || document.documentElement.clientWidth;
    var height = window.innerHeight || document.documentElement.clientHeight;
    container.style.left = (width / 2) - (container.offsetWidth / 2) + 'px';
    container.style.top = (height / 2) - (container.offsetHeight / 2) + 'px';
    container.style.visibility = 'visible';
    var bg;
    if ('getComputedStyle' in window) {
      bg = window.getComputedStyle(container, null).backgroundColor;
    } else {
      bg = container.currentStyle['backgroundColor'];
    }
    if (bg == 'transparent' || bg == 'rgba(0, 0, 0, 0)'){
      container.style.background = '#aaaaaa';
    }

    if ('addEventListener' in form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();

        var username = document.getElementById('esri_username').value,
            password = document.getElementById('esri_password').value;

        container.style.display = 'none';
        document.body.removeChild(container);

        _t.fetchToken(username, password);
      }, false);
    } else {
      form.attachEvent('onSubmit', function(e) {
        e.preventDefault();

        var username = document.getElementById('esri_username').value,
            password = document.getElementById('esri_password').value;

        container.style.display = 'none';
        document.body.removeChild(container);

        _t.fetchToken(username, password);
      });
    }
  },

  fetchToken: function(username, password) {
    var _t = this;
    this.options.username = username;

    var url = this.url + '/tokens',
        params = 'request=getToken&username=' + username + '&password=' + password + '&expiration=60';

    var getJsonP = function(url, params) {
      window.setToken = function(obj) { // this is messy
        var token;

        if (typeof obj === 'object' && obj.token) {
          token = obj.token;
        } else if (typeof obj === 'string') {
          token = obj;
        }

        var d = new Date();

        _t.token = {
          value: token,
          expiration: +(d.setMinutes(d.getMinutes() + 59))
        };

        document.body.removeChild(document.getElementById('tokenJsonP'));

        delete window.setToken;

        if (typeof _t.callback !== 'undefined') {
          _t.callback();
        }
      };

      var params = '?' + params + '&f=pjson&callback=setToken';

      // &clientid=ip.10.20.13.61

      var script = document.createElement('script');
      script.id = 'tokenJsonP';
      script.src = url + params;
      document.body.appendChild(script);
      
      setTimeout(function() {
        if (typeof _t.token.value === 'undefined') {
          _t.getUserInfo('failed login'); // assume incorrect username / password combo
        }
      }, 5000);
    };

    var setToken = function(obj) {
      var token;

      if (typeof obj === 'object' && obj.token) {
        token = obj.token;
      } else if (typeof obj === 'string') {
        token = obj;
      }
        
      var d = new Date();

      _t.token = {
        value: token,
        expiration: +(d.setMinutes(d.getMinutes() + 59))
      };

      console.log(_t.token);

      var elem = document.getElementById('tokenJsonP');

      if (elem) {
        document.body.removeChild(elem);
      }

      if (typeof _t.callback !== 'undefined') {
        _t.callback();
      }
    };

    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        if (xhr.status == 400 || xhr.status == 0) {
          xhr.abort();
          getJsonP(url, params);
        } else if (xhr.status == 200 || xhr.status == 304) {
          setToken(xhr.responseText);
        } else if (xhr.status == 403) {
          xhr.abort();
          _t.getUserInfo('failed login');
        }
      }
    }

    var formData;

    if ('FormData' in window) {
      formData = new FormData();
      params = params.split('&');
      for (var i = 0; i < params.length; i++) {
        var keyValue = params[i].split('=');
        formData.append(keyValue[0], keyValue[1]);
      }
    } else {
      formData = params;
    }

    if ('XDomainRequest' in window) {
      var xdr = new XDomainRequest();
      xdr.onerror = function() {
        xdr.abort();
        getJsonP(url, params);
      };
      xdr.onload = function() {
        setToken(xdr.responseText);
      };
      xdr.open('POST', url, true);
      xdr.send(formData);
    } else {
      xhr.open('POST', url, true);
      
      if (typeof formData === 'string') {
        xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
      }
      
      xhr.send(formData);
    }
  }
};

AGS.Layer = {};

AGS.Layer.Tiled = function (template) {
  return new MM.Layer(new MM.TemplatedMapProvider(template));
};

AGS.Layer.Tiled.prototype = {};

AGS.Layer.Dynamic = function (url, options) {
  this.url = url;
  var options = options || {};
  MM.merge(this.options, options);

  this.parseLayers();
  this.parseLayerDefs();

  this.getTileUrl = function (coordinate) {
    var _t = this;
    var coord = this.sourceCoordinate(coordinate);
    if(!coord) return null;
    var base = _t.url;

    var nwPoint = coord,
        sePoint = coord.down().right(),
        nwLoc = map.coordinateLocation(nwPoint),
        seLoc = map.coordinateLocation(sePoint),
        bbox = [nwLoc.lon, seLoc.lat, seLoc.lon, nwLoc.lat].join(',');

    var params = [];

    for(var key in _t.options) {
      if (key !== 'token') {
        var value = _t.options[key];
        params.push(key + '=' + value);
      }
    }

    base = base + '/export?' + params.join('&') + '&bbox=' + bbox + '&bboxSR=4326&size=256,256';

    if(_t.options.token) {
      base = base + '&token=' + _t.options.token;
    }

    return base;
  };

  MM.MapProvider.call(this, this.getTileUrl);
};

AGS.Layer.Dynamic.prototype = {
  options: {
    format: 'png8',
    transparent: true,
    nocache: false,
    f: 'image'
  },

  parseLayers: function () {
    if (typeof this.options.layers === 'undefined') {
      delete this.options.layerOption;
      return;
    }

    var layers = this.options.layers,
        action = this.options.layerOption || null,
        verb = 'show',
        verbs = ['show', 'hide', 'include', 'exclude'];

    if (!action) {
      if (layers instanceof Array) {
        this.options.layers = verb + ':' + layers.join(',');
      } else if (typeof layers === 'string') {
        var match = layers.match(':');

        if (match) {
          layers = layers.split(match[0]);
          if (Number(layers[1].split(',')[0])) {
            if (verbs.indexOf(layers[0]) != -1) {
              verb = layers[0];
            }
            layers = layers[1];
          }
        }
        this.options.layers = verb + ':' + layers;
      }
    } else {
      if (verbs.indexOf(action) != -1) {
        verb = action;
      }
      this.options.layers = verb + ':' + layers;
    }
  },

  parseLayerDefs: function () {
    if (typeof this.options.layerDefs === 'undefined') return;
    var layerDefs = this.options.layerDefs;

    var defs = [];

    if (layerDefs instanceof Array) {
      var len = layerDefs.length;
      for (var i = 0; i < len; i++) {
        if (layerDefs[i]) {
          defs.push(i + ':' + layerDefs[i]);
        }
      }
    } else if (typeof layerDefs === 'object') {
      for (var layer in layerDefs) {
        defs.push(layer + ':' + layerDefs[layer]);
      }
    } else {
      delete this._layerParams.layerDefs;
      return;
    }
    this.options.layers = defs.join(';');
  },

  getTile: function(coord) {
    return this.getTileUrl(coord);
  } 
};

MM.extend(AGS.Layer.Dynamic, MM.MapProvider);

AGS.DynamicLayer = function(url, options) {
  return new MM.Layer(new AGS.Layer.Dynamic(url, options));
};