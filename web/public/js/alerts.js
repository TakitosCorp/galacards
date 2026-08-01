/**
 * Shows a confirmation dialog before awarding points to a player.
 * @param {string} playerId
 * @param {string} playerName
 * @param {number} points - 1 or 0.5
 */
function confirmPointsAssignment(playerId, playerName, points) {
  const pointText = points === 1 ? "point" : "points";

  Swal.fire({
    title: "Are you ABSOLUTELY sure?",
    html: `Do you want to give <b>${points} ${pointText}</b> to <b>${playerName}</b> and it wasn't an "accidental" misclick?`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Come on, they guessed it right!",
    cancelButtonText: "Oops, I think I messed up",
    customClass: {
      popup: "bg-[#8b458b] rounded-2xl p-6 shadow-2xl w-[100%] max-w-md",
      title: "text-3xl text-white font-bold mb-4 text-center",
      htmlContainer: "text-white text-lg",
      confirmButton:
        "mt-4 w-full py-2 bg-purple-light text-purple-dark text-base font-bold rounded-lg hover:bg-purple-hover transition-colors duration-300 shadow-md",
      cancelButton:
        "mt-2 w-full py-2 bg-red-500 text-white text-base font-bold rounded-lg hover:bg-red-600 transition-colors duration-300 shadow-md",
    },
  }).then((result) => {
    if (result.isConfirmed) {
      if (points === 0.5) {
        turnButton.setAttribute("disabled", true);
      }
      sendScoreUpdate(playerId);
    }
  });
}

/**
 * Shows a dialog with each player's VDO/game link and a copy button.
 * @param {Array<{ id: string, name: string, playerUrl?: string, vdoUrl: string }>} players
 */
function displayPlayerLinks(players) {
  const contentHtml = players
    .map((player) => {
      const isHost = player.name === players[0]?.name;
      return `
        <div class="bg-purple-bg bg-opacity-94 rounded-lg p-3">
          <p class="text-white">Name: <span class="font-bold text-purple-light">${player.name}</span></p>
          <button class="mt-2 w-full py-2 bg-purple-light text-purple-dark text-sm font-bold rounded-lg transition-colors duration-300 shadow-md copy-link"
            ${
              isHost
                ? `data-vdo-url="${player.vdoUrl}"`
                : `data-game-url="${player.playerUrl}" data-vdo-url="${player.vdoUrl}"`
            }>
            ${isHost ? "Copy link" : "Copy message"}
          </button>
        </div>
      `;
    })
    .join("");

  Swal.fire({
    title: "Player Info",
    html: contentHtml,
    customClass: {
      popup: "bg-[#8b458b] rounded-2xl p-6 shadow-2xl w-[100%]  max-w-md",
      title: "text-3xl text-white font-bold mb-4 text-center",
      htmlContainer: "space-y-4",
      confirmButton:
        "mt-4 w-[100%] mx-auto py-2 bg-purple-light text-purple-dark text-base font-bold rounded-lg transition-colors duration-300 shadow-md",
    },
    showConfirmButton: true,
    confirmButtonText: "Close",
    didOpen: () => {
      document.querySelectorAll(".copy-link").forEach((button) => {
        button.addEventListener("click", () => {
          const vdoUrl = button.getAttribute("data-vdo-url");
          const gameUrl = button.getAttribute("data-game-url");
          const isHost = !gameUrl;
          const message = isHost
            ? vdoUrl
            : `Hi! Here are the links you need to play the game ^^\n\nVDO.Ninja: ${vdoUrl}\nGame Web: ${gameUrl}\n\nThis is an automated message btw :p`;

          navigator.clipboard.writeText(message).then(() => {
            button.classList.add("bg-green-500", "text-white");
            setTimeout(
              () => button.classList.remove("bg-green-500", "text-white"),
              1000,
            );
          });
        });
      });
    },
  });
}

/**
 * Prompts a newly connected player to set a display name.
 * @param {object} socket
 */
function promptForUsername(socket) {
  Swal.fire({
    title: "Enter your name :D",
    input: "text",
    inputAttributes: {
      maxlength: 20,
      autocapitalize: "off",
      autocorrect: "off",
      style:
        "text-align: center; font-size: 1rem; padding: 0.5rem; border-radius: 0.5rem; border: 2px solid #8b458b; background-color: #6a2c70; color: white; box-shadow: 0 0 10px #8b458b;",
    },
    allowOutsideClick: false,
    allowEscapeKey: false,
    showCancelButton: false,
    confirmButtonText: "Yep, that's me!",
    customClass: {
      popup: "bg-[#8b458b] rounded-2xl p-6 shadow-2xl w-[100%] max-w-md",
      title: "text-3xl text-white font-bold mb-4 text-center",
      input:
        "text-purple-dark text-lg font-bold p-2 rounded-lg border-2 border-purple-light",
      confirmButton:
        "mt-4 w-full py-2 bg-purple-light text-purple-dark text-base font-bold rounded-lg hover:bg-purple-hover transition-colors duration-300 shadow-md",
    },
    preConfirm: (name) => {
      if (!name || name.trim().length === 0) {
        Swal.showValidationMessage("The name cannot be empty");
        return false;
      }
      if (name.length > 20) {
        Swal.showValidationMessage(
          "The name cannot be longer than 20 characters",
        );
        return false;
      }
      return name.trim();
    },
  }).then((result) => {
    if (result.isConfirmed) {
      socket.emit("player:setName", { name: result.value });
    }
  });
}

/**
 * Shows a full-width Streamable video embed in a modal.
 */
function displayVideoEmbed() {
  Swal.fire({
    title: "Watch this video",
    html: `<div style="position:relative; width:100%; height:0px; padding-bottom:56.250%"><iframe allow="fullscreen" allowfullscreen height="100%" src="https://streamable.com/e/l97z9o?" width="100%" style="border:none; width:100%; height:100%; position:absolute; left:0px; top:0px; overflow:hidden;"></iframe></div>`,
    customClass: {
      popup: "bg-[#8b458b] rounded-2xl p-8 shadow-2xl w-[100%] max-w-2xl",
      title: "text-4xl text-white font-bold mb-6 text-center",
      htmlContainer: "text-white text-lg",
      confirmButton:
        "mt-6 w-full py-3 bg-purple-light text-purple-dark text-lg font-bold rounded-lg hover:bg-purple-hover transition-colors duration-300 shadow-md",
    },
    showConfirmButton: true,
    confirmButtonText: "Close",
  });
}
