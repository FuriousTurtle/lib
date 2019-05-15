export default function XucThirdParty($log, $rootScope, $http, $q, $window, XucPhoneEventListener, XucUser, XucQueue, XucAgent, XucLink) {
  var _actionEventName = 'XucThirdParty.Action';
  var _clearEventName = 'XucThirdParty.Clear';

  var _thirdPartyWs = null;
  var _currentAction = null;
  var _wasEstablished = false;

  $log.debug('XucThirdParty service initialization');

  var _setThirdPartyWs = function(url) { _thirdPartyWs = url; };
  var _getCurrentAction = function() { return _currentAction; };

  /**
   * Subscribe to Third party Action events. The callback will be called
   * when a third party action must be done
   * @param scope The scope containing the callback
   * @param callback The callback function called with the action required as argument.
   * @private
   */
  var _addActionHandler = function(scope, callback) {
    var handler = $rootScope.$on(_actionEventName, function(event, action) {
      callback(action);
    });
    scope.$on('$destroy', handler);
  };

  var _addClearHandler = function(scope, callback) {
    var handler = $rootScope.$on(_clearEventName, callback);
    scope.$on('$destroy', handler);
  };

  var _clearAction = function() {
    if(_currentAction !== null && _currentAction.autopause) {
      XucAgent.unpause();
    }

    _currentAction = null;
    $rootScope.$emit(_clearEventName);
  };

  var _callThirdPartyWs = function(data) {
    if(typeof(_thirdPartyWs) !== "string" || _thirdPartyWs.length === 0){
      var defer = $q.defer();
      defer.reject("XucThirdParty not initialized with WS Url");
      return defer.promise;
    }

    return $http.post(_thirdPartyWs, data)
      .then(function success(response) {
        $log.debug("Got WS Response " + JSON.stringify(response.data));
        _currentAction = response.data;
      }, function error() {
        $log.error("Error while fetching response from " + _thirdPartyWs);
        _currentAction = null;
      });
  };

  var _checkAndFireEvent = function(phoneEvent) {
    if(_currentAction !== null) {
      if(phoneEvent === "EventEstablished") {
        _wasEstablished = true;
      }

      if(phoneEvent === _currentAction.event && !_currentAction.triggered) {
        if(phoneEvent !== "EventReleased" || (phoneEvent === "EventReleased" && _wasEstablished)) {
          $log.debug("Firing ThirdParty action");
          if (_currentAction.autopause) {
            XucAgent.pause();
          }
          $rootScope.$emit(_actionEventName, angular.copy(_currentAction));
          _currentAction.triggered = true;
        }
      }
    }
  };

  var _onRinging = function(event) {
    $log.debug("_onRinging " + JSON.stringify(event));
    var promises = [XucUser.getUserAsync(), XucLink.whenLogged()];
    if(typeof(event.queueName) !== "undefined") {
      promises.push(XucQueue.getQueueByNameAsync(event.queueName));
    }
    _wasEstablished = false;

    $q.all(promises).then(function (results) {
      var user = results[0];
      var queue;
      var token = results[1].token;
      if(results.length > 2) {
        queue = results[2];
      }

      var data = {
        user: {
          userId: user.userId,
          agentId: user.agentId,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          token: token
        },
        callee: event.DN,
        caller: event.otherDN,
        userData: event.userData,
        callDataCallId: event.linkedId
      };
      if(typeof(queue) !== "undefined") {
        data.queue = {
          id: queue.id,
          name: queue.name,
          displayName: queue.displayName,
          number: queue.number
        };
      }
      _callThirdPartyWs(data)
        .then(function() {_checkAndFireEvent(XucPhoneEventListener.EVENT_RINGING);})
        .catch(function() { $log.debug("Service seems disabled or not available");});
    });

  };

  var _onEstablished = function(event) {
    $log.debug("_onEstablished");
    _checkAndFireEvent(event.eventType);
  };

  var _onReleased = function(event) {
    $log.debug("_onReleased");
    _checkAndFireEvent(event.eventType);
  };

  XucPhoneEventListener.addRingingHandler($rootScope, _onRinging);
  XucPhoneEventListener.addEstablishedHandler($rootScope, _onEstablished);
  XucPhoneEventListener.addReleasedHandler($rootScope, _onReleased);

  return {
    setThirdPartyWs: _setThirdPartyWs,
    addActionHandler: _addActionHandler,
    addClearHandler: _addClearHandler,
    getCurrentAction: _getCurrentAction,
    clearAction: _clearAction
  };
}
