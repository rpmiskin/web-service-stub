const express = require("express");
const serverConfig = require("./config");
const bodyParser = require("body-parser");

let server;
let requestHistory = {};
const stubbedPaths = {
  // Will contain things like:
  // {
  //   path:'foo/bar',
  //   method:'GET',
  //   type:'json'
  //   response:[{status:200, headers:{}, body:""}]
  // }
};

const app = express();
app.use(bodyParser.json());

function checkConfig(config) {
  if (!config) {
    return { error: "No config specified" };
  }
  if (!config.path) {
    return { error: "No path specified" };
  }

  if (!config.method) {
    return { error: "No method specified" };
  }
  if (!config.response) {
    return { error: "No response specified" };
  }

  // Have we already configured this path?
  if (stubbedPaths[config.path] && stubbedPaths[config.path][config.method]) {
    return {
      error: `Path ${config.method} ${config.path} has already be configured.`
    };
  }
  return undefined;
}

function configureStub(config) {
  if (!stubbedPaths[config.path]) {
    stubbedPaths[config.path] = {};
  }
  stubbedPaths[config.path][config.method] = config.response;
  let router;
  switch (config.method) {
    case "GET":
      router = app.get;
      break;
    case "POST":
      router = app.post;
      break;
    default:
      console.log(`Unexpected method ${config.method}, defaulting to GET`);
      router = app.get;
  }
  app.get(config.path, (req, res) => {
    console.log("aaa");
    // Match path to stubbedPaths.
    if (!stubbedPaths[config.path]) {
      return res.status(404).send();
    }
    // Check for responses.
    let stubResponse = stubbedPaths[config.path].response;
    if (Array.isArray(stubResponse)) {
      if (Array.isArray(stubResponse.length === 0)) {
        console.log(`responses for ${config.method} ${config.path} exhausted`);
        return res.status(404).send();
      }
      stubResponse = stubResponse.unshift();
    }
    // Use the response.
    if (stubResponse.status) {
      res.status(stubResponse.status);
    }
    if (stubResponse.headers) {
      Object.keys(stubResponse.headers).forEach(k =>
        res.set(k, stubResponse.headers[k])
      );
    }
    if (stubResponse.body) {
      return res.send(stubResponse.body);
    }
    return res.end();
  });
}

app.get(serverConfig.path, (req, res) => {
  console.log("returning requests...");
  return res.json(requestHistory);
});
app.delete(serverConfig.path, (req, res) => {
  console.log("clearing configuration and request history...");
  requestHistory = [];
  return res.send("Cleared!");
});

app.post(serverConfig.path, (req, res) => {
  console.log("configuring new path...");
  console.log(JSON.stringify(req.body));
  const validationError = checkConfig(req.body);
  if (validationError) {
    return res.status(403).json(validationError);
  }
  try {
    res.status(200).json(configureStub(req.body));
    server.close();
    setImmediate(() => {
      server.emit("close");
    });
    server = app.listen(serverConfig.port);
  } catch (e) {
    console.log(e.message);
    console.log(e.stack);
    return res.status(503).end();
  }
});

server = app.listen(serverConfig.port, () =>
  console.log(`Listening on port ${serverConfig.port}`)
);
server.on("connection", () => console.log("foo!"));
