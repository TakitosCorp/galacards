import { Server } from "socket.io";
import * as dbase from "./utils/db.js";
import { sendDiscordWebhook } from "send-discord-webhook";
import { readFile } from "fs/promises";

const data = await readFile("./config/config.json", "utf-8");
const config = JSON.parse(data);

//! Inicialización del Socket
async function initializeSocket(server) {
  await dbase.initializeDatabase();
  const io = new Server(server);

  io.use(authenticateSocket);
  io.on("connection", async (socket) => {
    console.log(`Cliente autenticado. Auth ID: ${socket.playerId}`);

    handleConnection(socket, io, "connect").catch(console.error);

    registerSocketHandlers(socket, io);
  });
}

//! Middleware de autenticación
function authenticateSocket(socket, next) {
  let playerId = socket.handshake.auth.id;

  if (!playerId) {
    console.log("Desconectando: falta el ID de autenticación");
    socket.disconnect(true);
    return;
  }

  if (playerId === "obs") {
    socket.playerId = playerId;
    next();
    return;
  }

  const db = dbase.getDatabase();
  const player = db.data.players.find((p) => p.id === playerId);
  if (!player) {
    console.log(`Desconectando: ID de autenticación no válido (${playerId})`);
    socket.disconnect(true);
    return;
  }

  socket.playerId = playerId;
  next();
}

//! Registro de eventos del Socket
// Para todo lo que sean returns, se utilizará returnX
async function registerSocketHandlers(socket, io) {
  const playerId = socket.playerId;

  socket.on("general:getData", () => sendGeneralData(socket));

  socket.on("player:getAllPlayersData", () => getAllPlayersData(socket, true, false));
  socket.on("player:getLinks", async () => sendLinks(socket));
  socket.on("player:setName", async (name) => {
    handleNameChange(io, socket.playerId, name);
  });

  socket.on("game:reset", async () => resetGameData(io));
  socket.on("game:spin", async () => gameSpin(io));
  socket.on("game:setAssignedScores", async (data) => handleScoreAddition(data, io));
  socket.on("game:getAssignedScores", async () => {
    const data = await dbase.getAssignedScores(playerId);
    socket.emit("game:returnAssignedScores", { assignedScores: data });
  });
  socket.on("game:getCurrentPlayer", async () => {
    const data = await dbase.getCurrentPlayer();
    socket.emit("game:returnCurrentPlayer", { playerId: data });
  });
  socket.on(
    "game:setCurrentPlayer",
    async () =>
      await dbase.setCurrentPlayer().then(async () => {
        const data = await dbase.getCurrentPlayer();
        io.emit("game:returnCurrentPlayer", { playerId: data });
      })
  );

  socket.on("presentation:reset", async () => {
    const presentationData = await dbase.resetPresentation();
    io.emit("presentation:returnReset", presentationData);
  });

  socket.on("presentation:next", async () => {
    const presentationData = await dbase.nextPresenter();
    io.emit("presentation:returnNext", presentationData);
  });

  socket.on("presentation:all", async () => {
    await dbase.resetPresentation();
    io.emit("presentation:returnAll");
  });

  socket.on("presentation:getStatus", async () => {
    const presentationData = await dbase.getPresentation();
    socket.emit("presentation:returnStatus", presentationData);
  });

  socket.on("game:getSpinButtonState", async () => {
    const db = await dbase.getDatabase();
    const game = db.data.game;
    socket.emit("game:returnSpinButtonState", { game });
  });

  socket.on("disconnect", async () => {
    console.log(`Cliente desconectado. Auth ID: ${socket.playerId}`);
    await handleConnection(socket, io, "disconnect");
  });
}

//! Funciones auxiliares del socket

async function sendGeneralData(socket) {
  var data = await dbase.getDatabase();
  const currentPlayerPosition = await dbase.getCurrentPlayer();
  const presentationData = await dbase.getPresentation();
  socket.emit("general:returnData", {
    players: data.data.players,
    game: {
      ...data.data.game,
      currentPlayer: currentPlayerPosition,
      presentation: presentationData,
    },
  });
}

async function sendGameData(socket) {
  const db = dbase.getDatabase();
  const gameData = db.data.game;
  socket.emit("game:returnGameData", gameData);
}

async function sendLinks(socket) {
  const db = dbase.getDatabase();
  const players = db.data.players;
  socket.emit("player:returnLinks", { players: players });
}

async function getAllPlayersData(socket, updateVdo, isNameChange) {
  const db = dbase.getDatabase();
  const players = db.data.players;
  if (isNameChange) {
    socket.emit("player:returnPlayerNameChange", { players: players, updateVdo: updateVdo });
  } else {
    socket.emit("player:returnAllPlayersData", { players: players, updateVdo: updateVdo });
  }
}

async function resetGameData(socket) {
  await dbase.generateGameData();
  sendGameData(socket);
  socket.emit("game:returnReset");
  const players = await dbase.getAllPlayers();
  for (const player of players) {
    socket.emit("game:returnScore", { playerId: player.id, score: 0 });
  }
}

async function gameSpin(socket) {
  await dbase.resetAfterSpin();
  const data = await dbase.getGameState();
  const imageList = data.images || [];
  const remainingImages = data.remainingImages || [];
  const selectedImages = data.selectedImages || [];
  let previousSelectedImages = selectedImages;

  if (!previousSelectedImages || previousSelectedImages.length === 0) {
    previousSelectedImages = Array(4).fill("GENERAL.avif");
  }

  const selected = getRandomImages(remainingImages, 4);

  await dbase.updateSelectedImages(selected);
  await dbase.updateRemainingImages();
  await dbase.updateCurrentRound();

  const updatedData = await dbase.getGameState();
  const updatedRemainingImages = updatedData.remainingImages || [];
  const updatedCurrentRound = updatedData.currentRound || 1;
  const totalRounds = updatedData.totalRounds || 1;

  const hasMoreRounds = updatedRemainingImages.length >= 4 && updatedCurrentRound < totalRounds;

  const spinData = selected.map((finalImage, index) => {
    const fillerImages = getRandomImages(
      imageList.filter((img) => img !== finalImage),
      15
    );
    fillerImages[0] = previousSelectedImages[index];
    fillerImages.push(finalImage);
    return fillerImages;
  });

  socket.emit("game:returnSpin", {
    spinData,
    selected,
    hasMoreRounds,
    currentRound: updatedCurrentRound,
    remainingImages: updatedRemainingImages.length,
  });
}

async function handleNameChange(socket, playerId, name) {
  await dbase.updatePlayerName(playerId, name.name).then(async () => {
    await getAllPlayersData(socket, false, true);
  });
}

async function handleScoreAddition(data, socket) {
  const playerId = data.playerIdFunc;
  await dbase.addScore(playerId);
  const score = await dbase.getPlayerScore(playerId);
  socket.emit("game:returnScore", { playerId: playerId, score: score });
}

//! Funciones auxiliares generales
function getRandomImages(remainingImages, count) {
  const shuffled = remainingImages.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

//! Funciones de conexión y desconexión

async function handleConnection(socket, io, type) {
  const players = await dbase.getAllPlayers();
  if (socket.playerId !== "obs" && socket.playerId !== players[0].id) {
    const player = players.find((p) => p.id === socket.playerId);
    const playerName = player ? player.name : "Desconocido";
    const timestamp = Math.floor(Date.now() / 1000);

    if (type === "connect") {
      sendDiscordWebhook({
        url: config.djsWebhook,
        content: `Jugador con ID ${socket.playerId} (${playerName}) se ha conectado. (Timestamp: <t:${timestamp}:T>)`,
      }).catch(console.error);
    }

    if (type === "disconnect") {
      sendDiscordWebhook({
        url: config.djsWebhook,
        content: `Jugador con ID ${socket.playerId} (${playerName}) se ha desconectado. (Timestamp: <t:${timestamp}:T>)`,
      }).catch(console.error);
    }
  }
}

export default initializeSocket;
