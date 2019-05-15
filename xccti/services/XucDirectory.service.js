export default function XucDirectory($rootScope, XucPhoneHintService, $log) {
  var searchResult = [];
  var favorites = [];
  var headers = [];
  var searchTerm = null;
  var isSearching = false;

  var _directoryLookup = function(term) {
    searchTerm = term ? term : '';
    isSearching = true;
    Cti.directoryLookUp(searchTerm);
  };

  var _getSearchTerm = function() {
    return searchTerm;
  };

  var _isSearching = function() {
    return isSearching;
  };

  var _onSearchResult = function(result) {
    searchResult = angular.copy(result.entries);
    isSearching = false;
    _setHeaders(result);
    $rootScope.$broadcast('searchResultUpdated');
  };

  var _onFavorites = function(newFavorites) {
    searchResult = [];
    favorites = angular.copy(newFavorites.entries);
    _setHeaders(newFavorites);
    $rootScope.$broadcast('favoritesUpdated');
  };

  var _setHeaders = function(result) {
    headers = angular.copy(result.headers);
    if(headers.indexOf("Favoris") != -1) {
      headers.splice(-3, 2);
    }
  };

  var _onFavoriteUpdated = function(update) {
    if (update.action === "Removed" || update.action === "Added") {
      searchResult.forEach(function (elem) {
        if (elem.contact_id == update.contact_id && elem.source == update.source) {
          elem.favorite = ! elem.favorite;
        }
      });
    }
    else {
      $log.log("SERVER ERROR: Favorite update failed: ", update);
    }
    _updateFavorites(update);
    $rootScope.$broadcast('searchResultUpdated');
  };

  var _updateFavorites = function(update) {
    if (update.action === "Removed") {
      var result = _find(favorites, update);
      if (result.index >= 0) {
        favorites.splice(result.index, 1);
      }
    }
    else if (update.action == "Added") {
      var newFavorite = _find(searchResult, update);
      if (newFavorite) {
        favorites.push(newFavorite.elem);
      }
    }
    $rootScope.$broadcast('favoritesUpdated');
  };

  var _find = function(contacts, update) {
    var result;
    contacts.forEach(function(elem, i) {
      if (elem.contact_id === update.contact_id && elem.source === update.source) {
        result = {'elem': elem, 'index': i};
      }
    });
    return result;
  };

  var _getSearchResult = function() {
    return searchResult;
  };

  var _getFavorites = function() {
    return favorites;
  };

  var _clearResults = function() {
    favorites = [];
    searchResult = [];
    searchTerm = null;
    isSearching = false;
    $rootScope.$broadcast('searchResultUpdated');
  };

  var _getHeaders = function() {
    return headers;
  };

  var _onPhoneHint = function(phoneHint) {
    var source = null;
    var sourceEvent = "";
    if(searchResult.length > 0) {
      source = searchResult;
      sourceEvent = 'searchResultUpdated';
    } else if(favorites.length > 0) {
      source = favorites;
      sourceEvent = 'favoritesUpdated';
    } else {
      return;
    }

    var matchFound = false;
    angular.forEach(source, function(contact) {
      if(angular.isDefined(contact) &&
         angular.isArray(contact.entry) &&
         contact.entry[1] === phoneHint.number)
      {
        contact.status = phoneHint.status;
        matchFound = true;
      }
    });


    if(matchFound) {
      $rootScope.$broadcast(sourceEvent);
    }
  };

  Cti.setHandler(Cti.MessageType.DIRECTORYRESULT, _onSearchResult);
  Cti.setHandler(Cti.MessageType.FAVORITES, _onFavorites);
  Cti.setHandler(Cti.MessageType.FAVORITEUPDATED, _onFavoriteUpdated);

  XucPhoneHintService.addEventListener($rootScope, _onPhoneHint);

  return {
    directoryLookup: _directoryLookup,
    onSearchResult : _onSearchResult,
    onFavorites : _onFavorites,
    onFavoriteUpdated : _onFavoriteUpdated,
    getSearchResult : _getSearchResult,
    getFavorites : _getFavorites,
    clearResults: _clearResults,
    getHeaders : _getHeaders,
    getSearchTerm : _getSearchTerm,
    isSearching : _isSearching
  };
}
