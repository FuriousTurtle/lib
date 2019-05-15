export default function XucCallNotification($log, $rootScope, XucPhoneEventListener, webNotification, $translate, electronWrapper) {

  $log.debug('XucCallNotification service initialization');
  var _notifications = [];

  var _isNotificationEnabled = false;

  var _onNotificationClick = function() {
    try {
      electronWrapper.setFocus();
      window.focus();
      _autoClose();
    } catch(ex) {
      $log.debug("Ignoring error when focusing window", ex);
    }
  };
  
  var _onRinging = function(event) {
    $log.debug("_onRinging ", event);
    if(_isNotificationEnabled) {
      var options = {
        body: event.otherDName ? event.otherDName + ' ' + event.otherDN : event.otherDN,
        icon: "/assets/images/incoming_call.ico",
        onClick: _onNotificationClick,
        autoClose: 0
      };
      webNotification.showNotification($translate.instant('NotificationTitle'), options, _onNotificationShown);
    }
  };

  var _onNotificationShown = function(error, hide) {
    if(error) {
      $log.debug('XucCallNotification error: ' + error.message);
    } else {
      _notifications.push(hide);
    }
  };

  var _autoClose = function() {
    angular.forEach(_notifications, function(hide) { hide(); });
    _notifications.length = 0;
  };

  var _enableNotification = function() {
    _isNotificationEnabled = true;
    webNotification.allowRequest = false;
    if(!webNotification.permissionGranted) {
      window.Notification.requestPermission();
    }
  };

  var _disableNotification = function() {
    _isNotificationEnabled = false;
    _autoClose();
  };

  var _getNotificationEnabled = function() { return _isNotificationEnabled; };

  XucPhoneEventListener.addRingingHandler($rootScope, _onRinging);
  XucPhoneEventListener.addEstablishedHandler($rootScope, _autoClose);
  XucPhoneEventListener.addReleasedHandler($rootScope, _autoClose);

  return {
    enableNotification: _enableNotification,
    disableNotification: _disableNotification,
    isNotificationEnabled: _getNotificationEnabled
  };
}
