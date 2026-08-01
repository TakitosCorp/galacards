const queryParams = new URLSearchParams(window.location.search);
const playerId = queryParams.get("id");
const isDevMode = queryParams.get("dev") === "true";
const isPresentationMode = queryParams.get("mode") === "presentation";
const turnAudio = new Audio("/public/sounds/turn.mp3");
let hostId = null;
const resetPresentationButton = document.getElementById(
  "resetPresentationButton",
);
const nextPresentationButton = document.getElementById(
  "nextPresentationButton",
);

window.onload = () => {
  document.getElementById("background-video").playbackRate = 0.5;

  if (isPresentationMode) {
    if (resetPresentationButton) {
      resetPresentationButton.style.display = "block";
      resetPresentationButton.addEventListener("click", () => {
        socket.emit("presentation:reset");
      });
    }
    if (nextPresentationButton) {
      nextPresentationButton.style.display = "block";
      nextPresentationButton.addEventListener("click", () => {
        socket.emit("presentation:next");
      });
    }
  } else {
    if (resetPresentationButton) resetPresentationButton.style.display = "none";
    if (nextPresentationButton) nextPresentationButton.style.display = "none";
  }
};

const socket = io(window.location.host, {
  auth: { id: playerId },
});

socket.on("connect", () => {
  socket.emit("general:getData");
});

socket.on("player:returnAllPlayersData", (data) => {
  const { players, updateVdo } = data;
  handlePlayerData(players, updateVdo, socket);
});

socket.on("player:returnPlayerNameChange", (data) => {
  const { players, updateVdo } = data;
  handlePlayerData(players, updateVdo, socket);
});

socket.on("general:returnData", (data) => {
  handleReturnedData(data, socket);
});

socket.on("game:returnCurrentPlayer", (data) => {
  handleApplyCurrentRound(data);
});

if (isPresentationMode) {
  socket.on("presentation:returnReset", (data) => {
    handlePresentationReset();
  });

  socket.on("presentation:returnNext", (data) => {
    handlePresentationNext(data);
  });

  socket.on("presentation:returnAll", () => {
    handlePresentationReset();
  });
}

/**
 * Handles `general:returnData` on the generic page — refreshes players
 * and presentation highlight state.
 * @param {{ players: Array, game: object }} data
 * @param {object} socket
 */
function handleReturnedData(data, socket) {
  const players = data.players || [];
  const game = data.game || {};

  if (players.length > 0) {
    handlePlayerData(players, true, socket);
  }

  if (game.presentation) {
    updatePresentationViewFromServer(game.presentation);
  }

  const currentPlayerPosition = game.currentPlayer;
  if (currentPlayerPosition) {
    resetHighlightEffects();

    const iframeContainer = document.getElementById(
      `player${currentPlayerPosition}iframe`,
    );
    if (iframeContainer) {
      highlightElement(iframeContainer);
    }
  }
}

/**
 * Updates player iframes and shows/hides the presentation control bar.
 * @param {Array} players
 * @param {boolean} updateVdo
 * @param {object} socket
 */
function handlePlayerData(players, updateVdo, socket) {
  hostId = players[0].id;
  const hostIframe = document.getElementById("hostIframe");
  const hostName = document.getElementById("hostName");

  const presentationButtonsContainer = document.getElementById(
    "presentationButtonsContainer",
  );
  if (presentationButtonsContainer) {
    if (isPresentationMode && playerId === hostId) {
      presentationButtonsContainer.style.display = "flex";
    } else {
      presentationButtonsContainer.style.display = "none";
    }
  }

  if (hostIframe && hostName) {
    if (updateVdo) {
      hostIframe.src = `https://vdo.ninja/?view=${hostId}&autoplay=1&controls=0&muted=1&noaudio=1&cleanoutput&codec=h264,vp8,vp9,av1&fadein&bitrate=2000`;
    }
    hostName.textContent = players[0]?.name || "Host";
  }

  players.slice(1).forEach((player, index) => {
    const playerName = document.getElementById(`playerName${index + 1}`);
    const playerIframe = document.getElementById(`player${index + 1}iframe`);

    if (playerName) {
      playerName.innerText = player.name || `Player ${index + 1}`;
    }

    if (playerIframe && updateVdo) {
      playerIframe.src = `https://vdo.ninja/?view=${player.id}&autoplay=1&controls=0&muted=1&noaudio=1&cleanoutput&codec=h264,vp8,vp9,av1&fadein&bitrate=2000`;
    }
  });

  if (isPresentationMode) {
  }
}

/**
 * Highlights the active presenter's iframe.
 * @param {{ playerId: number }} data
 */
function handleApplyCurrentRound(data) {
  applyStylesToCurrentPlayer(data.playerId);
}

/**
 * Highlights the active presenter's iframe.
 * @param {number} playerId
 */
function applyStylesToCurrentPlayer(playerId) {
  const currentHighlightedElements = document.querySelectorAll(
    ".shadow-glow.scale-\\[1\\.04\\]",
  );
  currentHighlightedElements.forEach((element) => {
    element.classList.remove("shadow-glow", "scale-[1.04]");
  });

  if (playerId) {
    const iframeContainer = document.getElementById(`player${playerId}iframe`);
    if (iframeContainer) {
      iframeContainer.classList.add("shadow-glow", "scale-[1.04]");
    }
  }
}

/**
 * Removes all glow/scale highlight classes from player iframes.
 */
function resetHighlightEffects() {
  const currentHighlightedElements = document.querySelectorAll(
    ".shadow-glow, .scale-\\[1\\.04\\]",
  );
  currentHighlightedElements.forEach((element) => {
    element.classList.remove("shadow-glow", "scale-[1.04]");
  });
}

/**
 * Adds glow + scale highlight to a DOM element.
 * @param {HTMLElement} element
 */
function highlightElement(element) {
  element.classList.add("shadow-glow", "scale-[1.04]");
}

/**
 * Resets all presentation effects and adds a focus class to every iframe.
 */
function handlePresentationReset() {
  resetHighlightEffects();

  resetPresentationEffects();

  const playerIframes = [];
  for (let i = 1; i <= 4; i++) {
    const iframe = document.getElementById(`player${i}iframe`);
    if (iframe) {
      playerIframes.push(iframe);
      iframe.classList.add("player-focused");
    }
  }

  const hostIframe = document.getElementById("hostIframe");
  if (hostIframe) {
    hostIframe.classList.add("player-focused");
  }
}

/**
 * Transitions to the next presentation stage and plays a sound.
 * @param {{ active: boolean, currentPresenter: string|null }} data
 */
function handlePresentationNext(data) {
  resetHighlightEffects();

  if (data && data.active && data.currentPresenter) {
    turnAudio.volume = 0.6;
    turnAudio.play();
  }

  updatePresentationViewFromServer(data);
}

/**
 * Applies blur/focus CSS classes based on the presentation stage.
 * @param {{ stage: number, active: boolean }} presentationData
 */
function updatePresentationViewFromServer(presentationData) {
  if (!isPresentationMode || !presentationData) return;

  const stage = presentationData.stage || 0;
  const isActive = presentationData.active || false;

  resetPresentationEffects();

  applyPresentationEffects(stage);

  if (isActive && stage > 0) {
    turnAudio.volume = 0.4;
    turnAudio.play();
  }
}

/**
 * Strips all presentation CSS classes from every player and host iframe.
 */
function resetPresentationEffects() {
  for (let i = 1; i <= 4; i++) {
    const iframe = document.getElementById(`player${i}iframe`);
    if (iframe) {
      iframe.className = iframe.className
        .replace(/player-blurred/g, "")
        .replace(/player-focused/g, "")
        .replace(/shadow-glow/g, "")
        .replace(/scale-\[1\.04\]/g, "")
        .trim();
    }
  }

  const hostIframe = document.getElementById("hostIframe");
  if (hostIframe) {
    hostIframe.className = hostIframe.className
      .replace(/player-blurred/g, "")
      .replace(/player-focused/g, "")
      .replace(/shadow-glow/g, "")
      .replace(/scale-\[1\.04\]/g, "")
      .trim();
  }
}

/**
 * Sets player-focused / player-blurred classes based on presentation stage.
 * @param {number} stage
 */
function applyPresentationEffects(stage) {
  const playerIframes = [];
  for (let i = 1; i <= 4; i++) {
    const iframe = document.getElementById(`player${i}iframe`);
    if (iframe) playerIframes.push(iframe);
  }

  const hostIframe = document.getElementById("hostIframe");

  if (stage === 0) {
    playerIframes.forEach((iframe) => {
      iframe.classList.remove("player-blurred");
      iframe.classList.add("player-focused");
    });

    if (hostIframe) {
      hostIframe.classList.remove("player-blurred");
      hostIframe.classList.add("player-focused");
    }
  } else {
    playerIframes.forEach((iframe, index) => {
      iframe.classList.remove("player-blurred", "player-focused");

      if (index + 1 === stage) {
        iframe.classList.add("player-focused");
      } else {
        iframe.classList.add("player-blurred");
      }
    });

    if (hostIframe) {
      hostIframe.classList.remove("player-blurred");
      hostIframe.classList.add("player-focused");
    }
  }
}
