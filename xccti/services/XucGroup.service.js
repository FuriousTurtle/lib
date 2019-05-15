export default function XucGroup($rootScope, XucAgent, XucLink, $q, $filter, $log) {
  var groups = [];

  var _loaded = $q.defer();
  
  var _onAgentGroupList = function(agentGroups) {
    groups = [];
    for(var i=0; i < agentGroups.length; i++) {
      var group = agentGroups[i];
      group.displayName = group.displayName ? group.displayName: group.name;
      groups.push(group);
    }
    $rootScope.$broadcast('GroupsLoaded');
    _loaded.resolve();
  };

  var _getGroups = function() {
    return groups;
  };

  var _getGroupAsync = function(groupId) {
    return _loaded.promise.then(() => _getGroup(groupId));
  };

  var _getGroup = function(groupId) {
    for (var j = 0; j < groups.length; j++) {
      if (groups[j].id === groupId) {
        return groups[j];
      }
    }
    return null;
  };
  
  var _getAvailableGroups = function(queueId) {
    var availableGroups = [];
    var availableAgents = XucAgent.getAgentsNotInQueue(queueId);

    angular.forEach(availableAgents, function(agent) {
      var group = _getGroup(agent.groupId);
      if (this.indexOf(group) <0) this.push(_getGroup(agent.groupId));
    }, availableGroups);

    return availableGroups;
  };
  
  var _moveAgentsInGroup = function(groupId, fromQueueId, fromPenalty, toQueueId, toPenalty) {
    Cti.moveAgentsInGroup(groupId, fromQueueId, fromPenalty, toQueueId, toPenalty);
  };
  var _addAgentsInGroup = function(groupId, fromQueueId, fromPenalty, toQueueId, toPenalty) {
    Cti.addAgentsInGroup(groupId, fromQueueId, fromPenalty, toQueueId, toPenalty);
  };
  var _removeAgentGroupFromQueueGroup = function(groupId, queueId, penalty) {
    Cti.removeAgentGroupFromQueueGroup(groupId, queueId, penalty);
  };
  var _addAgentsNotInQueueFromGroupTo = function(groupId, queueId, penalty) {
    Cti.addAgentsNotInQueueFromGroupTo(groupId, queueId, penalty);
  };
  var _start = function() {
    $log.info("running group service");
    Cti.getList("agentgroup");
  };

  Cti.setHandler(Cti.MessageType.AGENTGROUPLIST, _onAgentGroupList);

  XucLink.whenLogged().then(_start());
  
  return {
    getGroups : _getGroups,
    onAgentGroupList : _onAgentGroupList,
    start : _start,
    reload : _start,
    getGroup : _getGroup,
    getGroupAsync : _getGroupAsync,
    getAvailableGroups : _getAvailableGroups,
    moveAgentsInGroup : _moveAgentsInGroup,
    addAgentsInGroup : _addAgentsInGroup,
    removeAgentGroupFromQueueGroup: _removeAgentGroupFromQueueGroup,
    addAgentsNotInQueueFromGroupTo: _addAgentsNotInQueueFromGroupTo
  };
}
