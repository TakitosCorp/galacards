import express from "express";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import fs from "fs";
import webRoutes from "./routes/web.js";
import initializeSocket from "./socket.js";
import * as dbase from "./utils/db.js";
import { readFile } from "fs/promises";

const data = await readFile("./config/config.json", "utf-8");
const config = JSON.parse(data);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const app = express();
const port = config.gamePort;

const server = http.createServer(app);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "web", "views"));

app.use(express.json());

// Routes
app.use("/", webRoutes);
app.get("/error/:code", (req, res) => {
  const code = parseInt(req.params.code, 10) || 404;
  res
    .status(code)
    .render("error", {
      title: `${config.gameName} | Error ${code}`,
      errorCode: code,
    });
});

app.use("/public", express.static(path.join(__dirname, "web", "public")));

// Server initialization

// Initialize socket.io
initializeSocket(server);

// Initialize database
await dbase.initializeDatabase();

if (process.argv.includes("resetData")) {
  await dbase.resetApp(config.gameUrl);
}

// Get the host ID from the database
const db = dbase.getDatabase();
const hostId = db.data.players[0]?.id;

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  if (hostId) {
    console.log(
      `Controller available at ${config.gameUrl}/controller?id=${hostId}`,
    );
  } else {
    console.log("Could not get the host ID.");
  }
});
