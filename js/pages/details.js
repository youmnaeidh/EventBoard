window.EventBoard = window.EventBoard || {};

(function (EB) {
  EB.pages = EB.pages || {};

  EB.pages.details = function detailsPage(slug) {
    const event = EB.events.find((item) => item.slug === slug);
    if (!event) return EB.pages.notFound();

    const inPlan = EB.storage.getPlans().includes(event.id);
    const metrics = EB.analytics.metricsFor(event);
    const interestRate = Math.round((metrics.plans / Math.max(metrics.views, 1)) * 100);

    return `
      <section class="page-hero event-detail-hero" style="background-image: url('${event.image}')">
        <div class="container">
          <span class="eyebrow page-eyebrow">${event.category} · ${event.eventType}</span>
          <h1>${event.title}</h1>
          <p>${event.summary}</p>
        </div>
      </section>

      <section class="section">
        <div class="container details">
          <div class="details-image reveal">
            <img src="${event.image}" alt="${event.title}" />
          </div>

          <div class="details-content reveal">
            <span class="eyebrow">تفاصيل التجربة</span>
            <h1>${event.title}</h1>
            <p>${event.description}</p>

            <div class="detail-list">
              <div><strong>التاريخ</strong><span>${event.dateLabel}</span></div>
              <div><strong>الوقت</strong><span>${event.time}</span></div>
              <div><strong>الموقع</strong><span>${event.venue}</span></div>
              <div><strong>السعر</strong><span>${event.price}</span></div>
              <div><strong>مناسبة لـ</strong><span>${event.audience}</span></div>
              <div><strong>طريقة الحضور</strong><span>${event.format}</span></div>
              <div><strong>المنظم</strong><span>${event.organizer}</span></div>
              <div><strong>المسافة التقريبية</strong><span>${event.distance}</span></div>
            </div>

            <h3>ماذا تتضمن الفعالية؟</h3>
            <div class="highlights">
              ${event.highlights.map((highlight) => `<div class="highlight">✓ ${highlight}</div>`).join("")}
            </div>

            <div class="event-interest-summary">
              <span><strong>${metrics.plans}</strong> أضافوها إلى خطتهم</span>
              <span><strong>${interestRate}%</strong> معدل اهتمام</span>
            </div>

            <div class="hero-actions detail-actions">
              <button
                class="button button-gradient"
                type="button"
                data-action="toggle-plan"
                data-event-id="${event.id}"
              >${inPlan ? "إزالة من خطتي" : "أضف إلى خطتي"}</button>

              <button
                class="button button-outline"
                type="button"
                data-action="share-event"
                data-event-slug="${event.slug}"
                data-event-title="${event.title}"
                data-event-id="${event.id}"
              >مشاركة الفعالية</button>
            </div>
          </div>
        </div>
      </section>
    `;
  };

  EB.pages.notFound = function notFoundPage() {
    return `
      <section class="section not-found-page">
        <div class="container">
          <span class="not-found-number">404</span>
          <h1>الصفحة غير موجودة</h1>
          <p>الرابط الذي فتحته غير متاح أو تغير مكانه.</p>
          <a class="button button-gradient" href="#home">العودة للرئيسية</a>
        </div>
      </section>
    `;
  };
})(window.EventBoard);
