document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("background-video").playbackRate = 0.5;
  const cardGrid = document.getElementById("cardGrid");

  try {
    const response = await fetch("/images");
    const images = await response.json();

    images.forEach((imageName) => {
      const vtuberName = imageName.split(".")[0].replace(/_/g, " ");
      const cardElement = document.createElement("div");
      cardElement.className = "w-full flex flex-col items-center group";

      cardElement.innerHTML = `
        <a href="https://www.google.com/search?q=${encodeURIComponent(vtuberName)}" target="_blank" class="text-white text-base font-bold mb-4 animate-glow" title="${vtuberName}">
          ${vtuberName}
        </a>
        <div class="w-full h-0 pb-[133.33%] relative">
          <a href="https://www.google.com/search?q=${encodeURIComponent(vtuberName)}" target="_blank" class="block w-full h-full">
            <div class="absolute inset-0 rounded-2xl bg-purple-card border-2 border-purple-light shadow-card transition-all duration-300 flex justify-center transform overflow-hidden group-hover:scale-[1.04] group-hover:shadow-glow">
              <img src="/public/images/${imageName}" alt="${vtuberName}" class="w-full h-full object-cover rounded-2xl" style="position: relative; opacity: 1; z-index: 1;">
            </div>
          </a>
        </div>
      `;

      cardGrid.appendChild(cardElement);
    });
  } catch (error) {
    // Image loading error - silently fail
  }
});
