let cti = require('exports-loader?Cti!./js/cti.js');
let callback = require('exports-loader?Callback!./js/callback.js');
let membership = require('exports-loader?Membership!./js/membership.js');
window.Cti = cti;
window.Callback = callback;
window.membership = membership;
export {cti, callback, membership};
