import '../img/icon-128.png'
import '../img/icon-34.png'

// chrome.history.onVisited.addListener(function (result) {
//   console.log('storing', result.url);
// });
//

function checkHistory(startTime) {
  console.log(startTime);
  chrome.history.search({startTime: startTime, maxResults: 2147483647, text: ''}, function(data) {
    let result = data.filter(data => data.lastVisitTime !== startTime);
    result.sort(function (a, b) {
      return a.lastVisitTime - b.lastVisitTime;
    });
    let mostRecent = result[result.length - 1];

    console.log(result);

    if (result.length > 0) {
      addData(mostRecent.lastVisitTime);
    }
  });
}

// chrome.alarms.onAlarm.addListener(function (alarm) {
//   if (alarm.name === 'checkHistory') {
//     console.log('checkHistory');
//   }
// });

// Alarm period is less than minimum of 1 minutes. In released .crx, alarm "checkHistory" will fire approximately every 1 minutes.
// chrome.alarms.create('checkHistory', {when: Date.now() + 10000, periodInMinutes: 0.166667});

// chrome.storage.sync.get(['mostRecent'], function(result) {
//   if (result) {
//
//   }
//   checkHistory(result.mostRecent.lastVisitTime || 0, result.mostRecent.id || -1, function () {
//     chrome.storage.sync.get(['mostRecent'], function(result) {
//       checkHistory(result.mostRecent.lastVisitTime || 0, result.mostRecent.id || -1)
//     });
//   })
// });
//


// This works on all devices/browsers, and uses IndexedDBShim as a final fallback
const indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;


// Open (or create) the database
const opendb = indexedDB.open("pk-browsing-history", 2);

let db;

// Create the schema
opendb.onupgradeneeded = function(e) {
  db = e.target.result;
  const store = db.createObjectStore("runHistory", {autoIncrement: true});
  store.createIndex("timestamp", "timestamp");
};

opendb.onsuccess = function(e) {
  db = e.target.result;
  findMostRecentRun(function (timestamp) {
    checkHistory(timestamp);
  });
};

function addData(timestamp) {
  let transaction = db.transaction(['runHistory'], 'readwrite');
  let store = transaction.objectStore('runHistory');

  let request = store.add({timestamp: timestamp});

  request.onerror = function(e) {
    console.log('Error', e.target.error.name);
  };

  request.onsuccess = function(e) {
    console.log('Woot! Did it');
  };
}

function findMostRecentRun(cb) {
  let transaction = db.transaction(['runHistory'], 'readwrite');
  let store = transaction.objectStore('runHistory');
  let index = store.index("timestamp");

  let request = index.openCursor(null, 'prev');

  request.onerror = function(e) {
    console.log('Error', e.target.error.name);
  };

  request.onsuccess = function (event) {
    if (event.target.result) {
      cb(event.target.result.value.timestamp)
    } else {
      cb(0);
    }
  };
}