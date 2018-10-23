import React from "react";
import {hot} from "react-hot-loader";

class ServerConfiguration extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      statusMessage: '',
      user: '',
      password: '',
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

    let perkeep = Perkeep({
      host: self.state.serverUrl,
      user: self.state.user,
      password: self.state.password
    });

    return perkeep.discover()
      .then(function (discoveryConfig) {
        perkeep.discoveryConfig = discoveryConfig;
        return perkeep.upload(data);
      })
      .then(function () {
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

  handleUserChange(event) {
    this.setState({
      user: event.target.value
    });
  }

  handlePasswordChange(event) {
    this.setState({
      password: event.target.value
    });
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
    let self = this;
    this.setStatus('Options saved!');
    setTimeout(function () {
      self.setStatus('');
    }.bind(this), 1500)
  }

  handleOnSubmit(event) {
    event.preventDefault();
    let self = this;
    this.setRootPermanode()
      .then(this.saveOptions)
      .then(this.onFinish)
      .catch(function (error) {
        self.setStatus(error.message);
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
          <label htmlFor="user">User</label>
          <input id={'user'} type={'text'} value={this.state.user} onChange={this.handleUserChange}/>
          <br/>
          <label htmlFor="password">Password</label>
          <input id={'password'} type={'text'} value={this.state.password} onChange={this.handlePasswordChange}/>

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

export default hot(module)(ServerConfiguration)
