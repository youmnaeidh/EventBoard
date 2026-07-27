window.EventBoard = window.EventBoard || {};

(function (EB) {
  function count(type, eventId) {
    return EB.storage.getInteractions().filter((item) => item.type === type && (!eventId || item.eventId === eventId)).length;
  }

  function metricsFor(event) {
    return {
      views: event.metrics.views + count("view", event.id),
      saves: event.metrics.saves + count("favorite_add", event.id),
      plans: event.metrics.plans + count("plan_add", event.id),
      shares: event.metrics.shares + count("share", event.id)
    };
  }

  function demandRows() {
    const localSearches = EB.storage.getSearches();
    return EB.analyticsSeed.demand.map((item) => {
      const additions = localSearches.filter((search) => {
        const query = search.query.toLowerCase();
        return search.category === item.category || query.includes(item.term.split(" ")[0]);
      }).length;
      const searches = item.searches + additions;
      const ratio = searches / Math.max(item.available, 1);
      const opportunity = ratio >= 55 ? "مرتفعة" : ratio >= 30 ? "متوسطة" : "جيدة";
      return { ...item, searches, opportunity };
    }).sort((a, b) => b.searches / b.available - a.searches / a.available);
  }

  function report() {
    const eventRows = EB.events.map((event) => ({ event, metrics: metricsFor(event) }));
    const totals = eventRows.reduce((result, row) => {
      result.views += row.metrics.views;
      result.saves += row.metrics.saves;
      result.plans += row.metrics.plans;
      result.shares += row.metrics.shares;
      result.target += row.event.targetAttendance;
      return result;
    }, { views: 0, saves: 0, plans: 0, shares: 0, target: 0 });

    const categoryMap = eventRows.reduce((result, row) => {
      const name = row.event.category;
      if (!result[name]) result[name] = { views: 0, plans: 0, saves: 0 };
      result[name].views += row.metrics.views;
      result[name].plans += row.metrics.plans;
      result[name].saves += row.metrics.saves;
      return result;
    }, {});

    const categories = Object.entries(categoryMap)
      .map(([name, values]) => ({
        name,
        ...values,
        rate: Math.round((values.plans / Math.max(values.views, 1)) * 100)
      }))
      .sort((a, b) => b.plans - a.plans);

    const topEvents = [...eventRows]
      .sort((a, b) => b.metrics.plans - a.metrics.plans)
      .slice(0, 4);

    const interestRate = Math.round((totals.plans / Math.max(totals.views, 1)) * 100);
    const saveRate = Math.round((totals.saves / Math.max(totals.views, 1)) * 100);
    const interestVsTarget = Math.round((totals.plans / Math.max(totals.target, 1)) * 100);
    const localActivity = EB.storage.getInteractions().length + EB.storage.getSearches().length;

    return {
      totals,
      categories,
      topEvents,
      demand: demandRows(),
      daily: EB.analyticsSeed.dailyActivity,
      interestRate,
      saveRate,
      interestVsTarget,
      localActivity
    };
  }

  function csvCell(value) {
    const text = String(value ?? "").replace(/"/g, '""');
    return `"${text}"`;
  }

  EB.analytics = {
    metricsFor,
    report,

    downloadCsv() {
      const data = report();
      const rows = [
        ["event_name", "category", "views", "favorites", "plan_additions", "shares", "target_attendance", "interest_rate", "interest_vs_target"]
      ];

      EB.events.forEach((event) => {
        const metrics = metricsFor(event);
        rows.push([
          event.title,
          event.category,
          metrics.views,
          metrics.saves,
          metrics.plans,
          metrics.shares,
          event.targetAttendance,
          `${Math.round((metrics.plans / Math.max(metrics.views, 1)) * 100)}%`,
          `${Math.round((metrics.plans / Math.max(event.targetAttendance, 1)) * 100)}%`
        ]);
      });

      rows.push([]);
      rows.push(["search_term", "category", "searches", "available_events", "opportunity"]);
      data.demand.forEach((item) => rows.push([item.term, item.category, item.searches, item.available, item.opportunity]));

      const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "eventboard-performance-report.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
  };
})(window.EventBoard);
