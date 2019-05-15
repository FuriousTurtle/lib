import _ from 'lodash';

export default class RequestQueryBuilder {

  constructor() {
    this._filters = {};
    this._offset = 0;
    this._limit = 100;
  }
  
  _filter(field, operator, val) {
    if(this._filters.hasOwnProperty(field)) {
      this._filters[field].operator = operator;
      this._filters[field].value = val + "";
    } else {
      this._filters[field] = {"field": field, "operator": operator, "value": val + ""};
    }
    return this;
  }

  sort(field, order) {
    if(this._filters.hasOwnProperty(field)) {
      this._filters[field].order = order.toUpperCase();
    } else {
      this._filters[field] = {"field": field, "order": order.toUpperCase()};
    }
    return this;
  }

  filterEq(field, val) {
    return this._filter(field, "=", val);
  }

  filterLt(field, val) {
    return this._filter(field, "<", val);
  }

  filterLte(field, val) {
    return this._filter(field, "<=", val);
  }

  filterGte(field, val) {
    return this._filter(field, ">=", val);
  }


  filterIlike(field, val) {
    return this._filter(field, "ilike", val);
  }

  filterIsNull(field) {
    if(this._filters.hasOwnProperty(field)) {
      this._filters[field].operator = "is null";
    } else {
      this._filters[field] = {"field": field, "operator": "is null"};
    }
    return this;
  }

  filterIsNotNull(field) {
    if(this._filters.hasOwnProperty(field)) {
      this._filters[field].operator = "is not null";
    } else {
      this._filters[field] = {"field": field, "operator": "is not null"};
    }
    return this;
  }

  filterLike(field, val) {
    return this._filter(field, "Like", val);
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  offset(n) {
    this._offset = n;
    return this;
  }

  build() {
    var f = _.map(this._filters);
    return {filters: f, offset: this._offset, limit: this._limit};
  }

}
