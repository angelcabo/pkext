import axios from 'axios'
import Connection from './connection.js'

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
}