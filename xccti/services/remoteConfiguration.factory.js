(function() {
  'use strict';

  angular.module('xcCti').factory('remoteConfiguration', remoteConfiguration);

  remoteConfiguration.$inject = ["$http"];

  function remoteConfiguration($http) {
    var _get = function(name) {
      return $http.get("/config/" + name).then(function(resp) {
        return resp.data.value;
      });
    };

    var _getBoolean = function(name) {
      return _get(name).then(function(value) {
        return value === "true";
      });
    };

    var _getBooleanOrElse = function(name, defaultValue) {
      return _get(name).then(function(value) {
        return value === "true";
      }).catch(function() { return defaultValue;});
    };

    return {
      get : _get,
      getBoolean: _getBoolean,
      getBooleanOrElse: _getBooleanOrElse
    };
  }
})();
