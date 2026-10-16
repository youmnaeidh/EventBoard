// Sample catalogue for the demo. Everything here is illustrative: venues, organizers, prices,
// reviews and coordinates are made up (coordinates are approximate district centres).
// Event dates are expressed as offsets from "today" in Riyadh so the demo always looks current.

export interface DistrictInfo {
  lat: number;
  lng: number;
}

export const districts: Record<string, DistrictInfo> = {
  "المنطقة المركزية": { lat: 24.4672, lng: 39.6111 },
  "قباء": { lat: 24.4393, lng: 39.6177 },
  "حي العزيزية": { lat: 24.4585, lng: 39.6425 },
  "حي العريض": { lat: 24.5042, lng: 39.5791 },
  "حي الخالدية": { lat: 24.4891, lng: 39.5733 },
  "حي الهجرة": { lat: 24.4762, lng: 39.5602 },
  "منطقة أحد": { lat: 24.5004, lng: 39.6121 },
  "حي العوالي": { lat: 24.4262, lng: 39.6334 }
};

export const categories = ["ثقافة", "فن", "تراث", "عائلي", "رياضة", "ورش", "طعام وقهوة", "تقنية"] as const;

export interface SeedEvent {
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: (typeof categories)[number];
  eventType: string;
  image?: string;
  venue: string;
  district: keyof typeof districts;
  /** day offset from today (Riyadh) and local start hour */
  startDay: number;
  startHour: number;
  /** duration in hours (may span days) */
  durationHours: number;
  price: number;
  /** capacity => booking required */
  capacity?: number;
  audience: string;
  highlights: string[];
  organizer: string;
  featured?: boolean;
  /** latent quality used only by the sample-data generator */
  quality: number;
  /** relative attractiveness used only by the sample-data generator */
  appeal: number;
  createdDaysAgo: number;
}

export const organizers = [
  "فريق معرض الكتاب",
  "مجتمع فناني المدينة",
  "لجنة الفعاليات التراثية",
  "كفّة للقهوة",
  "مسارات المدينة",
  "غاليري المدينة",
  "مجتمع البيانات في طيبة",
  "استوديو الحرف"
] as const;

export const seedEvents: SeedEvent[] = [
  {
    slug: "madinah-book-fair",
    title: "معرض المدينة المنورة للكتاب",
    summary: "رحلة بين الكتب والندوات واللقاءات الثقافية في تجربة تناسب جميع أفراد العائلة.",
    description:
      "تجربة ثقافية تجمع دور النشر والمؤلفين وورش الأطفال والجلسات الحوارية في مكان واحد، مع مساحات للقراءة ومقاهٍ ثقافية.",
    category: "ثقافة", eventType: "معرض", image: "/assets/events/book-fair.webp",
    venue: "مركز المؤتمرات الدولي", district: "حي الخالدية",
    startDay: -3, startHour: 16, durationHours: 24 * 7 + 7, price: 0,
    audience: "العائلات ومحبو القراءة",
    highlights: ["دور نشر محلية وعربية", "ورش يومية للأطفال", "جلسات ولقاءات ثقافية", "مناطق قراءة ومقاهٍ"],
    organizer: "فريق معرض الكتاب", featured: true, quality: 4.5, appeal: 1.5, createdDaysAgo: 40
  },
  {
    slug: "art-and-inspiration",
    title: "تشكيل وإلهام",
    summary: "معرض فني معاصر يعرض أعمال فنانات وفناني المدينة في أجواء تفاعلية.",
    description:
      "أمسية فنية تجمع اللوحات والتجارب البصرية والعروض الحية، مع مساحة للقاء الفنانين وتجربة أنشطة فنية قصيرة.",
    category: "فن", eventType: "معرض", image: "/assets/events/art-inspiration.webp",
    venue: "مركز المدينة للفنون", district: "حي العريض",
    startDay: 2, startHour: 18, durationHours: 4.5, price: 45, capacity: 220,
    audience: "محبو الفن والتجارب الإبداعية",
    highlights: ["أعمال فنية معاصرة", "رسم حي", "لقاء الفنانين", "ركن تصوير تفاعلي"],
    organizer: "مجتمع فناني المدينة", featured: true, quality: 4.6, appeal: 1.3, createdDaysAgo: 21
  },
  {
    slug: "falcon-festival",
    title: "مهرجان الصقور",
    summary: "تجربة تراثية تعرّف الزوار بعالم الصقور وموروث المنطقة بأسلوب عائلي ممتع.",
    description:
      "مهرجان يحتفي بالصقور والموروث السعودي عبر عروض تعريفية وسوق حرفي وأطعمة شعبية وتجارب مناسبة للعائلة.",
    category: "تراث", eventType: "مهرجان", image: "/assets/events/falcon-festival.webp",
    venue: "ساحة الفعاليات التراثية", district: "حي العزيزية",
    startDay: 5, startHour: 17, durationHours: 48 + 6, price: 25, capacity: 500,
    audience: "العائلات ومحبو التراث",
    highlights: ["عروض الصقور", "سوق الحرف", "أكلات شعبية", "أنشطة للأطفال"],
    organizer: "لجنة الفعاليات التراثية", featured: true, quality: 4.4, appeal: 1.5, createdDaysAgo: 30
  },
  {
    slug: "madinah-nights",
    title: "ليالي المدينة",
    summary: "ليالٍ مليئة بالعروض والأسواق والمأكولات والتجارب العائلية بين أجواء المدينة.",
    description:
      "فعالية مسائية تجمع المسرح الحي وعربات الطعام وسوق المنتجات المحلية وأركان الأطفال ضمن أجواء احتفالية.",
    category: "عائلي", eventType: "مهرجان", image: "/assets/events/madinah-nights.webp",
    venue: "حديقة الملك فهد", district: "حي العزيزية",
    startDay: -1, startHour: 17.5, durationHours: 24 * 14 + 6.5, price: 30, capacity: 900,
    audience: "العائلات والأطفال",
    highlights: ["عروض مسرحية", "منطقة مطاعم", "سوق محلي", "ألعاب وتجارب عائلية"],
    organizer: "لجنة الفعاليات التراثية", featured: true, quality: 4.3, appeal: 2.0, createdDaysAgo: 35
  },
  {
    slug: "mountain-adventure",
    title: "مغامرة جبال المدينة",
    summary: "تجربة مشي واستكشاف صباحية في مسار طبيعي بإشراف فريق متخصص.",
    description:
      "نشاط رياضي للمبتدئين ومحبي الطبيعة، يشمل إرشادات السلامة واستراحات منظمة وتجربة تصوير للمناظر المحيطة.",
    category: "رياضة", eventType: "تجربة", image: "/assets/events/mountain-adventure.webp",
    venue: "مسار جبل أحد", district: "منطقة أحد",
    startDay: 3, startHour: 5.5, durationHours: 4.5, price: 80, capacity: 80,
    audience: "المبتدئون ومحبو الطبيعة",
    highlights: ["مرشدون متخصصون", "عدة سلامة", "استراحات ومياه", "تصوير جماعي"],
    organizer: "مسارات المدينة", quality: 4.7, appeal: 0.8, createdDaysAgo: 18
  },
  {
    slug: "madinah-designers",
    title: "معرض مصممات المدينة",
    summary: "مساحة تعرض منتجات وتصاميم محلية في الأزياء والفنون والمنتجات الإبداعية.",
    description:
      "معرض يدعم المواهب المحلية ويتيح للزوار التعرف على المصممات وشراء المنتجات وحضور جلسات قصيرة عن بناء العلامات.",
    category: "فن", eventType: "معرض", image: "/assets/events/design-exhibition.webp",
    venue: "مركز المعارض الإبداعية", district: "حي الهجرة",
    startDay: 9, startHour: 16, durationHours: 48 + 6, price: 0,
    audience: "محبو التصميم والمنتجات المحلية",
    highlights: ["علامات محلية", "جلسات قصيرة", "منتجات حصرية", "ركن تصوير"],
    organizer: "مجتمع فناني المدينة", quality: 4.2, appeal: 0.9, createdDaysAgo: 6
  },
  {
    slug: "art-gallery-evening",
    title: "أمسية في المعرض",
    summary: "جولة فنية بصحبة مرشد تتبعها جلسة نقاش خفيفة في أجواء هادئة.",
    description:
      "أمسية ثقافية مخصصة لمحبي الفن، تتضمن جولة تفسيرية بين الأعمال ثم حوارًا مفتوحًا حول التجارب المعروضة.",
    category: "ثقافة", eventType: "جولة", image: "/assets/events/art-gallery.webp",
    venue: "غاليري المدينة", district: "المنطقة المركزية",
    startDay: 6, startHour: 19, durationHours: 3, price: 35, capacity: 100,
    audience: "محبو الفنون والثقافة",
    highlights: ["جولة بإرشاد فني", "جلسة نقاش", "ضيافة خفيفة", "عدد محدود"],
    organizer: "غاليري المدينة", quality: 4.5, appeal: 0.7, createdDaysAgo: 12
  },
  {
    slug: "specialty-coffee-experience",
    title: "تجربة القهوة المختصة",
    summary: "جلسة تذوق تفاعلية للتعرّف على محاصيل القهوة وطرق التحضير المختلفة.",
    description:
      "تجربة لمحبي القهوة تشمل التعرف على المحاصيل ومقارنة النكهات وتجربة طرق تحضير متنوعة بإشراف مختصين.",
    category: "طعام وقهوة", eventType: "تجربة", image: "/assets/events/coffee-tasting.webp",
    venue: "مساحة كفّة للقهوة", district: "حي العريض",
    startDay: 4, startHour: 18, durationHours: 3, price: 55, capacity: 70,
    audience: "محبو القهوة والتذوق",
    highlights: ["تذوق عدة محاصيل", "شرح طرق التحضير", "ركن أدوات القهوة", "ضيافة خفيفة"],
    organizer: "كفّة للقهوة", quality: 4.6, appeal: 1.1, createdDaysAgo: 5
  },
  {
    slug: "arabic-calligraphy-workshop",
    title: "ورشة الخط العربي للمبتدئين",
    summary: "ثلاث ساعات تتعلم فيها أساسيات خط الثلث والنسخ بالقلم والحبر.",
    description:
      "ورشة عملية تبدأ بمسك القلم وقواعد الحروف ثم تطبيق على لوحة صغيرة تأخذها معك. جميع الأدوات متوفرة.",
    category: "ورش", eventType: "ورشة",
    venue: "استوديو الحرف", district: "حي الهجرة",
    startDay: 1, startHour: 17, durationHours: 3, price: 60, capacity: 25,
    audience: "الشباب والكبار",
    highlights: ["أدوات الخط متوفرة", "مدرّب معتمد", "لوحة تأخذها معك"],
    organizer: "استوديو الحرف", quality: 4.7, appeal: 1.0, createdDaysAgo: 9
  },
  {
    slug: "mobile-photography-workshop",
    title: "ورشة التصوير بالجوال",
    summary: "تعلّم الإضاءة والتكوين لتصوير أفضل بكاميرا هاتفك، مع جولة تطبيقية.",
    description:
      "ورشة تطبيقية تبدأ بشرح التكوين والإضاءة الطبيعية، ثم جولة تصوير قصيرة في أحياء المنطقة المركزية ومراجعة الصور جماعيًا.",
    category: "ورش", eventType: "ورشة",
    venue: "غاليري المدينة", district: "المنطقة المركزية",
    startDay: 8, startHour: 16.5, durationHours: 3, price: 90, capacity: 20,
    audience: "الشباب",
    highlights: ["جولة تصوير ميدانية", "مراجعة صور المشاركين", "نصائح تحرير بالجوال"],
    organizer: "غاليري المدينة", quality: 4.4, appeal: 0.9, createdDaysAgo: 3
  },
  {
    slug: "pottery-workshop-ended",
    title: "ورشة تشكيل الفخار",
    summary: "جلسة عملية على عجلة الفخار تنتهي بقطعة صغيرة تصنعها بيدك.",
    description:
      "ورشة للمبتدئين على عجلة الفخار: تجهيز الطين وتشكيل أول قطعة وتزيينها. الورشة انتهت وقد تُعاد قريبًا.",
    category: "ورش", eventType: "ورشة",
    venue: "استوديو الحرف", district: "حي الهجرة",
    startDay: -1, startHour: 16, durationHours: 3, price: 120, capacity: 18,
    audience: "الجميع",
    highlights: ["عجلة فخار لكل مشارك", "قطعة تأخذها معك", "مدرّبة متخصصة"],
    organizer: "استوديو الحرف", quality: 4.9, appeal: 1.2, createdDaysAgo: 20
  },
  {
    slug: "quba-evening-walk",
    title: "جولة قباء المسائية سيرًا",
    summary: "مشي هادئ في أحياء قباء القديمة مع مرشد يحكي تاريخ المكان.",
    description:
      "جولة مسائية مجانية على الأقدام بين معالم قباء، مناسبة للجميع، تنتهي بجلسة شاي قصيرة.",
    category: "رياضة", eventType: "جولة",
    venue: "نقطة اللقاء: ساحة قباء", district: "قباء",
    startDay: 0, startHour: 20.5, durationHours: 2, price: 0,
    audience: "الجميع",
    highlights: ["مرشد محلي", "مسار سهل", "شاي في النهاية"],
    organizer: "مسارات المدينة", quality: 4.5, appeal: 1.0, createdDaysAgo: 4
  },
  {
    slug: "madinah-5k-run",
    title: "ماراثون المدينة ٥ كم",
    summary: "سباق جري ودي بمسار آمن، مع ميداليات وقياس زمن لكل مشارك.",
    description:
      "سباق ٥ كم مناسب للمبتدئين والمتمرسين، مع تسخين جماعي ونقاط مياه وقياس زمن إلكتروني وميدالية لكل من يكمل المسار.",
    category: "رياضة", eventType: "سباق",
    venue: "حديقة الملك فهد", district: "حي العزيزية",
    startDay: 15, startHour: 5.5, durationHours: 3.5, price: 40, capacity: 400,
    audience: "الشباب والعائلات",
    highlights: ["قياس زمن إلكتروني", "ميدالية للمكملين", "نقاط مياه"],
    organizer: "مسارات المدينة", quality: 4.3, appeal: 1.0, createdDaysAgo: 2
  },
  {
    slug: "dates-market",
    title: "سوق التمور الموسمي",
    summary: "أنواع التمور المدنية من مزارع المنطقة مع تذوق مجاني وعروض مباشرة من المزارعين.",
    description:
      "سوق مفتوح يجمع مزارع المدينة وأسرها المنتجة: عجوة وصفاوي وسكري وغيرها، مع تعبئة هدايا وركن للأطفال.",
    category: "تراث", eventType: "سوق",
    venue: "ساحة المزارعين", district: "حي العوالي",
    startDay: -1, startHour: 16, durationHours: 24 * 10 + 7, price: 0,
    audience: "الجميع",
    highlights: ["تذوق مجاني", "مزارع محلية", "تغليف هدايا"],
    organizer: "لجنة الفعاليات التراثية", quality: 4.4, appeal: 1.4, createdDaysAgo: 8
  },
  {
    slug: "poetry-and-coffee-night",
    title: "أمسية الشعر والقهوة",
    summary: "قراءات شعرية فصيحة ونبطية مع قهوة عربية في مجلس مفتوح للنقاش.",
    description:
      "أمسية هادئة يقرأ فيها شعراء ومحبو الشعر من المنطقة، تتخللها فقرة مفتوحة للمشاركة وضيافة بالقهوة والتمر.",
    category: "ثقافة", eventType: "أمسية",
    venue: "مجلس غاليري المدينة", district: "المنطقة المركزية",
    startDay: 3, startHour: 20, durationHours: 2.5, price: 30, capacity: 60,
    audience: "الكبار ومحبو الأدب",
    highlights: ["قراءات حية", "مشاركة مفتوحة", "قهوة عربية وتمر"],
    organizer: "غاليري المدينة", quality: 4.5, appeal: 0.8, createdDaysAgo: 7
  },
  {
    slug: "oud-night",
    title: "ليلة العود",
    summary: "أمسية موسيقية على آلة العود بين المقامات العربية والألحان الخليجية.",
    description:
      "حفل موسيقي هادئ لعازفين من المنطقة، يشرح فيه العازف المقامات قبل كل مقطوعة. الجلوس محدود.",
    category: "فن", eventType: "حفل",
    venue: "مركز المدينة للفنون", district: "حي العريض",
    startDay: 7, startHour: 20.5, durationHours: 2.5, price: 50, capacity: 150,
    audience: "الجميع",
    highlights: ["عازفون محليون", "شرح المقامات", "جلوس مريح"],
    organizer: "مجتمع فناني المدينة", quality: 4.6, appeal: 1.1, createdDaysAgo: 10
  },
  {
    slug: "palm-tale-kids-theatre",
    title: "مسرح الأطفال: حكاية النخلة",
    summary: "مسرحية تفاعلية للأطفال عن النخلة وأهلها، بدمى وأغانٍ وأسئلة للجمهور الصغير.",
    description:
      "عرض مسرحي مدته ٦٠ دقيقة للأطفال من ٤ إلى ١٠ سنوات، يتضمن مشاركة الأطفال وهدية صغيرة عند الخروج.",
    category: "عائلي", eventType: "مسرحية",
    venue: "مسرح حديقة الملك فهد", district: "حي العزيزية",
    startDay: 2, startHour: 17, durationHours: 1.5, price: 35, capacity: 120,
    audience: "الأطفال (٤–١٠ سنوات)",
    highlights: ["عرض تفاعلي", "دمى وأغانٍ", "هدية لكل طفل"],
    organizer: "لجنة الفعاليات التراثية", quality: 4.7, appeal: 1.3, createdDaysAgo: 5
  },
  {
    slug: "open-air-family-cinema",
    title: "سينما الهواء الطلق العائلية",
    summary: "فيلم رسوم متحركة على شاشة كبيرة تحت السماء، مع فشار ومقاعد عائلية.",
    description:
      "عرض سينمائي عائلي في الحديقة، يُحضر فيه الزوار فرشهم أو يستأجرون مقاعد المكان. الفشار والمشروبات متوفرة.",
    category: "عائلي", eventType: "عرض",
    venue: "حديقة الملك فهد", district: "حي العزيزية",
    startDay: 0, startHour: 21, durationHours: 2.5, price: 20, capacity: 200,
    audience: "العائلات",
    highlights: ["شاشة كبيرة", "فشار ومشروبات", "مقاعد عائلية"],
    organizer: "لجنة الفعاليات التراثية", quality: 4.4, appeal: 1.3, createdDaysAgo: 3
  },
  {
    slug: "calligraphy-ornament-exhibition",
    title: "معرض الخط والزخرفة الإسلامية",
    summary: "لوحات خط وزخرفة معاصرة لفنانين من المنطقة، مع ركن مفتوح لتجربة الخط.",
    description:
      "معرض مجاني يضم أكثر من أربعين عملًا بين الخط الكلاسيكي والتجريب المعاصر، وجولات إرشادية في المساء.",
    category: "فن", eventType: "معرض",
    venue: "مركز المعارض الإبداعية", district: "حي الهجرة",
    startDay: -4, startHour: 16, durationHours: 24 * 16 + 6, price: 0,
    audience: "الجميع",
    highlights: ["أكثر من ٤٠ عملًا", "جولات إرشادية مسائية", "ركن تجربة الخط"],
    organizer: "مجتمع فناني المدينة", quality: 4.6, appeal: 0.9, createdDaysAgo: 15
  },
  {
    slug: "data-and-ai-forum",
    title: "ملتقى البيانات والذكاء الاصطناعي",
    summary: "يوم مفتوح عن تطبيقات البيانات والذكاء الاصطناعي في الأعمال والخدمات المحلية.",
    description:
      "جلسات قصيرة وعروض عملية من مختصين ومبتدئين، وركن للتوظيف والتعارف. مناسب للطلاب والعاملين في المجال.",
    category: "تقنية", eventType: "ملتقى",
    venue: "قاعة المؤتمرات - مركز الأعمال", district: "حي الخالدية",
    startDay: 10, startHour: 9, durationHours: 7, price: 0, capacity: 180,
    audience: "الطلاب والمهتمون بالتقنية",
    highlights: ["جلسات عملية", "ركن التعارف والتوظيف", "عروض مشاريع الطلاب"],
    organizer: "مجتمع البيانات في طيبة", featured: true, quality: 4.5, appeal: 1.1, createdDaysAgo: 4
  },
  {
    slug: "taibah-student-hackathon",
    title: "هاكاثون طيبة للطلاب",
    summary: "٢٤ ساعة لبناء فكرة مشروع تقني مع فرق ومرشدين وجوائز رمزية.",
    description:
      "يتشكل المشاركون في فرق من ٣ إلى ٥ أشخاص، ويبنون نموذجًا أوليًا خلال يوم كامل مع تقييم من لجنة في النهاية.",
    category: "تقنية", eventType: "هاكاثون",
    venue: "مركز الابتكار", district: "حي الخالدية",
    startDay: 12, startHour: 9, durationHours: 33, price: 0, capacity: 120,
    audience: "طلاب الجامعات",
    highlights: ["مرشدون من الصناعة", "جوائز للفرق", "وجبات خلال الفعالية"],
    organizer: "مجتمع البيانات في طيبة", quality: 4.4, appeal: 0.8, createdDaysAgo: 2
  },
  {
    slug: "street-food-festival",
    title: "مهرجان الأكل الشعبي",
    summary: "أكثر من ثلاثين عربة وركنًا للأكلات الحجازية والمدنية والحلويات.",
    description:
      "مهرجان طعام مفتوح يقدّم أطباقًا شعبية من أسر منتجة وعربات طعام، مع موسيقى هادئة ومنطقة جلوس عائلية.",
    category: "طعام وقهوة", eventType: "مهرجان",
    venue: "ساحة قباء", district: "قباء",
    startDay: -2, startHour: 17, durationHours: 24 * 5 + 7, price: 15,
    audience: "الجميع",
    highlights: ["+٣٠ عربة", "أسر منتجة", "منطقة جلوس عائلية"],
    organizer: "لجنة الفعاليات التراثية", quality: 4.2, appeal: 1.6, createdDaysAgo: 9
  },
  {
    slug: "dates-tasting-tour",
    title: "جولة تذوق التمور",
    summary: "جولة في مزرعة مع تذوق عشرة أنواع من التمور وطريقة اختيار الأفضل.",
    description:
      "تبدأ الجولة بمشاهدة النخيل وطريقة القطاف، ثم جلسة تذوق وشرح لدرجات الجودة والتخزين.",
    category: "طعام وقهوة", eventType: "جولة",
    venue: "مزرعة العوالي", district: "حي العوالي",
    startDay: 5, startHour: 10, durationHours: 2, price: 40, capacity: 40,
    audience: "الجميع",
    highlights: ["١٠ أنواع تمور", "مرشد مزارع", "كيس تمور هدية"],
    organizer: "كفّة للقهوة", quality: 4.5, appeal: 0.8, createdDaysAgo: 6
  },
  {
    slug: "home-gardening-workshop",
    title: "ورشة الزراعة المنزلية",
    summary: "ابدأ حديقتك الصغيرة في البلكونة: اختيار النباتات والتربة والري.",
    description:
      "ورشة عملية تغطي النباتات المناسبة لمناخ المدينة وتجهيز التربة وجدولة الري، وكل مشارك يأخذ أصيص نبات.",
    category: "ورش", eventType: "ورشة",
    venue: "استوديو الحرف", district: "حي الهجرة",
    startDay: 6, startHour: 10, durationHours: 2.5, price: 45, capacity: 30,
    audience: "الجميع",
    highlights: ["أصيص نبات لكل مشارك", "دليل ري مطبوع", "أسئلة مفتوحة"],
    organizer: "استوديو الحرف", quality: 4.3, appeal: 0.7, createdDaysAgo: 2
  },
  {
    slug: "uhud-sunset-trip",
    title: "رحلة غروب جبل أحد",
    summary: "مسار سهل عند العصر ينتهي بمشاهدة الغروب وجلسة قهوة على القمة المنخفضة.",
    description:
      "رحلة قصيرة مع مرشدين ومياه ومشروبات ساخنة، مناسبة للمبتدئين ومحبي التصوير. ارتدِ حذاءً رياضيًا.",
    category: "رياضة", eventType: "رحلة",
    venue: "مسار جبل أحد", district: "منطقة أحد",
    startDay: 4, startHour: 16, durationHours: 3.5, price: 60, capacity: 40,
    audience: "المبتدئون والشباب",
    highlights: ["مرشدون", "جلسة قهوة", "فرصة تصوير الغروب"],
    organizer: "مسارات المدينة", quality: 4.7, appeal: 1.1, createdDaysAgo: 3
  },
  // --- ended events (these carry the reviews) ---
  {
    slug: "arabic-coffee-night-ended",
    title: "ليلة القهوة العربية",
    summary: "أمسية للتعرف على أنواع القهوة العربية ومراسم تقديمها.",
    description: "جلسة تعريفية بالبن والهيل والزعفران وطريقة التقديم، مع تجربة تحضير مباشرة.",
    category: "طعام وقهوة", eventType: "أمسية",
    venue: "مساحة كفّة للقهوة", district: "حي العريض",
    startDay: -8, startHour: 19, durationHours: 3, price: 35, capacity: 60,
    audience: "الجميع",
    highlights: ["تذوق مباشر", "مراسم التقديم", "ضيافة"],
    organizer: "كفّة للقهوة", quality: 4.5, appeal: 1.0, createdDaysAgo: 25
  },
  {
    slug: "taiba-photo-exhibition-ended",
    title: "معرض صور طيبة",
    summary: "معرض مجاني لصور فوتوغرافية من أحياء المدينة وأسواقها القديمة.",
    description: "مجموعة صور لمصورين هواة ومحترفين توثّق الحياة اليومية في المدينة المنورة.",
    category: "فن", eventType: "معرض",
    venue: "مركز المعارض الإبداعية", district: "حي الهجرة",
    startDay: -14, startHour: 16, durationHours: 24 * 6 + 6, price: 0,
    audience: "الجميع",
    highlights: ["صور من الأحياء القديمة", "مصورون محليون"],
    organizer: "مجتمع فناني المدينة", quality: 4.3, appeal: 0.9, createdDaysAgo: 30
  },
  {
    slug: "watercolor-workshop-ended",
    title: "ورشة الألوان المائية",
    summary: "ثلاث ساعات لرسم منظر طبيعي بالألوان المائية خطوة بخطوة.",
    description: "ورشة للمبتدئين تشرح الخلط والتدرج وتنتهي بلوحة صغيرة لكل مشارك.",
    category: "ورش", eventType: "ورشة",
    venue: "استوديو الحرف", district: "حي الهجرة",
    startDay: -6, startHour: 16, durationHours: 3, price: 70, capacity: 20,
    audience: "الجميع",
    highlights: ["أدوات متوفرة", "لوحة تأخذها معك"],
    organizer: "استوديو الحرف", quality: 4.8, appeal: 1.0, createdDaysAgo: 22
  },
  {
    slug: "kids-science-evening-ended",
    title: "أمسية الأطفال العلمية",
    summary: "تجارب علمية بسيطة للأطفال يشاركون فيها بأنفسهم.",
    description: "عروض وتجارب آمنة عن الكهرباء والماء والألوان مع مشرفين متخصصين.",
    category: "عائلي", eventType: "ورشة",
    venue: "مركز الابتكار", district: "حي الخالدية",
    startDay: -5, startHour: 17, durationHours: 2, price: 25, capacity: 100,
    audience: "الأطفال (٦–١٢ سنة)",
    highlights: ["تجارب تفاعلية", "مشرفون متخصصون"],
    organizer: "مجتمع البيانات في طيبة", quality: 4.5, appeal: 1.0, createdDaysAgo: 18
  },
  {
    slug: "summer-heritage-days-ended",
    title: "أيام التراث الصيفية",
    summary: "أسبوع من العروض الشعبية والحرف التقليدية في الساحة التراثية.",
    description: "عروض فنون شعبية وورش حرفية وأكلات تقليدية في أجواء مسائية.",
    category: "تراث", eventType: "مهرجان",
    venue: "ساحة الفعاليات التراثية", district: "حي العزيزية",
    startDay: -12, startHour: 17, durationHours: 24 * 6 + 6, price: 20,
    audience: "العائلات",
    highlights: ["فنون شعبية", "حرف تقليدية"],
    organizer: "لجنة الفعاليات التراثية", quality: 4.1, appeal: 1.2, createdDaysAgo: 28
  }
];

// ---- Review text pools (Arabic, informal register typical of app reviews) ----
export const reviewPools = {
  positive: [
    "تنظيم ممتاز والمكان مرتب، استمتعنا من البداية للنهاية.",
    "تجربة حلوة جدًا وتستاهل الوقت، أنصح فيها.",
    "الفريق متعاون والبرنامج كان واضح، بنرجع إن شاء الله.",
    "السعر مناسب لما قدّموه، وكانت التفاصيل مثل ما انكتب.",
    "أجواء رائعة، وخصوصًا للعائلة. الأطفال انبسطوا.",
    "ما توقعت أن يكون بهذا المستوى، شكرًا للمنظمين.",
    "المدرّب ممتاز وشرح بطريقة بسيطة، طلعت بشي أعتز فيه."
  ],
  neutral: [
    "الفكرة حلوة بس كان فيه زحمة شوي عند الدخول.",
    "كانت تجربة جيدة، لكن أتمنى يزيدون مواقف السيارات.",
    "الفعالية حلوة والتنظيم مقبول، والوقت بدأ متأخر شوي."
  ],
  negative: [
    "تأخر البدء كثير والمعلومات في الإعلان ما كانت دقيقة.",
    "الزحمة كبيرة والمكان ما كفى العدد، كنت أتوقع تنظيم أفضل.",
    "السعر مرتفع مقارنة بالمحتوى."
  ]
};

// ---- Synthetic search log used to demonstrate demand-gap analysis ----
export interface SearchTopic {
  label: string;
  queries: string[];
  weight: number;
  results: number;
  category?: string;
  /** > 1 means the topic is trending up in the last two weeks */
  trend?: number;
}

export const searchTopics: SearchTopic[] = [
  { label: "ورش فخار", queries: ["فخار", "ورشة فخار", "تشكيل فخار", "ودي بورشة فخار", "سيراميك", "ورشة طين", "فخار للمبتدئين"], weight: 70, results: 0, category: "ورش", trend: 2.2 },
  { label: "يوغا ولياقة", queries: ["يوغا", "حصة يوغا", "لياقة", "رياضة صباحية للنساء", "بيلاتس"], weight: 34, results: 0, category: "رياضة", trend: 1.5 },
  { label: "ورش أطفال", queries: ["ورش للاطفال", "ورشة اطفال", "وش فيه للعيال", "نشاط للاطفال", "ورشة رسم للاطفال"], weight: 48, results: 1, category: "ورش", trend: 1.4 },
  { label: "رسم وألوان", queries: ["ألوان مائية", "ورشة رسم", "رسم", "تعلم الرسم"], weight: 30, results: 0, category: "ورش", trend: 1.3 },
  { label: "قهوة مختصة", queries: ["قهوة مختصة", "تذوق قهوة", "كوفي", "قهوه"], weight: 40, results: 1, category: "طعام وقهوة" },
  { label: "فعاليات عائلية", queries: ["فعاليات عائلية", "شي عائلي", "وين اروح مع العائلة", "عائلي الليلة", "فعاليات للعائلة"], weight: 80, results: 5, category: "عائلي" },
  { label: "مسرح أطفال", queries: ["مسرح اطفال", "مسرحية", "عرض للاطفال"], weight: 30, results: 1, category: "عائلي" },
  { label: "تصوير", queries: ["تصوير", "ورشة تصوير", "كورس تصوير", "كاميرا"], weight: 36, results: 1, category: "ورش" },
  { label: "مشي وطبيعة", queries: ["مشي", "هايكنج", "جبل احد", "طلعة", "تسلق"], weight: 42, results: 3, category: "رياضة" },
  { label: "معارض فنية", queries: ["معرض فني", "معارض", "غاليري", "لوحات"], weight: 30, results: 3, category: "فن" },
  { label: "كتب وثقافة", queries: ["كتب", "معرض الكتاب", "امسية ثقافية"], weight: 25, results: 1, category: "ثقافة" },
  { label: "ذكاء اصطناعي وتقنية", queries: ["ذكاء اصطناعي", "برمجة", "هاكاثون", "بيانات"], weight: 26, results: 2, category: "تقنية", trend: 1.6 },
  { label: "الليلة", queries: ["فعاليات الليلة", "وين اروح الليلة", "الليلة", "شي الليلة"], weight: 55, results: 4 },
  { label: "مجانية", queries: ["مجاني", "فعاليات مجانية", "ببلاش", "فري"], weight: 50, results: 8 },
  { label: "موسيقى", queries: ["حفلة", "عود", "موسيقى", "حفل موسيقي"], weight: 26, results: 1, category: "فن" }
];

export const syntheticUserNames = [
  "نورة", "سارة", "ريم", "لمى", "أمل", "هند", "عبدالله", "محمد", "فهد", "خالد",
  "سلطان", "ماجد", "جود", "رغد", "غادة", "تالا", "بدر", "ياسر", "عمر", "منى"
];
