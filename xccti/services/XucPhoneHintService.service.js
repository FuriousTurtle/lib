export default function XucPhoneHintService($log, $rootScope, XucLink) {
  var _eventName = "XucPhoneHint";

  $log.debug('XucPhoneHintService service initialization');

  var _onCtiPhoneHintEvent = function(phoneEvent) {
    $rootScope.$emit(_eventName, phoneEvent);
  };

  var _addEventListener = function(scope, callback) {
    var handler = $rootScope.$on(_eventName, function(event, phoneHint) {
      if ($rootScope.$$phase) {
        callback(phoneHint);
      } else {
        scope.$apply(function () {
          callback(phoneHint);
        });
      }
    });
    scope.$on('$destroy', handler);
  };

  XucLink.whenLogged().then(function() {
    Cti.setHandler(Cti.MessageType.PHONEHINTSTATUSEVENT, _onCtiPhoneHintEvent);
  });

  return {
    addEventListener: _addEventListener
  };
}
