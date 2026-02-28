document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("background-video").playbackRate = 0.5;
  const cardGrid = document.getElementById("cardGrid");

  try {
    const response = await fetch("/images");
    const images = await response.json();

    images.forEach((imageName) => {
      const vtuberName = imageName.split(".")[0].replace(/_/g, " ");
      const cardElement = document.createElement("div");
      cardElement.className =
        "flex flex-col items-center bg-purple-card p-2 rounded-lg shadow-card";

      cardElement.innerHTML = `
        <img src="/public/images/${imageName}" alt="${vtuberName}" class="w-full h-auto object-cover rounded-md mb-2">
        <a href="https://www.google.com/search?q=${encodeURIComponent(vtuberName)}" target="_blank"
           class="text-purple-light font-bold text-sm hover:underline focus:outline-none focus:ring-2 focus:ring-blue-400">${vtuberName}</a>
      `;

      cardGrid.appendChild(cardElement);
    });
  } catch (error) {
    console.error("Error loading images:", error);
  }
});
