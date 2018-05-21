import '../img/icon-128.png'
import '../img/icon-34.png'
import PerkeepConnection from './perkeep/connection.js'

const pk = new PerkeepConnection();
pk.sayHello('Angel');

window.chrome.history.onVisited.addListener(function (result) {
  console.log('storing', result.url);
});
