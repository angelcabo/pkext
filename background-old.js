!function (window, $, undefined) {

  var isActive = {}

  var serverConnection;

  fetchOptions()
    .then(discoverServer)
    .catch(function(error) {
      return error;
    })
    .then(function (results) {
      serverConnection = new PerkeepServer(results.options.serverUrl, results.discovery);
    });

  /**
   * Retrieve configuration 'options' from Chrome storage
   */
  function fetchOptions() {
    return new Promise(function(resolve) {
      resolve({serverUrl: 'http://perkeep.test'});
    });
  }

  /**
   * Retrieve discovery document from Camlistore blob server
   */
  function discoverServer(options) {
    return new Promise(function(resolve, reject) {
      var request = new XMLHttpRequest();
      request.open('GET', options.serverUrl);
      request.setRequestHeader("Authorization", "Basic " + btoa("user:rainbowdash"));
      request.setRequestHeader("Accept", "text/x-camli-configuration");
      request.onreadystatechange = function() {
        if (request.readyState === 4) {
          if (request.status === 200) {
            var json = JSON.parse(request.responseText);
            if (json) {
              console.log('retrieved camlistore server discovery data from: ' + options.serverUrl);
              console.log(json);
              var results = {
                'discovery': json,
                'options': options
              };
              resolve(results);
            }
            reject(Error('Error during server discovery'));
          } else {
            var message = (request.responseText) ? request.responseText : 'Server is not available';
            reject(Error(message));
          }
        }
      }.bind(this);

      request.onerror = function() {
        reject(Error('Network error discovering Camlistore server :('));
      };

      request.send();
    });
  }

  chrome.runtime.onMessage.addListener(function(msg, sender, respond) {
      console.log("EXT: onMessage - ", msg)
      if (msg.from === "content") {
        if (msg.action === "store") {
          //store in perkeep
          var     url   = sender.tab.url
              ,   text  = msg.text
              ,   tags  = msg.tags.sort()
              ,   title = msg.title
              ,   date  = new Date().toLocaleString()

          !function(tab, respond) {
            function captureActive() {
              chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                console.log("EXT: query active tab")

                if (!tabs[0] || tab.id !== tabs[0].id) {
                    // resend active tab query because tab is no longer active
                    respond()
                    catpure(tab.id)
                    return
                }
                // when the tab that invoked this function is active (visible at this precise time)
                chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT, {format: "png"}, function (src) {
                  if (!src) {
                    return
                  }
                });

                var generateHash_ = function(arrayBuffer) {
                  var bytes = new Uint8Array(arrayBuffer);
                  var blobref = 'sha1-' + Crypto.SHA1(bytes);
                  console.log('hash computed: ' + blobref);
                  return blobref;
                };

                var convertToTypedArray_ = function(blob) {
                  return new Promise(function(resolve, reject) {
                    var reader  = new FileReader();

                    reader.onload = function() {
                      if (reader.readyState === 2) {
                        console.log('blob converted to typed array');
                        resolve(reader.result);
                      }
                    }.bind(this);

                    reader.onerror = function() {
                      reject(Error('There was an error converting the image blob to a typed array'));
                    }

                    reader.readAsArrayBuffer(blob);
                  });
                };

                var captureBlobAndComputeRef_ = function(blob) {
                  var resolvedBlob = Promise.resolve(blob);
                  var blobref = convertToTypedArray_(blob).then(generateHash_);

                  return Promise.all([resolvedBlob, blobref]);
                };

                function chunkBlob(buffer) {
                  var chunkSize = 64000;
                  var bufferSize = buffer.byteLength;
                  var chunkCount = Math.ceil(bufferSize / chunkSize, chunkSize);
                  var chunks = [];

                  for (var i = 0; i < chunkCount; i++) {
                    if (chunkSize * (i + 1) <= bufferSize) {
                      chunks = chunks.concat(buffer.slice(chunkSize * i, chunkSize * (i + 1)));
                    } else {
                      chunks = chunks.concat(buffer.slice(chunkSize * i, bufferSize));
                    }
                  }

                  return chunks;
                }

                chrome.pageCapture.saveAsMHTML({tabId: tab.id}, function (mhtmlData) {
                  captureBlobAndComputeRef_(mhtmlData).then(function (hash) {
                    var blobRef = 'sha1-' + hash;

                    // statXhr.open('POST', 'camli/stat', true, options.username, options.password);
                    // camli/upload
                    chunkBlob(mhtmlData);
                  });
                });


                respond(true)

                // Need to sha1 hash the URL and use to find existing in Camli

                // send
                console.log({
                  url: url,
                  tags: tags,
                  title: title,
                  date: date
                })
              })
            }
            setTimeout(captureActive, 500)
          }(sender.tab, respond)
        }
      }
      return true
  })

  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === "complete") {
      capture(tabId)
    }
  })

  chrome.tabs.onReplaced.addListener(function(tabId, removedTabId) {
    delete isActive[removedTabId]
    capture(tabId)
  })

  chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
    delete isActive[tabId]
  })

  function capture(tabId, retry) {
    chrome.tabs.executeScript(tabId, {file: "vendor/jquery-2.1.0.min.js", runAt: "document_start"}, function (result) {
      if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError)
        return
      }
    })
    chrome.tabs.executeScript(tabId, {file: "nlp.js", runAt: "document_start"}, function (result) {
      if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError)
        return
      }
    })

    chrome.tabs.executeScript(tabId, {file: "addHistoryItem.js", runAt: "document_start"}, function (result) {
      if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError)
        return
      }
    })
  }

  chrome.contextMenus.create({
    id: "myContextMenu",
    title: "Save to Camlistore",
    contexts: ["all"]
  });

  // for future parameters / expansion see here: https://developer.chrome.com/extensions/contextMenus#type-ContextType
  chrome.contextMenus.onClicked.addListener(function(info) {
    var url = 'popup.html' + '?imgSrc=' + info.srcUrl + '&referrer=' + info.pageUrl;
    chrome.windows.create({ url: url, type: "popup", width: 500, height: 700 });
  });


}(window, jQuery)
