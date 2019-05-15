export default function XucQueueGroup(XucAgent, XucGroup, $q) {
  const MAXPENALTY = 20;
  
  var _getGroupsForAQueue = function (queueId) {
    var queueGroups = [];
    var agents = XucAgent.getAgentsInQueue(queueId);

    var initGroup = function (penalty) {
      if (typeof queueGroups[penalty] === 'undefined') queueGroups[penalty] = {
        'penalty': penalty,
        'groups': []
      };
      if (!queueGroups[penalty - 1] && penalty > 0) initGroup(penalty - 1);
    };

    var getGroup = function (penalty) {
      if (typeof queueGroups[penalty] === 'undefined') initGroup(penalty);
      return queueGroups[penalty];
    };

    var addToGroup = function (groupOfGroup, agent) {
      let getQueueGroup = function(g) {
        for (var j = 0; j < groupOfGroup.groups.length; j++) {
          if (groupOfGroup.groups[j].id === agent.groupId) {
            groupOfGroup.groups[j].nbOfAgents = groupOfGroup.groups[j].nbOfAgents +1;
            groupOfGroup.groups[j].agents.push(agent);
            return ;
          }
        }
        var group = angular.copy(g);
        group.nbOfAgents = 1;
        group.agents = [agent];
        groupOfGroup.groups.push(group);
      };

      return XucGroup.getGroupAsync(agent.groupId).then(g => getQueueGroup(g));
    };

    var buildGroups = function () {
      let promises = [];
      angular.forEach(agents, function (agent) {
        if (typeof agent.queueMembers[queueId] !== 'undefined' && typeof agent.groupId !== 'undefined') {
          var groups = getGroup(agent.queueMembers[queueId]);
          promises.push(addToGroup(groups, agent));
          if (agent.queueMembers[queueId] + 1 < MAXPENALTY) initGroup(agent.queueMembers[queueId] + 1);
        }
      });
      return $q.all(promises).then(()=> queueGroups);
    };
    initGroup(0);
    return buildGroups();
  };

  return {
    getGroupsForAQueue: _getGroupsForAQueue
  };
}