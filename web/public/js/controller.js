// Configuration and constants section

const queryParams = new URLSearchParams(window.location.search);
const playerId = queryParams.get("id");
const isDevMode = queryParams.get("dev") === "true";
const audio = new Audio("/public/sounds/wheel.wav");
const turnAudio = new Audio("/public/sounds/turn.mp3");
const pointsAudio = new Audio("/public/sounds/points.mp3");
let hostId = null;

const cardContainers = [
  document.getElementById("cardContainer1"),
  document.getElementById("cardContainer2"),
  document.getElementById("cardContainer3"),
  document.getElementById("cardContainer4"),
];

const cardNames = [
  document.getElementById("cardName1"),
  document.getElementById("cardName2"),
  document.getElementById("cardName3"),
  document.getElementById("cardName4"),
];
const pointsContainer = document.getElementById("pointsContainer");
const spinButton = document.getElementById("spinButton");
const turnButton = document.getElementById("turnButton");
const avaliableCards = document.getElementById("avaliableCards");
const currentRound = document.getElementById("roundNumber");
const totalRounds = document.getElementById("totalRounds");

// Initialization section

window.onload = () => {
  document.getElementById("background-video").playbackRate = 0.5;
  audio.loop = true;
};

// socket.io section

const socket = io(window.location.host, {
  auth: { id: playerId },
});

socket.on("connect", () => {
  if (isDevMode) {
    socket.emit("game:reset");
  }

  socket.emit("general:getData");
});

socket.on("player:returnLinks", (data) => {
  displayPlayerLinks(data.players);
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

socket.on("game:returnGameData", (data) => {
  handleGameData(data);
});

socket.on("game:returnSpin", async (data) => {
  const { spinData, selected, hasMoreRounds, currentRound, remainingImages } =
    data;
  await handleSpinData(
    spinData,
    selected,
    hasMoreRounds,
    currentRound,
    remainingImages,
  );
});

socket.on("game:returnScore", (data) => {
  handleReturnedScore(data);
});

socket.on("game:returnCurrentPlayer", (data) => {
  handleApplyCurrentRound(data);
});

socket.on("game:returnReset", async () => {
  handleGameReset();
});

socket.on("game:returnSpinButtonState", (data) => {
  updateSpinButtonState(data.game);
});

// Socket helper functions section

function handleReturnedData(data, socket) {
  const game = data.game || {};
  const players = data.players || [];

  if (players.length > 0) {
    handlePlayerData(players, true, socket);
  }

  if (game) {
    handleGameData(game);
  }

  updateSpinButtonState(game);

  const currentPlayerPosition = game.currentPlayer;
  if (currentPlayerPosition) {
    if (game.assignedScores.length === 0) {
      spinButton.setAttribute("disabled", true);
    } else if (game.assignedScores.length === 1) {
      spinButton.removeAttribute("disabled");
      spinButton.textContent = "Reveal!";
    } else {
      spinButton.removeAttribute("disabled");
      spinButton.textContent = "Spin!";
    }
    if (game.assignedScores.length >= 2) {
      turnButton.setAttribute("disabled", true);
    }
    const cardContainer = document.getElementById(
      `cardContainer${currentPlayerPosition}`,
    );
    const iframeContainer = document.getElementById(
      `player${currentPlayerPosition}iframe`,
    );

    const currentHighlightedCard = document.querySelector(
      ".shadow-glow .scale-\\[1\\.04\\]",
    );
    if (currentHighlightedCard) {
      currentHighlightedCard.classList.remove("shadow-glow", "scale-[1.04]");
    }

    if (cardContainer) {
      cardContainer.classList.add("shadow-glow", "scale-[1.04]");
    }

    if (iframeContainer) {
      iframeContainer.classList.add("shadow-glow", "scale-[1.04]");
    }
  } else {
    spinButton.removeAttribute("disabled");
    spinButton.textContent = "Spin!";
    turnButton.setAttribute("disabled", true);
    const currentHighlightedCard = document.querySelector(
      ".shadow-glow .scale-\\[1\\.04\\]",
    );
    if (currentHighlightedCard) {
      currentHighlightedCard.classList.remove("shadow-glow", "scale-[1.04]");
    }
  }
}

function handlePlayerData(players, updateVdo, socket) {
  // Handle host
  hostId = players[0].id;
  const hostIframe = document.getElementById("hostIframe");
  const hostName = document.getElementById("hostName");
  if (hostIframe && hostName) {
    if (updateVdo) {
      hostIframe.src = `https://vdo.ninja/?view=${hostId}&autoplay=1&controls=0&muted=1&noaudio=1&cleanoutput&codec=h264,vp8,vp9,av1&fadein&bitrate=2000`;
    }
    hostName.textContent = players[0]?.name || "Host";
  }
  pointsContainer.innerHTML = "";

  // Handle players
  players.slice(1).forEach((player, index) => {
    const playerName = document.getElementById(`playerName${index + 1}`);
    const playerIframe = document.getElementById(`player${index + 1}iframe`);
    pointsContainer.innerHTML += `
    <div class="bg-purple-bg bg-opacity-50 rounded-lg p-2">
        <p class="text-white text-sm">
      ${player.name}:
      <span id="score-${player.id}" class="font-bold text-purple-light score-update">${player.score}</span>
        </p>
    </div>`;

    const scoreElement = document.getElementById(`score-${player.id}`);
    if (scoreElement) {
      setTimeout(() => {
        scoreElement.classList.remove("score-update");
      }, 500);
    }

    if (playerName) {
      playerName.innerText = player.name;
      playerName.setAttribute("data-id", player.id);
    }
    if (playerIframe && updateVdo) {
      playerIframe.src = `https://vdo.ninja/?view=${player.id}&autoplay=1&controls=0&muted=1&noaudio=1&cleanoutput&codec=h264,vp8,vp9,av1&fadein&bitrate=2000`;
    }
  });

  players.forEach((player) => {
    if (player.id === playerId) {
      if (player.id === players[0].id && player.name.includes("Host")) {
        promptForUsername(socket);
      } else if (player.name.includes("Player")) {
        promptForUsername(socket);
      }
    }
  });
}

function handleGameData(game) {
  if (game.selectedImages) {
    if (game.assignedScores.length > 0) {
      spinButton.setAttribute("disabled", true);
    }
    const selectedImages = game.selectedImages;
    selectedImages.forEach((imageName, index) => {
      const cardContainer = cardContainers[index];
      const initialImage = document.getElementById(`cardGenerica${index + 1}`);

      initialImage.style.opacity = "0";
      initialImage.style.position = "absolute";

      const currentImage = createImageElement(imageName);
      currentImage.style.position = "absolute";
      currentImage.style.top = "0";
      currentImage.style.left = "0";
      currentImage.style.width = "100%";
      currentImage.style.height = "100%";
      cardContainer.appendChild(currentImage);

      const formattedName = imageName
        .split(".")[0]
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
      cardNames[index].textContent = formattedName;
    });
  }
  document.getElementById("avaliableCards").textContent =
    game.remainingImages.length;
  document.getElementById("roundNumber").textContent = game.currentRound;
  document.getElementById("totalRounds").textContent = game.totalRounds;

  if (
    game.remainingImages.length === 0 ||
    game.currentRound >= game.totalRounds
  ) {
    spinButton.setAttribute("disabled", false);
    spinButton.textContent = "Reset";
  }

  const currentPlayer = game.currentPlayer;
  if (currentPlayer) {
    applyStylesToCurrentPlayer(currentPlayer);
  } else {
    const currentHighlightedCard = document.querySelector(
      ".shadow-glow .scale-\\[1\\.04\\]",
    );
    if (currentHighlightedCard) {
      currentHighlightedCard.classList.remove("shadow-glow", "scale-[1.04]");
    }
  }
}

function updateSpinButtonState(game) {
  if (!game) return;
  if (
    game.remainingImages.length === 0 ||
    game.currentRound >= game.totalRounds
  ) {
    spinButton.textContent = "Reset";
    spinButton.removeAttribute("disabled");
  } else if (!game.currentPlayer) {
    spinButton.textContent = "Spin!";
    spinButton.removeAttribute("disabled");
    turnButton.setAttribute("disabled", true);
  } else if (game.assignedScores.length === 0) {
    spinButton.setAttribute("disabled", true);
  } else if (game.assignedScores.length === 1) {
    spinButton.textContent = "Reveal!";
    spinButton.removeAttribute("disabled");
  } else {
    spinButton.textContent = "Spin!";
    spinButton.removeAttribute("disabled");
  }
}

// Game helper functions section

function createImageElement(imageName) {
  const img = document.createElement("img");
  img.src = `/public/images/${imageName}`;
  img.classList.add("w-full", "h-full", "object-cover", "rounded-2xl");
  img.alt = imageName.split(".")[0];
  return img;
}

async function fetchImages() {
  try {
    const response = await fetch("/images");
    const imageArray = await response.json();
    preloadImages(imageArray);
  } catch (error) {
    // Image fetch error - silently fail
  }
}

function preloadImages(imageArray) {
  imageArray.forEach((imageName) => {
    const img = new Image();
    img.src = `/public/images/${imageName}`;
  });
}

async function handleSpinData(
  spinData,
  selected,
  hasMoreRounds,
  cRound,
  remainingImages,
) {
  spinButton.setAttribute("disabled", true);
  turnButton.setAttribute("disabled", true);
  const elementsWithEffects = document.querySelectorAll(
    ".shadow-glow, .scale-\\[1\\.04\\]",
  );
  elementsWithEffects.forEach((element) => {
    element.classList.remove("shadow-glow", "scale-[1.04]");
  });

  currentRound.textContent = cRound;
  avaliableCards.textContent = remainingImages;
  if (!hasMoreRounds) {
    spinButton.textContent = "Reset";
  }

  for (const name of cardNames) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    name.classList.add("blurCardName");
  }

  await new Promise((resolve) => setTimeout(resolve, 500));
  for (let i = 0; i < 4; i++) {
    const formattedName = selected[i]
      .split(".")[0]
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
    cardNames[i].textContent = formattedName;
  }

  audio.volume = 1.0;
  audio.play();

  const spinPromises = spinData.map((reelData, index) => {
    const cardContainer = cardContainers[index];
    return spinContainer(index, cardContainer, reelData);
  });
  await Promise.all(spinPromises);

  const fadeOutInterval = setInterval(() => {
    if (audio.volume > 0.1) {
      audio.volume -= 0.1;
    } else {
      audio.volume = 0.0;
      clearInterval(fadeOutInterval);
    }
  }, 100);
  setTimeout(() => {
    audio.pause();
    audio.currentTime = 0;
  }, 600);

  for (const name of cardNames) {
    name.classList.add("revealed");
    await new Promise((resolve) => setTimeout(resolve, 400));
    name.classList.remove("blurCardName");
    name.classList.remove("revealed");
  }

  socket.emit("game:setCurrentPlayer");
  turnButton.removeAttribute("disabled");
}

async function spinContainer(cardContainerNumber, cardContainer, reelData) {
  return new Promise((resolve) => {
    const initialImage = document.getElementById(
      `cardGenerica${cardContainerNumber + 1}`,
    );

    const oldStrip = cardContainer.querySelector(".strip");
    if (oldStrip) {
      const lastImage = createImageElement(reelData[reelData.length - 1]);
      lastImage.style.position = "absolute";
      lastImage.style.top = "0";
      lastImage.style.left = "0";
      lastImage.style.width = "100%";
      lastImage.style.height = "100%";
      cardContainer.appendChild(lastImage);

      oldStrip.remove();
    }

    let currentPosition = 0;
    const totalImages = 16;
    const imageHeight = initialImage.clientHeight;
    const totalHeight = totalImages * imageHeight;
    const finalPosition = (totalImages - 1) * imageHeight;

    const strip = document.createElement("div");
    strip.style.width = "100%";
    strip.style.height = `${totalHeight}px`;
    strip.className = "strip";
    reelData.forEach((img) => {
      const imgElement = createImageElement(img);
      strip.appendChild(imgElement);
    });

    const tempImage = cardContainer.querySelector("img:not(.strip img)");
    if (
      tempImage &&
      tempImage.id !== `cardGenerica${cardContainerNumber + 1}`
    ) {
      tempImage.remove();
    }

    cardContainer.appendChild(strip);
    initialImage.style.opacity = "0";
    initialImage.style.position = "absolute";

    const interval = setInterval(() => {
      currentPosition += imageHeight / 8;
      if (currentPosition >= totalHeight) {
        currentPosition = 0;
      }

      strip.style.transform = `translateY(-${currentPosition}px)`;

      if (
        currentPosition >= finalPosition - imageHeight &&
        currentPosition <= finalPosition
      ) {
        clearInterval(interval);
        strip.style.transition = "transform 0.6s ease-out";
        strip.style.transform = `translateY(-${finalPosition}px)`;
        setTimeout(() => {
          strip.style.transition = "none";
          resolve();
        }, 600);
      }
    }, 25);
  });
}

async function handleGameReset() {
  spinButton.setAttribute("disabled", true);
  turnButton.setAttribute("disabled", true);
  spinButton.textContent = "Spin!";

  for (const name of cardNames) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    name.classList.add("blurCardName");
  }

  await Promise.all(
    cardContainers.map((container, index) => {
      return new Promise((resolve) => {
        const images = container.querySelectorAll(
          "img:not(#cardGenerica" + (index + 1) + ")",
        );
        const genericImage = document.getElementById(
          `cardGenerica${index + 1}`,
        );

        genericImage.style.zIndex = "1";

        const reel = document.createElement("div");
        reel.style.position = "absolute";
        reel.style.top = "0";
        reel.style.left = "0";
        reel.style.width = "100%";
        reel.style.height = "100%";
        reel.style.zIndex = "2";
        reel.className = "reel-transition";
        container.appendChild(reel);

        void genericImage.offsetWidth;

        requestAnimationFrame(() => {
          images.forEach((img) => {
            img.style.transition = "opacity 0.6s ease-in-out";
            img.style.opacity = "0";
          });

          genericImage.style.transition = "opacity 0.6s ease-in-out";
          genericImage.style.opacity = "1";

          setTimeout(() => {
            images.forEach((img) => img.remove());

            reel.remove();
            genericImage.style.zIndex = "2";
            genericImage.style.opacity = "1";

            genericImage.style.transition = "none";

            setTimeout(() => {
              resolve();
            }, 600);
          }, 600);
        });
      });
    }),
  );

  cardNames.forEach((name, index) => {
    name.textContent = ["Can you", "guess", "who", "you are?"][index];
  });

  const elementsWithEffects = document.querySelectorAll(
    ".shadow-glow, .scale-\\[1\\.04\\]",
  );
  elementsWithEffects.forEach((element) => {
    element.classList.remove("shadow-glow", "scale-[1.04]");
  });

  for (const name of cardNames) {
    name.classList.add("revealed");
    await new Promise((resolve) => setTimeout(resolve, 400));
    name.classList.remove("blurCardName", "revealed");
  }

  spinButton.removeAttribute("disabled");
}

function applyStylesToCurrentPlayer(playerId) {
  const currentHighlightedElements = document.querySelectorAll(
    ".shadow-glow.scale-\\[1\\.04\\]",
  );
  currentHighlightedElements.forEach((element) => {
    element.classList.remove("shadow-glow", "scale-[1.04]");
  });

  if (playerId) {
    turnAudio.volume = 1.0;
    turnAudio.play();
    const cardContainer = document.getElementById(`cardContainer${playerId}`);
    const iframeContainer = document.getElementById(`player${playerId}iframe`);

    if (cardContainer) {
      cardContainer.classList.add("shadow-glow", "scale-[1.04]");
    }

    if (iframeContainer) {
      iframeContainer.classList.add("shadow-glow", "scale-[1.04]");
    }
  }
}

function handleApplyCurrentRound(data) {
  applyStylesToCurrentPlayer(data.playerId);
}

// Scores handling section

document.querySelectorAll('[id^="player"]').forEach((container) => {
  if (container.id.includes("iframe")) {
    container.parentElement.addEventListener("click", () => {
      if (
        container.classList.contains("shadow-glow") &&
        container.classList.contains("scale-[1.04]")
      ) {
        const iframeSrc = container.src;
        const urlParams = new URLSearchParams(iframeSrc.split("?")[1]);
        const playerIdVdo = urlParams.get("view");

        if (!playerIdVdo) {
          // Missing playerIdVdo from iframe
          return;
        }

        const playerIndex = container.id.match(/player(\d+)iframe/)[1];
        const playerNameElement = document.getElementById(
          `playerName${playerIndex}`,
        );
        const playerName = playerNameElement
          ? playerNameElement.textContent
          : "Unknown";

        socket.emit("game:getAssignedScores", { playerIndex });
        socket.once("game:returnAssignedScores", (data) => {
          if (data.assignedScores.includes(playerIdVdo)) {
            return;
          }
          if (data.assignedScores.length === 0) {
            confirmPointsAssignment(playerIdVdo, playerName, 1);
          }
          if (data.assignedScores.length === 1) {
            confirmPointsAssignment(playerIdVdo, playerName, 0.5);
          }
        });
      }
    });
  }
});

function sendScoreUpdate(playerIdFunc) {
  socket.emit("game:setAssignedScores", { playerIdFunc });
  socket.emit("game:getAssignedScores");
  socket.once("game:returnAssignedScores", (data) => {
    socket.emit("game:getSpinButtonState");
  });
}

function handleReturnedScore(data) {
  spinButton.removeAttribute("disabled");
  const { playerId, score } = data;
  if (playerId !== "0" || score === 0) {
    pointsAudio.volume = 1.0;
    pointsAudio.play();
  }
  const scoreElement = document.getElementById(`score-${playerId}`);
  if (scoreElement) {
    scoreElement.classList.remove("score-update");
    scoreElement.classList.add("score-update");
    scoreElement.textContent = score;
    setTimeout(() => {
      scoreElement.classList.remove("score-update");
    }, 500);
  }
  socket.emit("game:getSpinButtonState");
}

// Button functions section

document.getElementById("getPlayerLinks").addEventListener("click", () => {
  socket.emit("player:getLinks");
});

spinButton.addEventListener("click", () => {
  if (spinButton.textContent === "Reset") {
    socket.emit("game:reset");
    spinButton.textContent = "Spin!";
  } else if (spinButton.textContent === "Reveal!") {
    turnButton.setAttribute("disabled", true);
    socket.emit("game:setAssignedScores", { playerIdFunc: "0" });
    socket.emit("game:getSpinButtonState");
  } else {
    socket.emit("game:spin");
  }
});

turnButton.addEventListener("click", () => {
  socket.emit("game:setCurrentPlayer");
});
