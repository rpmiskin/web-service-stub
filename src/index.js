const express = require("express");
const serverConfig = require("./config");
const bodyParser = require("body-parser");
const killable = require("killable");

let server;

let requestHistory = {
  // Will contain things like
  // {
  //   "/foo": {
  //     "GET": [
  //       {
  //         "body": {},
  //         "headers": {
  //           "host": "localhost:3000",
  //           "user-agent": "curl/7.54.0",
  //           "accept": "*/*"
  //         },
  //         "query": { "re": "" },
  //         "params": {}
  //       },
  //       {
  //         "body": {},
  //         "headers": {
  //           "host": "localhost:3000",
  //           "user-agent": "curl/7.54.0",
  //           "accept": "*/*"
  //         },
  //         "query": { "re": "" },
  //         "params": {}
  //       }
  //     ]
  //   }
  // }
};
let stubbedPaths = {
  // // Will contain things like:
  // "/foo/bar": {
  //   GET: {
  //     type: "json",
  //     response: [{ status: 200, headers: {}, body: "" }]
  //   },
  //   DELETE: {
  //     type: "json",
  //     response: { status: 503, headers: {}, body: "" }
  //   }
  // }
};

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
      error: `Path ${config.method} ${config.path} has already been configured.`
    };
  }
  return undefined;
}

function save(args) {
  const { path, method, req } = args;
  if (!requestHistory[path]) {
    requestHistory[path] = {};
  }
  if (!requestHistory[path][method]) {
    requestHistory[path][method] = [];
  }
  requestHistory[path][method].push({
    body: req.body,
    headers: req.headers,
    query: req.query,
    params: req.params
  });
}
function getResponse(args) {
  const { path, method } = args;
  // Check for responses.
  let stubResponse = stubbedPaths[path][method];
  if (Array.isArray(stubResponse)) {
    if (stubResponse.length === 0) {
      console.log(`responses for ${method} ${path} exhausted`);
      return { status: 404 };
    }
    stubResponse = stubResponse.shift();
  }
  return stubResponse;
}
function send(args) {
  const { res } = args;
  const stubResponse = getResponse(args);
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
}

function handler(args) {
  save(args);
  send(args);
}

function configureStub(config) {
  if (!stubbedPaths[config.path]) {
    stubbedPaths[config.path] = {};
  }
  stubbedPaths[config.path][config.method] = config.response;
}

function startServer() {
  const app = express();
  app.use(bodyParser.json());

  app.get(serverConfig.path, (req, res) => {
    console.log("returning requests...");
    return res.json(requestHistory);
  });

  app.delete(serverConfig.path, (req, res) => {
    console.log("clearing configuration and request history...");
    requestHistory = [];
    stubbedPaths = {};
    res.send("Cleared!");
    server.kill(() => {
      console.log("Restarting server...");
      startServer();
    });
  });

  app.post(serverConfig.path, (req, res) => {
    console.log("configuring new path...");
    const validationError = checkConfig(req.body);
    if (validationError) {
      return res.status(403).json(validationError);
    }
    try {
      res.status(200).json(configureStub(req.body));
      return server.kill(() => {
        console.log("Restarting server...");
        startServer();
      });
    } catch (e) {
      console.log(e.message);
      console.log(e.stack);
      return res.status(503).end();
    }
  });

  // Iterate through all of the stubbed paths, creating the handlers.
  Object.keys(stubbedPaths).forEach(path =>
    Object.keys(stubbedPaths[path]).forEach(method => {
      switch (method) {
        case "GET":
          app.get(path, (req, res) => handler({ req, res, path, method }));
          break;
        case "POST":
          app.post(path, (req, res) => handler({ req, res, path, method }));
          break;
        case "PUT":
          app.put(path, (req, res) => handler({ req, res, path, method }));
          break;

        default:
          console.log(`Unsupported method ${method} ${path}`);
          break;
      }
    })
  );

  server = app.listen(serverConfig.port, () => {
    killable(server);
    console.log(`Listening on port ${serverConfig.port}`);
  });
}

startServer();
