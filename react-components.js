var Popup = React.createClass({
  displayName: 'Popup',

  propTypes: {
    config: React.PropTypes.shape({
      serverUrl: React.PropTypes.string.isRequired,
      defaultTags: React.PropTypes.string
    }).isRequired,
    queryString: React.PropTypes.string.isRequired,
    serverConnection: React.PropTypes.object.isRequired
  },

  getInitialState: function () {
    return {
      statusMessage: '',
    };
  },

  // thanks: https://css-tricks.com/snippets/javascript/get-url-variables/
  getQueryParam_: function (param) {
    var vars = this.props.queryString.split("&");
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split("=");
      if (pair[0] == param) {
        return pair[1];
      }
    }
    return false;
  },

  setStatus: function (message) {
    this.setState({
        statusMessage: message
      }
    );
  },

  render: function () {
    return React.createElement("div", null,
      React.createElement("h3", null, "C3: Camli Clipper (Chrome)"),
      React.createElement(ImagePreview,
        {
          imgSrc: this.getQueryParam_('imgSrc'),
        }),
      React.createElement(ImageSubmitForm,
        {
          onError: this.setStatus,
          onProgress: this.setStatus,
          imgSrc: this.getQueryParam_('imgSrc'),
          referrerUrl: this.getQueryParam_('referrer'),
          serverConnection: this.props.serverConnection,
          defaultTags: this.props.config.defaultTags,
        }),
      React.createElement(Status,
        {
          message: this.state.statusMessage,
        })
    );
  }
});

var Status = React.createClass({
  displayName: 'Status',

  propTypes: {
    message: React.PropTypes.string.isRequired,
  },

  render: function () {
    return React.createElement("div",
      {
        id: 'status'
      },
      this.props.message
    );
  }
});

var ImagePreview = React.createClass({
  displayName: 'ImagePreview',

  propTypes: {
    imgSrc: React.PropTypes.string.isRequired,
  },

  render: function () {
    return React.createElement("figure", null,
      React.createElement("image", {src: this.props.imgSrc})
    );
  }
});

var ImageSubmitForm = React.createClass({
  displayName: 'ImageSubmitForm',

  propTypes: {
    defaultTags: React.PropTypes.string,
    imgSrc: React.PropTypes.string.isRequired,
    onError: React.PropTypes.func.isRequired,
    onProgress: React.PropTypes.func.isRequired,
    referrerUrl: React.PropTypes.string,
    serverConnection: React.PropTypes.object.isRequired,
  },

  componentWillMount: function () {
    var message = this.validateForm_();
    if (message) {
      this.props.onError(message)
    }
  },

  getInitialState: function () {
    return {
      imgSrcInput: this.props.imgSrc,
      referrerInput: this.props.referrerUrl,
      tagsInput: this.props.defaultTags,
      tagsInvalid: false
    };
  },

  handleImgSrcChange_: function (event) {
    this.setState({
      imgSrcInput: event.target.value
    });
  },

  handleReferrerChange_: function (event) {
    this.setState({
      referrerInput: event.target.value
    });
  },

  handleTagsChange_: function (event) {
    this.setState({
      tagsInput: event.target.value,
      tagsInvalid: false
    });
  },

  handleOnSubmit_: function (event) {
    event.preventDefault();
    var error = this.validateForm_();
    if (error) {
      this.props.onError(error)
    } else {
      this.initiateUpload_();
    }
  },

  validateForm_: function () {
    if (this.state.tagsInput) {
      var tags = this.state.tagsInput.split(',').map(function (s) {
        return s.trim();
      });
      var invalid = tags.some(function (t) {
        return !t
      });

      if (invalid) {
        this.setState({
          tagsInvalid: true
        });
        return 'At least one invalid tag was supplied';
      }
    }

    return '';
  },

  render: function () {
    return React.createElement("form",
      {
        id: 'upload-form',
        method: 'POST',
        onSubmit: this.handleOnSubmit_,
      },
      React.createElement("label", {htmlFor: 'imageSrc'}, 'Image URL'),
      React.createElement("input",
        {
          onChange: this.handleImgSrcChange_,
          id: 'imageSrc',
          type: 'text',
          name: 'img',
          value: this.state.imgSrcInput
        }
      ),
      React.createElement("label", {htmlFor: 'referrer'}, 'Found on Page'),
      React.createElement("input",
        {
          onChange: this.handleReferrerChange_,
          id: 'referrer',
          type: 'text',
          name: 'img',
          value: this.state.referrerInput
        }
      ),
      React.createElement("label", {htmlFor: 'tags'}, 'Additional Tags'),
      React.createElement("input",
        {
          onChange: this.handleTagsChange_,
          id: 'tags',
          type: 'text',
          name: 'img',
          value: this.state.tagsInput,
          className: this.state.tagsInvalid ? 'invalid' : '',
        }
      ),
      React.createElement("input",
        {
          type: 'submit',
          value: 'Send to Camlistore'
        }
      )
    );
  },

  initiateUpload_: function () {
    this._fetchImage(this.state.imgSrcInput)
      .then(this.captureBlobAndComputeRef_)
      .then(this.assembleResults_)
      .then(this._checkForDuplicate)
      .then(this.doUpload_)
      .then(this.createPermanode_)
      .then(this.addPermanodeMetadata_)
      .then(this.onFinish_)
      .catch(function (error) {
        console.log("Error caught: ", error.message);
        this.props.onError(error.message);
      }.bind(this));
  },

  _fetchImage: function (url) {
    if (this.isDataURL_(url)) {
      return this.dataURLToBlob_(url);
    }

    return this.getAsBlob_(url);
  },

  captureBlobAndComputeRef_: function (blob) {
    var resolvedBlob = Promise.resolve(blob);
    var blobref = this.convertToTypedArray_(blob).then(this.generateHash_);

    return Promise.all([resolvedBlob, blobref]);
  },

  convertToTypedArray_: function (blob) {
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
      }

      reader.readAsArrayBuffer(blob);
    });
  },

  generateHash_: function (arrayBuffer) {
    var bytes = new Uint8Array(arrayBuffer);
    var blobref = 'sha1-' + Crypto.SHA1(bytes);
    console.log('hash computed: ' + blobref);
    return blobref;
  },

  // 'readable=ify' the results
  assembleResults_: function (results) {
    return {
      'blob': results[0],
      'blobref': results[1]
    };
  },

  _checkForDuplicate: function (results) {
    console.log('checking for duplicates');
    var sc = this.props.serverConnection;
    return sc.findFileByRef(results.blobref).then(
      function (json) {
        return results; // ignore empty json and keep passing results
      });
  },

  doUpload_: function (results) {
    var sc = this.props.serverConnection;
    return sc.uploadBlob(results.blob).then(
      function (ref) {
        console.log('blob uploaded: ' + ref);
        results.fileref = ref;
        return results;
      });
  },

  createPermanode_: function (results) {
    var sc = this.props.serverConnection;
    return sc.createPermanode().then(
      function (data) {
        console.log('permanode created: ' + data);
        results.permanoderef = data
        return results;
      });
  },

  addPermanodeMetadata_: function (results) {
    var camliContent = this.addCamliContentRef_(results.permanoderef, results.fileref);
    var imgSrc = this.addImageSrcAttribute_(results.permanoderef, this.state.imgSrcInput);
    var referrer = this.addReferrerAttribute_(results.permanoderef, this.state.referrerInput);
    var tags = this.addTags_(results);

    return Promise.all([camliContent, imgSrc, referrer, tags]);
  },

  updatePermanodeAttr_: function (ref, operation, attribute, value) {
    var sc = this.props.serverConnection;
    return sc.updatePermanodeAttr(ref, operation, attribute, value).then(
      function (data) {
        console.log(attribute + ' attribute added: ' + data);
        return data;
      });
  },

  addCamliContentRef_: function (permanoderef, fileref) {
    return this.updatePermanodeAttr_(permanoderef, "set-attribute", "camliContent", fileref);
  },

  addImageSrcAttribute_: function (permanoderef, value) {
    return this.updatePermanodeAttr_(permanoderef, "set-attribute", "imgSrc", value);
  },

  addReferrerAttribute_: function (permanoderef, value) {
    return this.updatePermanodeAttr_(permanoderef, "set-attribute", "referrer", value);
  },

  addTags_: function (results) {
    var sc = this.props.serverConnection;
    var promises = [];
    var tags = this.state.tagsInput.split(',').map(function (s) {
      return s.trim();
    });
    tags.forEach(function (tag) {
      if (tag) {
        promises.push(sc.updatePermanodeAttr(results.permanoderef, "add-attribute", "tag", tag));
      }
    });

    return Promise.all(promises).then(function (results) {
      results.forEach(function (ref) {
        console.log('tag attribute added: ' + ref);
      });
      return results;
    });
  },

  onFinish_: function (results) {
    this.props.onProgress('Success!');
  },

  /**
   * Request to load a url as a 'blob'
   *
   * @param {string} url of item to download as blob.
   */
  getAsBlob_: function (url) {
    console.log('fetching blob from: ' + url);
    return new Promise(function (resolve, reject) {
      var request = new XMLHttpRequest();
      request.open('GET', url);
      request.responseType = 'blob';

      request.onload = function () {
        if (request.status === 200) {
          resolve(request.response);
        } else {
          reject(Error('Blob didn\'t load successfully; error:' + request.statusText));
        }
      }.bind(this);

      request.onerror = function () {
        reject(Error('There was a network error loading the blob'));
      };

      request.send();
    });
  },

  /**
   * Creates and returns a blob from a data URL (either base64 encoded or not).
   *     thanks: https://github.com/ebidel/filer.js/blob/master/src/filer.js#L137
   *
   * @param {string} dataURL The data URL to convert.
   */
  dataURLToBlob_: function (dataURL) {
    console.log('creating blob from provided dataURL');
    return new Promise(function (resolve, reject) {
      var BASE64_MARKER = ';base64,';
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
  },

  isDataURL_: function (url) {
    return url.startsWith('data:');
  }
});

var OptionsPopup = React.createClass({
  displayName: 'OptionsPopup',

  getInitialState: function () {
    return {
      statusMessage: ''
    };
  },

  setStatus: function (message) {
    this.setState({
        statusMessage: message
      }
    );
  },

  render: function () {
    return React.createElement("div", null,
      React.createElement("h3", null, "Options"),
      React.createElement(OptionsForm,
        {
          onError: this.setStatus,
          onProgress: this.setStatus,
        }),
      React.createElement(Status,
        {
          message: this.state.statusMessage,
        })
    );
  }
});

var OptionsForm = React.createClass({
  displayName: 'OptionsForm',

  propTypes: {
    onError: React.PropTypes.func.isRequired,
    onProgress: React.PropTypes.func.isRequired
  },

  componentWillMount: function () {
    this.runFormValidation_();
  },

  runFormValidation_: function () {
    var message = this.validateForm_();
    if (message) {
      this.props.onError(message)
    }
  },

  getInitialState: function () {
    return {
      serverUrl: '',
      defaultTags: '',
      rootPermanodeName: '',
      rootPermanodeRef: '',
      tagsInvalid: false
    };
  },

  componentDidMount: function () {
    this.fetchOptions_()
      .then(this.updateForm_)
      .catch(function (error) {
        this.props.onError(error.message);
      }.bind(this))
  },

  fetchOptions_: function () {
    return new Promise(function (resolve, reject) {
      chrome.storage.sync.get(['serverUrl', 'defaultTags', 'rootPermanodeName', 'rootPermanodeRef'], function (items) {
        if (chrome.runtime.lastError) {
          console.log('Error getting options');
          reject(chrome.runtime.lastError) // TODO: how to forcibly test this error condition?
        }
        resolve(items);
      });
    });
  },

  setRootPermanode: function () {
    let self = this;
    return new Promise(function (resolve, reject) {
      PerkeepServer.discover({serverUrl: self.state.serverUrl, user: 'user', pass: 'pass'})
        .then(function (server) {
          return server.getRootPermanode(self.state.rootPermanodeName);
        })
        .then(function (permanode) {
          self.setState({
            rootPermanodeRef: permanode.blobRef
          });
          resolve();
        })
        .catch(function (error) {
          reject(error);
        });
    });
  },

  saveOptions_: function () {
    this.props.onProgress('Saving...');
    return new Promise(function (resolve, reject) {
      chrome.storage.sync.set(
        {
          serverUrl: this.state.serverUrl,
          defaultTags: this.state.defaultTags,
          rootPermanodeName: this.state.rootPermanodeName,
          rootPermanodeRef: this.state.rootPermanodeRef
        },
        function () {
          if (chrome.runtime.error) {
            reject(Error('Error saving options'));
          } else {
            resolve();
          }
        }
      );
    }.bind(this));
  },

  onFinish_: function () {
    this.props.onProgress('Options saved!');
    setTimeout(function () {
      this.props.onProgress('');
    }.bind(this), 1500);
  },

  updateForm_: function (options) {
    this.setState({
      serverUrl: options.serverUrl,
      defaultTags: options.defaultTags,
      rootPermanodeName: options.rootPermanodeName,
      rootPermanodeRef: options.rootPermanodeRef
    }, this.runFormValidation_);
  },

  handleUrlChange_: function (event) {
    this.setState({
      serverUrl: event.target.value
    });
  },

  handleTagsChange_: function (event) {
    this.setState({
      defaultTags: event.target.value,
      tagsInvalid: false
    });
  },

  handleRootChange: function (event) {
    this.setState({
      rootPermanodeName: event.target.value
    });
  },

  handleOnSubmit_: function (event) {
    event.preventDefault();
    this.validateForm_()
      .then(this.setRootPermanode)
      .then(this.saveOptions_)
      .then(this.onFinish_)
      .catch(function (error) {
        this.props.onError(error.message);
      }.bind(this));
  },

  validateForm_: function () {
    return new Promise(function (resolve, reject) {
      if (this.state.defaultTags) {
        var tags = this.state.defaultTags.split(',').map(function (s) {
          return s.trim();
        });
        var invalid = tags.some(function (t) {
          return !t
        });

        if (invalid) {
          this.setState({
            tagsInvalid: true
          });
          reject(Error('At least one invalid tag was supplied'));
        }
      }

      resolve();
    }.bind(this));
  },

  render: function () {
    return React.createElement("form",
      {
        id: 'options-form',
        onSubmit: this.handleOnSubmit_,
      },
      React.createElement("label", {htmlFor: 'serverUrl'}, 'Server URL'),
      React.createElement("input",
        {
          onChange: this.handleUrlChange_,
          id: 'serverUrl',
          type: 'text',
          value: this.state.serverUrl
        }
      ),
      React.createElement("label", {htmlFor: 'defaultTags'}, 'Default Tag(s)'),
      React.createElement("input",
        {
          onChange: this.handleTagsChange_,
          id: 'defaultTags',
          type: 'text',
          value: this.state.defaultTags,
          className: this.state.tagsInvalid ? 'invalid' : ''
        }
      ),
      React.createElement("label", {htmlFor: 'rootPermanodeName'}, 'Root Permanode'),
      React.createElement("input",
        {
          onChange: this.handleRootChange,
          id: 'rootPermanodeName',
          type: 'text',
          value: this.state.rootPermanodeName
        }
      ),
      React.createElement("label", {}, this.state.rootPermanodeRef),
      React.createElement("input",
        {
          type: 'submit',
          value: 'Save'
        }
      )
    );
  }
});