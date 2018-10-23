var ServerConnection = ServerConnection || {};

/*
 * Connection to the Camlistore blob server and API for the RPCs it provides. All code should use this connection to contact the server.
 * @constructor
 *
 * @param {String} url The URL for the Camlistore server.
 * @param {JSON} Discovery document for the camlistore server (Format: https://github.com/camlistore/camlistore/blob/master/doc/protocol/discovery.txt)
 *    The following parameters are required:
 *        config.blobRoot, eg: "/bs-and-maybe-also-index/"
 *        config.signing.publicKeyBlobRef, eg: "sha1-xx...x"
 *        config.signing.signHandler, eg: "/sighelper/camli/sig/sign"
 *        config.uploadHelper, eg: "/ui/?camli.mode=uploadhelper"
 */
ServerConnection = function (url, config) {
  this.server_url_ = url;
  this.config_ = config;

  this.signHandler_ = this.config_.signing.signHandler;
  this.uploadHandler_ = this.config_.blobRoot + 'camli/upload';
  this.uploadHelper_ = this.config_.uploadHelper;
  this.searchRoot_ = this.config_.searchRoot;
  // this.searchRoot_ = this.config_.searchRoot + 'camli/search/files';
  // this.queryRoot = this.config_.searchRoot + 'camli/search/query';

  this.PUBLIC_KEY_BLOB_REF = this.config_.signing.publicKeyBlobRef;
  this.UPLOAD_HANDLER = this.server_url_ + this.uploadHandler_;
  this.UPLOAD_HELPER = this.server_url_ + this.uploadHelper_;
  this.SIGN_HANDLER = this.server_url_ + this.signHandler_;
  this.SEARCH_ROOT = this.server_url_ + this.searchRoot_;
}

/**
 * Request Camlistore server to create a permanode
 */
ServerConnection.prototype.createPermanode = function () {
  var json = {
    "camliVersion": 1,
    "camliType": "permanode",
    "random": "" + Math.random()
  };

  return this.signObject(json).then(this.uploadSignature.bind(this));
}

/**
 * Request Camlistore server to update a permanode attribute
 *
 * @param {string} blobref permanode to update.
 * @param {string} What type of claim: "add-attribute", "set-attribute"...
 * @param {string} name of attribute to update.
 * @param {string} value for attribute.
 */
ServerConnection.prototype.updatePermanodeAttr = function (blobref, claimType, attribute, value) {
  var json = {
    "camliVersion": 1,
    "camliType": "claim",
    "permaNode": blobref,
    "claimType": claimType,
    "claimDate": this.dateToRfc3339String_(new Date()),
    "attribute": attribute,
    "value": value
  };

  return this.signObject(json).then(this.uploadSignature.bind(this));
}

/**
 * Submit object to Camlistore server to sign
 *
 * @param {Object} clearObj Unsigned object.
 */
ServerConnection.prototype.signObject = function (clearObj) {

  function sign(clearObj, resolve, reject) {
    clearObj.camliSigner = this.PUBLIC_KEY_BLOB_REF;

    var camVersion = clearObj.camliVersion;
    if (camVersion) {
      delete clearObj.camliVersion;
    }

    var clearText = JSON.stringify(clearObj, null, "    ");
    if (camVersion) {
      clearText = "{\"camliVersion\":" + camVersion + ",\n" + clearText.substr("{\n".length);
    }

    var request = new XMLHttpRequest();
    request.open("POST", this.SIGN_HANDLER);
    request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    var data = "json=" + encodeURIComponent(clearText);

    request.onreadystatechange = function () {
      if (request.readyState === 4) {
        if (request.status === 200) {
          resolve(request.responseText);
        } else {
          reject(Error(request.statusText));
        }
      }
    };

    request.onerror = function () {
      reject(Error('Network error during signing'));
    };

    request.send(data);
  }

  return new Promise(sign.bind(this, clearObj));
};

/**
 * Upload a string to Camlistore server
 *
 * @param {string} s String to upload.
 */
ServerConnection.prototype.uploadSignature = function (s) {

  function upload(s, resolve, reject) {
    var byteArray = Crypto.charenc.UTF8.stringToBytes(s);
    var blobref = 'sha1-' + Crypto.SHA1(byteArray);
    var parts = [s];
    var bb = new Blob(parts);
    var fd = new FormData();
    fd.append(blobref, bb);

    var request = new XMLHttpRequest();
    request.open("POST", this.UPLOAD_HANDLER);

    request.onreadystatechange = function () {
      if (request.readyState === 4) {
        if (request.status === 200) {
          var received = JSON.parse(request.responseText).received;
          var ref = received[0].blobRef;
          resolve(ref);
        } else {
          reject(Error(request.statusText));
        }
      }
    };

    request.onerror = function () {
      reject(Error('Network error uploading string'));
    };

    request.send(fd);
  }

  return new Promise(upload.bind(this, s));
};

/**
 * Upload a blob to Camlistore server
 *
 * @param {blob} Blob to upload.
 */
ServerConnection.prototype.uploadBlob = function (blob, filename) {

  function upload(blob, filename, resolve, reject) {
    var fd = new FormData();
    fd.append("blob", blob, filename || "filename");

    var request = new XMLHttpRequest();
    request.open("POST", this.UPLOAD_HELPER);

    request.onreadystatechange = function () {
      if (request.readyState === 4) {
        if (request.status === 200) {
          var got = JSON.parse(request.responseText).got;
          var fileRef = got[0].fileref
          resolve(fileRef);
        } else {
          reject(Error(request.statusText));
        }
      }
    }.bind(this);

    request.onerror = function () {
      reject(Error('Network error'));
    };

    request.send(fd);
  }

  return new Promise(upload.bind(this, blob, filename));
};

/**
 * Upload a blob to Camlistore server
 *
 * @param {blobref} blobref to check if exists already.
 */
ServerConnection.prototype.findFileByRef = function (blobref) {

  function findByRef(blobref, resolve, reject) {
    var endpoint = this.SEARCH_ROOT + 'camli/search/files' + '?wholedigest=' + blobref;
    var request = new XMLHttpRequest();
    request.open('GET', endpoint);

    request.onreadystatechange = function () {
      if (request.readyState === 4) {
        if (request.status === 200) {
          var json = JSON.parse(request.responseText);
          if (json.files) {
            if (json.files.length == 0) {
              resolve(json);
            } else {
              reject(Error('Item already exists'));
            }
          }
        }
      }
    }.bind(this);

    request.onerror = function () {
      reject(Error('Network error'));
    };

    request.send();
  }

  return new Promise(findByRef.bind(this, blobref));
}

ServerConnection.prototype.describe = function (blobref) {

  function describe(query, resolve, reject) {
    var endpoint = this.SEARCH_ROOT + 'camli/search/describe' + '?blobref=' + blobref;
    var request = new XMLHttpRequest();
    request.open('GET', endpoint);
    request.setRequestHeader("Content-Type", "application/json");

    request.onreadystatechange = function () {
      if (request.readyState === 4) {
        if (request.status === 200) {
          var json = JSON.parse(request.responseText);
          if (json.meta[blobref]) {
            resolve(json.meta[blobref]);
          } else {
            reject(Error('Item not found'));
          }
        }
      }
    }.bind(this);

    request.onerror = function () {
      reject(Error('Network error'));
    };

    request.send();
  }

  return new Promise(describe.bind(this, blobref));
};

ServerConnection.prototype.search = function (query) {

  function search(query, resolve, reject) {
    var endpoint = this.SEARCH_ROOT + 'camli/search/query';
    var request = new XMLHttpRequest();
    request.open('POST', endpoint);
    request.setRequestHeader("Content-Type", "application/json");

    request.onreadystatechange = function () {
      if (request.readyState === 4) {
        if (request.status === 200) {
          var json = JSON.parse(request.responseText);
          if (json.blobs && json.blobs.length > 0) {
            resolve(json);
          } else {
            resolve()
          }
        }
      }
    }.bind(this);

    request.onerror = function () {
      reject(Error('Network error'));
    };

    request.send(JSON.stringify(query));
  }

  return new Promise(search.bind(this, query));
};

/**
 * Format |dateVal| as specified by RFC 3339.
 */
ServerConnection.prototype.dateToRfc3339String_ = function (dateVal) {
  // Return a string containing |num| zero-padded to |length| digits.
  var pad = function (num, length) {
    var numStr = "" + num;
    while (numStr.length < length) {
      numStr = "0" + numStr;
    }
    return numStr;
  };

  // thanks: http://stackoverflow.com/questions/7975005/format-a-string-using-placeholders-and-an-object-of-substitutions
  var subs = {
    "%UTC_YEAR%": dateVal.getUTCFullYear(),
    "%UTC_MONTH%": pad(dateVal.getUTCMonth() + 1, 2),
    "%UTC_DATE%": pad(dateVal.getUTCDate(), 2),
    "%UTC_HOURS%": pad(dateVal.getUTCHours(), 2),
    "%UTC_MINS%": pad(dateVal.getUTCMinutes(), 2),
    "%UTC_SECONDS%": pad(dateVal.getUTCSeconds(), 2),
  };

  var formatted = "%UTC_YEAR%-%UTC_MONTH%-%UTC_DATE%T%UTC_HOURS%:%UTC_MINS%:%UTC_SECONDS%Z";

  formatted = formatted.replace(/%\w+%/g, function (all) {
    return subs[all] || all;
  });

  return formatted;
};