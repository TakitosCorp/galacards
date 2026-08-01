import path from "path";
import { fileURLToPath } from "url";
import { Low } from "lowdb";
import fs from "fs";
import { customAlphabet } from "nanoid";
import { error, warn, debug } from "./logger.js";
import { AtomicJSONFile } from "./dbAdapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFile = path.join(__dirname, "..", "data", "db.json");
const imageDir = path.join(__dirname, "..", "web", "public", "images");

const defaultData = {
  players: [],
  game: {
    gameState: "",
    images: [],
    remainingImages: [],
    selectedImages: [],
    totalRounds: 0,
    currentRound: 0,
    currentPlayer: null,
    presentation: {
      active: false,
      currentPresenter: null,
      stage: 0, // 0: all visible, 1-4: specific player + host
    },
  },
};
let db;

/**
 * Writes the current database state to disk.
 * Plain pass-through to handle exceptions at call sites if needed.
 */
async function safeDbWrite() {
  await db.write();
}

// Create a custom nanoid with letters and numbers
const nanoid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  8,
);

/**
 * Reads the JSON database file and initializes the LowDB singleton.
 * Must be called before {@link getDatabase}.
 */
export async function initializeDatabase() {
  const adapter = new AtomicJSONFile(dbFile);
  db = new Low(adapter, defaultData);
  await db.read();
  if (db.data === defaultData) {
    await db.write();
  }
}

/**
 * Returns the initialized LowDB singleton instance.
 * @returns {import("lowdb").Low<typeof defaultData>} The database.
 */
export function getDatabase() {
  return db;
}

/**
 * Resets the entire game state (images, players, scores).
 * @param {string} gameBaseUrl - Base URL used to build player links.
 */
export async function resetApp(gameBaseUrl) {
  await generateGameData();
  await generatePlayerData(gameBaseUrl);
}

/**
 * Creates the host (index 0) and 4 player entries in the database.
 * @param {string} gameBaseUrl - Base URL for player page links.
 */
async function generatePlayerData(gameBaseUrl) {
  db.data.players = [];
  const hostId = nanoid();

  const host = {
    id: hostId,
    vdoUrl: `https://vdo.ninja/?push=${hostId}&webcam&outboundvideobitrate=2000&maxvideobitrate=2000&maxbandwidth=10000&videobitrate=2000&quality=1&width=390&height=520&contenthint=motion&maxframerate=60&quality=1&stereo=1`,
    name: "Host",
  };
  db.data.players.push(host);

  for (let i = 1; i <= 4; i++) {
    const pId = nanoid();
    const player = {
      id: pId,
      playerUrl: `${gameBaseUrl}/?id=${pId}`,
      vdoUrl: `https://vdo.ninja/?push=${pId}&webcam&outboundvideobitrate=2000&maxvideobitrate=2000&maxbandwidth=10000&videobitrate=2000&quality=1&width=390&height=520&contenthint=motion&maxframerate=60&quality=1&stereo=1`,
      name: `Player ${i}`,
      score: 0,
    };
    db.data.players.push(player);
  }

  await safeDbWrite();
}

/**
 * Scans the images directory, resets game state for a fresh round,
 * and sets totalRounds to imageCount / 4.
 */
export async function generateGameData() {
  try {
    const files = await fs.promises.readdir(imageDir);
    const images = files.filter(
      (file) =>
        file !== "favicon.png" &&
        file !== "LOGO.avif" &&
        file !== "TC.avif" &&
        file !== "GENERAL.avif",
    );
    db.data.game.images = images;
    db.data.game.remainingImages = [...images];
    db.data.game.selectedImages = [];
    db.data.game.currentRound = 0;
    db.data.game.totalRounds = images.length / 4;
    db.data.game.gameState = "waiting";
    db.data.game.currentPlayer = null;
    db.data.game.assignedScores = [];
    await setAllPlayerScores(0);
    await safeDbWrite();
  } catch (err) {
    error(
      "Error reading the images directory: {error}",
      "DB",
      { error: err.message },
      { error: err },
    );
    throw new Error("Could not read the images");
  }
}

/**
 * Clears currentPlayer and assignedScores after a spin completes.
 */
export async function resetAfterSpin() {
  db.data.game.currentPlayer = null;
  db.data.game.assignedScores = [];
  await safeDbWrite();
}

/**
 * Returns a single player by ID.
 * @param {string} playerId
 * @returns {{ id: string, name: string, score?: number, playerUrl?: string, vdoUrl?: string }}
 */
export async function getPlayerInfo(playerId) {
  const player = db.data.players.find((p) => p.id === playerId);
  if (!player) {
    throw new Error("Player not found");
  }
  return player;
}

/**
 * Returns all players (host + 4), or an empty array if none exist.
 * @returns {Array<{ id: string, name: string }>}
 */
export async function getAllPlayers() {
  return db.data.players || [];
}

/**
 * Updates a player's display name and persists to disk.
 * @param {string} playerId
 * @param {string} name - New display name.
 */
export async function updatePlayerName(playerId, name) {
  debug("Updating player name: {playerId} -> {name}", "DB", { playerId, name });
  const player = db.data.players.find((p) => p.id === playerId);
  if (player) {
    player.name = typeof name === "string" ? name : player.name;
    try {
      await safeDbWrite();
    } catch (err) {
      error(
        "Failed to update player name for {playerId}: {error}",
        "DB",
        { playerId, error: err.message },
        { error: err, playerId },
      );
      throw err;
    }
  }
}

/**
 * Returns the full game state object.
 * @returns {typeof defaultData["game"]}
 */
export async function getGameState() {
  return db.data.game || {};
}

/**
 * Sets the top-level gameState string (e.g. "waiting", "playing").
 * @param {string} newState
 */
export async function updateGameState(newState) {
  db.data.game.gameState = newState;
  await safeDbWrite();
}

/**
 * Replaces the selected images for the current round.
 * @param {string[]} selectedImages
 */
export async function updateSelectedImages(selectedImages) {
  db.data.game.selectedImages = selectedImages;
  await safeDbWrite();
}

/**
 * Removes already-selected images from the remaining pool.
 */
export async function updateRemainingImages() {
  db.data.game.remainingImages = db.data.game.remainingImages.filter(
    (img) => !db.data.game.selectedImages.includes(img),
  );
  await safeDbWrite();
}

/**
 * Increments the current round counter by 1.
 */
export async function updateCurrentRound() {
  db.data.game.currentRound += 1;
  await safeDbWrite();
}

/**
 * Awards points to a player or records a provisional "0" (host) entry.
 * First caller gets +1, second caller gets +0.5. Max 2 entries per spin.
 * @param {string} playerId - "0" for host provisional, else a player ID.
 */
export async function addScore(playerId) {
  if (playerId === "0") {
    const actualScores = db.data.game.assignedScores || [];
    if (actualScores.length < 2) {
      actualScores.push(playerId);
      db.data.game.assignedScores = actualScores;
      await safeDbWrite();
    }
    return;
  }

  const player = db.data.players.find((p) => p.id === playerId);
  if (!player) return;

  const actualScores = db.data.game.assignedScores || [];

  if (actualScores.length >= 2) return;

  if (actualScores.length === 0) {
    player.score += 1;
    actualScores.push(playerId);
  } else if (actualScores.length === 1) {
    player.score += 0.5;
    actualScores.push(playerId);
  }

  db.data.game.assignedScores = actualScores;
  await safeDbWrite();
}

/**
 * Returns the current score for a player (0 if not found).
 * @param {string} playerId
 * @returns {number}
 */
export async function getPlayerScore(playerId) {
  const player = db.data.players.find((p) => p.id === playerId);
  return player ? player.score : 0;
}

/**
 * Resets every player's score to the given value.
 * @param {number} score
 */
export async function setAllPlayerScores(score) {
  for (const player of db.data.players) {
    player.score = score;
  }
  await safeDbWrite();
}

/**
 * Returns an array of { id, score } for all players.
 * @returns {Array<{ id: string, score: number }>}
 */
export async function getAllPlayerScores() {
  return db.data.players.map(({ id, score }) => ({
    id,
    score: typeof score === "object" ? score.score || 0 : score || 0,
  }));
}

/**
 * Returns the provisional score entries for the current spin.
 * @returns {string[]} Array of player IDs (or "0" for host).
 */
export async function getAssignedScores() {
  return db.data.game.assignedScores || [];
}

/**
 * Returns the 1-based player index of the current turn, or null.
 * @returns {number|null}
 */
export async function getCurrentPlayer() {
  const players = db.data.players.slice(1, 5);
  const currentPlayerId = db.data.game.currentPlayer;

  if (!currentPlayerId) {
    return null;
  }

  const currentIndex = players.findIndex((p) => p.id === currentPlayerId);
  return currentIndex !== -1 ? currentIndex + 1 : null;
}

/**
 * Advances currentPlayer to the next player, or null if the round is done.
 */
export async function setCurrentPlayer() {
  const players = db.data.players.slice(1, 5);
  const currentPlayer = db.data.game.currentPlayer;

  if (currentPlayer === null) {
    db.data.game.currentPlayer = players[0]?.id || null;
  } else {
    const currentIndex = players.findIndex((p) => p.id === currentPlayer);
    if (currentIndex === -1 || currentIndex === players.length - 1) {
      db.data.game.currentPlayer = null;
    } else {
      db.data.game.currentPlayer = players[currentIndex + 1]?.id || null;
    }
  }

  await safeDbWrite();
}

/**
 * Resets presentation state to inactive (stage 0).
 * @returns {typeof defaultData["game"]["presentation"]}
 */
export async function resetPresentation() {
  debug("Restarting presentation on the server", "DB");
  if (!db.data.game.presentation) {
    db.data.game.presentation = {};
  }

  db.data.game.presentation.active = false;
  db.data.game.presentation.currentPresenter = null;
  db.data.game.presentation.stage = 0;

  await safeDbWrite();
  debug(
    "Presentation restarted",
    "DB",
    {},
    { presentation: db.data.game.presentation },
  );
  return db.data.game.presentation;
}

/**
 * Returns the current presentation state, initializing defaults if absent.
 * @returns {{ active: boolean, currentPresenter: string|null, stage: number }}
 */
export async function getPresentation() {
  if (!db.data.game.presentation) {
    db.data.game.presentation = {
      active: false,
      currentPresenter: null,
      stage: 0,
    };
  } else if (db.data.game.presentation.stage === undefined) {
    db.data.game.presentation.stage = 0;
  }

  return db.data.game.presentation;
}

/**
 * Advances the presentation stage (cycles 0→1→2→3→4→0).
 * Stage 0 means all visible; stages 1-4 show a specific player + host.
 * @returns {typeof defaultData["game"]["presentation"]}
 */
export async function nextPresenter() {
  if (!db.data.game.presentation) {
    db.data.game.presentation = {
      active: false,
      currentPresenter: null,
      stage: 0,
    };
  }

  db.data.game.presentation.stage = (db.data.game.presentation.stage + 1) % 5;

  if (db.data.game.presentation.stage === 0) {
    db.data.game.presentation.active = false;
    db.data.game.presentation.currentPresenter = null;
  } else {
    db.data.game.presentation.active = true;

    const playerIndex = db.data.game.presentation.stage - 1;
    if (playerIndex >= 0 && playerIndex < 4) {
      db.data.game.presentation.currentPresenter =
        db.data.players[playerIndex + 1]?.id || null;
    } else {
      db.data.game.presentation.currentPresenter = null;
    }
  }

  await safeDbWrite();
  return db.data.game.presentation;
}
