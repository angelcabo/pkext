import React from "react";
import {hot} from "react-hot-loader";
import Perkeep from '../perkeep/manager.js'

class ServerComponent extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      statusMessage: '',
      serverUrl: '',
      rootPermanodeName: '',
      rootPermanodeRef: ''
    };

    this.handleOnSubmit = this.handleOnSubmit.bind(this);
    this.handleUrlChange = this.handleUrlChange.bind(this);
    this.handleRootChange = this.handleRootChange.bind(this);
    this.updateForm = this.updateForm.bind(this);
    this.setStatus = this.setStatus.bind(this);
    this.saveOptions = this.saveOptions.bind(this);
    this.onFinish = this.onFinish.bind(this);
  }

  componentDidMount() {
    this.fetchOptions()
      .then(this.updateForm)
      .catch(function (error) {
        this.setStatus(error.message);
      }.bind(this));
  }

  fetchOptions() {
    return new Promise(function (resolve, reject) {
      chrome.storage.sync.get(['serverUrl', 'rootPermanodeName', 'rootPermanodeRef'], function (items) {
        if (chrome.runtime.lastError) {
          console.log('Error fetching options');
          reject(chrome.runtime.lastError);
        }
        resolve(items);
      })
    })
  }

  updateForm(options) {
    console.log(options);
    this.setState({
      serverUrl: options.serverUrl,
      rootPermanodeName: options.rootPermanodeName,
      rootPermanodeRef: options.rootPermanodeRef
    });
  }

  setStatus(message) {
    this.setState({
      statusMessage: message
    });
  }

  setRootPermanode() {
    let self = this;
    return Perkeep.discover({serverUrl: self.state.serverUrl, user: 'user', pass: 'pass'})
      .then(function (server) {
        return server.getRootPermanode(self.state.rootPermanodeName);
      })
      .then(function (permanode) {
        console.log(permanode);
        return self.setState({
          rootPermanodeRef: permanode.blobRef
        });
      });
  }

  saveOptions() {
    this.setStatus('Saving...');
    console.log('made it here');
    return new Promise(function (resolve, reject) {
      chrome.storage.sync.set({
        serverUrl: this.state.serverUrl,
        rootPermanodeName: this.state.rootPermanodeName,
        rootPermanodeRef: this.state.rootPermanodeRef
      }, function () {
        if (chrome.runtime.error) {
          reject(Error('Error saving options'));
        } else {
          resolve();
        }
      })
    }.bind(this));
  }

  handleUrlChange(event) {
    this.setState({
      serverUrl: event.target.value
    });
  }

  handleRootChange(event) {
    this.setState({
      rootPermanodeName: event.target.value
    });
  }

  onFinish() {
    this.setStatus('Options saved!');
    setTimeout(function () {
      this.setStatus('');
    }.bind(this), 1500)
  }

  handleOnSubmit(event) {
    event.preventDefault();
    this.setRootPermanode()
      .then(this.saveOptions)
      .then(this.onFinish)
      .catch(function (error) {
        this.setStatus(error.message);
      }.bind(this));
  }

  render() {
    return (
      <div>
        <h3>Options</h3>
        <form id={'options-form'} onSubmit={this.handleOnSubmit}>
          <label htmlFor="serverUrl">Server URL</label>
          <input id={'serverUrl'} type={'text'} value={this.state.serverUrl} onChange={this.handleUrlChange}/>

          <br/>

          <label htmlFor="rootPermanodeName">Root Permanode</label>
          <input id={'rootPermanodeName'} type={'text'} value={this.state.rootPermanodeName} onChange={this.handleRootChange}/>

          <br/>

          <label>{this.state.rootPermanodeRef}</label>

          <br/>

          <input type={'submit'} value={'Save'}/>
        </form>
        <div id={'status'}>{this.state.statusMessage}</div>
      </div>
    )
  }
}

export default hot(module)(ServerComponent)
