import _ from 'lodash';

export default function XucMembership($q, $rootScope, $log, $timeout) {
  var _timeoutms = 5000;
  var _pendingRequests = {};

  var _setTimeoutMs = function(val) {
    _timeoutms = val;
  };

  var _getTimeoutMs = function() {
    return _timeoutms;
  };

  var _init = function() {
    $log.info('init membership service');
    Membership.init(Cti);
  };

  var _setUserDefaultMembership = function(userId, membership) {
    Membership.setUserDefaultMembership(userId, membership);
  };

  var _setUsersDefaultMembership = function(userIds, membership) {
    Membership.setUsersDefaultMembership(userIds, membership);
  };

  var _applyUsersDefaultMembership = function(userIds) {
    Membership.applyUsersDefaultMembership(userIds);
  };

  var _addPendingRequest = function(userId) {
    if(_.has(_pendingRequests, userId)) {
      _pendingRequests[userId].reject("Request aborted by new request for the same user " + userId);
    }

    _pendingRequests[userId] = $q.defer();
    $timeout(function() { _timeoutRequest(userId); }, _timeoutms);
    return _pendingRequests[userId];
  };

  var _timeoutRequest = function(userId) {
    if(_.has(_pendingRequests, userId)) {
      var p = _pendingRequests[userId];
      delete _pendingRequests[userId];
      p.reject({"error": "timeout"});
    }
  };

  var _getUserDefaultMembership = function(userId) {
    var deferred = _addPendingRequest(userId);
    Membership.getUserDefaultMembership(userId);
    return deferred.promise;
  };


  var _onUserQueueDefaultMembership = function(userQueueMembership) {
    if(_.has(_pendingRequests, userQueueMembership.userId)) {
      var p = _pendingRequests[userQueueMembership.userId];
      delete _pendingRequests[userQueueMembership.userId];
      p.resolve(userQueueMembership.membership);
    }
  };

  $rootScope.$on('QueuesLoaded', _init);
  Cti.setHandler(Cti.MessageType.LOGGEDON, _init);
  Cti.setHandler(Membership.MessageType.USERQUEUEDEFAULTMEMBERSHIP, _onUserQueueDefaultMembership);

  return {
    init: _init,
    setUserDefaultMembership: _setUserDefaultMembership,
    setUsersDefaultMembership: _setUsersDefaultMembership,
    getUserDefaultMembership: _getUserDefaultMembership,
    applyUsersDefaultMembership: _applyUsersDefaultMembership,
    setTimeoutMs: _setTimeoutMs,
    getTimeoutMs: _getTimeoutMs
  };
}
