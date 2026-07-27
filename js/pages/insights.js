window.EventBoard = window.EventBoard || {};

(function (EB) {
  EB.pages = EB.pages || {};

  function formatNumber(value) {
    return new Intl.NumberFormat("ar-SA").format(value);
  }

  function opportunityClass(value) {
    if (value === "مرتفعة") return "high";
    if (value === "متوسطة") return "medium";
    return "good";
  }

  EB.pages.insights = function insightsPage() {
    const report = EB.analytics.report();
    const { totals, categories, topEvents, demand, daily } = report;
    const maxPlans = Math.max(...categories.map((item) => item.plans), 1);
    const maxDailyViews = Math.max(...daily.map((item) => item.views), 1);
    const topCategory = categories[0];
    const topEvent = topEvents[0];
    const topEventRate = Math.round((topEvent.metrics.plans / Math.max(topEvent.metrics.views, 1)) * 100);
    const funnel = [
      { label: "مشاهدات", value: totals.views, width: 100 },
      { label: "حفظ", value: totals.saves, width: Math.max(24, Math.round((totals.saves / totals.views) * 100)) },
      { label: "إضافة للخطة", value: totals.plans, width: Math.max(20, Math.round((totals.plans / totals.views) * 100)) },
      { label: "مشاركة", value: totals.shares, width: Math.max(14, Math.round((totals.shares / totals.views) * 100)) }
    ];

    return `
      <section class="page-hero insights-hero">
        <div class="container">
          <span class="eyebrow page-eyebrow">نموذج لصاحب الفعالية</span>
          <h1>تقرير الأداء والطلب</h1>
          <p>يعرض الوصول والتفاعل وما يبحث عنه الجمهور، ثم يحول الأرقام إلى خطوات تساعد في تحسين الترويج.</p>
        </div>
      </section>

      <section class="section analytics-section">
        <div class="container">
          <div class="analytics-toolbar reveal">
            <div>
              <strong>نموذج توضيحي</strong>
              <span>يعتمد على بيانات مشروع تجريبية، ويضيف التفاعل الذي يحدث داخل هذا المتصفح.</span>
            </div>
            <button class="button button-outline" type="button" data-action="download-report">تنزيل CSV</button>
          </div>

          <div class="metrics-grid stagger-list">
            <article class="metric-card reveal"><span>إجمالي المشاهدات</span><strong>${formatNumber(totals.views)}</strong><small>وصول الفعاليات للجمهور</small></article>
            <article class="metric-card reveal"><span>الإضافة إلى الخطة</span><strong>${formatNumber(totals.plans)}</strong><small>${report.interestRate}% من المشاهدات</small></article>
            <article class="metric-card reveal"><span>مرات الحفظ</span><strong>${formatNumber(totals.saves)}</strong><small>${report.saveRate}% للعودة لاحقًا</small></article>
            <article class="metric-card reveal"><span>الاهتمام مقارنة بالمستهدف</span><strong>${report.interestVsTarget}%</strong><small>إضافات الخطة مقارنة بالعدد المستهدف</small></article>
          </div>

          <div class="analytics-grid">
            <article class="analytics-card reveal">
              <div class="analytics-card-head">
                <div><span class="eyebrow">رحلة التفاعل</span><h2>من المشاهدة إلى الاهتمام</h2></div>
                <span class="analytics-label">Conversion funnel</span>
              </div>
              <div class="funnel-list">
                ${funnel.map((item) => `
                  <div class="funnel-row">
                    <div><strong>${item.label}</strong><span>${formatNumber(item.value)}</span></div>
                    <div class="funnel-track"><i style="width:${item.width}%"></i></div>
                  </div>
                `).join("")}
              </div>
            </article>

            <article class="analytics-card reveal">
              <div class="analytics-card-head">
                <div><span class="eyebrow">نمط أسبوعي تجريبي</span><h2>اتجاه التفاعل حسب اليوم</h2></div>
                <span class="analytics-label">المشاهدات</span>
              </div>
              <div class="daily-chart" aria-label="اتجاه المشاهدات خلال أيام الأسبوع">
                ${daily.map((item) => `
                  <div class="daily-column">
                    <span>${formatNumber(item.views)}</span>
                    <i style="height:${Math.max(20, Math.round((item.views / maxDailyViews) * 100))}%"></i>
                    <small>${item.day}</small>
                  </div>
                `).join("")}
              </div>
            </article>
          </div>

          <div class="analytics-grid">
            <article class="analytics-card reveal">
              <div class="analytics-card-head">
                <div><span class="eyebrow">حسب الاهتمام</span><h2>التفاعل حسب التصنيف</h2></div>
                <span class="analytics-label">إضافات إلى الخطة</span>
              </div>
              <div class="bar-list">
                ${categories.map((item) => `
                  <div class="bar-row">
                    <div><strong>${item.name}</strong><span>${formatNumber(item.plans)} مهتم · ${item.rate}%</span></div>
                    <div class="bar-track"><i style="width:${Math.max(12, Math.round((item.plans / maxPlans) * 100))}%"></i></div>
                  </div>
                `).join("")}
              </div>
            </article>

            <article class="analytics-card reveal">
              <div class="analytics-card-head">
                <div><span class="eyebrow">الأعلى تفاعلًا</span><h2>الفعاليات الأكثر اهتمامًا</h2></div>
              </div>
              <div class="ranking-list">
                ${topEvents.map((row, index) => `
                  <a href="#event/${row.event.slug}">
                    <b>${index + 1}</b>
                    <span><strong>${row.event.title}</strong><small>${formatNumber(row.metrics.plans)} إضافة إلى الخطة</small></span>
                    <i>${Math.round((row.metrics.plans / Math.max(row.metrics.views, 1)) * 100)}%</i>
                  </a>
                `).join("")}
              </div>
            </article>
          </div>

          <article class="analytics-card demand-card reveal">
            <div class="analytics-card-head">
              <div>
                <span class="eyebrow">فرص جديدة</span>
                <h2>ماذا يبحث عنه الجمهور؟</h2>
                <p>مقارنة مبسطة بين حجم البحث وعدد الفعاليات المتاحة.</p>
              </div>
            </div>
            <div class="demand-table-wrap">
              <table class="demand-table">
                <thead>
                  <tr><th>الاهتمام</th><th>عمليات البحث</th><th>المتاح</th><th>الفرصة</th></tr>
                </thead>
                <tbody>
                  ${demand.map((item) => `
                    <tr>
                      <td><strong>${item.term}</strong><small>${item.category}</small></td>
                      <td>${formatNumber(item.searches)}</td>
                      <td>${item.available}</td>
                      <td><span class="opportunity ${opportunityClass(item.opportunity)}">${item.opportunity}</span></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </article>

          <div class="insights-panel reveal">
            <div class="insights-heading">
              <span class="eyebrow">ماذا نفعل بعد قراءة الأرقام؟</span>
              <h2>توصيات قابلة للتنفيذ</h2>
            </div>
            <div class="insight-cards">
              <article>
                <span>01</span>
                <h3>${topEvent.event.title} الأعلى اهتمامًا</h3>
                <p>حقق معدل اهتمام ${topEventRate}%. يمكن الاستفادة من توقيته وطريقة عرض تفاصيله عند الترويج لفعاليات مشابهة.</p>
              </article>
              <article>
                <span>02</span>
                <h3>${topCategory.name} يقود التفاعل</h3>
                <p>هذا التصنيف جمع أعلى عدد من الإضافات إلى الخطة، لذلك يستحق ظهورًا أكبر قبل نهاية الأسبوع.</p>
              </article>
              <article>
                <span>03</span>
                <h3>${demand[0].term} فرصة واضحة</h3>
                <p>حجم البحث مرتفع مقارنة بعدد الخيارات المتاحة. هذا يعطي المنظم إشارة لتجربة فعالية جديدة في هذا المجال.</p>
              </article>
            </div>
          </div>

          <div class="analytics-cta reveal">
            <div>
              <span class="eyebrow">الهدف من التقرير</span>
              <h2>قرار أوضح قبل زيادة ميزانية الإعلان</h2>
              <p>يعرف المنظم أين وصل الإعلان، وما الذي جذب الجمهور، وأي تفاصيل تحتاج تحسين.</p>
            </div>
            <a class="button button-gradient" href="#sell">العودة لإضافة الفعالية</a>
          </div>
        </div>
      </section>
    `;
  };
})(window.EventBoard);
