// const pk = Perkeep({
//   host: "http://perkeep.test",
//   user: "devcam",
//   password: "pass3179"
// });
//
// pk.discover().then(function(config) {
//   console.log(config);
// });

import browser from 'webextension-polyfill'

const getBrowserActionHandler = action => {
  console.log(action);
};

browser.browserAction.onClicked.addListener(action => getBrowserActionHandler(action));
