const express = require("express");
const config = require("./config");

function wrapper(fn) {
  return (req, res) => {
    console.log(`wrapper ${JSON.stringify(res.headers)}`);
    return fn(req, res);
  };
}

let requests = [];
const realApp = express();
const app = new Proxy(realApp, {
  get: (target, path, fn) => target.get(path, wrapper(fn))
});

app.get("/", (req, res) => {
  // console.log(JSON.stringify(req.headers, null, 3));
  // console.log(JSON.stringify(req.path, null, 3));
  requests.push({
    path: req.path,
    headers: req.headers
  });
  return res.send("Hello World!");
});

app.get("/stub", (req, res) => {
  console.log("returning requests...");
  return res.json(requests);
});

app.delete("/stub", (req, res) => {
  console.log("clearing requests...");
  requests = [];
  return res.send("Cleared!");
});

app.listen(config.port, () => console.log(`Listening on port ${config.port}`));
