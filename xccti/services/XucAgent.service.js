import moment from 'moment';
import _ from 'lodash';

export default function XucAgent($rootScope, XucLink, XucQueue, $filter, $timeout, $q, $log) {
  var agents = [];
  var agentStatesWatingForConfig = [];
  var userStatuses = [];
  var agentStateTimer = 3;
  var notReadyStatuses = [];
  var readyStatuses = [];
  var _started = false;
  var _agentListDeferred = $q.defer();
  var _queueMemberListDeferred = $q.defer();

  var _NO_DEFAULT_MEMBERSHIP = "NO_DEFAULT_MEMBERSHIP";
  var _MATCH_DEFAULT_MEMBERSHIP = "MATCH_DEFAULT_MEMBERSHIP";
  var _DOES_NOT_MATCH_DEFAULT_MEMBERSHIP = "DOES_NOT_MATCH_DEFAULT_MEMBERSHIP";

  var buildAgent = (id, userId) => {
    return {
      'id' : id,
      'userId': userId,
      'lastName' : '',
      'firstName' : '',
      'queueMembers' : [],
      'defaultMembership': [],
      'state' : 'AgentLoggedOut',
      'status' : '-',
      'stats' : {}
    };
  };
  var newAgent = (id, userId) => {
    var agent = buildAgent(id, userId);
    agents.push(agent);
    return(agent);
  };
  var newAgentStatesWaitingForConfig = function(id, userId) {    
    var agent = {};
    if(typeof(id) !== "undefined" && id !== null) {
      agent.id = id;
    }
    if(typeof(userId) !== "undefined" && userId !== null) {
      agent.userId = userId;
    }
    agentStatesWatingForConfig.push(agent);
    return(agent);
  };

  var updateAgent = (agentUpdate,agent) => {
    this.mergeAgentInformations(agent, agentUpdate);
    $rootScope.$broadcast('AgentConfigUpdated', agent.id);
  };

  var updateQueueMember = (queueMember) => {
    var agent = this.getAgent(queueMember.agentId) || newAgentStatesWaitingForConfig(queueMember.agentId);
    if (queueMember.penalty >= 0) {
      if(typeof(agent.queueMembers) === "undefined") {
        agent.queueMembers =  [];
      }
      agent.queueMembers[queueMember.queueId] = {};
      agent.queueMembers[queueMember.queueId] = queueMember.penalty;
    }
    else {
      delete agent.queueMembers[queueMember.queueId];
    }
    updateDefaultMembershipIndicator(agent);
  };

  var updateDefaultMembership = (userId, queueMember) =>{
    var agent = this.getUser(userId) || newAgentStatesWaitingForConfig(null, userId);
    if(typeof(agent.defaultMembership) === "undefined") {
      agent.defaultMembership = [];
    }
    if (queueMember.penalty >= 0) {
      agent.defaultMembership[queueMember.queueId] = {};
      agent.defaultMembership[queueMember.queueId] = queueMember.penalty;
    }
    else {
      delete agent.defaultMembership[queueMember.queueId];
    }
    updateDefaultMembershipIndicator(agent);
  };

  var _cleanPenalties = (arr) =>{
    return _.dropRightWhile(arr, function(value) {
      if(typeof(value) === "undefined" || value < 0) {
        return true;
      }
      return false;
    });
  };
  
  var updateDefaultMembershipIndicator = (agent) => {
    if(typeof(agent.defaultMembership) !== "undefined" &&
       agent.defaultMembership.length > 0 &&
       _.some(agent.defaultMembership, (value) => { return value >=0;})) {
      var defaultMembers = _cleanPenalties(agent.defaultMembership);
      var members = _cleanPenalties(agent.queueMembers);

      if(_.isEqual(defaultMembers, members)) {
        agent.matchDefaultMembership = _MATCH_DEFAULT_MEMBERSHIP;
      } else {
        agent.matchDefaultMembership = _DOES_NOT_MATCH_DEFAULT_MEMBERSHIP;
      }
    } else {
      agent.matchDefaultMembership = _NO_DEFAULT_MEMBERSHIP;
    }
  };


  var statusActionsHas = (actions, actionName) => {
    var hasAction = false;
    angular.forEach(actions, (action) => {
      if(action.name === actionName) {
        hasAction = true;
      }
    });
    return hasAction;
  };

  var statusActionIsNotready = (actions) => {
    return statusActionsHas(actions, "queuepause_all");
  };
  var statusActionIsReady = (actions) => {
    return statusActionsHas(actions, "queueunpause_all");
  };

  this.onUserStatuses = (statuses) => {
    angular.forEach(statuses, (userStatus) => {
      userStatuses[userStatus.name] = userStatus.longName;

      if(statusActionIsNotready(userStatus.actions)) {
        notReadyStatuses.push(userStatus);
      }
      if(statusActionIsReady(userStatus.actions)) {
        readyStatuses.push(userStatus);
      }
    });
    $rootScope.$broadcast('AgentUserStatusesLoaded');
  };
  this.getNotReadyStatuses = () => {
    return notReadyStatuses;
  };
  this.getReadyStatuses = () => {
    return readyStatuses;
  };
  this.getUserStatusDisplayName = (name) => {
    return (userStatuses[name] || "");
  };
  this.getAgents = () => {
    return agents;
  };
  this.getAgentsInGroup = (idOfGroup) => {
    return agents.filter((agent) => { return agent.groupId == idOfGroup; });
  };


  this.getAgent = (agentId) => {
    for (var j = 0; j < agents.length; j++) {
      if (agents[j].id === agentId) {
        return agents[j];
      }
    }
    return null;
  };

  this.getUser = (userId) => {
    for (var j = 0; j < agents.length; j++) {
      if (agents[j].userId === userId) {
        return agents[j];
      }
    }
    return null;
  };

  this.getAgentAsync = (agentId) => {
    return $q.all([_agentListDeferred.promise, _queueMemberListDeferred.promise]).then(() =>{
      return this.getAgent(agentId);
    });
  };
  this.getAgentsAsync = () =>  {
    return $q.all([_agentListDeferred.promise, _queueMemberListDeferred.promise]).then(() =>{
      return this.getAgents();
    });
  };
  this.getAndCopyAgentStatesWaitingForConfig = (agentId, userId) => {
    var ag = buildAgent(agentId, userId);
    var found = false;
    for (var j = 0; j < agentStatesWatingForConfig.length; j++) {
      if (agentStatesWatingForConfig[j].id === agentId || agentStatesWatingForConfig[j].userId === userId) {
        found = true;
        this.mergeAgentInformations(ag, agentStatesWatingForConfig[j]);
      }
    }

    agentStatesWatingForConfig = _.filter(agentStatesWatingForConfig, (o) => {
      return !(o.id === agentId || o.userId === userId);
    });
    
    if(found) {
      agents.push(ag);
      return ag;
    } else {
      return null;
    }
  };

  this.mergeAgentInformations = (ag, src) => {
    _.forEach(src, function(value, key) {
      if (_.isArray(value)) {
        if(!ag.hasOwnProperty(key)) {
          ag[key] = [];
        }
        for(var k=0; k<value.length; k++) {
          if(value[k] !== null) {
            ag[key][k] = value[k];
          }
        }
      } else {
        ag[key] = value;
      }
    });
  };
  this.getAgentsNotInQueue = (queueId) => {
    var ags = [];
    angular.forEach(agents, (agent) => {
      if(typeof agent.queueMembers[queueId] === 'undefined') {
        ags.push(agent);
      }
    });
    return ags;
  };
  this.getAgentsInQueue = (queueId) => {    
    var ags = [];
    angular.forEach(agents, (agent) => {
      if(typeof agent.queueMembers[queueId] !== 'undefined') {
        ags.push(agent);
      }
    });
    return ags;
  };
  this._getAgentsInQueues = (filter) => {
    var agentsInQueues = [];

    var queues = filter();

    angular.forEach(queues, (queue) => {
      angular.forEach(this.getAgentsInQueue(queue.id), (agent) =>{
        if (agentsInQueues.indexOf(agent) < 0) agentsInQueues.push(agent);
      });
    });
    return agentsInQueues;
  };
  this.getAgentsInQueues = (queueName) => {
    var qFilter = () =>  {
      var queues = XucQueue.getQueues();
      queues = $filter('filter')(queues, { name :queueName});
      return queues;
    };
    return this._getAgentsInQueues(qFilter);
  };

  this.getAgentsInQueueByIds = (ids) => {

    var qFilter = () =>  {
      return XucQueue.getQueueByIds(ids);
    };
    return this._getAgentsInQueues(qFilter);
  };

  this.onAgentList  = (agentList) => {
    for (var i = 0; i < agentList.length; i++) {
      this.onAgentConfig(agentList[i]);
    }
    angular.forEach(agents, (agent, index) => {
      if(agent.firstName === '') {
        agents.splice(index,1);
      }
    });
    $rootScope.$broadcast('AgentsLoaded');
    _agentListDeferred.resolve();
    Cti.subscribeToAgentStats();
  };
  this.onAgentConfig = (agentConfig) => {
    var agent = this.getAgent(agentConfig.id) || (this.getAndCopyAgentStatesWaitingForConfig(agentConfig.id, agentConfig.userId) || newAgent(agentConfig.id, agentConfig.userId));
    updateAgent(agentConfig,agent);
  };
  this.buildMoment = (since) => {
    var start = moment().add(-(since), 'seconds');
    return {
      'momentStart' : start.toDate(),
      'timeInState' : moment().countdown(start.toDate())
    };
  };

  var _buildState = (agentState) => {
    var state = agentState.name;
    state = agentState.acd ? 'AgentOnAcdCall': agentState.name;
    if (agentState.direction === 'Incoming' && !agentState.acd) {
      state = 'AgentOnIncomingCall';
    }
    if (agentState.direction === 'Outgoing') {
      state = 'AgentOnOutgoingCall';
    }
    return state;
  };

  var _isANotReadyStatus = (statusLongName) => {
    var found = false;
    angular.forEach(notReadyStatuses, (status) => {
      if (status.longName === statusLongName) found = true;
    });
    return found;
  };
  var _buildStateName = (agent) => {
    if (agent.state === 'AgentOnPause' && agent.status !== '') {
      if (_isANotReadyStatus(agent.status))
        return agent.status;
      else return agent.state;
    }
    else {
      return agent.state;
    }
  };
  this.onAgentState = (agentState) => {

    var agent = this.getAgent(agentState.agentId) || newAgentStatesWaitingForConfig(agentState.agentId);
    agent.status = userStatuses[agentState.cause] || '';
    agent.state = _buildState(agentState);
    agent.stateName = _buildStateName(agent);
    agent.phoneNb =  agentState.phoneNb || '';
    agent.phoneNb = (agent.phoneNb === 'null' ? '' : agent.phoneNb);
    agent.queues = agentState.queues;
    if (agentState.name === "AgentLoggedOut") {
      agent.timeInState = undefined;
      agent.momentStart = undefined;
    }
    else {
      var mt = this.buildMoment(agentState.since);
      agent.momentStart = mt.momentStart;
      agent.timeInState = mt.timeInState;
    }
    $rootScope.$broadcast('AgentStateUpdated',agent.id);
  };

  this.onQueueMember = (queueMember) => {
    updateQueueMember(queueMember);
    $rootScope.$broadcast('QueueMemberUpdated', queueMember.queueId);
  };

  this.onQueueMemberList = (queueMemberList) => {
    var queueIds = [];
    for (var i = 0; i < queueMemberList.length; i++) {
      updateQueueMember(queueMemberList[i]);
      queueIds[queueMemberList[i].queueId] = true;
    }
    angular.forEach(queueIds, (done, queueId) => {
      $rootScope.$broadcast('QueueMemberUpdated', queueId);
    });

    _queueMemberListDeferred.resolve();
  };

  this.onDefaultMember = (member) => {
    var queueIds = [];
    var agent = this.getUser(member.userId) || newAgentStatesWaitingForConfig(null, member.userId);
    _.forEach(agent.defaultMembership, (value, key) => {
      if(typeof(value) !== "undefined"  && !_.some(member.membership, {queueId: key})) {
        member.membership.push({queueId: key, penalty: -1});
      }
    });

    for(var j = 0; j<member.membership.length; j++) {
      updateDefaultMembership(member.userId, member.membership[j]);
      queueIds[member.membership[j].queueId] = true;
    }
    angular.forEach(queueIds, (done, queueId) => {
      $rootScope.$broadcast('DefaultMembershipUpdated', queueId);
    });
  };

  this.onDefaultMemberList = (msg) => {
    var members = msg.memberships;
    var queueIds = [];
    for (var i = 0; i < members.length; i++) {
      var m = members[i];
      for(var j = 0; j<m.membership.length; j++) {
        updateDefaultMembership(m.userId, m.membership[j]);
        queueIds[m.membership[j].queueId] = true;
      }
    }

    angular.forEach(queueIds, (done, queueId) => {
      $rootScope.$broadcast('DefaultMembershipUpdated', queueId);
    });
  };

  // timeout
  this.updateAgentStates = () =>  {
    var nowMt = moment();
    angular.forEach(agents, (value, key) => {
      if (agents[key].state !== "AgentLoggedOut") {
        agents[key].timeInState = nowMt.countdown(agents[key].momentStart);
      }
    });
    $timeout(this.updateAgentStates.bind(this), agentStateTimer * 1000, false);
  };
  $timeout(this.updateAgentStates.bind(this), 1000, false);

  this.onAgentStatistics = (agentStatistics) => {
    var agent = this.getAgent(agentStatistics.id);
    if(agent !== null) {
      angular.forEach(agentStatistics.statistics, (statistic) => {
        agent.stats[statistic.name] = statistic.value;
      });
      $rootScope.$broadcast('AgentStatisticsUpdated');
    }
  };

  this.start = () =>  {
    if(_started) {
      return;
    }
    $log.info("Starting XucAgent service");
    _started = true;
    Cti.getList("agent");
    Cti.getList("queuemember");
    Cti.getList("basequeuemember");
    Cti.getAgentStates();
    Cti.subscribeToAgentEvents();
    XucLink.whenLoggedOut().then(this.uninit.bind(this));
  };

  this.uninit = () =>  {
    $log.info("Unloading XucAgent servoce");
    _started = false;
    agents = [];
    agentStatesWatingForConfig = [];
    userStatuses = [];
    agentStateTimer = 3;
    notReadyStatuses = [];
    readyStatuses = [];
    _agentListDeferred = $q.defer();
    _queueMemberListDeferred = $q.defer();
    XucLink.whenLogged().then(this.start.bind(this));
  };

  this.canLogIn = (agentId) => {
    return (this.getAgent(agentId).state === 'AgentLoggedOut');
  };

  this.login = (agentId) => {
    Cti.loginAgent(this.getAgent(agentId).phoneNb,agentId);
  };

  this.canLogOut = (agentId) => {
    return (this.getAgent(agentId).state === 'AgentReady' || this.getAgent(agentId).state === 'AgentOnPause');
  };
  this.logout = (agentId) => {
    Cti.logoutAgent(agentId);
  };
  this.canPause = (agentId) => {
    return (this.getAgent(agentId).state === 'AgentReady' || this.getAgent(agentId).state === 'AgentOnWrapup');
  };
  this.canBeCalled = (agentId) => {
    var agt = this.getAgent(agentId);
    var isInCallableState = [ 'AgentReady', 'AgentOnPause' ].indexOf(agt.state) > -1;

    return (isInCallableState &&
            angular.isString(agt.phoneNb) &&
            agt.phoneNb.length > 0);
  };
  this.callAgent = (agentId) => {
    Cti.dial(this.getAgent(agentId).phoneNb);      
  };
  this.pause = (agentId) => {
    Cti.pauseAgent(agentId);
  };
  this.canUnPause = (agentId) => {
    return (this.getAgent(agentId).state === 'AgentOnPause' || this.getAgent(agentId).state === 'AgentOnWrapup');
  };
  this.unpause = (agentId) => {
    Cti.unpauseAgent(agentId);
  };
  this.canListen = (agentId) => {
    var listenStates = ['AgentOnAcdCall','AgentOnCall','AgentOnIncomingCall','AgentOnOutgoingCall','AgentDialing','AgentRinging'];

    return (listenStates.indexOf(this.getAgent(agentId).state) > -1);
  };
  this.listen = (agentId) => {
    Cti.listenAgent(agentId);
  };
  this.updateQueues = (agentId, updatedQueues) => {
    var agent = this.getAgent(agentId);
    var updateQueue = (queueToUpdate) => {
      if(queueToUpdate.penalty !== agent.queueMembers[queueToUpdate.id]) {
        Cti.setAgentQueue(agentId,queueToUpdate.id,queueToUpdate.penalty);
      }
    };
    var updateOrRemoveQueue = (queueId) => {
      for (var j = 0; j < updatedQueues.length; j++) {
        if (updatedQueues[j].id === queueId) {
          updateQueue(updatedQueues[j]);
          updatedQueues.splice(j,1);
          return;
        }
      }
      Cti.removeAgentFromQueue(agentId,queueId);
    };
    var addAgentToQueues = () => {
      for (var j = 0; j < updatedQueues.length; j++) {
        if (typeof agent.queueMembers[updatedQueues[j].id] === 'undefined')
          Cti.setAgentQueue(agentId,updatedQueues[j].id,updatedQueues[j].penalty);
      }
    };
    angular.forEach(agent.queueMembers, (penalty, queueId) =>{
      if(typeof(penalty) !== "undefined") {
        updateOrRemoveQueue(queueId);
      }
    });
    addAgentToQueues();

  };

  this.addAgentsToQueues = (agents, queueDefs) => {
    var _setAgentQueues = (agent) => {
      _.map(queueDefs, (queueDef) => {
        Cti.setAgentQueue(agent.id, queueDef.queue.id, queueDef.penalty);
      });
    };
    _.map(agents, _setAgentQueues);
  };
  this.removeAgentsFromQueues = (agents, queues) => {
    var _removeAgentQueues = (agent) => {
      _.map(queues, (queue) => {
        Cti.removeAgentFromQueue(agent.id, queue.id);
      });
    };
    _.map(agents, _removeAgentQueues);
  };

  XucLink.whenLogged().then(() => {
    this.start();
  });

  Cti.setHandler(Cti.MessageType.AGENTCONFIG, this.onAgentConfig.bind(this));
  Cti.setHandler(Cti.MessageType.AGENTLIST, this.onAgentList.bind(this));
  Cti.setHandler(Cti.MessageType.USERSTATUSES, this.onUserStatuses.bind(this));
  Cti.setHandler(Cti.MessageType.AGENTSTATEEVENT, this.onAgentState.bind(this));
  Cti.setHandler(Cti.MessageType.AGENTSTATISTICS, this.onAgentStatistics.bind(this));
  Cti.setHandler(Cti.MessageType.QUEUEMEMBER, this.onQueueMember.bind(this));
  Cti.setHandler(Cti.MessageType.QUEUEMEMBERLIST, this.onQueueMemberList.bind(this));
  if(typeof Membership !== 'undefined') {
    Cti.setHandler(Membership.MessageType.USERQUEUEDEFAULTMEMBERSHIP, this.onDefaultMember.bind(this));
    Cti.setHandler(Membership.MessageType.USERSQUEUEDEFAULTMEMBERSHIP, this.onDefaultMemberList.bind(this));
  }

  return this;
}
