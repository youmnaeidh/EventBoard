window.EventBoard = window.EventBoard || {};

(function (EB) {
  const keys = {
    favorites: "eventboard-favorites",
    plans: "eventboard-plans",
    newsletter: "eventboard-newsletter",
    eventRequests: "eventboard-event-requests",
    interactions: "eventboard-interactions",
    searches: "eventboard-searches"
  };

  function read(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function toggleList(key, eventId) {
    const items = read(key, []);
    const exists = items.includes(eventId);
    const updated = exists ? items.filter((id) => id !== eventId) : [...items, eventId];
    write(key, updated);
    return !exists;
  }

  EB.storage = {
    getFavorites() {
      return read(keys.favorites, []);
    },

    toggleFavorite(eventId) {
      const added = toggleList(keys.favorites, eventId);
      this.recordInteraction(added ? "favorite_add" : "favorite_remove", eventId);
      return added;
    },

    getPlans() {
      return read(keys.plans, []);
    },

    togglePlan(eventId) {
      const added = toggleList(keys.plans, eventId);
      this.recordInteraction(added ? "plan_add" : "plan_remove", eventId);
      return added;
    },

    recordEventView(eventId) {
      const sessionKey = `eventboard-viewed-${eventId}`;
      try {
        if (sessionStorage.getItem(sessionKey)) return;
        sessionStorage.setItem(sessionKey, "1");
      } catch (error) {
        return this.recordInteraction("view", eventId);
      }
      this.recordInteraction("view", eventId);
    },

    recordInteraction(type, eventId, meta) {
      const interactions = read(keys.interactions, []);
      interactions.push({
        type,
        eventId: Number(eventId) || null,
        meta: meta || {},
        createdAt: new Date().toISOString()
      });
      write(keys.interactions, interactions.slice(-500));
    },

    getInteractions() {
      return read(keys.interactions, []);
    },

    recordSearch(query, category, source) {
      const searches = read(keys.searches, []);
      const value = {
        query: String(query || "").trim(),
        category: String(category || "الكل"),
        source: source || "search",
        createdAt: new Date().toISOString()
      };
      if (!value.query && value.category === "الكل") return;
      searches.push(value);
      write(keys.searches, searches.slice(-200));
    },

    getSearches() {
      return read(keys.searches, []);
    },

    saveNewsletterEmail(email) {
      const emails = read(keys.newsletter, []);
      const normalized = email.trim().toLowerCase();
      if (!emails.includes(normalized)) write(keys.newsletter, [...emails, normalized]);
    },

    saveEventRequest(request) {
      const requests = read(keys.eventRequests, []);
      const reference = `EB-${String(Date.now()).slice(-6)}`;
      write(keys.eventRequests, [
        ...requests,
        { ...request, reference, createdAt: new Date().toISOString() }
      ]);
      return reference;
    }
  };
})(window.EventBoard);
