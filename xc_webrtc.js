xc_webrtc = function() {
  'use strict';

  var registerExp = 60;
  var regTimeoutStep = 20;
  var regMaxTimeout = 60;
  var autoAnswerHeaderName = "Alert-Info";
  var autoAnswerHeaderValue = "xivo-autoanswer";
  var debugSIPml5 = 'error';
  var debugEvent = false;
  var debugHandler = false;

  var sipStack = null;
  var sipStackStarting = false;
  var wsIp;
  var wsPort;
  var wsProto;
  var conf;
  var registerSession = null;
  var registerTimeout = 0;
  var username;
  var callSession = [];
  var remoteAudioIdRoot;
  var callConfig;
  var iceServers;

  var ctiApi = Cti;
  var sipmlApi = SIPml;

  function init(name, ssl, websocketPort, remoteAudio, ip) {
    preConfig(name, ssl, websocketPort, remoteAudio, ip);
    ctiApi.setHandler(Cti.MessageType.LINECONFIG, processLineCfg);
    ctiApi.getConfig('line');
  }

  function initByLineConfig(lineCfg, name, ssl, websocketPort, remoteAudio, ip) {
    preConfig(name, ssl, websocketPort, remoteAudio, ip);
    conf = initConf(lineCfg, username);
    startStack( conf );
  }

  function stop() {
    callSession.forEach(function(call) {
      call.session.removeEventListener('*');
    });

    callSession.size = 0;
    if (registerSession !== null) {
      registerSession.removeEventListener('*');
      registerSession = null;
    }

    if (sipStack !== null) {
      sipStack.removeEventListener('*');
      sipStack.stop();
      sipStackStarting = false;
      sipStack = null;
    }
  }

  function preConfig(name, ssl, websocketPort, remoteAudio, ip) {
    remoteAudioIdRoot = typeof remoteAudio !== 'undefined' ?  remoteAudio : "audio_remote";
    if (ip) { wsIp = ip; }
    username = name;
    wsProto = ssl ? 'wss://' : 'ws://';
    wsPort = websocketPort;
  }

  function disableICE() {
    iceServers = [];
    iceServers.toString = function() {
      return "workaround bug https://code.google.com/p/sipml5/issues/detail?id=187";
    };
    console.log("Disable ICE");
  }

  function setIceUrls(urls) {
    iceServers = urls;
    console.log("Set ICE urls: ", urls);
  }

  function processLineCfg(lineCfg) {
    ctiApi.unsetHandler(Cti.MessageType.LINECONFIG, processLineCfg);
    conf = initConf(lineCfg, username);
    startStack( conf );
  }

  function initConf(lineCfg, name) {
    if (typeof lineCfg.password !== 'string') {
      throw new Error('Unable to configure WebRTC - LineConfig does not contains password');
    }

    wsIp = typeof wsIp !== 'undefined' ? wsIp : lineCfg.xivoIp;
    return {
      sip: {
        authorizationUser : lineCfg.name,
        realm: 'xivo',
        domain: lineCfg.xivoIp,
        password : lineCfg.password,
        wsServer : wsProto + wsIp + ':' + wsPort + '/ws',
        displayName: name,
        registerExpires: registerExp,
      }
    };
  }

  function startStack(conf) {
    if (sipmlApi.isReady()) {
      if(!sipStackStarting) {
        console.info("SIPml is already initialized - recreating stack only");
        sipStackStarting = true;
        createSipStack(conf);
      }
      return;
    }
    sipStackStarting = true;
    var readyCallback = function(){
      createSipStack(conf);
    };
    var errorCallback = function(e){
      console.error('Failed to initialize the engine: ' + e.message);
    };
    setSipDebug(debugSIPml5);
    sipmlApi.init(readyCallback, errorCallback);
  }

  function setDebug(sipml5level, event, handler) {
    setSipDebug(sipml5level);
    debugEvent = event;
    debugHandler = handler;
  }

  function setSipDebug(level) {
    console.log('Setting SIPml5 debug to ', level);
    sipmlApi.setDebugLevel(level);
  }

  function createSipStack(conf) {
    sipStack = new sipmlApi.Stack({
      /*jshint camelcase: false */
      realm: conf.sip.realm,
      impi: conf.sip.authorizationUser,
      impu: 'sip:' + conf.sip.authorizationUser + '@' + conf.sip.domain,
      password: conf.sip.password,
      display_name: conf.sip.displayName,
      websocket_proxy_url: conf.sip.wsServer,
      enable_rtcweb_breaker: false,
      events_listener: { events: '*', listener: generalEventListener },
      ice_servers: iceServers,
    });
    sipStack.start();
  }

  function register() {
    if (sipStack === null) {
      console.info("sipStack is stopped, aborting registration");
      return;
    }

    registerSession = sipStack.newSession('register', {
      expires: conf.sip.registerExpires,
      /*jshint camelcase: false */
      events_listener: { events: '*', listener: registerEventListener },
    });
    registerSession.register();
  }

  function topic(id) {
    return {
      clear : function(){
        try{
          SHOTGUN.remove('xc_webrtc');
        }catch(e){}
      },
      publish : function(val){
        SHOTGUN.fire('xc_webrtc/'+id,[val]);
      },
      subscribe : function(handler){
        SHOTGUN.listen('xc_webrtc/'+id,handler);
      },
      unsubscribe : function(handler){
        SHOTGUN.remove('xc_webrtc/'+id,handler);
      }
    };
  }

  function setHandler(eventName, handler) {
    topic(eventName).subscribe(handler);
    if (debugHandler) {
      console.log("subscribing : [" + eventName + "] to " + handler);
    }
  }

  function unsetHandler(eventName, handler) {
    topic(eventName).unsubscribe(handler);
    if (debugHandler) {
      console.log("unsubscribing : [" + eventName + "] to " + handler);
    }
  }

  function clearHandlers() {
    topic().clear();
  }

  function generalEventListener(e) {
    if (debugEvent){ console.log("RE<<< ", e); }
    processGeneralEvent(e);
  }

  function registerEventListener(e) {
    if (debugEvent){ console.log("RE<<< ", e); }
    processRegisterEvent(e);
  }
  function sessionEventListener(e) {
    if (debugEvent){ console.log("RE<<< ", e); }
    processSessionEvent(e);
  }

  function publishEvent(id, event, data) {
    if (sipStack === null) {
      if (ctiApi.debugMsg){
        console.info('Event not published because there is no SIP stack:', id, event, data);
      }
      return;
    }
    try{
      topic(id).publish(createEvent(event, data));
    }catch(error){
      if (ctiApi.debugMsg){
        console.error(id,event,error);
      }
    }
  }

  function createEvent(eventType, data) {
    if (typeof data === 'undefined' || data === null) {
      return {'type': eventType};
    }
    else {
      return {'type': eventType, 'data': data};
    }
  }

  function processGeneralEvent(e) {
    switch(e.type) {
    case 'starting': {
      callSession = [];
      break;
    }
    case 'started': {
      publishEvent(xc_webrtc.MessageType.GENERAL, xc_webrtc.General.STARTED);
      console.log('Started, registering');
      register();
      break;
    }
    case 'failed_to_start': {
      publishEvent(xc_webrtc.MessageType.GENERAL, xc_webrtc.General.FAILED, {'reason': e.description});
      break;
    }
    case 'i_new_call': {
      publishEvent(xc_webrtc.MessageType.INCOMING, xc_webrtc.Incoming.SETUP, getCaller(e));
      e.newSession.addEventListener('*', sessionEventListener);
      insertSession(e, xc_webrtc.Incoming.SETUP);
      processAutoAnswer(e.o_event.o_message.ao_headers, e.newSession.getId(), getCaller(e));
      break;
    }
    }
  }

  function insertSession(event, state) {
    callSession.push({
      id: event.newSession.getId(),
      session: event.newSession,
      state: state,
      sipCallId: getSipCallId(event)
    });
  }

  function getSipCallId(event) {
    return event.o_event.o_message.o_hdr_Call_ID.s_value;
  }

  function getSessionById(id) {
    return callSession.filter(function(session) {
      return session.id === id;
    });
  }

  function getCallsInState(state) {
    return callSession.filter(function(session) {
      return session.state === state;
    });
  }

  function getConnectedCalls() {
    if (xc_webrtc.Incoming.CONNECTED === xc_webrtc.Outgoing.CONNECTED) {
      return getCallsInState(xc_webrtc.Incoming.CONNECTED);
    }
    else {
      return getCallsInState(xc_webrtc.Incoming.CONNECTED)
        .concat(getCallsInState(xc_webrtc.Outgoing.CONNECTED));
    }
  }

  function allButWithId(id) {
    return callSession.filter(function(session) {
      return session.id !== id;
    });
  }

  function allButOnHold() {
    return callSession.filter(function (session) {
      return (session.state !== xc_webrtc.Incoming.HOLD || session.state !== xc_webrtc.Outgoing.HOLD);
    });
  }

  function updateSession(sessionId, state, sipCallId) {
    var call = getSessionById(sessionId)[0];
    if (call) {
      var updatedSession = call;
      updatedSession.state = state;
      if (typeof sipCallId !== 'undefined' && sipCallId !== null) {
        updatedSession.sipCallId = sipCallId;
      }
      pushUpdatedSession(updatedSession);
    }
  }

  function pushUpdatedSession(updatedSession) {
    var index = -1;
    callSession.some(function(item, currentIndex) { if(item.id === updatedSession.id) { index = currentIndex; } });
    if (index>=0) {
      callSession.splice(index, 1);
      callSession.push(updatedSession);
    }
    else { callSession.push(updatedSession); }
  }

  function processAutoAnswer(headers, incomingSessionId, caller) {
    if(shouldAutoAnswer(headers)) {
      console.log('XiVO auto answer header found, answering the call.');
      allButWithId(incomingSessionId).forEach(function(call, index) {
        if (!call.hold) {
          call.session.hold();
        }
      });
      answer(incomingSessionId);
      publishEvent(xc_webrtc.MessageType.INCOMING, xc_webrtc.Incoming.AUTO_ANSWERED, caller);
    }
  }

  function processHangup(sessionId) {
    callSession = allButWithId(sessionId);
    removeAudioElem(sessionId);
  }

  function shouldAutoAnswer(headers) {
    function isAutoAnswerHeader(elem) {
      return elem.s_name===autoAnswerHeaderName && elem.s_value===autoAnswerHeaderValue;
    }
    return headers.some(isAutoAnswerHeader);
  }

  function processRegisterEvent(e) {
    switch(e.type) {
    case 'connected': {
      publishEvent(xc_webrtc.MessageType.REGISTRATION, xc_webrtc.Registration.REGISTERED);
      console.log("Registered");
      registerTimeout = 0;
      break;
    }
    case 'terminated': {
      publishEvent(xc_webrtc.MessageType.REGISTRATION, xc_webrtc.Registration.UNREGISTERED, {'reason': e.description});
      if(sipStack !== null) {
        retryRegister();
      }
      break;
    }
    }
  }

  function retryRegister() {
    console.log("Unregistered, will retry in " + registerTimeout + "s");
    setTimeout(
      function() {
        console.log("Retrying register request");
        register();
      },
      registerTimeout * 1000);

    if (registerTimeout <= regMaxTimeout - regTimeoutStep) {
      registerTimeout = registerTimeout + regTimeoutStep;
    }
  }

  function processSessionEvent(e) {
    switch(e.type) {
    case 'connected': {
      if (isOutgoing(e)) {
        publishEvent(xc_webrtc.MessageType.OUTGOING, xc_webrtc.Outgoing.CONNECTED, getCallee(e));
        updateSession(e.session.getId(), xc_webrtc.Outgoing.CONNECTED);
      } else {
        publishEvent(xc_webrtc.MessageType.INCOMING, xc_webrtc.Incoming.CONNECTED, getCaller(e));
        updateSession(e.session.getId(), xc_webrtc.Incoming.CONNECTED);
      }
      console.log('Connected');
      updateElements(e.session);
      break;
    }
    case 'i_ao_request':
      {
        setSipCallId(e);
        var iSipResponseCode = e.getSipResponseCode();
        if (iSipResponseCode === 180 || iSipResponseCode === 183) {
          if (isOutgoing(e)) {
            publishEvent(xc_webrtc.MessageType.OUTGOING, xc_webrtc.Outgoing.RINGING, getCallee(e));
            updateSession(e.session.getId(), xc_webrtc.Outgoing.RINGING);
          } else {
            publishEvent(xc_webrtc.MessageType.INCOMING, xc_webrtc.Incoming.RINGING, getCaller(e));
            updateSession(e.session.getId(), xc_webrtc.Incoming.RINGING);
          }
          updateElements(e.session);
          console.log('Ringing');
        }
        break;
      }
    case 'm_local_hold_ok': {
      if (isOutgoing(e)) {
        publishEvent(xc_webrtc.MessageType.OUTGOING, xc_webrtc.Outgoing.HOLD);
        updateSession(e.session.getId(), xc_webrtc.Outgoing.HOLD);
      } else {
        publishEvent(xc_webrtc.MessageType.INCOMING, xc_webrtc.Incoming.HOLD);
        updateSession(e.session.getId(), xc_webrtc.Incoming.HOLD);
      }
      console.log('Holded');
      break;
    }
    case 'm_local_resume_ok': {
      if (isOutgoing(e)) {
        publishEvent(xc_webrtc.MessageType.OUTGOING, xc_webrtc.Outgoing.RESUME);
        updateSession(e.session.getId(), xc_webrtc.Outgoing.CONNECTED);
      } else {
        publishEvent(xc_webrtc.MessageType.INCOMING, xc_webrtc.Outgoing.RESUME);
        updateSession(e.session.getId(), xc_webrtc.Incoming.CONNECTED);
      }
      console.log('Resumed');
      break;
    }
    case 'terminating':
    case 'terminated': {
      if (isOutgoing(e)) {
        publishEvent(xc_webrtc.MessageType.OUTGOING, xc_webrtc.Outgoing.TERMINATED, {"reason": e.description});
      } else {
        publishEvent(xc_webrtc.MessageType.INCOMING, xc_webrtc.Outgoing.TERMINATED, {"reason": e.description});
      }
      processHangup(e.session.getId());
      console.debug('calls after hangup: ', callSession);
      break;
    }
    }
  }

  function setSipCallId(e) {
    var call = getSessionById(e.session.getId());
    if (typeof call.sipCallId === 'undefined' || call.sipCallId === null) {
      updateSession(e.session.getId(), call.state, getSipCallId(e));
    }
  }

  function updateElements(session) {
    var video = getSessionType(session) === xc_webrtc.mediaType.AUDIOVIDEO;
    var cfg = getCallConfig(session.o_session.i_id, video);
    console.log('Update session configuration: ', cfg);
    session.setConfiguration(cfg);
  }

  function isOutgoing(e) {
    return e.o_event.o_session.o_uri_from.s_display_name === conf.sip.displayName;
  }

  function getCallee(e) {
    return {'callee': e.o_event.o_session.o_uri_to.s_user_name};
  }

  function getCaller(e) {
    return {'caller': e.o_event.o_session.o_uri_from.s_user_name};
  }

  function getParticipantsData(e) {
    return {'caller': e.o_session.o_uri_from.s_display_name,
            'callee': e.o_session.o_uri_to.s_user_name};
  }

  function dial(destination, video) {
    console.log('Dial: ', destination, ' video: ', video);
    var sessionType = (typeof video !== 'undefined' && video === true) ? 'call-audiovideo' : 'call-audio';
    var newSession = sipStack.newSession(sessionType, {});
    newSession.setConfiguration(getCallConfig(newSession.getId()));
    if (newSession.call(destination) !== 0) {
      publishEvent(xc_webrtc.MessageType.OUTGOING, xc_webrtc.Outgoing.FAILED);
      console.log('call Failed');
      return;
    }
    else {
      publishEvent(xc_webrtc.MessageType.OUTGOING, xc_webrtc.Outgoing.ESTABLISHING);
      callSession.push({id: newSession.getId(), session: newSession, hold: false});
      console.log('call Establishing');
    }
  }

  function answer(sessionId) {
    if (sessionId) {
      return answerById(sessionId);
    }
    else {
      return answerWithoutId();
    }
  }

  function answerById(sessionId) {
    var call = getSessionById(sessionId)[0];
    if (call) {
      return acceptSession(call.session);
    }
    else {
      console.warn('Call not found, unable to answer, sessionId: ', sessionId);
      return false;
    }
  }

  function answerWithoutId() {
    var ringingCall = getCallsInState(xc_webrtc.Incoming.SETUP)[0];
    if (ringingCall) {
      var establishedCalls = getConnectedCalls();
      establishedCalls.forEach(function(session,index) {
        session.session.hold();
      });
      return acceptSession(ringingCall.session);
    }
    else {
      console.error('Answering without session ID is not supported if there\'s more or less than one active session');
      return false;
    }
  }

  function acceptSession(session) {
    if (session.accept(getCallConfig(session.getId())) === 0) {
      return true;
    }
    else {
      console.error('Unable to answer session ', session);
      return false;
    }
  }

  function getCallConfig(id, video) {
    var config = {
      /*jshint camelcase: false */
      audio_remote: getAudioElem(id),
      events_listener: { events: '*', listener: sessionEventListener }
    };
    if (video) {
      /*jshint camelcase: false */
      config.video_local = document.getElementById("video-local");
      config.video_remote = document.getElementById("video-remote");
    }
    return config;
  }

  function getAudioElem(id) {
    var elemId = remoteAudioIdRoot + id;
    var elem = document.getElementById(elemId);
    if (elem !== null && typeof elem !== 'undefined') {
      return elem;
    }
    else {
      $('body').append('<audio id="' + elemId + '" autoplay="autoplay"></audio>');
      return document.getElementById(elemId);
    }
  }

  function removeAudioElem(id) {
    $('audio').remove('#' + remoteAudioIdRoot + id);
  }

  function attendedTransfer(destination) {
    var establishedCalls = getConnectedCalls();
    establishedCalls.forEach(function(call,index) {
      call.session.hold();
    });
    ctiApi.attendedTransfer(destination);
  }

  function completeTransfer() {
    ctiApi.completeTransfer();
  }

  function dtmf(digit) {
    var establishedCalls = getConnectedCalls();
    if (establishedCalls.length < 1) {
      console.warn('We need at least one established session to send DTMF - DTMF not send.');
      return false;
    }
    if (digit.length !== 1) {
      console.warn('Expecting exactly one character - DTMF not send.');
      return false;
    }
    var res = 0;
    establishedCalls.forEach(function(call, index) {
      res += call.session.dtmf(digit);
    });
    if (res !== 0) {
      console.warn('sending DTMF failed with error ' + res);
      return false;
    }
    return true;
  }

  function hold(sessionId) {
    if (sessionId) {
      return holdBySessionId(sessionId);
    }
    else {
      return holdWithouSessionId();
    }
  }

  function holdBySessionId(sessionId) {
    var call = getSessionById(sessionId)[0];
    if(call) {
      if (call.hold) {
        return deactivateHold(call.session);
      }
      else {
        return activateHold(call.session);
      }
    }
    return false;
  }

  function holdWithouSessionId() {
    if (callSession.length !== 1) {
      console.error('Hold/resume without session Id is not supported if there\'s more or less than one session');
      return false;
    }
    else {
      if (callSession[0].state === xc_webrtc.Incoming.HOLD || callSession[0].state === xc_webrtc.Outgoing.HOLD) {
        return deactivateHold(callSession[0].session);

      }
      else {
        return activateHold(callSession[0].session);
      }
    }
  }

  function activateHold(session) {
    console.log('Hold');
    return (session.hold() === 0);
  }

  function deactivateHold(session) {
    console.log('Resume');
    return (session.resume() === 0);
  }

  function getRegisterTimeoutStep() {
    return regTimeoutStep;
  }

  function injectTestDependencies(cti, sipml) {
    ctiApi = cti;
    sipmlApi = sipml;
    callSession = [];
  }

  function getMediaTypeBySipCallId(callId) {
    var index = -1;
    callSession.some(function(item, currentIndex) { if(item.sipCallId === callId) { index = currentIndex; } });
    if (index >=0) {
      return getSessionType(callSession[index].session);
    }
    else {
      return null;
    }
  }

  function getSessionType(session) {
    return session.o_session.media.e_type.s_name;
  }

  return{
    init: init,
    initByLineConfig: initByLineConfig,
    stop: stop,
    dial: dial,
    answer: answer,
    attendedTransfer: attendedTransfer,
    completeTransfer: completeTransfer,
    dtmf: dtmf,
    hold: hold,
    setHandler: setHandler,
    disableICE: disableICE,
    setIceUrls: setIceUrls,
    clearHandlers: clearHandlers,
    setDebug: setDebug,
    injectTestDependencies: injectTestDependencies,
    getRegisterTimeoutStep: getRegisterTimeoutStep,
    getMediaTypeBySipCallId: getMediaTypeBySipCallId
  };
}();

xc_webrtc.MessageType = {
  GENERAL: "general",
  OUTGOING: "outgoing",
  INCOMING: "incoming",
  REGISTRATION: "registration",
};

xc_webrtc.General = {
  STARTED: "Started",
  FAILED: "Failed",
};

xc_webrtc.Incoming = {
  SETUP: "Setup",
  RINGING: "Ringing",
  CONNECTED: "Connected",
  TERMINATED: "Terminated",
  HOLD: "Hold",
  RESUME: "Resume",
};

xc_webrtc.Outgoing = {
  ESTABLISHING: "Establishing",
  RINGING: "Ringing",
  CONNECTED: "Connected",
  TERMINATED: "Terminated",
  FAILED: "Failed",
  HOLD: "Hold",
  RESUME: "Resume",
};

xc_webrtc.Registration = {
  REGISTERED: "Registered",
  UNREGISTERED: "Unregistered",
};

xc_webrtc.mediaType = {
  AUDIO: "audio",
  AUDIOVIDEO: "audio/video",
};
