window.EventBoard = window.EventBoard || {};

(function (EB) {
  EB.pages = EB.pages || {};

  EB.pages.sell = function sellPage() {
    return `
      <section class="page-hero sell-hero">
        <div class="container">
          <span class="eyebrow page-eyebrow">خل الناس تعرف عنها</span>
          <h1>أعلن عن فعاليتك</h1>
          <p>أرسل التفاصيل الأساسية واختر طريقة الظهور المناسبة قبل موعد الفعالية.</p>
        </div>
      </section>

      <section class="section organizer-teaser">
        <div class="container organizer-preview-grid">
          <div class="reveal">
            <span class="eyebrow">بعد نشر فعاليتك</span>
            <h2>اعرف إيش وصل للناس وإيش يحتاج تحسين</h2>
            <p>تتابع المشاهدات، الحفظ، الإضافة إلى الخطة والاهتمام مقارنة بالمستهدف. وتشوف أكثر الأشياء التي يبحث عنها الجمهور قبل ما تزيد ميزانية الإعلان.</p>
            <div class="organizer-benefits">
              <span>مؤشرات واضحة</span>
              <span>تحليل الطلب</span>
              <span>توصيات عملية</span>
              <span>تقرير CSV</span>
            </div>
            <a class="button button-outline" href="#insights">شاهد نموذج تقرير الأداء</a>
          </div>

          <div class="mini-dashboard reveal" aria-label="معاينة تقرير الأداء">
            <div><span>المشاهدات</span><strong>11.3K</strong></div>
            <div><span>الإضافة للخطة</span><strong>2.3K</strong></div>
            <div><span>الاهتمام مقابل المستهدف</span><strong>78%</strong></div>
            <div class="mini-chart"><i style="height:42%"></i><i style="height:66%"></i><i style="height:50%"></i><i style="height:88%"></i><i style="height:74%"></i></div>
            <p class="mini-insight">أعلى تفاعل يظهر قبل نهاية الأسبوع، بينما ورش الفخار من أكثر الأشياء بحثًا.</p>
          </div>
        </div>
      </section>

      <section class="section section-soft">
        <div class="container sell-layout">
          <div class="sell-intro reveal">
            <span class="eyebrow">قبل الإرسال</span>
            <h2>كل معلومة واضحة تزيد فرصة الوصول</h2>
            <p>اكتب وصفًا مباشرًا، حدّد الجمهور المتوقع، وأضف رابط التسجيل حتى يعرف الزائر الخطوة التالية بدون بحث إضافي.</p>
            <ul>
              <li>اسم واضح وصورة مناسبة</li>
              <li>التاريخ والوقت والموقع</li>
              <li>السعر وعدد الحضور المستهدف</li>
              <li>رابط التسجيل أو التواصل</li>
            </ul>
          </div>

          <form class="sell-form reveal" id="sellForm">
            <label>
              اسم المنظم
              <input name="organizer" required placeholder="الاسم أو الجهة" />
            </label>

            <label>
              البريد الإلكتروني
              <input name="email" type="email" required placeholder="name@example.com" />
            </label>

            <label>
              اسم الفعالية
              <input name="eventName" required placeholder="اسم واضح ومختصر" />
            </label>

            <label>
              التصنيف
              <select name="category">
                <option>ثقافة</option>
                <option>فن</option>
                <option>تراث</option>
                <option>عائلي</option>
                <option>رياضة</option>
                <option>ورش</option>
                <option>طعام وقهوة</option>
              </select>
            </label>

            <label>
              التاريخ
              <input name="date" type="date" required />
            </label>

            <label>
              الوقت
              <input name="time" type="time" required />
            </label>

            <label>
              الموقع أو الحي
              <input name="location" required placeholder="مثلاً: حي العريض" />
            </label>

            <label>
              السعر
              <input name="price" placeholder="مجاني أو السعر بالريال" />
            </label>

            <label>
              الجمهور المناسب
              <select name="audience">
                <option>الجميع</option>
                <option>العائلات</option>
                <option>الأطفال</option>
                <option>الشباب</option>
                <option>المهتمون بالمجال</option>
              </select>
            </label>

            <label>
              العدد المستهدف
              <input name="targetAttendance" type="number" min="1" required placeholder="مثلاً: 100" />
            </label>

            <label class="full">
              رابط التسجيل أو التواصل
              <input name="registrationUrl" type="url" placeholder="https://example.com/register" />
            </label>

            <fieldset class="promotion-options full">
              <legend>طريقة الظهور</legend>
              <label class="promotion-card">
                <input type="radio" name="promotion" value="standard" checked />
                <span><strong>إدراج عادي</strong><small>تظهر الفعالية ضمن نتائج البحث والتصنيف.</small></span>
              </label>
              <label class="promotion-card">
                <input type="radio" name="promotion" value="featured" />
                <span><strong>فعالية مميزة</strong><small>ظهور أوضح داخل نتائج البحث.</small></span>
              </label>
              <label class="promotion-card">
                <input type="radio" name="promotion" value="homepage" />
                <span><strong>الصفحة الرئيسية</strong><small>ظهور ضمن مختارات الصفحة الرئيسية.</small></span>
              </label>
            </fieldset>

            <label class="full">
              وصف الفعالية
              <textarea name="description" required placeholder="ما الذي سيجربه الزائر؟ وما أهم التفاصيل التي يحتاج يعرفها؟"></textarea>
            </label>

            <p class="form-note full">بعد الإرسال يظهر رقم مرجعي للطلب.</p>
            <button class="button button-gradient full" type="submit">إرسال الطلب</button>
          </form>
        </div>
      </section>
    `;
  };
})(window.EventBoard);
