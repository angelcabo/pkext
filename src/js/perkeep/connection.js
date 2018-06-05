import axios from 'axios'

export default class Connection {
  constructor(serverUrl, config) {
    this.server_url_ = serverUrl;
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

  search(query) {
    return axios.post(this.SEARCH_ROOT + 'camli/search/query', JSON.stringify(query), {headers: {'Content-Type': 'application/json'}})
      .then(function (response) {
        return response.data;
      });
  }
}