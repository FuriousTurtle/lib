import _ from 'lodash';

export default function XucUtils() {

  var _normalize = function(number) {
    if (typeof(number) !== "undefined") {
      var trimmed = number.replace(/[ ]/g,"");
      if(trimmed.charAt(0) == '*') {
        return /^\**/.exec(trimmed) + trimmed.replace(/[+().]/g,"").replace(/^\*\**(?=\d?)/g,"");
      } else {
        return trimmed.replace(/^\+/,"00").replace(/[+().]/g,"").replace(/^\*\**(?=\d?)/g,"");
      }
    }
    else
      return "";
  };

  var _isaPhoneNb = function(value) {
    return /^\**\d+\*{0,2}\d+$/.test(value);
  };

  var _prettyPhoneNb = function(number) {
    if(number.length < 6) {
      return number;
    }

    var modulo, offset = 1;
    if(number.length % 2 === 0) {
      modulo = 2;
    } else if(number.length % 3 === 0) {
      modulo = 3;
    } else {
      offset = 0;
      modulo = 2;
    }

    return _.trim(
      _.join(
        _.map(_.toArray(number), function(value, index) {
          return value + ((index+offset) % modulo === 0?' ':'');
        }), ''
      )
    );
  };

  return {
    normalizePhoneNb : _normalize,
    isaPhoneNb : _isaPhoneNb,
    prettyPhoneNb: _prettyPhoneNb
  };
}
