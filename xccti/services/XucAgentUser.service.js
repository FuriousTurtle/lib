import _ from 'lodash';

export default function XucAgentUser($rootScope, $q, XucUser, XucAgent, XucQueue, XucLink, $log, $timeout) {
  var _agentErrorDefer = $q.defer();
  var _currentAgentState = null;

  var _timeout;
  var _timeoutms = 5000;
  var _setQueueTimeoutMs = function(val) {
    _timeoutms = val;
  };
  var _pendingRequests = {};
  var _isListened = false;

  var _getQueuesAsync = function() {
    return XucUser.getUserAsync().then(function(user) {
      return XucAgent.getAgentAsync(user.agentId);
    }).then(function(agent) {
      var results = [];
      angular.forEach(agent.queueMembers, function(penalty, queueId) {
        results.push(XucQueue.getQueueAsync(queueId).then(function(queue) {
          var q = angular.copy(queue);
          q.penalty = penalty;
          return q;
        }));
      });
      return $q.all(results);
    });
  };

  var _subscribeToAgentState = function(scope, callback) {
    var handler = $rootScope.$on('UserAgentState', function(event, state) {
      if ($rootScope.$$phase) {
        callback(state);
      } else {
        scope.$apply(function () {
          callback(state);
        });
      }
    });
    if(_currentAgentState !== null) {
      callback(_currentAgentState);
    }
    scope.$on('$destroy', handler);
  };

  var _buildStatusFromList = function(statusName, statusList, minCandidates) {
    var states = [];
    if(statusList.length > minCandidates) {
      _.forEach(statusList, function(item) {
        states.push({"name": statusName, userStatus: {name: item.name, longName: item.longName}});
      });
    } else {
      states.push({"name": statusName, userStatus: null});
    }
    return states;
  };

  var _readyStatuses = function() {
    return _buildStatusFromList('AgentReady', XucAgent.getReadyStatuses(), 1);
  };
  var _otherStatuses = function() {
    return _buildStatusFromList('AgentOnPause', XucAgent.getNotReadyStatuses(), 0);
  };

  var _getPossibleAgentStates = function() {
    var states = [];
    if(_currentAgentState !== null) {
      switch(_currentAgentState.name) {
      case 'AgentOnPause':
        Array.prototype.push.apply(states, _readyStatuses());
        states.push({"name":'AgentLoggedOut', userStatus: null});
        break;
      case 'AgentOnWrapup':
        Array.prototype.push.apply(states, _readyStatuses());
        Array.prototype.push.apply(states, _otherStatuses());
        states.push({"name":'AgentLoggedOut', userStatus: null});
        break;
      case 'AgentReady':
        Array.prototype.push.apply(states, _otherStatuses());
        states.push({"name":'AgentLoggedOut', userStatus: null});
        break;
      case 'AgentOnCall':
        Array.prototype.push.apply(states, _otherStatuses());
        states.push({"name":'AgentLoggedOut', userStatus: null});
        break;
      case 'AgentDialing':
        Array.prototype.push.apply(states, _otherStatuses());
        states.push({"name":'AgentLoggedOut', userStatus: null});
        break;
      case 'AgentRinging':
        Array.prototype.push.apply(states, _otherStatuses());
        states.push({"name":'AgentLoggedOut', userStatus: null});
        break;
      case 'AgentLoggedOut':
        states.push({"name":'AgentLoggedOut', userStatus: null});
        break;
      case 'AgentLogin':
        var loginStatuses = _buildStatusFromList('AgentReady', XucAgent.getReadyStatuses(), 1);
        Array.prototype.push.apply(states, loginStatuses);
        states.push({"name":'AgentLoggedOut', userStatus: null});
        break;
      }
    } else {
      states.push({"name":'AgentLogin', userStatus: null});
    }
    return states;
  };

  var _switchAgentState = function(state) {
    $log.debug("Switching agent state", state);
    if(state.userStatus !== null) {
      Cti.changeUserStatus(state.userStatus.name);
    } else {
      switch(state.name) {
      case 'AgentOnPause':
        Cti.pauseAgent();
        break;
      case 'AgentReady':
        Cti.unpauseAgent();
        break;
      case 'AgentLoggedOut':
        Cti.logoutAgent();
        break;
      }
    }
  };

  var _onAgentStateEvent = function(event) {
    XucUser.getUserAsync().then(function(user) {
      if(event.agentId === user.agentId) {
        if(event.name === "AgentOnPause") {
          event.causeName = XucAgent.getUserStatusDisplayName(event.cause);
        }
        _currentAgentState = event;
        if(_isListened) {
          _isListened = false;
          $rootScope.$emit("AgentListenEvent", {started: false, phoneNumber: event.phoneNb, agentId: user.agentId});
        }
        $rootScope.$emit("UserAgentState", event);
      }
    });
  };

  var _onAgentError = function(event) {
    _agentErrorDefer.resolve(event);
  };

  var _whenAgentError = function() {
    return _agentErrorDefer.promise;
  };

  var _loginAgent = function() {
    $q.all([XucLink.whenLogged(), XucUser.getUserAsync()]).then(function() {
      Cti.loginAgent(XucLink.getPhoneNumber());
      Cti.getAgentStates();
    });
  };

  var _logoutAgent = function() {
    $q.all([XucLink.whenLogged(), XucUser.getUserAsync()]).then(function() {
      Cti.logoutAgent();
    });
  };

  var _init = function() {
    $log.info("Starting XucAgentUser service");
    XucLink.whenLoggedOut().then(_uninit);
  };

  var _uninit = function() {
    $log.info("Unloading XucAgentUser service");
    _agentErrorDefer = $q.defer();
    _currentAgentState = null;
    _isListened = false;
    XucLink.whenLogged().then(_init);
  };

  var _joinQueue = function(queueId, penalty) {
    XucUser.getUserAsync().then(function(user) {Cti.setAgentQueue(user.agentId, queueId, penalty);});
  };

  var _leaveQueue = function(queueId) {
    XucUser.getUserAsync().then(function(user) {Cti.removeAgentFromQueue(user.agentId, queueId);});
  };

  var _isMemberOfQueueAsync = function(queueId) {
    return XucUser.getUserAsync().then(function(user) {
      return XucAgent.getAgentAsync(user.agentId);
    }).then(function(agent) {
      return typeof(agent.queueMembers[queueId]) !== "undefined";
    });
  };

  var _joinQueueAsync = function(queueId, penalty) {
    return XucUser.getUserAsync().then(function(user) {
      var deferred = _addPendingRequest(queueId);
      Cti.setAgentQueue(user.agentId, queueId, penalty);
      return deferred.promise;
    });
  };

  var _leaveQueueAsync = function(queueId) {
    return XucUser.getUserAsync().then(function(user) {
      var deferred = _addPendingRequest(queueId);
      Cti.removeAgentFromQueue(user.agentId, queueId);
      return deferred.promise;
    });
  };

  var _onQueueMemberEvent = function(queueMember) {
    if(_.has(_pendingRequests, queueMember.queueId)) {
      if (_timeout) $timeout.cancel(_timeout);
      var p = _pendingRequests[queueMember.queueId];
      p.resolve(queueMember.queueId);
      delete _pendingRequests[queueMember.queueId];
    }
  };

  var _addPendingRequest = function(queueId) {
    _pendingRequests[queueId] = $q.defer();
    _timeout = $timeout(function() { _timeoutRequest(queueId); }, _timeoutms);
    return _pendingRequests[queueId];
  };

  var _timeoutRequest = function(queueId) {
    if(_.has(_pendingRequests, queueId)) {
      var p = _pendingRequests[queueId];
      delete _pendingRequests[queueId];
      p.reject({"error": "timeout"});
    }
  };

  var _onAgentListened = function(evt) {
    _isListened = evt.started;
    $rootScope.$emit("AgentListenEvent", evt);
  };

  var _subscribeToListenEvent = function(scope, callback) {
    var handler = $rootScope.$on('AgentListenEvent', function(event, state) {
      if ($rootScope.$$phase) {
        callback(state);
      } else {
        scope.$apply(function () {
          callback(state);
        });
      }
    });

    scope.$on('$destroy', handler);
  };

  var _canMonitor = function() {
    if(_currentAgentState != null
       && (_currentAgentState.monitorState == "ACTIVE" || _currentAgentState.monitorState == "PAUSED")) {
      return true;
    }
    return false;
  };

  var _isMonitored = function() {
    if(_currentAgentState != null
       && _currentAgentState.monitorState == "ACTIVE") {
      return true;
    }
    return false;
  };

  var _monitorPause = function() {
    XucUser.getUserAsync().then(function(user) {
      Cti.monitorPause(user.agentId);
    });
  };

  var _monitorUnpause = function() {
    XucUser.getUserAsync().then(function(user) {
      Cti.monitorUnpause(user.agentId);
    });
  };

  Cti.setHandler(Cti.MessageType.AGENTSTATEEVENT, _onAgentStateEvent);
  Cti.setHandler(Cti.MessageType.AGENTERROR, _onAgentError);
  Cti.setHandler(Cti.MessageType.QUEUEMEMBER, _onQueueMemberEvent);
  Cti.setHandler(Cti.MessageType.AGENTLISTEN, _onAgentListened);
  
  XucLink.whenLogged().then(_init);

  return {
    getQueuesAsync: _getQueuesAsync,
    isMemberOfQueueAsync: _isMemberOfQueueAsync,
    subscribeToAgentState: _subscribeToAgentState,
    subscribeToListenEvent: _subscribeToListenEvent,
    loginAgent: _loginAgent,
    logoutAgent: _logoutAgent,
    joinQueue: _joinQueue,
    joinQueueAsync: _joinQueueAsync,
    leaveQueue: _leaveQueue,
    leaveQueueAsync: _leaveQueueAsync,
    setQueueTimeoutMs: _setQueueTimeoutMs,
    getPossibleAgentStates: _getPossibleAgentStates,
    switchAgentState: _switchAgentState,
    whenAgentError: _whenAgentError,
    canMonitor: _canMonitor,
    isMonitored: _isMonitored,
    monitorPause: _monitorPause,
    monitorUnpause: _monitorUnpause
  };
}

