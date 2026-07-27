window.EventBoard = window.EventBoard || {};

(function (EB) {
  EB.state = {
    testimonialIndex: 0,
    testimonialTimer: null,
    toastTimer: null
  };

  const app = document.getElementById("app");
  const header = document.getElementById("siteHeader");
  const menuButton = document.getElementById("menuButton");
  const mainNav = document.getElementById("mainNav");

  function getRoute() {
    return decodeURIComponent(window.location.hash.replace(/^#/, "") || "home");
  }

  function setActiveNavigation(route) {
    document.querySelectorAll("[data-nav]").forEach((link) => {
      link.classList.toggle("active", route.startsWith(link.dataset.nav));
    });
  }

  function closeMobileMenu() {
    mainNav.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
  }

  function setupRevealAnimation() {
    document.querySelectorAll(".stagger-list").forEach((group) => {
      [...group.children].forEach((item, index) => {
        if (item.classList.contains("reveal")) {
          item.style.setProperty("--reveal-delay", `${Math.min(index, 6) * 90}ms`);
        }
      });
    });

    const items = document.querySelectorAll(".reveal");

    if (!("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("visible"));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    items.forEach((item) => observer.observe(item));
  }

  function setupHeroVideo() {
    const video = document.getElementById("heroVideo");
    if (!video) return;

    video.addEventListener("timeupdate", () => {
      if (video.currentTime >= 28) {
        video.currentTime = 0;
        video.play().catch(() => {});
      }
    });
  }

  function updateHashFromForm(form, baseRoute) {
    const params = new URLSearchParams();
    const formData = new FormData(form);

    formData.forEach((value, key) => {
      const text = String(value).trim();
      if (!text || text === "الكل" || text === "all") return;
      params.set(key, text);
    });

    window.location.hash = params.toString() ? `#${baseRoute}?${params}` : `#${baseRoute}`;
  }

  function setupPageForms() {
    const searchForm = document.getElementById("homeSearch");
    const filterForm = document.getElementById("eventsFilterForm");
    const newsletterForm = document.getElementById("newsletterForm");
    const sellForm = document.getElementById("sellForm");

    if (searchForm) {
      searchForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const query = document.getElementById("searchQuery").value.trim();
        const category = document.getElementById("searchCategory").value;
        const params = new URLSearchParams();

        EB.storage.recordSearch(query, category, "home");
        if (query) params.set("q", query);
        if (category !== "الكل") params.set("category", category);
        window.location.hash = params.toString() ? `#events?${params}` : "#events";
      });
    }

    if (filterForm) {
      filterForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(filterForm);
        EB.storage.recordSearch(data.get("q"), data.get("category"), "filters");
        updateHashFromForm(filterForm, "events");
      });
    }

    if (newsletterForm) {
      newsletterForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const email = new FormData(newsletterForm).get("email");
        EB.storage.saveNewsletterEmail(String(email));
        newsletterForm.reset();
        EB.ui.showToast("تم تسجيل بريدك، نورت قائمة EventBoard");
      });
    }

    if (sellForm) {
      sellForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const formData = Object.fromEntries(new FormData(sellForm).entries());
        const reference = EB.storage.saveEventRequest(formData);
        sellForm.reset();
        EB.ui.showToast(`تم حفظ الطلب برقم ${reference}`);
      });
    }
  }

  function startTestimonialRotation() {
    clearInterval(EB.state.testimonialTimer);
    if (!document.getElementById("testimonial")) return;

    EB.ui.renderTestimonial();
    EB.state.testimonialTimer = setInterval(() => {
      EB.state.testimonialIndex = (EB.state.testimonialIndex + 1) % EB.testimonials.length;
      EB.ui.renderTestimonial();
    }, 5500);
  }

  function renderRoute() {
    const route = getRoute();

    if (route.startsWith("event/")) {
      const slug = route.split("/")[1].split("?")[0];
      const event = EB.events.find((item) => item.slug === slug);
      if (event) EB.storage.recordEventView(event.id);
      app.innerHTML = EB.pages.details(slug);
    } else if (route.startsWith("events")) {
      app.innerHTML = EB.pages.events(false);
    } else if (route.startsWith("favorites")) {
      app.innerHTML = EB.pages.events(true);
    } else if (route.startsWith("insights")) {
      app.innerHTML = EB.pages.insights();
    } else if (route.startsWith("sell")) {
      app.innerHTML = EB.pages.sell();
    } else if (route === "home" || route === "") {
      app.innerHTML = EB.pages.home();
    } else {
      app.innerHTML = EB.pages.notFound();
    }

    setActiveNavigation(route);
    closeMobileMenu();
    EB.ui.updateFavoriteCount();
    setupPageForms();
    setupRevealAnimation();
    setupHeroVideo();
    startTestimonialRotation();

    window.scrollTo({ top: 0, behavior: "auto" });
    app.focus({ preventScroll: true });
  }

  async function shareEvent(button) {
    const title = button.dataset.eventTitle;
    const slug = button.dataset.eventSlug;
    const eventId = Number(button.dataset.eventId);
    const baseUrl = window.location.href.split("#")[0];
    const url = `${baseUrl}#event/${slug}`;

    try {
      if (navigator.share) {
        await navigator.share({ title, text: `شوف فعالية ${title} على EventBoard`, url });
        EB.storage.recordInteraction("share", eventId);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        EB.storage.recordInteraction("share", eventId);
        EB.ui.showToast("تم نسخ رابط الفعالية");
      } else {
        EB.ui.showToast("انسخ رابط الصفحة من شريط المتصفح");
      }
    } catch (error) {
      if (error.name !== "AbortError") EB.ui.showToast("تعذرت المشاركة الآن");
    }
  }

  document.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    const action = actionButton.dataset.action;

    if (action === "toggle-favorite") {
      const eventId = Number(actionButton.dataset.eventId);
      const added = EB.storage.toggleFavorite(eventId);
      actionButton.classList.toggle("active", added);
      actionButton.textContent = added ? "♥" : "♡";
      actionButton.setAttribute("aria-pressed", String(added));
      actionButton.setAttribute("aria-label", added ? "إزالة من المفضلة" : "إضافة إلى المفضلة");
      EB.ui.updateFavoriteCount();
      EB.ui.showToast(added ? "تمت إضافة الفعالية إلى المفضلة" : "تم حذف الفعالية من المفضلة");
      if (getRoute().startsWith("favorites")) renderRoute();
    }

    if (action === "toggle-plan") {
      const eventId = Number(actionButton.dataset.eventId);
      const added = EB.storage.togglePlan(eventId);
      actionButton.textContent = added ? "إزالة من خطتي" : "أضف إلى خطتي";
      EB.ui.showToast(added ? "تمت إضافة الفعالية إلى خطتك" : "تم حذف الفعالية من خطتك");
    }

    if (action === "set-category") {
      const category = actionButton.dataset.category;
      EB.storage.recordSearch("", category, "category");
      window.location.hash = category === "الكل"
        ? "#events"
        : `#events?category=${encodeURIComponent(category)}`;
    }

    if (action === "track-interest") {
      EB.storage.recordSearch("", actionButton.dataset.category, "interest");
    }

    if (action === "testimonial") {
      EB.state.testimonialIndex = Number(actionButton.dataset.index);
      EB.ui.renderTestimonial();
      startTestimonialRotation();
    }

    if (action === "share-event") shareEvent(actionButton);

    if (action === "download-report") {
      EB.analytics.downloadCsv();
      EB.ui.showToast("تم تجهيز تقرير CSV");
    }
  });

  menuButton.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (event) => {
    if (!mainNav.classList.contains("open")) return;
    if (mainNav.contains(event.target) || menuButton.contains(event.target)) return;
    closeMobileMenu();
  });

  window.addEventListener("scroll", () => {
    header.classList.toggle("scrolled", window.scrollY > 40);
  }, { passive: true });

  window.addEventListener("hashchange", renderRoute);
  renderRoute();
})(window.EventBoard);
