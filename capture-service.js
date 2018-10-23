CaptureService = function() {};

CaptureService.convert = function (src) {
  this._fetchImage(src)
    .then(this.captureBlobAndComputeRef_)
    .then(this.assembleResults_)
    .then(this._checkForDuplicate)
    .then(this.doUpload_)
    .then(this.createPermanode_)
    .then(this.addPermanodeMetadata_)
    .then(this.onFinish_)
    .catch(function(error) {
      console.log("Error caught: ", error.message);
      this.props.onError(error.message);
    }.bind(this));
};
