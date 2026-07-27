window.EventBoard = window.EventBoard || {};

(function (EB) {
  function addScore(scores, category, value) {
    scores[category] = (scores[category] || 0) + value;
  }

  function profileScores() {
    const scores = {};
    const favorites = EB.storage.getFavorites();
    const plans = EB.storage.getPlans();
    const interactions = EB.storage.getInteractions();
    const searches = EB.storage.getSearches();

    EB.events.forEach((event) => {
      if (favorites.includes(event.id)) addScore(scores, event.category, 5);
      if (plans.includes(event.id)) addScore(scores, event.category, 7);
    });

    interactions.forEach((item) => {
      const event = EB.events.find((entry) => entry.id === item.eventId);
      if (!event) return;
      if (item.type === "view") addScore(scores, event.category, 1);
      if (item.type === "share") addScore(scores, event.category, 2);
    });

    searches.forEach((item) => {
      if (item.category === "ثقافة وفن") {
        addScore(scores, "ثقافة", 3);
        addScore(scores, "فن", 3);
      } else if (item.category && item.category !== "الكل") {
        addScore(scores, item.category, 3);
      }
      if (item.query) {
        const query = item.query.toLowerCase();
        EB.events.forEach((event) => {
          const haystack = [event.title, event.category, event.summary, event.eventType].join(" ").toLowerCase();
          if (haystack.includes(query)) addScore(scores, event.category, 2);
        });
      }
    });

    return scores;
  }

  EB.recommendations = {
    get(limit) {
      const scores = profileScores();
      const rankedCategories = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      const plans = EB.storage.getPlans();
      const favorites = EB.storage.getFavorites();
      const hasProfile = rankedCategories.length > 0;

      const events = [...EB.events]
        .map((event) => ({
          event,
          score: (scores[event.category] || 0)
            + (event.featured ? 1 : 0)
            + Math.round(event.metrics.plans / 250)
            - (plans.includes(event.id) ? 2 : 0)
        }))
        .sort((a, b) => b.score - a.score)
        .map((item) => item.event);

      const selected = events.slice(0, limit || 4);
      const availableCategories = rankedCategories.filter(([category]) => EB.events.some((event) => event.category === category));
      const topCategory = availableCategories[0] ? availableCategories[0][0] : "";
      let reason = "مختارات عليها اهتمام من زوار EventBoard";

      if (hasProfile && topCategory) {
        reason = `اخترناها لك بناءً على اهتمامك بفعاليات ${topCategory}`;
      } else if (hasProfile) {
        reason = "ما فيه خيار مطابق لاهتمامك الآن، فاخترنا لك أقرب فعاليات";
      } else if (favorites.length) {
        reason = "فعاليات قريبة من الأشياء التي حفظتها";
      }

      return { events: selected, reason, personalized: hasProfile };
    }
  };
})(window.EventBoard);
