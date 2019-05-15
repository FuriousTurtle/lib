var ctiModule = angular.module('xcCti');

ctiModule.factory('CtiProxy', function($rootScope, webRtcAudio, XucPhoneEventListener, XucPhoneState, $translate, $window, $log, remoteConfiguration) {

  var isUsingWebRtc = function() { return ctiAdapter === webRtcAdapter; };
  var isUsingCti = function() { return ctiAdapter === Cti; };
  var UnknownDeviceVendor = "unknown";
  var deviceVendor = UnknownDeviceVendor;
  var getDeviceVendor = function() { return deviceVendor; };
  var isConferenceCapable = function() { return !isUsingWebRtc() && getDeviceVendor() === 'Snom'; };

  var ctiAdapter = Cti;
  var maxAnswerableCalls = 1;
  var asteriskWsPort = 5039;
  var httpsPort = 443;
  var protocol = $window.location.protocol;
  var disableWebRtc = false;

  var FatalError = "fatalError";
  var FatalErrors = {
    WEBRTC_REQUIRES_SSL: 'WEBRTC_REQUIRES_SSL',
    UNABLE_TO_START_WEBRTC: 'UNABLE_TO_START_WEBRTC',
    UNABLE_TO_REGISTER_WEBRTC: 'UNABLE_TO_REGISTER_WEBRTC',
    MISSING_LINE: 'MISSING_LINE'
  };

  var fatalError = function(errorCode) {
    stopUsingWebRtc();
    $rootScope.$broadcast(FatalError, errorCode);
  };

  var useWebRTC = function() {
    ctiAdapter = webRtcAdapter;
    maxAnswerableCalls = 2;
    webRtcAudio.enable();
  };

  var useCti = function() {
    ctiAdapter = Cti;
    maxAnswerableCalls = 1;
  };

  var processLineCfg = function(lineCfg) {
    $log.debug('LineCfg: ', lineCfg);
    deviceVendor = UnknownDeviceVendor;
    disableWebRtc.then(function(disableWebRtc) {
      if (lineCfg.webRtc && !lineCfg.hasDevice && !disableWebRtc) {
        $log.info("WebRTC line without device - CtiProxy will use WebRTC");
        var usingSsl = protocol === 'https:';
        var hostname = $window.location.hostname;

        if (!usingSsl && hostname != '127.0.0.1' && hostname != 'localhost') {
          $log.warn('Cannot use WebRtc without SSL - aborting WebRtc initialization');
          fatalError(FatalErrors.WEBRTC_REQUIRES_SSL);
          stopUsingWebRtc();
        } else {
          useWebRTC();
          var actualPort = $window.location.port === '' ? httpsPort : $window.location.port;
          var port = usingSsl ? actualPort : asteriskWsPort;
          var address = usingSsl ? hostname : lineCfg.xivoIp;
          xc_webrtc.initByLineConfig(lineCfg, 'XiVO Assistant', usingSsl, port, 'audio_remote', address);
        }
      } else {
        if (lineCfg.id === '-') {
          $log.warn('User without line, logging out');
          fatalError(FatalErrors.MISSING_LINE);
        }
        else {
          if(disableWebRtc) {
            $log.info("WebRTC manually disabled - CtiProxy will use standard Cti");
          }
          else {
            if(lineCfg.hasDevice && lineCfg.webRtc) {
              $log.info("Line has both, device and webrtc, using device");
            } else {
              $log.info("Line with device - CtiProxy will use standard Cti");
            }
          }
          if(typeof(lineCfg.vendor) !== "undefined") {
            deviceVendor = lineCfg.vendor;
          }
        }
        stopUsingWebRtc();
      }
    });
  };

  var notImplemented = function() {
    var msg = 'CtiProxy: method not implemented: ' + arguments.callee.caller.name;
    $log.error(msg);
    throw new Error(msg);
  };

  var webRtcAdapter = {
    dial : function(destination, variables, video) {
      if (variables) { $log.warn("Dial using webRTC does not propagate variables"); }
      xc_webrtc.dial(destination, video);
    },
    hangup : function() { Cti.hangup(); },
    answer : function() { xc_webrtc.answer(); },
    attendedTransfer: function(destination) {xc_webrtc.attendedTransfer(destination); },
    hold : function() { xc_webrtc.hold(); },
    conference : function() { notImplemented(); },
    conferenceMuteMe: function(conferenceNumber) { Cti.conferenceMuteMe(conferenceNumber); },
    conferenceUnmuteMe: function(conferenceNumber) { Cti.conferenceUnmuteMe(conferenceNumber); },
    conferenceMuteAll: function(conferenceNumber) { Cti.conferenceMuteAll(conferenceNumber); },
    conferenceUnmuteAll: function(conferenceNumber) { Cti.conferenceUnmuteAll(conferenceNumber); },
    conferenceMute: function(conferenceNumber, index) { Cti.conferenceMute(conferenceNumber, index); },
    conferenceUnmute: function(conferenceNumber, index) { Cti.conferenceUnmute(conferenceNumber, index); },
    conferenceKick: function(conferenceNumber, index) { Cti.conferenceKick(conferenceNumber, index); },
  };

  var registerWebRtcHandlers = function() {
    var webRtcGeneralEventHandler = function(event) {
      $log.log('webRtcGeneralEventHandler' + JSON.stringify(event));
      if (event.type === xc_webrtc.General.FAILED) {
        fatalError(FatalErrors.UNABLE_TO_START_WEBRTC);
      }
    };
    var webRtcRegistrationEventHandler = function(event) {
      $log.log('webRtcRegistrationEventHandler' + JSON.stringify(event));
      if (event.type === xc_webrtc.Registration.UNREGISTERED) {
        fatalError(FatalErrors.UNABLE_TO_REGISTER_WEBRTC);
      }
    };
    var webRtcIncomingEventHandler = function(event) {
      $log.log('webRtcIncomingEventHandler' + JSON.stringify(event));
    };
    var webRtcOutgoingEventHandler = function(event) {
      $log.log('webRtcOutgoingEventHandler' + JSON.stringify(event));
    };

    xc_webrtc.clearHandlers();
    xc_webrtc.setHandler(xc_webrtc.MessageType.GENERAL, webRtcGeneralEventHandler);
    xc_webrtc.setHandler(xc_webrtc.MessageType.REGISTRATION, webRtcRegistrationEventHandler);
    xc_webrtc.setHandler(xc_webrtc.MessageType.INCOMING, webRtcIncomingEventHandler);
    xc_webrtc.setHandler(xc_webrtc.MessageType.OUTGOING, webRtcOutgoingEventHandler);
    xc_webrtc.disableICE();
  };

  var onCtiLoggedOn = function() {
    try {
      Cti.unsetHandler(Cti.MessageType.LOGGEDON, CtiProxy.onCtiLoggedOn);
      registerWebRtcHandlers();
      Cti.setHandler(Cti.MessageType.LINECONFIG, processLineCfg);
      Cti.getConfig('line');
    } catch(e) {
      $log.error("ctiProxy error", e);
    }
  };

  var stopUsingWebRtc = function() {
    if (isUsingWebRtc()) {
      xc_webrtc.stop();
    }
    webRtcAudio.disable();
    useCti();
  };

  var updateLine = function() {
    Cti.getConfig('line');
  };

  var getMaxAnswerableCalls = function() {
    return maxAnswerableCalls;
  };

  var CtiProxy = {
    dial : function(destination, variables, video) {
      if (!isUsingWebRtc() && video) { $log.warn("Dial using Cti does not support video"); }
      if (!isUsingWebRtc() || XucPhoneState.getCalls().length < 2) {
        ctiAdapter.dial(destination, variables, (typeof video === 'undefined' || video === null) ? false : video);
      }
    },
    hangup : function() { ctiAdapter.hangup(); },
    answer : function() { ctiAdapter.answer(); },
    hold : function() { ctiAdapter.hold(); },
    conference : function() { ctiAdapter.conference(); },
    conferenceMuteMe: function(conferenceNumber) { ctiAdapter.conferenceMuteMe(conferenceNumber); },
    conferenceUnmuteMe: function(conferenceNumber) { ctiAdapter.conferenceUnmuteMe(conferenceNumber); },
    conferenceMuteAll: function(conferenceNumber) { ctiAdapter.conferenceMuteAll(conferenceNumber); },
    conferenceUnmuteAll: function(conferenceNumber) { ctiAdapter.conferenceUnmuteAll(conferenceNumber); },
    conferenceMute: function(conferenceNumber, index) { ctiAdapter.conferenceMute(conferenceNumber, index); },
    conferenceUnmute: function(conferenceNumber, index) { ctiAdapter.conferenceUnmute(conferenceNumber, index); },
    conferenceKick: function(conferenceNumber, index) { ctiAdapter.conferenceKick(conferenceNumber, index); },
    attendedTransfer : function(destination) { ctiAdapter.attendedTransfer(destination); },
    directTransfer : function(destination) { Cti.directTransfer(destination); },
    completeTransfer : function() { Cti.completeTransfer(); },
    cancelTransfer : function() { Cti.cancelTransfer(); },

    dtmf : function(digit) {
      if (isUsingWebRtc()) {
        xc_webrtc.dtmf(digit);
      } else if (isUsingCti()) {
        $log.warn("CtiProxy is using standard Cti - DTMF sending is not supported");
      } else {
        $log.warn("CtiProxy is not initialized");
      }
    },

    isUsingWebRtc: isUsingWebRtc,
    isUsingCti: isUsingCti,
    stopUsingWebRtc: stopUsingWebRtc,
    getDeviceVendor: getDeviceVendor,
    getMaxAnswerableCalls: getMaxAnswerableCalls,
    isConferenceCapable: isConferenceCapable,

    UnknownDeviceVendor: UnknownDeviceVendor,
    FatalError: FatalError,
    FatalErrors: FatalErrors,

    updateLine: updateLine,

    _testProcessLineCfg: processLineCfg,
    _setProtocolForTest: function(p) { protocol = p; }
  };

  var init = function() {
    useCti();
    disableWebRtc =remoteConfiguration.getBooleanOrElse("disableWebRtc", false);
    $rootScope.$on('ctiLoggedOn', onCtiLoggedOn);
  };
  init();

  return CtiProxy;
});
