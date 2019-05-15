export default function XucVoiceMail($rootScope, XucLink) {
  var voiceMail = {};
  voiceMail.newMessages = 0;
  voiceMail.waitingMessages = 0;
  voiceMail.oldMessages = 0;


  var _onVoiceMailUpdate = function(voiceMailUpdate) {
    voiceMail = angular.copy(voiceMailUpdate);
    $rootScope.$broadcast('voicemailUpdated');
  };

  var _getVoiceMail = function() {
    return voiceMail;
  };

  var _init = function() {
    XucLink.whenLoggedOut().then(_uninit);
  };

  var _uninit = function() {
    voiceMail = {};
    voiceMail.newMessages = 0;
    voiceMail.waitingMessages = 0;
    voiceMail.oldMessages = 0;
    XucLink.whenLogged().then(_init);
  };

  XucLink.whenLogged().then(_init);

  Cti.setHandler(Cti.MessageType.VOICEMAILSTATUSUPDATE, _onVoiceMailUpdate);

  return {
    onVoiceMailUpdate : _onVoiceMailUpdate,
    getVoiceMail : _getVoiceMail
  };
}
