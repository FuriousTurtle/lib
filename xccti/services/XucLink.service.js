export default function XucLink($rootScope, $q, $log, $window, $http, $filter) {
  var _hostAndPort = "";
  var _homeUrl = "/";
  var _redirectToHomeUrl = false;
  var _user = {};
  var _logged = false;
  var _token = null;
  var _logonDeferred = $q.defer();
  var _linkClosedDeferred = $q.defer();
  var _profileNameDeferred = $q.defer();
  var _timeout = 5000;

  var _isJson = function (value) {
    try
    {
      if (typeof value === 'object')
      {
        JSON.parse(JSON.stringify(value));
      }
      else
      {
        JSON.parse(value);
      }
      return true;
    }
    catch (e)
    {
      return false;
    }
  };

  var _parseXHRError = function(response) {
    if(_isJson(response.data) && response.data) {
      return response.data;
    } else {
      return {error: 'NoResponse', message:'No response from server'};
    }
  };

  var _parseUrlParameters = function (search) {
    return (search).replace(/(^\?)/,'').split("&").reduce((p,n) => {
      return n = n.split("="), p[n[0]] = n[1], p;
    }, {});
  };

  var _loggedOnHandler = function() {
    _logged = true;
    _logonDeferred.resolve(_user);
    $rootScope.$broadcast('ctiLoggedOn', _user);
  };

  var _onRightProfile = function(event) {
    _profileNameDeferred.resolve(event.profile);
  };

  var _whenLogged = function() { return _logonDeferred.promise;};
  var _whenLoggedOut = function() { return _linkClosedDeferred.promise;};

  var _linkStatusHandler = function(event) {
    $log.info("link status : " + event.status);
    if (event.status !== 'opened') {
      if(_logged) {
        _logged = false;
        _logonDeferred = $q.defer();
      }
      _linkClosedDeferred.resolve();
      _linkClosedDeferred = $q.defer();
      _profileNameDeferred = $q.defer();
      $rootScope.$broadcast('linkDisConnected');
      if(_redirectToHomeUrl) {
        $window.location.replace(_homeUrl+"?error='unable to connect to xuc server'");
      }
    }
  };

  var _setHostAndPort = function(hostAndPort) {
    _hostAndPort = hostAndPort;
  };
  var _setHomeUrl = function(homeUrl) {
    _homeUrl = homeUrl;
  };
  var _setRedirectToHomeUrl = function(value) {
    _redirectToHomeUrl = value;
  };
  var _getServerUrl = function(protocol) {
    return $filter('prepareServerUrl')($window.location.protocol, _hostAndPort, protocol);
  };

  var _getStoredCredentials = function() {
    if(typeof(Storage) !== "undefined" && angular.isString(localStorage.getItem("credentials"))) {
      try {
        return JSON.parse(localStorage.getItem("credentials"));
      } catch(e) {
        $log.error("Unable to parse stored credentials");
        return null;
      }
    } else {
      return null;
    }
  };

  var _storeCredentials = function(credentials) {
    $log.debug("storeCredentials");
    if(typeof(Storage) !== "undefined") {
      localStorage.setItem("credentials",JSON.stringify(credentials));
    }
  };

  var _clearCredentials = function() {
    if(typeof(Storage) !== "undefined") {
      localStorage.removeItem("credentials");
    }
  };

  var _checkCredentials = function(credentials) {
    $log.debug('checkStoredCredentials, xucserver host and port: ', _hostAndPort);

    return $http.get(_getServerUrl('http') + "/xuc/api/2.0/auth/check", {headers: { 'Authorization': 'Bearer ' + credentials.token }, timeout:_timeout})
      .then(function(response) {
        return response.data;
      }, function(response) {
        var data = _parseXHRError(response);
        $log.warn("Error while checking credentials: " + data);
        if(data.error !== "NoResponse") {
          _cleanupLocalStorage();
        }
        return $q.reject(data);
      });
  };

  var _getSsoCredentials = function() {
    $log.debug("getSsoCredentials");
    return $http.get(_getServerUrl('http') + "/xuc/api/2.0/auth/sso", {withCredentials: true, timeout:_timeout})
      .then(function(response) {
        return response.data;
      }, function(response) {
        var data = _parseXHRError(response);
        $log.warn("Error during SSO authentication: " + JSON.stringify(data));
        return $q.reject(data);
      });
  };

  var _getCasCredentials = function(casServerUrl, serviceParameter) {
    var ticket = _parseUrlParameters($window.location.search).ticket;
    var service = escape($window.location.href.match(/(^[^#?]*)/)[0] + (serviceParameter?serviceParameter:''));
    var loginUrl = casServerUrl + "/login?service=" + service;

    if(angular.isDefined(ticket)) {
      var parameters = "service=" + service + "&ticket=" + ticket;
      return $http.get(_getServerUrl('http') + "/xuc/api/2.0/auth/cas?" + parameters, {timeout:_timeout})
       .then(function(response) {
         return response.data;
       }, function(response) {
         var data = _parseXHRError(response);
         $log.warn("Error during CAS authentication: " + JSON.stringify(data));
         if(data.error === "CasServerInvalidTicket") {
           $window.location.href = loginUrl;
         }
         return $q.reject(data);
       });
    } else {
      $window.location.href = loginUrl;
      return $q.reject();
    }
  };

  var _loginWithStoredCredentials = function() {
    $log.debug("loginWithStoredCredentials");
    var credentials = _getStoredCredentials();
    if(credentials !== null) {
      return _checkCredentials(credentials).then(function(newCredentials) {
        credentials.token = newCredentials.token;
        _storeCredentials(credentials);
        return _loginWithCredentials(credentials);
      });
    } else {
      return $q.reject("NoStoredCredentials");
    }
  };

  var _loginWithCredentials = function(credentials) {
    $log.debug("loginWithCredentials");
    _user.username = credentials.login;
    _user.phoneNumber = credentials.phoneNumber;
    _user.token = credentials.token;
    var wsurl = _getServerUrl('ws') + "/xuc/api/2.0/cti?token=" + credentials.token;
    return Cti.WebSocket.init(wsurl, credentials.login, credentials.phoneNumber);
  };

  var _loginWithSso = function(ssoCredentials, phoneNumber, persistCredentials) {
    $log.debug("loginWithSso");
    return _checkCredentials(ssoCredentials).then(function(newCredentials) {
      newCredentials.phoneNumber = phoneNumber;
      if(persistCredentials) _storeCredentials(newCredentials);
      return _loginWithCredentials(newCredentials);
    });
  };
  
  var _login = function(username, password, phoneNumber, persistCredentials) {
    $log.debug("login");
    return $http.post(_getServerUrl('http') + "/xuc/api/2.0/auth/login", {"login": username, "password": password}, {timeout:_timeout})
      .then(function(response) {
        var data = response.data;
        data.phoneNumber = phoneNumber;
        if(persistCredentials) _storeCredentials(data);
        else _clearCredentials();
        return _loginWithCredentials(data);
      }, function(response) {
        var data = _parseXHRError(response);
        $log.warn("Error while logging in: " + JSON.stringify(data));
        return $q.reject(data);
      });
  };
  
  var _initCti = function(username, password, phoneNumber) {
    _user.username = username;
    _user.password = password;
    _user.phoneNumber = phoneNumber;
    var wsurl = '';
    if(_token)
      wsurl = _getServerUrl('ws') + "/xuc/ctichannel/tokenAuthentication?token=" + _token;
    else
      wsurl = _getServerUrl('ws') + "/xuc/ctichannel?username=" + username + "&amp;agentNumber=" +
      phoneNumber + "&amp;password=" + encodeURIComponent(password);

    if(typeof(Storage) !== "undefined" && angular.isString(phoneNumber) && phoneNumber.length > 0 && phoneNumber !== "0") {
      localStorage.agentNumber = phoneNumber;
    }

    Cti.WebSocket.init(wsurl, username, phoneNumber);
  };

  var _cleanupLocalStorage = function() {
    $log.info("cleanupLocalStorage");
    if(typeof(Storage) !== "undefined") {
      localStorage.removeItem("xucToken");
      localStorage.removeItem("agentNumber");
      localStorage.removeItem("credentials");
      _token = null;
    }
  };

  var _logout = function() {
    Cti.close();
    $rootScope.$broadcast("ctiLoggedOut", _user);
    if (_redirectToHomeUrl) {
      $log.info("redirecting to ",_homeUrl);
      $window.location.replace(_homeUrl);
    }
  };

  var _isLogged = function() {
    return _logged;
  };

  var _getPhoneNumber = function() { return _user.phoneNumber; };

  var _getProfileNameAsync = function() { return _profileNameDeferred.promise; };

  Cti.setHandler(Cti.MessageType.LOGGEDON, _loggedOnHandler);
  Cti.setHandler(Cti.MessageType.LINKSTATUSUPDATE, _linkStatusHandler);
  Cti.setHandler(Cti.MessageType.RIGHTPROFILE, _onRightProfile);

  return {
    login: _login,
    loginWithCredentials: _loginWithCredentials,
    loginWithStoredCredentials: _loginWithStoredCredentials,
    getStoredCredentials: _getStoredCredentials,
    loginWithSso: _loginWithSso,
    getSsoCredentials: _getSsoCredentials,
    getCasCredentials: _getCasCredentials,
    getServerUrl: _getServerUrl,
    setHostAndPort : _setHostAndPort,
    setHomeUrl : _setHomeUrl,
    setRedirectToHomeUrl: _setRedirectToHomeUrl,
    initCti : _initCti,
    logout : _logout,
    isLogged : _isLogged,
    whenLogged: _whenLogged,
    whenLoggedOut: _whenLoggedOut,
    getProfileNameAsync: _getProfileNameAsync,
    getPhoneNumber: _getPhoneNumber,
    parseUrlParameters: _parseUrlParameters
  };
}
