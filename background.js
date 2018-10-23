!function (window, $, undefined) {

  let isActive = {};
  let contextMenuId;

  if (!contextMenuId) {
    contextMenuId = chrome.contextMenus.create({
      id: "myContextMenu",
      title: "Store page HTML",
      contexts: ["all"]
    });

    chrome.contextMenus.onClicked.addListener(function(info) {
      // chrome.history.search({text: '', maxResults: 1}, function(data) {
      //   data.forEach(function(page) {
      //     console.log(page);
      //   });
      // });

      chrome.tabs.query({}, function(tabs) {
        tabs.forEach(function (tab) {
          if (tab && tab.url && tab.url.indexOf('chrome://') === -1) {
            captureHTML(tab).then(function (blob) {
              console.log(blob);
              getServer().then(function (perkeep) {
                return perkeep.findOrCreatePermanode(tab).then(function (result) {
                  let ref = result.blobs[0].blob;
                  return perkeep.storeBlob(blob, tab.title + '.mht', ref);
                });
              });
            });
          }
        });
      });
    });
  }

  /**
   * Retrieve configuration 'options' from Chrome storage
   */
  function fetchOptions() {
    return new Promise(function (resolve, reject) {
      chrome.storage.sync.get(['serverUrl', 'rootPermanodeRef'], function (items) {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError) // TODO: how to forcibly test this error condition?
        }
        if (items.serverUrl && items.rootPermanodeRef) {
          resolve(items);
        }
      });
    });
  }

  let perkeepServer;
  function getServer() {
    if (perkeepServer) {
      return Promise.resolve(perkeepServer);
    } else {
      return fetchOptions()
        .then(PerkeepServer.discover)
        .catch(function (error) {
          return error;
        })
        .then(function (_perkeepServer_) {
          perkeepServer = _perkeepServer_;
          return perkeepServer;
        });
    }
  }

  if (!perkeepServer) {
    getServer();
  }

  chrome.runtime.onMessage.addListener(function (msg, sender, respond) {

    if (msg.from === "content") {
      if (msg.action === "store") {
        let url = sender.tab.url
          , text = msg.text
          , tags = msg.tags.sort()
          , title = msg.title;
        !function (tab, respond) {
          function captureActive() {
            chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {

              if (!tabs[0] || tab.id !== tabs[0].id) {
                // resend active tab query because tab is no longer active
                respond();
                capture(tab.id);
                return
              }

              // when the tab that invoked this function is active (visible at this precise time)
              // chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT, {format: "png"}, function (imgSrcDataUrl) {
              //   if (imgSrcDataUrl) {
              //     storeScreenshot(perkeepServer, tab).then(function () {
              //       console.log('finished');
              //     });
              //   }
              // });

              // chrome.pageCapture.saveAsMHTML({tabId: tab.id}, function (mhtmlData) {
                // perkeepServer.storePageVisit(url, {
                //   tags: tags,
                //   title: title
                // });
                // captureBlobAndComputeRef_(mhtmlData).then(function (hash) {
                //   var blobRef = 'sha1-' + hash;
                //
                //   // statXhr.open('POST', 'camli/stat', true, options.username, options.password);
                //   // camli/upload
                //   chunkBlob(mhtmlData);
                // });
              // });
            })
          }

          setTimeout(captureActive, 500)
        }(sender.tab, respond)
      }
    }

  });

  chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status === "complete") {
      capture(tabId)
    }
  });

  chrome.tabs.onReplaced.addListener(function (tabId, removedTabId) {
    delete isActive[removedTabId];
    capture(tabId)
  });

  chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
    delete isActive[tabId]
  });

  // chrome.history.onVisited.addListener(function (result) {
  //   console.log('onVisited', result.url);
  // });

  function storeScreenshot(perkeep, tab) {
    return new Promise(function (resolve, reject) {
      chrome.tabs.captureVisibleTab(chrome.windows.WINDOW_ID_CURRENT, {format: "png"}, function (imgSrcDataUrl) {
        if (imgSrcDataUrl) {
          perkeep.storeWebpageScreenshot(imgSrcDataUrl, {
            title: tab.title,
            url: tab.url
          }).then(resolve).catch(reject);
        } else {
          reject();
        }
      });
    });
  }


  function captureHTML(tab) {
    return new Promise(function (resolve, reject) {
      chrome.pageCapture.saveAsMHTML({tabId: tab.id}, function (mhtBlob) {
        if (mhtBlob) {
          // contentType = 'multipart/related';
          // fileExt = '.mht';
          resolve(mhtBlob);
        } else {
          reject();
        }
      });
    });
  }

  function capture(tabId, retry) {
    chrome.tabs.get(tabId, function(tab) {
      if (tab && tab.url && tab.url.indexOf('chrome://') === -1) {
        let perkeep;
        getServer()
          .then(function (_perkeep_) {
            perkeep = _perkeep_;
            return perkeep.findOrCreatePermanode(tab);
          })
          .then(function (result) {
            let ref = result.blobs[0].blob;
            let permanode = result.description.meta[ref].permanode;
            let doStorePageVisit = perkeep.storePageVisit(ref);
            let hasContent = permanode.attr.camliContent && permanode.attr.camliContent.length > 0;
            if (!hasContent) {
              let doStoreHTML = captureHTML(tab).then(function (blob) {
                return perkeep.storeBlob(blob, tab.title + '.mht', ref);
              });
              return Promise.all([doStorePageVisit, doStoreHTML]);
            } else {
              return Promise.resolve(doStorePageVisit);
            }
          });
      }
    });

    chrome.tabs.executeScript(tabId, {file: "vendor/jquery-2.1.0.min.js", runAt: "document_start"}, function (result) {
      if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError);
      }
    });
    chrome.tabs.executeScript(tabId, {file: "nlp.js", runAt: "document_start"}, function (result) {
      if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError);
      }
    });

    chrome.tabs.executeScript(tabId, {file: "addHistoryItem.js", runAt: "document_start"}, function (result) {
      if (chrome.runtime.lastError) {
        console.log(chrome.runtime.lastError);
      }
    })
  }
}(window, jQuery);