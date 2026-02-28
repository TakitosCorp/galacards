import { Router } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";
import { getDatabase } from "../utils/db.js";

const data = await readFile("./config/config.json", "utf-8");
const config = JSON.parse(data);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

const isValidId = (req, res, next) => {
  const db = getDatabase();
  const players = db.data.players || [];
  const userId = req.query.id;

  if (!userId) {
    console.warn(`[Auth] Missing ID for route ${req.path}`);
    return res.redirect("/error/401");
  }

  if (userId === "obs" || players.some((player) => player.id === userId)) {
    return next();
  }

  console.warn(`[Auth] Invalid ID '${userId}' for route ${req.path}`);
  return res.redirect("/error/401");
};

const isHost = (req, res, next) => {
  const db = getDatabase();
  const players = db.data.players || [];
  const userId = req.query.id;

  if (!userId) {
    console.warn(`[Auth] Missing ID for host route ${req.path}`);
    return res.redirect("/error/401");
  }

  if (players[0] && players[0].id === userId) {
    return next();
  }

  console.warn(
    `[Auth] Forbidden access for ID '${userId}' on host route ${req.path}`,
  );
  return res.redirect("/error/403");
};

const isHostOrPlayer = (req, res, next) => {
  const db = getDatabase();
  const players = db.data.players || [];
  const userId = req.query.id;

  if (!userId) {
    console.warn(`[Auth] Missing ID for player route ${req.path}`);
    return res.redirect("/error/401");
  }

  if (players.some((player) => player.id === userId)) {
    return next();
  }

  console.warn(
    `[Auth] Forbidden access for ID '${userId}' on player route ${req.path}`,
  );
  return res.redirect("/error/403");
};

router.get("/", isValidId, (req, res) => {
  res.render("index", {
    title: `Home | ${config.gameName}`,
    gameTitle: config.gameName,
  });
});

router.get("/overlay", isValidId, (req, res) => {
  res.render("overlay", {
    title: `Overlay | ${config.gameName}`,
    gameTitle: config.gameName,
  });
});

router.get("/generic", isHostOrPlayer, (req, res) => {
  res.render("generic", {
    title: `Generic | ${config.gameName}`,
    gameTitle: config.gameName,
  });
});

router.get("/controller", isHost, (req, res) => {
  res.render("controller", {
    title: `Control | ${config.gameName}`,
    gameTitle: config.gameName,
  });
});

router.get("/player", isHostOrPlayer, (req, res) => {
  res.render("player", {
    title: `Game | ${config.gameName}`,
    gameTitle: config.gameName,
  });
});

router.get("/list", isValidId, (req, res) => {
  if (!config.enableList) {
    return res.redirect("/error/403");
  }
  res.render("list", {
    title: `List | ${config.gameName}`,
    gameTitle: config.gameName,
  });
});

router.get("/sw.js", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "web", "public", "js", "sw.js"));
});

router.get("/images", (req, res) => {
  const imageDir = path.join(__dirname, "..", "web", "public", "images");
  fs.readdir(imageDir, (err, files) => {
    if (err) {
      console.error("[FS] Error reading the images directory:", err);
      return res.status(500).json({ error: "Could not read the images" });
    }

    const images = files.filter(
      (file) =>
        file !== "favicon.png" &&
        file !== "LOGO.avif" &&
        file !== "TC.avif" &&
        file !== "GENERAL.avif",
    );
    res.json(images);
  });
});

export default router;
