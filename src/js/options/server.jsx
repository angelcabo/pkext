import React from "react";
import { hot } from "react-hot-loader";

class ServerComponent extends React.Component {
  render () {
    return (
      <div>
        <p>Details about your server!</p>
      </div>
    )
  }
}

export default hot(module)(ServerComponent)
