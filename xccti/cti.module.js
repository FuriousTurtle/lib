import angular from 'angular';
import AgentStates from './services/AgentStates.service';
import XucUser from './services/XucUser.service';
import XucQueue from './services/XucQueue.service';
import XucAgent from './services/XucAgent.service';
import XucAgentUser from './services/XucAgentUser.service';
import XucGroup from './services/XucGroup.service';
import XucQueueGroup from './services/XucQueueGroup.service';
import XucConfRoom from './services/XucConfRoom.service';
import XucVoiceMail from './services/XucVoiceMail.service';
import XucAgentTotal from './services/XucAgentTotal.service';
import XucQueueTotal from './services/XucQueueTotal.service';
import XucDirectory from './services/XucDirectory.service';
import XucCallback from './services/XucCallback.service';
import XucPhoneState from './services/XucPhoneState.service';
import XucLink from './services/XucLink.service';
import XucUtils from './services/XucUtils.service';
import XucTableHelper from './services/XucTableHelper.service';
import XucMembership from './services/XucMembership.service';
import XucPhoneEventListener from './services/XucPhoneEventListener.service';
import XucThirdParty from './services/XucThirdParty.service';
import XucPhoneHintService from './services/XucPhoneHintService.service';
import XucCallNotification from './services/XucCallNotification.service';
import XucCallHistory from './services/XucCallHistory.service';
import XucSheet from './services/XucSheet.factory';

import { queueTime, totalTime, timeInState, booleanText, dateTime, dashWhenEmpty, prettyPhoneNb, prepareServerUrl }
  from './filters/Xuc.filters';

var ctiModule = angular.module('xcCti', ['pascalprecht.translate', 'angular-web-notification']);

ctiModule.config(function ($translateProvider) {
  $translateProvider.translations('fr', {
    AgentReady: 'Disponible',
    AgentOnPause: 'En pause',
    AgentLoggedOut: 'Déconnecté',
    AgentOnCall: 'Appel en cours',
    AgentOnIncomingCall: 'Appel Entrant',
    AgentOnOutgoingCall: 'Appel Sortant',
    AgentOnWrapup: 'Post Appel',
    AgentOnAcdCall: 'Appel ACD en cours',
    AgentDialing: 'Numérotation',
    AgentRinging: 'Sonnerie',
    Fax: 'Fax',
    Email: 'Réponse par mail',
    NoAnswer: 'Non réponse',
    Answered: 'Répondu',
    Callback: 'A rappeler',
    NotificationTitle: 'Appel Entrant',
    DayAbbrv: 'j'
  });
  $translateProvider.translations('en', {
    AgentReady: 'Ready',
    AgentOnPause: 'Paused',
    AgentLoggedOut: 'Logged Out',
    AgentOnCall: 'On Call',
    AgentOnIncomingCall: 'Incoming Call',
    AgentOnOutgoingCall: 'Outgoing Call',
    AgentOnWrapup: 'Wrapup',
    AgentOnAcdCall: 'ACD Call',
    AgentDialing: 'Dialing',
    AgentRinging: 'Ringing',
    Fax: 'Fax',
    Email: 'Handled by mail',
    NoAnswer: 'No answer',
    Answered: 'Answered',
    Callback: 'To reschedule',
    NotificationTitle: 'Incoming Call',
    DayAbbrv: 'd'
  });
});

ctiModule.factory('AgentStates', AgentStates);
ctiModule.factory('XucUser', XucUser);
ctiModule.factory('XucQueue', XucQueue);
ctiModule.factory('XucAgent', XucAgent);
ctiModule.factory('XucGroup', XucGroup);
ctiModule.factory('XucQueueGroup', XucQueueGroup);
ctiModule.factory('XucConfRoom', XucConfRoom);
ctiModule.factory('XucVoiceMail', XucVoiceMail);
ctiModule.factory('XucAgentTotal', XucAgentTotal);
ctiModule.factory('XucQueueTotal', XucQueueTotal);
ctiModule.factory('XucDirectory', XucDirectory);
ctiModule.factory('XucCallback', XucCallback);
ctiModule.factory('XucPhoneState', XucPhoneState);
ctiModule.factory('XucLink', XucLink);
ctiModule.factory('XucUtils', XucUtils);
ctiModule.factory('XucTableHelper', XucTableHelper);
ctiModule.factory('XucMembership', XucMembership);
ctiModule.factory('XucPhoneEventListener', XucPhoneEventListener);
ctiModule.factory('XucThirdParty', XucThirdParty);
ctiModule.factory('XucPhoneHintService', XucPhoneHintService);
ctiModule.factory('XucCallNotification', XucCallNotification);
ctiModule.factory('XucAgentUser', XucAgentUser);
ctiModule.factory('XucCallHistory', XucCallHistory);
ctiModule.factory('XucSheet', XucSheet);

ctiModule.filter('queueTime', queueTime);
ctiModule.filter('totalTime', totalTime);
ctiModule.filter('timeInState', timeInState);
ctiModule.filter('booleanText', booleanText);
ctiModule.filter('dateTime', dateTime);
ctiModule.filter('dashWhenEmpty', dashWhenEmpty);
ctiModule.filter('prettyPhoneNb', prettyPhoneNb);
ctiModule.filter('prepareServerUrl', prepareServerUrl);
