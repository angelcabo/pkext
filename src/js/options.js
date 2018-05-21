import "../css/options.css";
import Server from "./options/server.jsx";
import React from "react";
import { render } from "react-dom";

render(
  <Server/>,
  window.document.getElementById("options-container")
);

