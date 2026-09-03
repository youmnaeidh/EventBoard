window.EventBoard = window.EventBoard || {};

(function (EB) {
  EB.pages = EB.pages || {};

  function scheduleItem(event) {
    return `
      <a class="schedule-event" href="#event/${event.slug}">
        <img src="${event.image}" alt="" loading="lazy" />
        <span>
          <strong>${event.title}</strong>
          <small>${event.dateLabel} · ${event.district}</small>
        </span>
        <b aria-hidden="true">←</b>
      </a>
    `;
  }

  EB.pages.home = function homePage() {
    const featuredEvents = EB.events.filter((event) => event.featured);
    const earlyEvents = EB.events.filter((event) => event.dateGroup === "early").slice(0, 2);
    const midEvents = EB.events.filter((event) => event.dateGroup === "mid").slice(0, 2);
    const endingSoonEvents = EB.events.filter((event) => event.endingSoon).slice(0, 2);
    const timelineEvents = EB.events.slice(0, 4);
    const recommendations = EB.recommendations.get(4);

    const interests = [
      ["🎭", "ثقافة وفن", "معارض وكتب وتجارب إبداعية", "#events?interest=ثقافة وفن", "ثقافة وفن"],
      ["🏺", "تراث", "فعاليات تحتفي بموروث المدينة", "#events?category=تراث", "تراث"],
      ["👨‍👩‍👧‍👦", "عائلي", "تجارب لجميع أفراد العائلة", "#events?category=عائلي", "عائلي"],
      ["⛰️", "رياضة ومغامرة", "أنشطة ومسارات في طبيعة المدينة", "#events?category=رياضة", "رياضة"],
      ["🧶", "ورش", "تعلّم مهارة جديدة بيدك", "#events?category=ورش", "ورش"],
      ["☕", "طعام وقهوة", "تذوق وتجارب محلية", "#events?category=طعام وقهوة", "طعام وقهوة"]
    ];

    return `
      <section class="hero" id="home">
        <video class="hero-video" id="heroVideo" autoplay muted loop playsinline poster="assets/branding/hero-poster.jpg">
          <source src="assets/video/madinah-intro.mp4" type="video/mp4" />
        </video>
        <div class="hero-overlay"></div>

        <div class="container hero-content">
          <div class="hero-copy">
            <h1>المدينة فيها<br /><span>أكثر مما تتخيّل</span></h1>
            <p>اكتشف فعاليات وتجارب تناسب اهتماماتك.</p>

            <div class="hero-actions">
              <a class="button hero-primary" href="#events">استكشف الفعاليات</a>
            </div>

            <form class="hero-search" id="homeSearch" aria-label="البحث عن الفعاليات">
              <label class="hero-search-query">
                <span class="sr-only">ابحث عن فعالية أو تجربة</span>
                <span class="hero-search-icon" aria-hidden="true">⌕</span>
                <input id="searchQuery" name="query" type="search" placeholder="ابحث عن فعالية أو تجربة" />
              </label>

              <label class="hero-search-category">
                <span class="sr-only">التصنيف</span>
                <select id="searchCategory" name="category">
                  <option value="الكل">كل التصنيفات</option>
                  <option value="ثقافة">ثقافة</option>
                  <option value="فن">فن</option>
                  <option value="تراث">تراث</option>
                  <option value="عائلي">عائلي</option>
                  <option value="رياضة">رياضة</option>
                  <option value="ورش">ورش</option>
                  <option value="طعام وقهوة">طعام وقهوة</option>
                </select>
              </label>

              <button class="button hero-search-button" type="submit">بحث</button>
            </form>
          </div>
        </div>
      </section>

      <section class="section story-section">
        <div class="container origin-story">
          <div class="origin-copy reveal">
            <span class="eyebrow">بداية الفكرة</span>
            <h2>الفعالية موجودة، لكن إعلانها ما وصل</h2>
            <p>كنت أبحث عن ورشة تشكيل فخار في المدينة، وبعد فترة عرفت بالصدفة عن مرسم صغير قريب. لما دخلت حسابهم اكتشفت أن الورشة انتهت قبلها بيوم، مع أنها كانت بالضبط التجربة التي أبحث عنها.</p>
            <p>وقتها صار السؤال: كم فعالية تبدأ وتنتهي ومحد يدري عنها لأن إعلانها محصور في حساب صغير؟ من هنا بدأت فكرة EventBoard.</p>
          </div>

          <aside class="origin-card reveal">
            <span class="origin-mark">“</span>
            <h3>الوصول للفعالية يصير أبسط</h3>
            <p>EventBoard يجمع التفاصيل المهمة في مكان واحد، ويخلي البحث حسب الوقت والاهتمام أوضح بدل التنقل بين حسابات كثيرة.</p>
            <div class="origin-tags">
              <span>بحث أوضح</span>
              <span>وقت مناسب</span>
              <span>اهتماماتك أولًا</span>
            </div>
          </aside>
        </div>
      </section>

      <section class="section section-soft schedule-section">
        <div class="container">
          ${EB.ui.titleBlock("مواعيد الفعاليات", "اختَر حسب فترة الفعالية", "استعرض فعاليات بداية الموسم ومنتصفه، أو الفعاليات ذات التسجيل المحدود.")}
          <div class="schedule-grid stagger-list">
            <article class="schedule-column reveal">
              <div class="schedule-heading"><span>بداية</span><strong>بداية الموسم</strong></div>
              ${earlyEvents.map(scheduleItem).join("")}
              <a class="schedule-more" href="#events?timing=early">عرض فعاليات بداية الموسم</a>
            </article>

            <article class="schedule-column reveal">
              <div class="schedule-heading"><span>منتصف</span><strong>منتصف الموسم</strong></div>
              ${midEvents.map(scheduleItem).join("")}
              <a class="schedule-more" href="#events?timing=mid">عرض فعاليات منتصف الموسم</a>
            </article>

            <article class="schedule-column reveal">
              <div class="schedule-heading"><span>محدود</span><strong>التسجيل محدود</strong></div>
              ${endingSoonEvents.map(scheduleItem).join("")}
              <a class="schedule-more" href="#events?timing=ending">عرضها الآن</a>
            </article>
          </div>
        </div>
      </section>

      <section class="section" id="featured">
        <div class="container">
          ${EB.ui.titleBlock("مختارات EventBoard", "أبرز الفعاليات", "تجارب متنوعة من قلب المدينة المنورة.")}
          <div class="events-grid stagger-list">${featuredEvents.map(EB.ui.eventCard).join("")}</div>
          <div class="center-actions"><a class="button button-outline" href="#events">شاهد جميع الفعاليات</a></div>
        </div>
      </section>

      <section class="section section-soft">
        <div class="container">
          ${EB.ui.titleBlock("اختر مزاجك", "اكتشف حسب اهتماماتك", "ابدأ من الشيء الذي تحبه، والباقي يصير أسهل.")}
          <div class="interests stagger-list">
            ${interests.map(([icon, title, text, href, category]) => `
              <a class="interest reveal" href="${href}" data-action="track-interest" data-category="${category}">
                <span class="emoji" aria-hidden="true">${icon}</span>
                <h3>${title}</h3>
                <p>${text}</p>
                <span class="interest-link">عرض الفعاليات ←</span>
              </a>
            `).join("")}
          </div>
        </div>
      </section>

      <section class="section recommendation-section">
        <div class="container">
          <div class="recommendation-heading reveal">
            <div>
              <span class="eyebrow">مختارة لك</span>
              <h2>اقتراحات تتغير مع اهتماماتك</h2>
              <p>${recommendations.reason}</p>
            </div>
            <span class="recommendation-chip">${recommendations.personalized ? "حسب تفاعلك" : "بداية مقترحة"}</span>
          </div>
          <div class="events-grid stagger-list">${recommendations.events.map(EB.ui.eventCard).join("")}</div>
        </div>
      </section>

      <section class="section timeline-section">
        <div class="container">
          ${EB.ui.titleBlock("القادم في المدينة", "الخط الزمني للفعاليات", "احفظ مواعيدك وخطط لتجربتك القادمة.")}
          <div class="timeline stagger-list">
            ${timelineEvents.map((event) => `
              <div class="timeline-item reveal">
                <time>${event.dateLabel}</time>
                <span class="timeline-dot"></span>
                <h3>${event.title}</h3>
                <p>${event.venue}</p>
              </div>
            `).join("")}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          ${EB.ui.titleBlock("آراء الزوار", "ماذا يقولون عن التجربة؟", "ملاحظات ساعدتنا نخلي الوصول للفعاليات أبسط.")}
          <div class="testimonial-wrap">
            <i class="shape shape1"></i>
            <i class="shape shape2"></i>
            <div class="testimonial reveal" id="testimonial"></div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="newsletter reveal">
            <div>
              <span class="eyebrow newsletter-eyebrow">لا تفوّت الجديد</span>
              <h2>فعاليات المدينة تصل إلى بريدك</h2>
              <p>مختارات أسبوعية وتجارب جديدة تستحق وقتك.</p>
            </div>
            <form id="newsletterForm">
              <label class="sr-only" for="newsletterEmail">البريد الإلكتروني</label>
              <input id="newsletterEmail" name="email" type="email" required placeholder="البريد الإلكتروني" />
              <button class="button button-light" type="submit">اشتراك</button>
            </form>
          </div>
        </div>
      </section>
    `;
  };
})(window.EventBoard);
