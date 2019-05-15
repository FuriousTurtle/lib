import RequestQueryBuilder from './RequestQueryBuilder';
import _ from 'lodash';
import moment from 'moment';

export default function XucCallHistory($rootScope, $interval, $q, $log, XucLink, XucPhoneEventListener) {
  var callHistory = [];
  var type = 'User';

  var _initDefer = $q.defer();
  var _pendingCustomerFindRequests = {};
  var _lastCustomerFindRequestId = 0;

  var _whenLoaded = function() { return _initDefer.promise; };

  var _queryBuilder = function() {
    return new RequestQueryBuilder();
  };

  var _updateUserCallHistory = function() {
    Cti.getUserCallHistory(20);
  };

  var _updateAgentCallHistory = function() {
    Cti.getAgentCallHistory(20);
  };

  var _processCallHistory = function(newHistory) {
    var isOngoingCall = _processCallHistoryItem(newHistory, callHistory);
    if (isOngoingCall) {
      $interval(_updateUserCallHistory, 2000, 1);
    }
  };

  var _processCallHistoryItem = function(newHistory, callHistory) {
    var _callHistory = [];
    var lastDay = "";
    var index = -1;
    var ongoingCallFound = false;

    _.forEach(newHistory, function(item) {

      if (item.status == 'ongoing') {
        ongoingCallFound = true;
      }

      if (item.status == 'emitted') {
        item.number = item.dstNum;
        item.firstName = item.dstFirstName;
        item.lastName = item.dstLastName;
      } else {
        item.number = item.srcNum;
        item.firstName = item.srcFirstName;
        item.lastName = item.srcLastName;
      }

      var day = moment(item.start).startOf('day').toISOString();
      if (lastDay !== day) {
        index++;
        lastDay = day;
        _callHistory[index] = {
          day: day,
          details: []
        };
      }

      _callHistory[index].details.push(item);
    });

    callHistory = _callHistory;
    $rootScope.$apply($rootScope.$broadcast(type+'CallHistoryUpdated', callHistory));
    return ongoingCallFound;
  };

  var _processCustomerCallHistory = function(resp) {
    if(angular.isDefined(_pendingCustomerFindRequests[resp.id])) {
      var defer = _pendingCustomerFindRequests[resp.id];
      delete _pendingCustomerFindRequests[resp.id];
      var r = resp.response;

      var _callHistory = [];
      var lastDay = "";
      var index = -1;

      _.forEach(r.list, (item) => {
        var day = moment(item.start).startOf('day').toISOString();
        if (lastDay !== day) {
          index++;
          lastDay = day;
          _callHistory[index] = {
            day: day,
            details: []
          };
        }

        _callHistory[index].details.push(item);
      });
      defer.resolve(_callHistory);
    }
  };

  var _findCustomerCallHistoryAsync = function(query) {
    return _whenLoaded().then(function() {
      _lastCustomerFindRequestId++;
      var rqId = _lastCustomerFindRequestId;
      var defer = $q.defer();
      Cti.findCustomerCallHistory(rqId, query.filters, query.limit);
      _pendingCustomerFindRequests[rqId] = defer;
      return defer.promise;
    });
  };

  var _processPhoneStateReleased = function() {
    setTimeout(function(){ type === 'Agent' ? _updateAgentCallHistory() : _updateUserCallHistory(); }, 3000);
  };

  var _subscribeToUserCallHistory = function(scope, callback) {
    type = 'User';
    _subscribeToCallHistory(scope, callback);
  };

  var _subscribeToAgentCallHistory = function(scope, callback) {
    type = 'Agent';
    _subscribeToCallHistory(scope, callback);
  };

  var _subscribeToCallHistory = function(scope, callback) {
    var unregister = $rootScope.$on(type + 'CallHistoryUpdated', function(event, updatedCallHistory) {
      scope.$apply(callback(updatedCallHistory));
    });
    scope.$on('$destroy', unregister);
  };

  var _unInit = function() {
    $log.info('Unloading CallHistory service');
    _initDefer.reject();
    _initDefer = $q.defer();
    callHistory = [];
    type = 'User';
    _pendingCustomerFindRequests = {};
    _lastCustomerFindRequestId = 0;
    XucLink.whenLogged().then(_init);
  };

  var _init = function() {
    $log.info('Starting CallHistory service');
    _initDefer.resolve();
    XucLink.whenLoggedOut().then(_unInit);
  };

  Cti.setHandler(Cti.MessageType.CALLHISTORY, _processCallHistory);
  Cti.setHandler(Cti.MessageType.CUSTOMERCALLHISTORY, _processCustomerCallHistory);

  XucPhoneEventListener.addReleasedHandler($rootScope, _processPhoneStateReleased);

  XucLink.whenLogged().then(_init);

  return {
    updateUserCallHistory: _updateUserCallHistory,
    subscribeToUserCallHistory: _subscribeToUserCallHistory,
    updateAgentCallHistory: _updateAgentCallHistory,
    subscribeToAgentCallHistory: _subscribeToAgentCallHistory,
    findCustomerCallHistoryAsync: _findCustomerCallHistoryAsync,
    queryBuilder: _queryBuilder
  };
}