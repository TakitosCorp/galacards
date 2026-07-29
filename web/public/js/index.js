const queryParams = new URLSearchParams(window.location.search);
const playerId = queryParams.get("id");

window.onload = () => {
  document.getElementById("background-video").playbackRate = 0.5;

  const totalSlides = 3;
  let currentSlide = 0;

  const updateSlide = () => {
    const slides = document.querySelectorAll(".slide");
    const dots = document.querySelectorAll("#dots-container div");
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const vamosBtn = document.getElementById("vamos-btn");

    slides.forEach((slide, i) => {
      if (i === currentSlide) {
        slide.classList.remove("opacity-0", "scale-95", "pointer-events-none");
        slide.classList.add("opacity-100", "scale-100");
      } else {
        slide.classList.add("opacity-0", "scale-95", "pointer-events-none");
        slide.classList.remove("opacity-100", "scale-100");
      }
    });

    dots.forEach((dot, i) => {
      if (i === currentSlide) {
        dot.classList.add("bg-purple-light", "scale-125", "shadow-glow");
        dot.classList.remove("bg-purple-light/20");
      } else {
        dot.classList.remove("bg-purple-light", "scale-125", "shadow-glow");
        dot.classList.add("bg-purple-light/20");
      }
    });

    if (currentSlide === 0) {
      prevBtn.classList.add("opacity-0", "pointer-events-none");
    } else {
      prevBtn.classList.remove("opacity-0", "pointer-events-none");
    }

    if (currentSlide === totalSlides - 1) {
      nextBtn.classList.add("hidden");
      vamosBtn.classList.remove("hidden");
    } else {
      nextBtn.classList.remove("hidden");
      vamosBtn.classList.add("hidden");
    }
  };

  document.getElementById("prev-btn").onclick = () => {
    if (currentSlide > 0) {
      currentSlide--;
      updateSlide();
    }
  };

  document.getElementById("next-btn").onclick = () => {
    if (currentSlide < totalSlides - 1) {
      currentSlide++;
      updateSlide();
    }
  };

  document.getElementById("vamos-btn").onclick = () => {
    window.location.href = `/player?id=${playerId}`;
  };

  updateSlide();
};
