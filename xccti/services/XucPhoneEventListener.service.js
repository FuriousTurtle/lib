export default function XucPhoneEventListener($log, $rootScope, $q, XucLink) {
  var _baseEventName = 'XucPhoneEventListener.';
  var _currentCallsEventName = 'CurrentCallsEvents';
  var _EVENT_DIALING = "EventDialing";
  var _EVENT_RINGING = "EventRinging";
  var _EVENT_ESTABLISHED = "EventEstablished";
  var _EVENT_RELEASED = "EventReleased";
  var _EVENT_ONHOLD = "EventOnHold";

  var _onCtiPhoneEvent = function(phoneEvent) {
    var eventWithType = _addCallType(phoneEvent);
    $rootScope.$emit(_baseEventName + "Any", eventWithType);
    $rootScope.$emit(_baseEventName + phoneEvent.eventType, eventWithType);
  };

  var _addCallType = function(event) {
    var getType = (userData) => {
      if (!angular.isUndefined(userData) && !angular.isUndefined(userData.SIPCALLID)) {
        return xc_webrtc.getMediaTypeBySipCallId(event.userData.SIPCALLID);
      } else {
        $log.warn('Unable to get SIP Call Id from event user data, fallback to audio media type', event);
        return xc_webrtc.mediaType.AUDIO;
      }
    };
    var type = getType(event.userData);
    event.callType = (typeof type !== undefined && type !== null) ? type : xc_webrtc.mediaType.AUDIO;
    return event;
  };

  var _onCtiCurrentCallsPhoneEvents = function(currentCallsPhoneEvents) {
    $rootScope.$emit(_baseEventName + _currentCallsEventName, currentCallsPhoneEvents.events);
  };

  /**
   * Add phone event handler unregistered on scope destroy. The callback will be called upon each PHONEEVENT received.
   * @param scope The scope containing the callback function
   * @param callback The callback function to call upon event reception
   * @param targetEvent The event name to be notified of.
   * One of 'EventRinging', 'EventEstablished', 'EventReleased' or undefined. If undefined, all events are notified
   */
  var _addHandler = function(scope, callback, targetEvent) {
    var unregister = _addHandlerCustom(callback, targetEvent);
    scope.$on('$destroy', unregister);
  };

  /**
   * Add phone event handler and return unregister function. The callback will be called upon each PHONEEVENT received.
   * @param callback The callback function to call upon event reception
   * @param targetEvent The event name to be notified of.
   * @returns unregister function
   * One of 'EventRinging', 'EventEstablished', 'EventReleased' or undefined. If undefined, all events are notified
   */
  var _addHandlerCustom = function(callback, targetEvent) {
    if(typeof(targetEvent) === "undefined") {
      targetEvent = "Any";
    }
    return $rootScope.$on(_baseEventName + targetEvent, function(event, phoneEvent) {
      $rootScope.$applyAsync(function () {
        callback(phoneEvent);
      });
    });
  };

  /**
   * Add dialing event handler.
   * @see _addHandler
   */
  var _addDialingHandler = function(scope, callback) { _addHandler(scope, callback, _EVENT_DIALING); };

  /**
   * Add ringing event handler.
   * @see _addHandler
   */
  var _addRingingHandler = function(scope, callback) { _addHandler(scope, callback, _EVENT_RINGING); };

  /**
   * Add established event handler.
   * @see _addHandler
   */
  var _addEstablishedHandler = function(scope, callback) { _addHandler(scope, callback, _EVENT_ESTABLISHED); };

  /**
   * Add released event handler.
   * @see _addHandler
   */
  var _addReleasedHandler = function(scope, callback) { _addHandler(scope, callback, _EVENT_RELEASED); };

  var _addCurrentCallsPhoneEventsHandler = function(scope, callback) {
    _addHandler(scope, callback, _currentCallsEventName);
  };

  var _requestPhoneEventsForCurrentCalls = function() { Cti.getCurrentCallsPhoneEvents(); };

  var _init = function() {
    $log.info("Starting XucPhoneEventListener service");
    Cti.setHandler(Cti.MessageType.PHONEEVENT, _onCtiPhoneEvent);
    Cti.setHandler(Cti.MessageType.CURRENTCALLSPHONEEVENTS, _onCtiCurrentCallsPhoneEvents);
    XucLink.whenLoggedOut().then(_unInit);
  };

  var _unInit = function () {
    $log.info("Unloading XucPhoneEventListener service");
    XucLink.whenLogged().then(_init);
  };

  XucLink.whenLogged().then(_init);

  return {
    EVENT_DIALING: _EVENT_DIALING,
    EVENT_RINGING: _EVENT_RINGING,
    EVENT_ESTABLISHED: _EVENT_ESTABLISHED,
    EVENT_RELEASED: _EVENT_RELEASED,
    EVENT_ONHOLD: _EVENT_ONHOLD,
    addHandler: _addHandler,
    addHandlerCustom: _addHandlerCustom,
    addDialingHandler: _addDialingHandler,
    addRingingHandler: _addRingingHandler,
    addEstablishedHandler: _addEstablishedHandler,
    addReleasedHandler: _addReleasedHandler,
    addCurrentCallsPhoneEventsHandler: _addCurrentCallsPhoneEventsHandler,
    requestPhoneEventsForCurrentCalls: _requestPhoneEventsForCurrentCalls
  };
}
