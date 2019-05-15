import moment from 'moment';
import _ from 'lodash';

export default function XucPhoneState($rootScope, XucPhoneEventListener, XucLink) {
  var _STATE_DIALING = "Dialing";
  var _STATE_RINGING = "Ringing";
  var _STATE_ESTABLISHED = "Established";
  var _STATE_AVAILABLE = "Available";
  var _STATE_ONHOLD = "OnHold";
  var _STATE_INIT = "Init";

  var _CONF_JOIN = "Join";
  var _CONF_LEAVE = "Leave";
  var _CONF_UPDATE = "Update";

  var _state = _STATE_INIT;

  var _eventStates = {};
  _eventStates[XucPhoneEventListener.EVENT_DIALING] = _STATE_DIALING;
  _eventStates[XucPhoneEventListener.EVENT_RINGING] = _STATE_RINGING;
  _eventStates[XucPhoneEventListener.EVENT_ESTABLISHED] = _STATE_ESTABLISHED;
  _eventStates[XucPhoneEventListener.EVENT_RELEASED] = _STATE_AVAILABLE;
  _eventStates[XucPhoneEventListener.EVENT_ONHOLD] = _STATE_ONHOLD;

  var _calls = [];
  var _conference = {calls: [], active: false};

  var _getState = function() {
    return _state;
  };

  var _getCalls = function() {
    return _calls;
  };

  var _isInCall = function() {
    return _calls.length !== 0;
  };

  var _getConference = function() {
    return _conference;
  };

  var _dial = function(number) {
    if(_calls.length === 0) {
      Cti.dial(number);
    } else {
      Cti.attendedTransfer(number);
    }
  };

  var _isPhoneAvailable = function(status) {
    return status === _STATE_AVAILABLE;
  };

  var _isPhoneOffHook = function(status) {
    return status === _STATE_ONHOLD ||
      status === _STATE_DIALING ||
      status === _STATE_ESTABLISHED;
  };

  var _isPhoneRinging = function(status) {
    return status === _STATE_RINGING;
  };

  var _findLineIndex = function(_calls, value) {
    return _.findIndex(_calls, function(o) { return o.linkedId === value; });
  };

  var _unregisterOnPhone;
  var _unregisterOnCurrentCallPhone;

  var _onPhoneEvent = function(event) {
    var lineIndex = _findLineIndex(_calls, event.linkedId);
    if(lineIndex < 0 && event.eventType === XucPhoneEventListener.EVENT_RELEASED) {
      lineIndex = _findLineIndex(_calls, event.uniqueId);
    }
    if (lineIndex < 0) {
      lineIndex = _calls.length;
      _calls[lineIndex] = { linkedId: event.linkedId};
    }

    _calls[lineIndex].state = _eventToState(event.eventType);
    _calls[lineIndex].uniqueId = event.uniqueId;
    _calls[lineIndex].DN = event.DN;
    _calls[lineIndex].direction = event.callDirection;
    _calls[lineIndex].acd = event.queueName ? true : false;
    _calls[lineIndex].mediaType = event.callType;

    if(typeof(event.otherDN) !== "undefined" && event.otherDN !== "") {
      _calls[lineIndex].otherDN = event.otherDN;
    }
    if(typeof(event.otherDName) !== "undefined" && event.otherDName !== "") {
      _calls[lineIndex].otherDName = event.otherDName;
    }
    if(typeof(event.queueName) !== "undefined" && event.queueName !== "") {
      _calls[lineIndex].queueName = event.queueName;
    }

    _calls[lineIndex].userData = event.userData;
    if(typeof(_calls[lineIndex].startTime) === "undefined" && event.eventType === XucPhoneEventListener.EVENT_ESTABLISHED) {
      _calls[lineIndex].startTime = Date.now();
    }

    if(event.eventType === XucPhoneEventListener.EVENT_RELEASED) {
      _.remove(_calls, function(call) {
        return call.uniqueId === event.uniqueId || call.linkedId === event.linkedId;
      });
    }

    if(_calls.length > 1 && _.every(_calls, {state: _STATE_ESTABLISHED})) {
      if(!_conference.active) {
        _conference.startTime = Date.now();
        _conference.active = true;
      }
      _.each(_calls, function(call) {
        if(!_.find(_conference.calls, {uniqueId: call.uniqueId})) {
          _conference.calls.push(call);
        }
      });
    } else {
      _conference.active = false;
      _conference.calls.length = 0;
    }

    _state = _eventToState(event.eventType);
    $rootScope.$broadcast('phoneStateUpdated', _state);
  };

  var _onCurrentCallsPhoneEvents = function(events) {
    angular.forEach(events, function(event) {
      _onPhoneEvent(event);
    });
  };

  var _eventToState = function(state) {
    if(typeof(_eventStates[state]) !== "undefined") {
      return _eventStates[state];
    } else {
      return null;
    }
  };

  var _onCtiConferenceEvent = function(event) {
    var lineIndex = _.findIndex(_calls, function(o) { return o.uniqueId === event.uniqueId; });

    if (lineIndex >= 0) {
      if(event.eventType === _CONF_LEAVE) {
        delete _calls[lineIndex].conference;
      } else {
        var participants = _.map(event.participants, function(item) {
          item.startTime = moment().add(-(item.since), 'seconds').toDate();
          return item;
        });
        var isMeAndOrganizer = _.filter(participants, {'isMe': true, 'role': 'Organizer'}).length > 0;
        
        _calls[lineIndex].conference = {
          conferenceName: event.conferenceName,
          conferenceNumber: event.conferenceNumber,
          participants: participants,
          since: event.since,
          currentUserRole: isMeAndOrganizer ? 'Organizer':'User',
          startTime: moment().add(-(event.since), 'seconds').toDate()
        };
      }
    }
  };

  var _addConferenceParticipant = function(lineIndex, event) {
    var cleanedEvent = _.omit(event, ['eventType', 'uniqueId', 'phoneNumber']);
    var newParticipant = { startTime: moment().add(-(event.since), 'seconds').toDate() };
    _.merge(newParticipant, cleanedEvent);
    _calls[lineIndex].conference.participants.push(newParticipant);
    if(_calls[lineIndex].conference.currentUserRole != 'Organizer' &&
       newParticipant.isMe &&
       newParticipant.role == 'Organizer') {
      _calls[lineIndex].conference.currentUserRole = 'Organizer';
    }
  };

  var _removeConferenceParticipant = function(lineIndex, index) {
    _.remove(_calls[lineIndex].conference.participants, function(n) {
      return n.index === index;
    });
  };

  var _onCtiConferenceParticipantEvent = function(event) {
    var lineIndex = _.findIndex(_calls, function(o) { return o.uniqueId === event.uniqueId; });
    
    if (lineIndex >= 0) {
      if(event.eventType === _CONF_JOIN) {
        _addConferenceParticipant(lineIndex, event);
      } else if(event.eventType === _CONF_UPDATE) {
        _removeConferenceParticipant(lineIndex, event.index);
        _addConferenceParticipant(lineIndex, event);
      } else {
        _removeConferenceParticipant(lineIndex, event.index);
      }
    }
  };

  var _unInit = function() {
    _calls = [];
    _conference = {calls: [], active: false};
    if (typeof _unregisterOnPhone === "function") {
      _unregisterOnPhone();
      _unregisterOnPhone = undefined;
    }
    if (typeof _unregisterOnCurrentCallPhone === "function") {
      _unregisterOnCurrentCallPhone ();
      _unregisterOnCurrentCallPhone = undefined;
    }
    Cti.unsetHandler(Cti.MessageType.CONFERENCEEVENT, _onCtiConferenceEvent);
    Cti.unsetHandler(Cti.MessageType.CONFERENCEPARTICIPANTEVENT, _onCtiConferenceParticipantEvent);
    XucLink.whenLogged().then(_init);
  };

  var _init = function() {
    if (_unregisterOnPhone === undefined) {
      _unregisterOnPhone = XucPhoneEventListener.addHandlerCustom(_onPhoneEvent);
    }
    if (_unregisterOnCurrentCallPhone === undefined) {
      _unregisterOnCurrentCallPhone =
        XucPhoneEventListener.addHandlerCustom(_onCurrentCallsPhoneEvents, 'CurrentCallsEvents');
    }

    Cti.setHandler(Cti.MessageType.CONFERENCEEVENT, _onCtiConferenceEvent);
    Cti.setHandler(Cti.MessageType.CONFERENCEPARTICIPANTEVENT, _onCtiConferenceParticipantEvent);

    XucLink.whenLoggedOut().then(_unInit);
    XucPhoneEventListener.requestPhoneEventsForCurrentCalls();
  }; 

  XucLink.whenLogged().then(_init);

  return {
    STATE_DIALING: _STATE_DIALING,
    STATE_RINGING: _STATE_RINGING,
    STATE_ESTABLISHED: _STATE_ESTABLISHED,
    STATE_AVAILABLE: _STATE_AVAILABLE,
    STATE_ONHOLD: _STATE_ONHOLD,
    getState: _getState,
    getCalls: _getCalls,
    isInCall: _isInCall,
    getConference: _getConference,
    dial: _dial,
    isPhoneAvailable: _isPhoneAvailable,
    isPhoneOffHook: _isPhoneOffHook,
    isPhoneRinging: _isPhoneRinging
  };
}
