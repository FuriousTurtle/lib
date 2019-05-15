export default function XucUser($rootScope, $q, XucLink, $log) {
  var _userLoggedDeferred = $q.defer();
  var user = {};
  user.fullName = '--------';
  user.naFwdEnabled = false;
  user.uncFwdEnabled = false;
  user.busyFwdEnabled = false;

  var _updateForwards = function(userConfig) {
    if(userConfig.naFwdDestination !== null) {
      user.naFwdDestination = userConfig.naFwdDestination;
      user.naFwdEnabled = userConfig.naFwdEnabled;
    }
    if(userConfig.uncFwdDestination !== null) {
      user.uncFwdDestination = userConfig.uncFwdDestination;
      user.uncFwdEnabled =userConfig.uncFwdEnabled;
    }
    if(userConfig.busyFwdDestination !== null) {
      user.busyFwdDestination = userConfig.busyFwdDestination;
      user.busyFwdEnabled =userConfig.busyFwdEnabled;
    }
    user.dndEnabled = userConfig.dndEnabled;
  };


  var _onUserConfig = function(userConfig) {
    if(userConfig.fullName !== null) {
      $log.debug("userconfig");
      user = angular.copy(userConfig);
      _userLoggedDeferred.resolve(angular.copy(user));
    }
    _updateForwards(userConfig);
    $rootScope.$evalAsync(() => {
      $rootScope.$broadcast('userConfigUpdated');
    });
  };

  var _getUser = function() {
    return user;
  };

  var _getUserAsync = function() {
    return _userLoggedDeferred.promise;
  };


  var _init = function() {
    $log.info("Starting XucUser service");
    XucLink.whenLoggedOut().then(_uninit);
  };

  var _uninit = function() {
    $log.info("Unloading XucUser service");
    user = {};
    user.fullName = '--------';
    user.naFwdEnabled = false;
    user.uncFwdEnabled = false;
    user.busyFwdEnabled = false;
    _userLoggedDeferred = $q.defer();
    XucLink.whenLogged().then(_init);
  };

  Cti.setHandler(Cti.MessageType.USERCONFIGUPDATE, _onUserConfig);
  XucLink.whenLogged().then(_init);

  return {
    onUserConfig : _onUserConfig,
    getUser : _getUser,
    getUserAsync: _getUserAsync
  };
}