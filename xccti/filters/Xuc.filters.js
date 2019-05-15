import moment from 'moment';

function queueTime() {
  return function(seconds) {
    if (typeof seconds == "undefined" || seconds == "-")
      return "";
    else if (seconds < 60)
      return seconds;
    if (seconds < 3600)
      return moment().hour(0).minute(0).seconds(0).add('seconds', seconds).format("m:ss");
    return moment().hour(0).minute(0).seconds(0).add('seconds', seconds).format("H:mm:ss");
  };
}

function totalTime() {
  return function(t) {
    if (typeof t == "undefined" || t == "-")
      return "";
    if(t < 100*3600) {
      return ('0'+Math.floor(t/3600) % 100).slice(-2)+':'+('0'+Math.floor(t/60)%60).slice(-2)+':'+('0' + t % 60).slice(-2);
    }
    else {
      if(t < 1000*3600) {
        return ('00'+Math.floor(t/3600) % 1000).slice(-3)+':'+('0'+Math.floor(t/60)%60).slice(-2)+':'+('0' + t % 60).slice(-2);
      }
      else {
        return "###:##:##";
      }
    }
  };
}

function timeInState($translate) {
  var toClockString = function(ts) {
    var fmt = function(t) { return ( t < 10 ? '0'+t : t ); };
    var fmth = function(h) { return (h > 0 ? fmt(h)+":" : '');};
    var fmtd = function(d) {return (d > 0 ? d+$translate.instant('DayAbbrv')+' ' :'');};
    return (fmtd(ts.days) +  fmth(ts.hours)+fmt(ts.minutes)+":"+fmt(ts.seconds));
  };
  
  return function(timeInState) {
    if ( typeof timeInState !== 'undefined') {
      return toClockString(timeInState);
    }
    else return "";
  };
}

function booleanText() {
  return function(bool) {
    if(bool)
      return 'Y';
    else
      return 'N';
  };
}

function dateTime() {
  return function(timeStamp) {
    if(timeStamp) {
      var dateFormat="HH:mm:ss";
      if (moment().dayOfYear() !== moment(timeStamp).dayOfYear()) {
        dateFormat="DD HH:mm:ss";
      }
      return moment(timeStamp).format(dateFormat);
    }
    else {
      return "-";
    }
  };
}


function dashWhenEmpty() {
  return function(number) {
    if(number) {
      return number;
    }
    else {
      return "-";
    }
  };
}

function prettyPhoneNb(XucUtils) {
  return XucUtils.prettyPhoneNb;
}

function prepareServerUrl() {
  return function(locationProtocol, _hostAndPort, protocol) {
    return locationProtocol === "http:" ?
      (protocol + '://' + _hostAndPort) :
      (protocol + 's://' + _hostAndPort.split(':')[0]);
  };
}

export { queueTime, totalTime, timeInState, booleanText, dateTime, dashWhenEmpty, prettyPhoneNb, prepareServerUrl };

