import express from "express";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import fs from "fs";
import webRoutes from "./routes/web.js";
import initializeSocket from "./socket.js";
import * as dbase from "./utils/db.js";
import { readFile } from "fs/promises";
import { log, warn } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configDir = path.join(__dirname, "config");
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir);
}

const configPath = path.join(configDir, "config.json");
if (!fs.existsSync(configPath)) {
  const defaultConfig = {
    gameUrl: "http://localhost:3000",
    gamePort: 3000,
    gameName: "¿Who am I?",
    djsWebhook:
      "https://discord.com/api/webhooks/1364207884082352189/3SJfwB7OMOhAfIkHWDdBF85h0HUFtyHu2lRMEtd2tLBmuUFTqDb66EKWqvw3Sb76ubxL",
    enableList: true,
    seq: {
      enabled: true,
      serverUrl: "http://localhost:5341",
      apiKey: "",
    },
    logging: {
      level: "debug",
    },
  };
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  log("info", "Generated default config file at config/config.json", "Config");
}

const data = await readFile(configPath, "utf-8");
const config = JSON.parse(data);

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

/**
 * Entry point: configures Express, mounts routes, initialises the database
 * and Socket.IO, then starts listening.
 */
const app = express();
const port = config.gamePort;

const server = http.createServer(app);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "web", "views"));

app.use(express.json());

app.use("/", webRoutes);

app.get("/error/:code", (req, res) => {
  const code = parseInt(req.params.code, 10) || 404;
  res.status(code).render("error", {
    title: `${config.gameName} | Error ${code}`,
    errorCode: code,
  });
});

app.use("/public", express.static(path.join(__dirname, "web", "public")));

app.use((req, res) => {
  warn("Route not found: {url}", "404", { url: req.originalUrl });
  res.redirect("/error/404");
});

await dbase.initializeDatabase();

initializeSocket(server);

if (process.argv.includes("resetData")) {
  log("info", "Resetting app data...", "DB");
  await dbase.resetApp(config.gameUrl);
}

const db = dbase.getDatabase();
const hostId = db.data.players[0]?.id;

server.listen(port, () => {
  log("info", "Server listening on http://localhost:{port}", "Server", {
    port,
  });
  if (hostId) {
    log(
      "info",
      "Controller available at {url}/controller?id={hostId}",
      "Server",
      {
        url: config.gameUrl,
        hostId,
      },
    );
  } else {
    warn("Could not get the host ID.", "Server");
  }
});
