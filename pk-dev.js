const stampit = require('stampit');
const axios = require('axios');
const qs = require('qs');
const FormData = require('form-data');
const SHA224 = require('crypto-js/sha224');

const Perkeep = stampit({
  conf: {
    host: 'http://localhost:3179',
    root: 'History'
  },
  init: ({host, root}, { stamp, instance }) => {
    // console.log(stamp.compose.configuration);
    // this.disoveryConfig = stamp.compose.configuration.discovery;

    this.host = host || stamp.compose.configuration.host;
    this.root = root || stamp.compose.configuration.root;

    // console.log(stamp.compose.configuration);

    instance.createPermanode = async (attrs) => {
      let json = {
        "camliVersion": 1,
        "camliType": "permanode",
        "random": "" + Math.random()
      };
      let signature = await instance.signObject(json);
      let permanodeRef = await instance.nodeUploadSignature(signature);
      let updateAttrRequests = [];
      for(let key in attrs){
        if (attrs.hasOwnProperty(key)) {
          updateAttrRequests.push(instance.updatePermanodeAttr(permanodeRef, "set-attribute", key, attrs[key]))
        }
      }
      await Promise.all(updateAttrRequests);
      return Object.assign(attrs, { permanodeRef });
      // return this.SIGN_HANDLER;
    };

    instance.discover = async () => {
      try { 
        let response = await axios.get(this.host, {headers: {'Accept': 'text/x-camli-configuration'}});
        console.log(`retrieved camlistore server discovery data from ${this.host}`);
        this.disoveryConfig = response.data;

        this.signHandler_ = this.disoveryConfig.signing.signHandler;
        this.uploadHandler_ = this.disoveryConfig.blobRoot + 'camli/upload';
        this.uploadHelper_ = this.disoveryConfig.uploadHelper;
        this.searchRoot_ = this.disoveryConfig.searchRoot;
        // this.searchRoot_ = this.disoveryConfig.searchRoot + 'camli/search/files';
        // this.queryRoot = this.disoveryConfig.searchRoot + 'camli/search/query';

        this.PUBLIC_KEY_BLOB_REF = this.disoveryConfig.signing.publicKeyBlobRef;
        this.UPLOAD_HANDLER = this.host + this.uploadHandler_;
        this.UPLOAD_HELPER = this.host + this.uploadHelper_;
        this.SIGN_HANDLER = this.host + this.signHandler_;
        this.SEARCH_ROOT = this.host + this.searchRoot_;
        return this
      } catch(e) {
        console.log(e);
      }
    };

    instance.signObject = async (clearObj) => {
      clearObj.camliSigner = this.PUBLIC_KEY_BLOB_REF;

      let camVersion = clearObj.camliVersion;
      if (camVersion) {
        delete clearObj.camliVersion;
      }

      let clearText = JSON.stringify(clearObj, null, "    ");
      if (camVersion) {
        clearText = "{\"camliVersion\":" + camVersion + ",\n" + clearText.substr("{\n".length);
      }

      const options = {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        data: "json=" + encodeURIComponent(clearText),
        url: this.SIGN_HANDLER,
        transformResponse: undefined
      };
      let response = await axios(options);
      return response.data;
    };

    instance.updatePermanodeAttr = async (blobref, claimType, attribute, value) => {
      let json = {
        "camliVersion": 1,
        "camliType": "claim",
        "permaNode": blobref,
        "claimType": claimType,
        "claimDate": instance.dateToRfc3339String(new Date()),
        "attribute": attribute,
        "value": value
      };

      let signature = await instance.signObject(json);
      return instance.nodeUploadSignature(signature);
    };

    instance.nodeUploadSignature = async (s) => {
      let blobref = 'sha224-' + SHA224(s).toString();
      let form = new FormData();
      form.append(blobref, new Buffer(s));

      return new Promise(function (resolve, reject) {
        form.submit({auth: 'devcam:pass3179', host: 'perkeep.test', path: '/bs-recv/camli/upload'}, function(err, res) {
          if (err) reject(err);
          let body = '';
          res.on("data", function(chunk) {
            body += chunk;
          });

          res.on("end", function() {
            resolve(JSON.parse(body).received[0].blobRef);
          });
        });
      }.bind(this));
    };

    instance.uploadSignature = async (s) => {
      let blobref = 'sha224-' + SHA224(s).toString();
      let parts = [s];
      let bb = new Blob(parts);
      let fd = new FormData();
      fd.append(blobref, bb);
      let response = await axios.post(this.UPLOAD_HANDLER, fd, {headers: { 'Content-Type': 'multipart/form-data' }});
      return response.received[0].blobRef;
    };

    instance.findPermanode = async (query) => {
      return axios.post(this.SEARCH_ROOT + 'camli/search/query', query, {headers: {'Content-Type': 'application/json'}})
        .then(function (response) {
          return response.data.blobs;
        });
    };

    instance.search = async (query) => {
      return axios.post(this.SEARCH_ROOT + 'camli/search/query', query, {headers: {'Content-Type': 'application/json'}})
        .then(function (response) {
          return response.data.blobs;
        });
    };
  },
  methods: {
    dateToRfc3339String(dateVal) {
      // Return a string containing |num| zero-padded to |length| digits.
      let pad = function (num, length) {
        let numStr = "" + num;
        while (numStr.length < length) {
          numStr = "0" + numStr;
        }
        return numStr;
      };

      // thanks: http://stackoverflow.com/questions/7975005/format-a-string-using-placeholders-and-an-object-of-substitutions
      let subs = {
        "%UTC_YEAR%": dateVal.getUTCFullYear(),
        "%UTC_MONTH%": pad(dateVal.getUTCMonth() + 1, 2),
        "%UTC_DATE%": pad(dateVal.getUTCDate(), 2),
        "%UTC_HOURS%": pad(dateVal.getUTCHours(), 2),
        "%UTC_MINS%": pad(dateVal.getUTCMinutes(), 2),
        "%UTC_SECONDS%": pad(dateVal.getUTCSeconds(), 2),
      };

      let formatted = "%UTC_YEAR%-%UTC_MONTH%-%UTC_DATE%T%UTC_HOURS%:%UTC_MINS%:%UTC_SECONDS%Z";

      formatted = formatted.replace(/%\w+%/g, function (all) {
        return subs[all] || all;
      });

      return formatted;
    }
  }
  // statics: {
  //   async discover(host) {
  //     try { let response = await axios.get(host, {headers: {'Accept': 'text/x-camli-configuration'}});
  //       console.log(`retrieved camlistore server discovery data from ${host}`);
  //       return this.conf({discovery: response.data});
  //     } catch(e) {
  //       console.log(e);
  //     }
  //   }
  // }
});

// Perkeep = Perkeep.compose({
//   methods: {
//     async findExistingBookmark(bookmarkHash, rootPermanodeRef) {
//       let query = {
//         "sort": "-created",
//         "constraint": {
//           "logical": {
//             "op": "and",
//             "a": {
//               "permanode": {
//                 "attr": "base64url",
//                 "value": bookmarkHash
//               }
//             },
//             "b": {
//               "permanode": {
//                 "relation": {
//                   "relation": "parent",
//                   "any": {
//                     "blobRefPrefix": rootPermanodeRef
//                   }
//                 }
//               }
//             }
//           }
//         },
//         "describe": {
//           "rules": [
//             {
//               "attrs": [
//                 "camliContent",
//                 "camliContentImage"
//               ]
//             }
//           ]
//         }
//       };
//
//       return this.search(query);
//     }
//   }
// });

const config = {
  host: `http://devcam:pass3179@perkeep.test`,
  root: 'History'
};

let pk = Perkeep(config);

pk.discover().then(function () {
  const createPermanode = async () => {
    try {
      // await pk.print();
      const { permanodeId } = await pk.createPermanode({title: 'My Title'});
      console.log(`Saved ${permanodeId}`);
      return permanodeId;
    } catch(e) {
      console.log(e)
    }
  };

  createPermanode();
});
