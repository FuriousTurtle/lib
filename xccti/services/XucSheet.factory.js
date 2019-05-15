import _ from 'lodash';

export default function XucSheet($log, $window, $rootScope, XucLink, XucPhoneEventListener) {
  let currentFields = [];
  let currentUser = null;
  
  const _receiveSheet = (sheet) => {
    let fields = _decodePayload(sheet.payload);
    _setAttachedData(fields);
    _openPopup(fields);
  };

  const _decodePayload = (payload) => {
    let sheetInfo = _.get(payload, 'profile.user.sheetInfo', []);
    let sheetFields = {};
    for ( let i in sheetInfo) {
      sheetFields[sheetInfo[i].name] = sheetInfo[i].value;
    }
    return sheetFields;
  };

  const _openPopup = (fields) => {
    let folderNumber = fields.folderNumber;
    let windowName = 'popupUrl';
    let popUrl = fields.popupUrl;

    if (!_.isEmpty(popUrl)) {
      popUrl = popUrl + folderNumber;
      popUrl = popUrl
        .replace('{xuc-token}', currentUser.token)
        .replace('{xuc-username}', currentUser.username);
      
      if(!_.isNil(fields.multiTab) && fields.multiTab === "true") {
        windowName = windowName + _.uniqueId();
      }
      if (!_.isEmpty(folderNumber) && folderNumber !== "-") {
        $window.open(popUrl, windowName);
      }
    }
  };

  const _getAttachedData = () => {
    return currentFields;
  };

  const _setAttachedData = (fields) => {
    currentFields = fields;
    $rootScope.$broadcast("SheetFieldUpdated", fields);
  };

  const _resetAttachedData = () => {
    currentFields = [];
  };

  const _subscribeToAttachedData = (callback) => {
    return $rootScope.$on("SheetFieldUpdated", (event, fields) => {
      $rootScope.$applyAsync(() => {
        callback(fields);
      });
    });
  };

  const _init = (user) => {
    $log.info("Starting XucSheet service");
    Cti.setHandler(Cti.MessageType.SHEET, _receiveSheet);
    XucPhoneEventListener.addReleasedHandler($rootScope, _resetAttachedData);
    XucLink.whenLoggedOut().then(_unInit);
    currentUser = user;
  };

  const _unInit = () => {
    $log.info("Unloading XucSheet service");
    _resetAttachedData();
    currentUser = null;
    XucLink.whenLogged().then(_init);
  };

  XucLink.whenLogged().then(_init);

  return {
    openPopup: _openPopup,
    decodePayload: _decodePayload,
    getAttachedData: _getAttachedData,
    subscribeToAttachedData: _subscribeToAttachedData
  };
}
