import axios from 'axios'
import Connection from './connection.js'
import Permanode from './permanode.js'

export default class Manager {
  constructor(connection, options) {
    this.connection = connection;
    this.rootPermanodeRef = options.rootPermanodeRef;
  }

  static discover(options) {
    return axios.get(options.serverUrl, {headers: {'Accept': 'text/x-camli-configuration'}})
      .then(function (response) {
        console.log('retrieved camlistore server discovery data from: ' + options.serverUrl);
        let connection = new Connection(options.serverUrl, response.data);
        return new Manager(connection, {rootPermanodeRef: options.rootPermanodeRef});
      });
  }

  getRootPermanode(name) {
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

    return this.connection.search(query).then(function (response) {
      let root = response.description.meta[response.blobs[0].blob];
      return {blobRef: root.blobRef, rootName: root.permanode.attr.camliRoot[0]};
    });
  }

  createNewPermanodeOnRoot() {

  }

  findBookmarkOnRoot() {

  }

  /*
  {

   */
  findOrCreatePermanode(attrs) {
    let self = this;
    let url = new URL(attrs.url);
    let encodedUrl = btoa(url.hostname.replace('www.', '') + url.pathname);

    return this.findBookmarkOnRoot(this.rootPermanodeRef, encodedUrl)
      .then(function (result) {
        if (result) {
          return result;
        } else {
          return self.createNewPermanodeOnRoot(attrs.url, attrs.title, encodedUrl)
            .then(function () {
              return self.findBookmarkOnRoot(self.rootPermanodeRef, encodedUrl);
            });
        }
      });
  };
}