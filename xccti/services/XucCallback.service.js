import RequestQueryBuilder from './RequestQueryBuilder';
import _ from 'lodash';
import moment from 'moment';

export default function XucCallback($rootScope, $translate, XucQueue, XucAgent, $log, XucLink, $q) {
  const DUE_STATUS_OVERDUE = 'overdue';
  const DUE_STATUS_NOW = 'now';
  const DUE_STATUS_LATER = 'later';
  
  var callbackLists = [];
  var _initDefer = $q.defer();
  var _pendingGetRequests = [];
  var _pendingTakeRequests = [];
  var _pendingGetPeriodsRequests = [];
  var _pendingFindRequests = {};
  var _lastFindRequestId = 0;


  const _callbackDueStatusOrder = (status) => {    
    switch(status) {
    case DUE_STATUS_OVERDUE: return 0;
    case DUE_STATUS_NOW: return 1;
    case DUE_STATUS_LATER: return 2;
    default: return 3;     
    }
  };

  var _whenLoaded = function() { return _initDefer.promise; };

  var _queryBuilder = function() {
    return new RequestQueryBuilder();
  };

  var _onCallbackLists = function(lists) {
    var promises = mixWithQueuesAndAgents(lists);
    $q.all(promises).then(function() {
      callbackLists = lists;
      $rootScope.$broadcast('CallbacksLoaded');
      angular.forEach(_pendingGetRequests, function (defer) {
        defer.resolve(callbackLists);
      });
      _pendingGetRequests.length = 0;
    });
  };

  var _onCallbackFindResponse = function(resp) {
    if(angular.isDefined(_pendingFindRequests[resp.id])) {
      var defer = _pendingFindRequests[resp.id];
      delete _pendingFindRequests[resp.id];
      var r = resp.response;
      mixWithAgentsAndStatus(r.list);
      var callbackListName = _getCallbackListNames();
      angular.forEach(r.list, function(cb) {
        cb.listName = callbackListName[cb.listUuid];
      });

      defer.resolve(r);

    }
  };

  var _getCallbackListNames = function() {
    var callbackListName = {};
    angular.forEach(callbackLists, function(list) {
      callbackListName[list.uuid] = list.name;
    });
    return callbackListName;
  };

  var _onCallbackPreferredPeriodLists = function(list) {
    angular.forEach(_pendingGetPeriodsRequests, function (defer) {
      defer.resolve(list);
    });
    _pendingGetRequests.length = 0;
  };

  var _callbackByUuid = function(uuid) {
    for(var i=0; i<callbackLists.length; i++) {
      for(var j=0; j<callbackLists[i].callbacks.length; j++) {
        if(callbackLists[i].callbacks[j].uuid == uuid) {
          return callbackLists[i].callbacks[j];
        }
      }
    }
  };

  var _getCallbackByUuidAsync = function(uuid) {
    return _whenLoaded().then(function() {
      if(callbackLists.length === 0){
        return _getCallbackListsAsync().then(function() {return _callbackByUuid(uuid);});
      } else {
        return _callbackByUuid(uuid);
      }
    });
  };

  var _onCallbackTaken = function(cbTaken) {
    var callback = _callbackByUuid(cbTaken.uuid);
    if(callback) {
      callback.agentId = cbTaken.agentId;
      callback.agent = XucAgent.getAgent(cbTaken.agentId);
    }

    angular.forEach(_pendingTakeRequests, function(rq) {
      if(cbTaken.uuid == rq.uuid) {
        rq.defer.resolve(cbTaken);
      }
    });
    _.remove(_pendingTakeRequests, {uuid:cbTaken.uuid});
    $rootScope.$broadcast('CallbackTaken', cbTaken);
  };

  var _onCallbackReleased = function(cbReleased) {
    var callback = _callbackByUuid(cbReleased.uuid);
    if(callback) {
      callback.agentId = null;
      callback.agent = null;
    }
    $rootScope.$broadcast('CallbackReleased', cbReleased);
  };

  var mixWithQueuesAndAgents = function(lists) {
    var promises = [];
    angular.forEach(lists, function(item) {
      promises.push(XucQueue.getQueueAsync(item.queueId).then(function(q) {
        item.queue = q;
        angular.forEach(item.callbacks, function(cb) {
          cb.queue = q;
        });
      }));
      mixWithAgentsAndStatus(item.callbacks);
    });
    return promises;
  };

  var mixWithAgentsAndStatus = function(requests) {
    for(var i=0; i<requests.length; i++) {
      if(requests[i].agentId) {
        requests[i].agent = XucAgent.getAgent(requests[i].agentId);
      }
      requests[i].dueStatus = _getCallbackDueStatus(requests[i]);
    }
  };

  var _getCallbackLists = function() {
    return callbackLists;
  };

  var _getCallbackListsAsync = function() {
    return _whenLoaded().then(function() {
      _refreshCallbacks();
      var defer = $q.defer();
      _pendingGetRequests.push(defer);
      return defer.promise;
    });
  };

  var _findCallbackRequestsAsync = function(query) {
    return _whenLoaded().then(function() {
      _lastFindRequestId++;
      var rqId = _lastFindRequestId;
      var defer = $q.defer();
      Callback.findCallbackRequest(rqId, query.filters, query.offset, query.limit);
      _pendingFindRequests[rqId] = defer;
      return defer.promise;
    });
  };

  var _getPreferredPeriodsAsync = function() {
    return _whenLoaded().then(function() {
      Callback.getCallbackPreferredPeriods();
      var defer = $q.defer();
      _pendingGetPeriodsRequests.push(defer);
      return defer.promise;
    });
  };

  var _refreshCallbacks = function() {
    _whenLoaded().then(function() { Callback.getCallbackLists();});
  };

  var _takeCallback = function(uuid) {
    _whenLoaded().then(function() { Callback.takeCallback(uuid); });
  };

  var _takeCallbackAsync = function(uuid) {
    var defer = $q.defer();
    _pendingTakeRequests.push({uuid: uuid, defer: defer});
    _whenLoaded().then(function() { Callback.takeCallback(uuid);});
    return defer.promise;
  };

  var _releaseCallback = function(uuid) {
    Callback.releaseCallback(uuid);
  };

  var _startCallback = function(uuid, number) {
    Callback.startCallback(uuid, number);
  };

  var _listenCallbackMessage = function(voiceMessageRef) {
    Callback.listenCallbackMessage(voiceMessageRef);
  };

  var _onCallbackStarted = function(cbStarted) {
    $rootScope.$broadcast('CallbackStarted', cbStarted);
  };

  var _updateCallbackTicket = function(ticket) {
    Callback.updateCallbackTicket(ticket.uuid, ticket.status, ticket.comment, ticket.dueDate, ticket.periodUuid);
  };

  var _onCallbackClotured = function(cbClotured) {
    _removeCallbackByUuid(cbClotured.uuid);
    $rootScope.$broadcast('CallbackClotured', cbClotured);
  };

  var _updateCallback = function(cb){
    $log.debug("XucCallback._updateCallback");
    var r = _callbackByUuid(cb.uuid);
    if(typeof(r) !== "undefined") {
      _.assign(r, cb);
    }
    $rootScope.$emit("CallbackUpdated", cb);
  };

  var _onCallbackRequestUpdated = function(cbu) {
    $log.debug("XucCallback._onCallbackRequestUpdated");
    if(_pendingGetRequests.length > 0) {
      _pendingGetRequests[_pendingGetRequests.length - 1].promise.then(function(){_updateCallback(cbu.request);});
    } else {
      _updateCallback(cbu.request);
    }
    $rootScope.$broadcast('CallbackRequestUpdated', cbu.request);
  };

  var _removeCallbackByUuid = function(uuid) {
    for(var i=0; i<callbackLists.length; i++) {
      for(var j=0; j<callbackLists[i].callbacks.length; j++) {
        if(callbackLists[i].callbacks[j].uuid == uuid) {
          callbackLists[i].callbacks.splice(j, 1);
        }
      }
    }
  };

  var _subscribeToUpdateEvent = function(scope, callback) {
    var handler = $rootScope.$on('CallbackUpdated', function(event, cb) {
      if ($rootScope.$$phase) {
        callback(cb);
      } else {
        scope.$apply(function () {
          callback(cb);
        });
      }
    });
    scope.$on('$destroy', handler);
  };

  var _getCallbackDueStatus = function(callback) {
    var start = moment(callback.dueDate + 'T' + callback.preferredPeriod.periodStart).toDate();
    var end = moment(callback.dueDate + 'T' + callback.preferredPeriod.periodEnd).toDate();
    var now = new Date();
    if(now > end) return DUE_STATUS_OVERDUE;
    if(now < start) return DUE_STATUS_LATER;
    return DUE_STATUS_NOW;
  };

  var _statuses = [
    {name: 'NoAnswer', displayName: $translate.instant('NoAnswer')},
    {name: 'Answered', displayName: $translate.instant('Answered')},
    {name: 'Email', displayName: $translate.instant('Email')},
    {name: 'Fax', displayName: $translate.instant('Fax')},
    {name: 'Callback', displayName: $translate.instant('Callback')}
  ];

  var _unInit = function() {
    $log.info('Unloading Callback service');
    _initDefer.reject();
    _initDefer = $q.defer();
    callbackLists = [];
    _initDefer = $q.defer();
    _pendingGetRequests = [];
    _pendingTakeRequests = [];
    _pendingGetPeriodsRequests = [];
    _pendingFindRequests = {};
    _lastFindRequestId = 0;
    XucLink.whenLogged().then(_init);
  };

  var _init = function() {
    $log.info('Starting Callback service');
    Callback.init(Cti);
    _initDefer.resolve();
    XucLink.whenLoggedOut().then(_unInit);
    XucQueue.whenQueuesLoaded().then(_refreshCallbacks);
  };

  Cti.setHandler(Callback.MessageType.CALLBACKLISTS, _onCallbackLists);
  Cti.setHandler(Callback.MessageType.CALLBACKTAKEN, _onCallbackTaken);
  Cti.setHandler(Callback.MessageType.CALLBACKRELEASED, _onCallbackReleased);
  Cti.setHandler(Callback.MessageType.CALLBACKSTARTED, _onCallbackStarted);
  Cti.setHandler(Callback.MessageType.CALLBACKCLOTURED, _onCallbackClotured);
  Cti.setHandler(Callback.MessageType.CALLBACKPREFERREDPERIODS, _onCallbackPreferredPeriodLists);
  Cti.setHandler(Callback.MessageType.CALLBACKREQUESTUPDATED, _onCallbackRequestUpdated);
  Cti.setHandler(Callback.MessageType.CALLBACKFINDRESPONSE, _onCallbackFindResponse);
  XucLink.whenLogged().then(_init);
  

  return {
    DUE_STATUS_OVERDUE: DUE_STATUS_OVERDUE,
    DUE_STATUS_NOW: DUE_STATUS_NOW,
    DUE_STATUS_LATER: DUE_STATUS_LATER,
    callbackDueStatusOrder: _callbackDueStatusOrder,
    getCallbackLists: _getCallbackLists,
    findCallbackRequestsAsync: _findCallbackRequestsAsync,
    refreshCallbacks: _refreshCallbacks,
    takeCallback: _takeCallback,
    releaseCallback: _releaseCallback,
    statuses: _statuses,
    _onCallbackLists: _onCallbackLists,
    _onCallbackTaken: _onCallbackTaken,
    _onCallbackReleased: _onCallbackReleased,
    startCallback: _startCallback,
    listenCallbackMessage: _listenCallbackMessage,
    _onCallbackStarted: _onCallbackStarted,
    updateCallbackTicket: _updateCallbackTicket,
    _onCallbackClotured: _onCallbackClotured,
    getCallbackListsAsync: _getCallbackListsAsync,
    getCallbackByUuidAsync: _getCallbackByUuidAsync,
    takeCallbackAsync: _takeCallbackAsync,
    getPreferredPeriodsAsync: _getPreferredPeriodsAsync,
    subscribeToUpdateEvent: _subscribeToUpdateEvent,
    queryBuilder: _queryBuilder,
    getCallbackListNames: _getCallbackListNames,
    getCallbackDueStatus: _getCallbackDueStatus
  };
}
