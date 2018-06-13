import "../css/options.css";
import ServerConfiguration from "./options/ServerConfiguration.jsx";
import React from "react";
import { render } from "react-dom";

render(
  <ServerConfiguration/>,
  window.document.getElementById("options-container")
);

