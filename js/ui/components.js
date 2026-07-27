window.EventBoard = window.EventBoard || {};

(function (EB) {
  const categoryIcons = {
    "ثقافة": "📚",
    "فن": "🎨",
    "تراث": "🏺",
    "عائلي": "🎡",
    "رياضة": "⛰️",
    "ورش": "🧶",
    "طعام وقهوة": "☕"
  };

  function isFavorite(eventId) {
    return EB.storage.getFavorites().includes(eventId);
  }

  EB.ui = {
    titleBlock(eyebrow, title, text) {
      return `
        <div class="section-title reveal">
          <span class="eyebrow">${eyebrow}</span>
          <h2>${title}</h2>
          <p>${text}</p>
        </div>
      `;
    },

    eventCard(event) {
      const active = isFavorite(event.id);
      const icon = categoryIcons[event.category] || "✨";

      return `
        <article class="event-card reveal">
          <div class="event-image">
            <img src="${event.image}" alt="${event.title}" loading="lazy" />
            <span class="event-category">${icon} ${event.category}</span>
            ${event.dateGroup === "early" ? '<span class="event-status">بداية الموسم</span>' : event.endingSoon ? '<span class="event-status event-status-warn">التسجيل محدود</span>' : ""}
            <button
              class="favorite ${active ? "active" : ""}"
              type="button"
              data-action="toggle-favorite"
              data-event-id="${event.id}"
              aria-label="${active ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}"
              aria-pressed="${active}"
            >${active ? "♥" : "♡"}</button>
          </div>

          <div class="event-body">
            <span class="event-date">${event.dateLabel}</span>
            <h3><a href="#event/${event.slug}">${event.title}</a></h3>
            <p>${event.summary}</p>
            <div class="event-meta">
              <span>📍 ${event.district}</span>
              <span>${event.price}</span>
            </div>
          </div>
        </article>
      `;
    },

    showToast(message) {
      const toast = document.getElementById("toast");
      if (!toast) return;

      toast.textContent = message;
      toast.classList.add("show");
      clearTimeout(EB.state.toastTimer);
      EB.state.toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
    },

    updateFavoriteCount() {
      const count = document.getElementById("favCount");
      if (count) count.textContent = EB.storage.getFavorites().length;
    },

    renderTestimonial() {
      const box = document.getElementById("testimonial");
      if (!box) return;

      const testimonial = EB.testimonials[EB.state.testimonialIndex];
      box.innerHTML = `
        <div class="quote" aria-hidden="true">“</div>
        <p class="testimonial-text">${testimonial.text}</p>
        <div class="person">
          <img src="${testimonial.image}" alt="${testimonial.name}" loading="lazy" />
          <div>
            <strong>${testimonial.name}</strong>
            <span>${testimonial.role}</span>
          </div>
        </div>
        <div class="dots" aria-label="التنقل بين الآراء">
          ${EB.testimonials.map((_, index) => `
            <button
              class="${index === EB.state.testimonialIndex ? "active" : ""}"
              type="button"
              data-action="testimonial"
              data-index="${index}"
              aria-label="عرض الرأي ${index + 1}"
            ></button>
          `).join("")}
        </div>
      `;
    }
  };
})(window.EventBoard);
