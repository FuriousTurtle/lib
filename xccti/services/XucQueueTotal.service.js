export default function XucQueueTotal() {

  var queueStats = {};
  queueStats.sum = {};
  queueStats.max = {};
  queueStats.global = {};

  var _razCalc = function() {

    queueStats.sum.TotalNumberCallsEntered = 0;
    queueStats.sum.TotalNumberCallsAnswered = 0;
    queueStats.sum.TotalNumberCallsAbandonned = 0;
    queueStats.sum.TotalNumberCallsClosed = 0;
    queueStats.sum.TotalNumberCallsTimeout = 0;
    queueStats.sum.WaitingCalls = 0;
    queueStats.sum.TotalNumberCallsAnsweredBefore15 = 0;
    queueStats.sum.TotalNumberCallsAbandonnedAfter15 = 0;
    queueStats.global.PercentageAnsweredBefore15 = 0;
    queueStats.global.PercentageAbandonnedAfter15 = 0;
    queueStats.max.LongestWaitTime = 0;
    queueStats.max.EWT = 0;
  };

  var _getCalcStats = function() {
    return queueStats;
  };

  var _calculateSum = function(property, value) {
    if (typeof(queueStats.sum[property]) !== 'undefined') {
      queueStats.sum[property] = queueStats.sum[property] + value;
    }
  };
  var _calculateMax = function(property, value) {
    if (typeof(queueStats.max[property]) !== 'undefined' && !isNaN(parseInt(value)) ) {
      if (value > queueStats.max[property])
        queueStats.max[property] = value;
    }
  };
  var _updateQueueTotals = function(queue) {
    angular.forEach(queue, function(value, property){
      _calculateSum(property, value);
      _calculateMax(property, value);
    });
  };
  var _calculatePercentages = function() {
    if (queueStats.sum.TotalNumberCallsEntered > 0) {
      queueStats.global.PercentageAnsweredBefore15 = _percent(queueStats.sum.TotalNumberCallsAnsweredBefore15,queueStats.sum.TotalNumberCallsEntered);
      queueStats.global.PercentageAbandonnedAfter15 = _percent(queueStats.sum.TotalNumberCallsAbandonnedAfter15,queueStats.sum.TotalNumberCallsEntered);
    }
  };

  var _percent = function(nom, denom) {
    var percentage = 0;
    if (denom > 0) {
      percentage = (nom/denom)*100;
      if (percentage > 100) percentage = 100;
    }
    return percentage;
  };

  var _calculate = function(queues) {
    _razCalc();
    angular.forEach(queues, function(queue){
      _updateQueueTotals(queue);
    });
    _calculatePercentages();
  };
  _razCalc();

  return {
    getCalcStats : _getCalcStats,
    calculate : _calculate
  };


}
