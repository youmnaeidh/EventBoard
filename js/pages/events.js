window.EventBoard = window.EventBoard || {};

(function (EB) {
  EB.pages = EB.pages || {};

  function getFilters() {
    const rawHash = decodeURIComponent(window.location.hash);
    const queryString = rawHash.split("?")[1] || "";
    const params = new URLSearchParams(queryString);

    return {
      query: (params.get("q") || "").trim(),
      category: params.get("category") || "الكل",
      interest: params.get("interest") || "",
      timing: params.get("timing") || "all",
      price: params.get("price") || "all"
    };
  }

  EB.pages.events = function eventsPage(onlyFavorites) {
    const { query, category, interest, timing, price } = getFilters();
    const favoriteIds = EB.storage.getFavorites();
    const categories = ["الكل", "ثقافة", "فن", "تراث", "عائلي", "رياضة", "ورش", "طعام وقهوة"];

    let list = onlyFavorites
      ? EB.events.filter((event) => favoriteIds.includes(event.id))
      : [...EB.events];

    if (query) {
      const searchableQuery = query.toLowerCase();
      list = list.filter((event) =>
        [event.title, event.venue, event.district, event.category, event.summary, event.eventType]
          .join(" ")
          .toLowerCase()
          .includes(searchableQuery)
      );
    }

    if (interest === "ثقافة وفن") {
      list = list.filter((event) => ["ثقافة", "فن"].includes(event.category));
    } else if (category !== "الكل") {
      list = list.filter((event) => event.category === category);
    }

    if (timing === "early") list = list.filter((event) => event.dateGroup === "early");
    if (timing === "mid") list = list.filter((event) => event.dateGroup === "mid");
    if (timing === "ending") list = list.filter((event) => event.endingSoon);
    if (price !== "all") list = list.filter((event) => event.priceType === price);

    let heading = onlyFavorites ? "الفعاليات المفضلة" : "جميع الفعاليات";
    if (interest) heading = `فعاليات ${interest}`;
    if (!interest && category !== "الكل") heading = `فعاليات ${category}`;
    if (timing === "early") heading = "فعاليات بداية الموسم";
    if (timing === "mid") heading = "فعاليات منتصف الموسم";
    if (timing === "ending") heading = "فعاليات التسجيل المحدود";
    if (query) heading = `نتائج البحث عن «${query}»`;

    return `
      <section class="page-hero ${onlyFavorites ? "favorites-hero" : "events-hero"}">
        <div class="container">
          <span class="eyebrow page-eyebrow">${onlyFavorites ? "قائمتك الخاصة" : "كل ما يحدث في المدينة"}</span>
          <h1>${heading}</h1>
          <p>${onlyFavorites
            ? "الفعاليات التي حفظتها لتعود إليها لاحقًا."
            : "ابحث حسب الاسم، الوقت، التصنيف أو السعر واختر التجربة المناسبة لك."}</p>
        </div>
      </section>

      <section class="section">
        <div class="container">
          ${onlyFavorites ? "" : `
            <form class="event-filter-panel reveal" id="eventsFilterForm">
              <label>
                كلمة البحث
                <input name="q" type="search" value="${query}" placeholder="اسم فعالية أو حي" />
              </label>
              <label>
                التصنيف
                <select name="category">
                  ${categories.map((item) => `<option value="${item}" ${item === category ? "selected" : ""}>${item}</option>`).join("")}
                </select>
              </label>
              <label>
                الوقت
                <select name="timing">
                  <option value="all" ${timing === "all" ? "selected" : ""}>كل المواعيد</option>
                  <option value="early" ${timing === "early" ? "selected" : ""}>بداية الموسم</option>
                  <option value="mid" ${timing === "mid" ? "selected" : ""}>منتصف الموسم</option>
                  <option value="ending" ${timing === "ending" ? "selected" : ""}>التسجيل محدود</option>
                </select>
              </label>
              <label>
                السعر
                <select name="price">
                  <option value="all" ${price === "all" ? "selected" : ""}>الكل</option>
                  <option value="free" ${price === "free" ? "selected" : ""}>مجانية</option>
                  <option value="paid" ${price === "paid" ? "selected" : ""}>مدفوعة</option>
                </select>
              </label>
              <button class="button button-gradient" type="submit">تطبيق</button>
            </form>

            <div class="results-toolbar reveal">
              <div class="filters" aria-label="تصفية الفعاليات حسب التصنيف">
                ${categories.map((item) => `
                  <button
                    class="${!interest && item === category ? "active" : ""}"
                    type="button"
                    data-action="set-category"
                    data-category="${item}"
                  >${item}</button>
                `).join("")}
              </div>
              <span class="results-count">${list.length} فعالية</span>
            </div>
          `}

          ${list.length
            ? `<div class="events-grid">${list.map(EB.ui.eventCard).join("")}</div>`
            : `
              <div class="empty reveal">
                <span class="empty-icon">♡</span>
                <h3>لا توجد فعاليات هنا حاليًا</h3>
                <p>${onlyFavorites
                  ? "اضغط على رمز القلب في أي فعالية لإضافتها إلى قائمتك."
                  : "جرّب تصنيفًا أو عبارة بحث مختلفة."}</p>
                <a class="button button-outline" href="#events">عرض جميع الفعاليات</a>
              </div>
            `}
        </div>
      </section>
    `;
  };
})(window.EventBoard);
