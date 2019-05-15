export default function XucConfRoom($rootScope) {
  var _confRooms = [];
  $rootScope.$on('ctiLoggedOn', function() {
    Cti.getConferenceRooms();
  });

  var _confRoomLoaded = function(newConfRooms) {
    _confRooms = newConfRooms;
    $rootScope.$broadcast('ConfRoomsUpdated');
  };

  var _getConferenceRooms = function() {
    return _confRooms;
  };
  Cti.setHandler(Cti.MessageType.CONFERENCES, _confRoomLoaded);

  var _requestConferenceRooms = function() {
    Cti.getConferenceRooms();
  };

  return {
    requestConferenceRooms: _requestConferenceRooms,
    getConferenceRooms : _getConferenceRooms
  };
}
