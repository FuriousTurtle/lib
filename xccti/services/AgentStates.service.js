export default function AgentStates(XucAgent, $translate, $q) {
  var definedStates = ['AgentReady','AgentRinging','AgentDialing','AgentOnIncomingCall','AgentOnOutgoingCall','AgentOnAcdCall','AgentOnWrapup','AgentOnPause','AgentLoggedOut'];
  var _buildStates = function() {
    var def = $q.defer();
    var arr = [];
    var states = [];
    
    angular.forEach(definedStates, function(item){
      if (arr.indexOf(item) === -1) {
        arr.push(item);
        states.push({
          'id': item,
          'label': $translate.instant(item)
        });
      }
    });
    angular.forEach(XucAgent.getNotReadyStatuses(), function(item){
      if (arr.indexOf(item) === -1) {
        arr.push(item);
        states.push({
          'id': item.longName,
          'label': item.longName
        });
      }
    });
    def.resolve(states);
    return def;
  };
  return {
    buildStates: _buildStates
  };
}
