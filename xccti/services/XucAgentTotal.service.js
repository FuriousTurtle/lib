export default function XucAgentTotal(XucGroup){

  var _get_stat_group = (stats, groupId) => {
    var groupName = XucGroup.getGroup(groupId).name;
    if (!stats[groupName])
      stats[groupName] = {};
    return stats[groupName];
  };
  var _calculate_stat = (agentStats, stats) => {
    angular.forEach(agentStats, (value, property) => {
      if (!isNaN(value)) {
        stats[property] = stats[property] ? stats[property] + value : value;
      }
    });
    return stats;
  };
  var _calculate = (agents) => {
    var stats = {};
    angular.forEach(agents, (agent) => {
      var groupStat = _get_stat_group(stats, agent.groupId);
      _calculate_stat(agent.stats, groupStat);
    });
    return stats;
  };
  return {
    calculate:_calculate
  };
}
