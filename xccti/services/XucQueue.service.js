export default function XucQueue($timeout, $rootScope, $log, $q, XucLink) {
  'use strict';
  var NoLongestWaitTime = "-";
  var updateQueueFrequency = 5;

  var queues = [];
  var _loaded = $q.defer();
  var loadQueues = function() {
    Cti.getList("queue");
  };
  var subscribeToQueueStats = function() {
    Cti.subscribeToQueueStats();
  };

  var _queueReplace = function(queueConfig) {
    var replaced = false;
    angular.forEach(queues, function(queue) {
      if (queue.id === queueConfig.id) {
        angular.forEach(queueConfig, function(value, property) {
          queue[property] = value;
        });
        replaced = true;
      }
    });
    return replaced;
  };

  this.onQueueConfig = function(queueConfig) {
    queueConfig.LongestWaitTime = NoLongestWaitTime;
    queueConfig.WaitingCalls = 0;
    // Not usefull ?
    //var replaced = _queueReplace(queueConfig);
    if (_queueReplace(queueConfig) === false) {
      queues.splice(1, 0, queueConfig);
    }
  };

  this.onQueueList = function(queueList) {
    for (var i = 0; i < queueList.length; i++) {
      this.onQueueConfig(queueList[i]);
    }
    subscribeToQueueStats();
    $rootScope.$broadcast('QueuesLoaded');
    _loaded.resolve();
  };
  this.onQueueStatistics = function(queueStatistics) {
    var updateCounters = function(counters, queue) {
      angular.forEach(counters, function(counter) {
        if (counter.statName === 'WaitingCalls' && counter.value === 0) {
          queue.LongestWaitTime = NoLongestWaitTime;
        }
        queue[counter.statName] = counter.value;
      });
    };
    var queueSelector = function(i) {return queues[i].id === queueStatistics.queueId;};
    if (typeof queueStatistics.queueId === 'undefined') {
      queueSelector = function(i) {return queues[i].name === queueStatistics.queueRef;};
    }
    for (var j = 0; j < queues.length; j++) {
      if (queueSelector(j)) {
        updateCounters(queueStatistics.counters,queues[j]);
      }
    }
    $rootScope.$broadcast('QueueStatsUpdated');
  };



  this.start = function() {
    loadQueues();
  };

  this.updateQueues = function(updateQueueFrequency) {
    for (var i = 0; i < queues.length; i++) {
      if (queues[i].LongestWaitTime >= 0 && queues[i].WaitingCalls !== 0) {
        queues[i].LongestWaitTime += updateQueueFrequency;
      } else {
        queues[i].LongestWaitTime = "-";
      }
    }
    $rootScope.$broadcast('QueueStatsUpdated');
  };

  this.subscribeToStatistics = function(scope, callback) {
    var handler = $rootScope.$on('QueueStatsUpdated', function() {
      scope.$apply(callback);
    });
    scope.$on('$destroy', handler);
  };

  this.updateLongestWaitTime = function() {
    this.updateQueues(updateQueueFrequency);
    $timeout(this.updateLongestWaitTime.bind(this),updateQueueFrequency*1000,false);
  };
  $timeout(this.updateLongestWaitTime.bind(this),updateQueueFrequency*1000,false);

  this.getQueue = function(queueId) {
    for (var j = 0; j < queues.length; j++) {
      if (queues[j].id === queueId) {
        return queues[j];
      }
    }
  };

  this.getQueueByName = function(queueName) {
    for (var j = 0; j < queues.length; j++) {
      if (queues[j].name === queueName) {
        return queues[j];
      }
    }
  };

  this.getQueueAsync = function(queueId) {
    var self = this;
    return _loaded.promise.then(function() {
      return self.getQueue(queueId);
    });
  };

  this.getQueueByNameAsync = function(queueName) {
    var self = this;
    return _loaded.promise.then(function() {
      return self.getQueueByName(queueName);
    });
  };

  this.getQueueByIds = function(ids) {
    var qFilter =  function(queue) {
      return (ids.indexOf(queue.id) >= 0);
    };
    return queues.filter(qFilter);
  };

  this.whenQueuesLoaded = function() { return _loaded.promise;};

  this.getQueues = function() {
    return queues;
  };

  this.getQueuesAsync = function() {
    var self = this;
    return _loaded.promise.then(function() {
      return self.getQueues();
    });
  };

  this.getQueuesExcept = function(excludeQueues) {
    var acceptQueue = function(queue) {
      for (var j = 0; j < excludeQueues.length; j++) {
        if (excludeQueues[j].id === queue.id) {
          return false;
        }
      }
      return true;
    };
    return queues.filter(acceptQueue);
  };

  this.uninit = function() {
    $log.info("Unloading XucQueue service");
    XucLink.whenLogged().then(this.init.bind(this));
  };
  
  this.init = function() {
    $log.info("Starting XucQueue service");
    NoLongestWaitTime = "-";
    updateQueueFrequency = 5;

    queues = [];
    _loaded = $q.defer();
    this.start();
    XucLink.whenLoggedOut().then(this.uninit.bind(this));
  };

  Cti.setHandler(Cti.MessageType.QUEUECONFIG, this.onQueueConfig.bind(this));
  Cti.setHandler(Cti.MessageType.QUEUELIST, this.onQueueList.bind(this));
  Cti.setHandler(Cti.MessageType.QUEUESTATISTICS, this.onQueueStatistics.bind(this));

  XucLink.whenLogged().then(this.init.bind(this));
  
  return this;
}
