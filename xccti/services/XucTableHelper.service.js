import _ from 'lodash';

export default function XucTableHelper($filter) {

  /**
   * Create a custom ngTable settings parameter with the given data
   * @param data the dataset or a function returning a dataset
   * @returns {...} an ngTable settings
   */
  var _createSettings = function(data) {
    function _getRawData() {
      if(_.isFunction(data)) return data();
      else return data;
    }

    return {
      total: _getRawData().length, // length of data
      counts:[],
      getData: function(params) {
        var orderedData = params.sorting() ?
          $filter('orderBy')(_getRawData(), params.orderBy()) :
          _getRawData();
        params.total(orderedData.length);
        _calculatePage(params);
        return orderedData.slice((params.page() - 1) * params.count(), params.page() * params.count());
      }
    };
  };

  var _calculatePage = function(params) {
    if (params.total() <= (params.page() - 1)  * params.count()) {
      var setPage = (params.page()-1) > 0 && (params.page()-1) || 1;
      params.page(setPage);
    }
  };
  return {
    createSettings: _createSettings,
    // Default number of table rows in a popup
    POPUP_TABLE_ROWS: 10
  };
}
