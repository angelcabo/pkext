var PerkeepServer = PerkeepServer || {};

PerkeepServer = function (serverConnection, options) {
  this.serverConnection = serverConnection;
  this.rootPermanodeRef = options.rootPermanodeRef;
};

PerkeepServer.discover = function (options) {
  return new Promise(function (resolve, reject) {
    let request = new XMLHttpRequest();
    request.open('GET', options.serverUrl);
    request.setRequestHeader("Accept", "text/x-camli-configuration");
    request.onreadystatechange = function () {
      if (request.readyState === 4) {
        if (request.status === 200) {
          let json = JSON.parse(request.responseText);
          if (json) {
            console.log('retrieved camlistore server discovery data from: ' + options.serverUrl);
            let connection = new ServerConnection(options.serverUrl, json);
            let perkeepServer = new PerkeepServer(connection, {rootPermanodeRef: options.rootPermanodeRef});
            resolve(perkeepServer);
          }
          reject(Error('Error during server discovery'));
        } else {
          let message = (request.responseText) ? request.responseText : 'Server is not available';
          reject(Error(message));
        }
      }
    };

    request.onerror = function () {
      reject(Error('Network error discovering Camlistore server :('));
    };

    request.send();
  });
};

PerkeepServer.prototype.getRootPermanode = function (name) {
  let self = this;
  let query = {
    constraint: {
      permanode: {
        attr: "camliRoot",
        value: name
      }
    },
    describe: {
      ifResultRoot: true
    }
  };

  function foo(query, resolve, reject) {
    self.serverConnection.search(query)
      .then(function (response) {
        let root = response.description.meta[response.blobs[0].blob];
        resolve({blobRef: root.blobRef, rootName: root.permanode.attr.camliRoot[0]});
      })
      .catch(reject);
  }

  return new Promise(foo.bind(this, query));
};

PerkeepServer.prototype.addCamliContentRef = function (permanoderef, fileref) {
  return this.serverConnection.updatePermanodeAttr(permanoderef, "set-attribute", "camliContent", fileref);
};

PerkeepServer.prototype.addCamliContentImageRef = function (permanoderef, fileref) {
  return this.serverConnection.updatePermanodeAttr(permanoderef, "set-attribute", "camliContentImage", fileref);
};

PerkeepServer.prototype.addImageSrcAttribute = function (permanoderef, value) {
  return this.updatePermanodeAttr(permanoderef, "set-attribute", "imgSrc", value);
};

PerkeepServer.prototype.addReferrerAttribute = function (permanoderef, value) {
  return this.updatePermanodeAttr(permanoderef, "set-attribute", "referrer", value);
};

PerkeepServer.prototype.addCamliPath = function (permanoderef, camliPath, value) {
  return this.serverConnection.updatePermanodeAttr(permanoderef, "set-attribute", camliPath, value);
};

PerkeepServer.prototype.addTitle = function (permanoderef, value) {
  return this.serverConnection.updatePermanodeAttr(permanoderef, "set-attribute", "title", value);
};

PerkeepServer.prototype.addUrl = function (permanoderef, value) {
  return this.serverConnection.updatePermanodeAttr(permanoderef, "set-attribute", "url", value);
};

PerkeepServer.prototype.addUrlHash = function (permanoderef, value) {
  return this.serverConnection.updatePermanodeAttr(permanoderef, "set-attribute", "base64url", value);
};

PerkeepServer.prototype.addVisited = function (permanoderef, value) {
  return this.updatePermanodeAttr(permanoderef, "set-attribute", "visited", value);
};

PerkeepServer.prototype.createNewPermanodeOnRoot = function (url, title, urlHash) {
  let self = this;
  return self.serverConnection
    .createPermanode()
    .then(function (permanoderef) {
      let setCamliPath = self.addCamliPath(self.rootPermanodeRef, 'camliPath:' + title + '.mht', permanoderef);
      let setUrl = self.addUrl(permanoderef, url);
      let setTitle = self.addTitle(permanoderef, title);
      let setUrlHash = self.addUrlHash(permanoderef, urlHash);

      return Promise.all([setCamliPath, setUrl, setTitle, setUrlHash]).then(function () {
        return permanoderef;
      });
    });
};

PerkeepServer.prototype.findBookmarkOnRoot = function (rootPermanodeRef, bookmarkHash) {
  let self = this;
  let query = {
    "sort": "-created",
    "constraint": {
      "logical": {
        "op": "and",
        "a": {
          "permanode": {
            "attr": "base64url",
            "value": bookmarkHash
          }
        },
        "b": {
          "permanode": {
            "relation": {
              "relation": "parent",
              "any": {
                "blobRefPrefix": rootPermanodeRef
              }
            }
          }
        }
      }
    },
    "describe": {
      "rules": [
        {
          "attrs": [
            "camliContent",
            "camliContentImage"
          ]
        }
      ]
    }
  };
  return self.serverConnection.search(query);
};

PerkeepServer.prototype.storePageVisit = function (permanoderef) {
  return this.serverConnection.updatePermanodeAttr(permanoderef, "set-attribute", "visited", Date.now().toString())
    .catch(console.log.bind(console));
};

PerkeepServer.prototype.storeBlob = function (blob, name, permanoderef) {
  let self = this;
  return self.captureBlobAndComputeRef_(blob)
    .then(self._assembleResults.bind(self))
    .then(self._checkForDuplicate.bind(self))
    .then(self.doUpload_.bind(self, name))
    .then(function (results) {
      results.permanoderef = permanoderef;
      return self.addPermanodeMetadata_(results);
    })
    .catch(console.log.bind(console));
};

PerkeepServer.prototype.storeWebpageScreenshot = function (imgUrl, page) {
  let self = this;
  return self._fetchImage(imgUrl)
    .then(self.captureBlobAndComputeRef_.bind(self))
    .then(self._assembleResults.bind(self))
    .then(self._checkForDuplicate.bind(self))
    .then(self.doUpload_.bind(self, page.title + '.png'))
    .then(function (results) {
      return self.findOrCreatePermanode(page).then(function (permanoderef) {
        results.permanoderef = permanoderef;
        return results;
      });
    })
    .then(self.addPermanodeImageMetadata_.bind(self))
    .catch(console.log.bind(console));
};

PerkeepServer.prototype.doUpload_ = function (title, results) {
  return this.serverConnection.uploadBlob(results.blob, title).then(function (ref) {
    console.log('blob uploaded: ' + ref);
    results.fileref = ref;
    return results;
  });
};

PerkeepServer.prototype.createPermanode_ = function (results) {
  var sc = this.props.serverConnection;
  return sc.createPermanode().then(function (data) {
    console.log('permanode created: ' + data);
    results.permanoderef = data;
    return results;
  });
};

PerkeepServer.prototype.findOrCreatePermanode = function (page) {
  let self = this;
  let url = new URL(page.url);
  let encodedUrl = btoa(url.hostname.replace('www.', '') + url.pathname);

  return this.findBookmarkOnRoot(this.rootPermanodeRef, encodedUrl)
    .then(function (result) {
      if (result) {
        return result;
      } else {
        return self.createNewPermanodeOnRoot(page.url, page.title, encodedUrl)
          .then(function () {
            return self.findBookmarkOnRoot(self.rootPermanodeRef, encodedUrl);
          });
      }
    });
};

PerkeepServer.prototype.addPermanodeImageMetadata_ = function(results) {
  var camliContentImage = this.addCamliContentImageRef(results.permanoderef, results.fileref);

  return Promise.all([camliContentImage]);
};

PerkeepServer.prototype.addPermanodeMetadata_ = function(results) {
  var camliContent = this.addCamliContentRef(results.permanoderef, results.fileref);

  return Promise.all([camliContent]);
};

PerkeepServer.prototype._fetchImage = function (url) {
  // if (this.isDataURL_(url)) {
  //   return this.dataURLToBlob_(url);
  // }
  //
  // return this.getAsBlob_(url);
  return this.dataURLToBlob_(url);
};

/**
 * Returns a Promise Blob
 * @param {Blob} blob
 * @returns {Promise} Promise object that represents a Blob and a hash for that Blob
 */
PerkeepServer.prototype.captureBlobAndComputeRef_ = function (blob) {
  var resolvedBlob = Promise.resolve(blob);
  var blobref = this.convertToTypedArray_(blob).then(this.generateHash_);

  return Promise.all([resolvedBlob, blobref]);
};

PerkeepServer.prototype._assembleResults = function (results) {
  return {
    'blob': results[0],
    'blobref': results[1]
  };
};

/**
 * Returns a Promise Blob
 * @param {Object} results
 * @returns {Promise} Promise object that represents a typed arrayBuffer for a given Blob
 */
PerkeepServer.prototype._checkForDuplicate = function (results) {
  console.log('checking for duplicates');
  return this.serverConnection.findFileByRef(results.blobref).then(function () {
    return results; // ignore empty json and keep passing results
  });
};

/**
 * Returns a Promise Blob
 * @param {string} dataURL
 * @returns {Promise} Promise object represents a Blob for the given dataURL
 */
PerkeepServer.prototype.dataURLToBlob_ = function (dataURL) {
  console.log('creating blob from provided dataURL');
  return new Promise(function (resolve, reject) {
    const BASE64_MARKER = ';base64,';
    if (dataURL.indexOf(BASE64_MARKER) == -1) {
      var parts = dataURL.split(',');
      var contentType = parts[0].split(':')[1];
      var raw = decodeURIComponent(parts[1]);

      resolve(new Blob([raw], {type: contentType}));
    }

    var parts = dataURL.split(BASE64_MARKER);
    var contentType = parts[0].split(':')[1];
    var raw = window.atob(parts[1]);
    var rawLength = raw.length;

    var uInt8Array = new Uint8Array(rawLength);

    for (var i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }

    resolve(new Blob([uInt8Array], {type: contentType}));
  });
};

/**
 * Returns a Promise Blob
 * @param {Blob} blob
 * @returns {Promise} Promise object that represents a typed arrayBuffer for a given Blob
 */
PerkeepServer.prototype.convertToTypedArray_ = function (blob) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();

    reader.onload = function () {
      if (reader.readyState === 2) {
        console.log('blob converted to typed array');
        resolve(reader.result);
      }
    }.bind(this);

    reader.onerror = function () {
      reject(Error('There was an error converting the image blob to a typed array'));
    };

    reader.readAsArrayBuffer(blob);
  });
};

PerkeepServer.prototype.generateHash_ = function (arrayBuffer) {
  var bytes = new Uint8Array(arrayBuffer);
  var blobref = 'sha1-' + Crypto.SHA1(bytes);
  console.log('hash computed: ' + blobref);
  return blobref;
};