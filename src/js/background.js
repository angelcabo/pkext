import '../img/icon-128.png'
import '../img/icon-34.png'

chrome.history.onVisited.addListener(function (result) {
  console.log('storing', result.url);
});
