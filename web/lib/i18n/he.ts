/**
 * Hebrew (he-IL) copy — the single source of truth for every user-facing
 * string in the product.
 *
 * Rules for editing this file:
 *  - Natural, modern, professional Israeli Hebrew. Short and direct.
 *    Not academic, not literal translation from English.
 *  - Terminology is fixed: reuse the same word for the same concept
 *    everywhere (מחיר השוואה is always מחיר השוואה, never מחיר ייחוס).
 *  - Never make guaranteed financial claims. Savings are always
 *    פוטנציאלי / משוער, never promised.
 *  - Components must never hardcode a visible string; they read it from here.
 */

export const he = {
  common: {
    appName: "בינת רכש למסעדות",
    loading: "טוען…",
    processing: "מעבד",
    completed: "הושלם",
    error: "שגיאה",
    retry: "נסה שוב",
    cancel: "ביטול",
    confirm: "אישור",
    delete: "מחיקה",
    save: "שמירה",
    back: "חזרה",
    next: "הבא",
    close: "סגירה",
    search: "חיפוש",
    filter: "סינון",
    sort: "מיון",
    all: "הכול",
    of: "מתוך",
    demoBadge: "נתוני דמו",
  },

  units: {
    kg: "ק״ג",
    g: "גרם",
    liter: "ליטר",
    ml: "מ״ל",
    unit: "יחידה",
    box: "קרטון",
    pack: "מארז",
    case: "ארגז",
  },

  confidence: {
    label: "רמת ודאות",
    high: "גבוהה",
    medium: "בינונית",
    low: "נמוכה",
  },

  home: {
    title: "כל הכסף שמסתתר בחשבוניות הספקים שלך",
    subtitle:
      "העלה את חשבוניות הספקים של המסעדה וגלה איפה עלויות הרכש שלך גבוהות ממה שהן צריכות להיות.",
    primaryCta: "בדיקת החיסכון שלי",
    secondaryCta: "איך זה עובד",
    howItWorksTitle: "איך זה עובד",
    steps: [
      {
        title: "מעלים חשבוניות",
        body: "צילום מהטלפון או קובץ PDF — כמו שקיבלת מהספק, בלי להקליד כלום.",
      },
      {
        title: "המערכת קוראת אותן",
        body: "זיהוי אוטומטי של ספקים, מוצרים, כמויות ומחירים — בלי קטלוג מוקדם ובלי מיפוי ידני.",
      },
      {
        title: "משווים מחירים",
        body: "כל מוצר מושווה להיסטוריית הרכישות שלך, אחרי נרמול יחידות ואריזות.",
      },
      {
        title: "מקבלים הזדמנויות לחיסכון",
        body: "רואים בדיוק אילו מוצרים התייקרו, בכמה, ומה ההשפעה השנתית המשוערת.",
      },
    ],
  },

  analyze: {
    title: "העלאת חשבוניות הספקים שלך",
    subtitle:
      "ננתח את המוצרים, המחירים והכמויות ונעריך הזדמנויות לחיסכון.",
    multiPeriodHint:
      "טיפ: העלה חשבוניות מכמה חודשים שונים בבת אחת — כך נוכל להשוות מחירים ולזהות התייקרויות כבר בניתוח הראשון.",
    dropzoneTitle: "גרור לכאן חשבוניות או לחץ לבחירה",
    dropzoneHint: "PDF, JPG או PNG · עד 10MB לקובץ · עד 10 קבצים",
    dropzoneMobile: "צלם חשבונית או בחר קובץ",
    filesReady: "מוכן לניתוח",
    startAnalysis: "נתח את החשבוניות שלי",
    emptyTitle: "עדיין לא נבחרו קבצים",
    emptyBody: "התחל בהעלאת חשבונית אחת לפחות.",
    removeFile: "הסרת הקובץ",
    uploading: "מעלה…",
    uploadFailed: "ההעלאה נכשלה",
  },

  validation: {
    tooLarge: "הקובץ גדול מדי. הגודל המרבי הוא 10MB.",
    wrongType: "סוג קובץ לא נתמך. אפשר להעלות PDF, JPG או PNG בלבד.",
    executable: "קבצי הרצה אינם מותרים.",
    tooMany: "אפשר להעלות עד 10 קבצים בניתוח אחד.",
    empty: "הקובץ ריק או פגום.",
    noFiles: "יש לבחור לפחות קובץ אחד.",
  },

  analysis: {
    title: "מנתח את החשבוניות שלך",
    subtitle: "זה ייקח בדרך כלל פחות מדקה. אפשר להשאיר את החלון פתוח.",
    steps: {
      uploading: "מעלה מסמכים",
      reading: "קורא את החשבוניות",
      identifying: "מזהה מוצרים",
      extracting: "מחלץ מחירים",
      normalizing: "מנרמל יחידות מידה",
      calculating: "מחשב הזדמנויות לחיסכון",
    },
    status: {
      pending: "ממתין",
      processing: "מעבד",
      complete: "הושלם",
      error: "שגיאה",
    },
    failedTitle: "הניתוח נכשל",
    failedBody: "לא הצלחנו להשלים את הניתוח. אפשר לנסות שוב או להעלות מסמכים ברורים יותר.",
    viewResults: "צפייה בתוצאות",
  },

  results: {
    title: "ניתוח הרכש שלך",
    heroLabel: "חיסכון שנתי פוטנציאלי",
    heroCaption: "הערכה על בסיס החשבוניות שנותחו.",
    summary: {
      invoices: "חשבוניות שנותחו",
      products: "מוצרים שנותחו",
      suppliers: "ספקים שזוהו",
      opportunities: "הזדמנויות לחיסכון",
      confidence: "רמת ודאות",
    },
    tableTitle: "הזדמנויות לחיסכון",
    columns: {
      product: "מוצר",
      supplier: "ספק",
      currentPrice: "מחיר נוכחי",
      referencePrice: "מחיר השוואה",
      difference: "הפרש מחיר",
      opportunity: "הזדמנות משוערת",
      confidence: "רמת ודאות",
    },
    chartTitle: "הזדמנויות החיסכון הגדולות ביותר",
    noOpportunitiesTitle: "לא נמצאו התייקרויות",
    noOpportunitiesBody:
      "רשמנו את מחירי הבסיס שלך. העלה חשבוניות מתקופה אחרת כדי לזהות שינויי מחירים.",
    insufficientBenchmark: "אין מספיק נתוני השוואה",
    priceTrend: "מגמת מחיר",
    saveAnalysis: "שמירת הניתוח",
    saveAnalysisBody: "צור חשבון חינם כדי לשמור את הניתוח ולעקוב אחרי המחירים לאורך זמן.",
    createAccount: "יצירת חשבון חינם",
  },

  productDetail: {
    title: "פרטי מוצר",
    supplier: "ספק",
    currentPrice: "מחיר נוכחי",
    previousPrice: "מחיר קודם",
    referencePrice: "מחיר השוואה",
    priceChange: "שינוי מחיר",
    observedQuantity: "כמות שנצפתה",
    annualImpact: "השפעה שנתית משוערת",
    confidence: "רמת ודאות",
    normalizedUnit: "יחידת השוואה",
    noHistory: "אין עדיין היסטוריית מחירים למוצר הזה.",
  },

  trust: {
    title: "איך חישבנו את זה?",
    intro: "החישוב מבוסס אך ורק על הנתונים שבחשבוניות שהעלית:",
    points: [
      "נתוני החשבוניות שחולצו מהמסמכים שהעלית.",
      "כמויות ומחירים מנורמלים ליחידת מידה אחידה, כדי שהשוואה בין אריזות שונות תהיה נכונה.",
      "היסטוריית הרכישות שלך אצל אותו ספק עבור אותו מוצר.",
      "נתוני השוואה חיצוניים — רק כאשר קיימים במערכת נתונים אמינים.",
    ],
    disclaimer:
      "אלו הזדמנויות פוטנציאליות, לא חיסכון מובטח. עליית מחיר אינה בהכרח טעות של הספק — היא יכולה לנבוע משינויי שוק, עונתיות או מפרט שונה.",
    methodHistorical: "השוואה להיסטוריית הרכישות שלך",
    methodBenchmark: "השוואה לנתוני השוואה במערכת",
    methodLabel: "שיטת חישוב",
  },

  auth: {
    loginTitle: "כניסה לחשבון",
    signupTitle: "יצירת חשבון",
    email: "אימייל",
    password: "סיסמה",
    emailPlaceholder: "you@restaurant.co.il",
    passwordHint: "לפחות 8 תווים",
    businessName: "שם העסק",
    businessNamePlaceholder: "לדוגמה: פלאפל הכיכר",
    login: "כניסה",
    signup: "הרשמה",
    logout: "התנתקות",
    googleLogin: "המשך עם Google",
    noAccount: "אין לך חשבון עדיין?",
    hasAccount: "כבר יש לך חשבון?",
    goToSignup: "להרשמה",
    goToLogin: "לכניסה",
    errors: {
      invalidCredentials: "האימייל או הסיסמה שגויים.",
      emailTaken: "כתובת האימייל הזו כבר רשומה במערכת.",
      weakPassword: "הסיסמה קצרה מדי. נדרשים לפחות 8 תווים.",
      generic: "ההתחברות נכשלה. נסה שוב.",
    },
  },

  dashboard: {
    greeting: "טוב לראות אותך",
    nav: {
      overview: "סקירה כללית",
      invoices: "חשבוניות",
      products: "מוצרים",
      savings: "חיסכון",
      settings: "הגדרות",
    },
    potentialSavings: "חיסכון פוטנציאלי",
    basedOnInvoices: "על בסיס החשבוניות שנותחו",
    cards: {
      invoices: "חשבוניות שנותחו",
      products: "מוצרים שנותחו",
      suppliers: "ספקים שנותחו",
      opportunities: "הזדמנויות לחיסכון",
    },
    topOpportunities: "הזדמנויות החיסכון הגדולות ביותר",
    priceTrends: "מגמות מחירים",
    recentInvoices: "חשבוניות אחרונות",
    uploadCta: "העלאת חשבוניות",
    viewAll: "הצג הכול",
    emptyTitle: "כאן מתחילה בינת הרכש שלך",
    emptyBody: "העלה את החשבונית הראשונה שלך כדי להתחיל לעקוב אחרי מחירי הספקים.",
    emptyCta: "העלאת החשבונית הראשונה",
  },

  invoices: {
    title: "חשבוניות",
    columns: {
      date: "תאריך חשבונית",
      supplier: "ספק",
      number: "מספר חשבונית",
      amount: "סה״כ",
      products: "מוצרים",
      status: "סטטוס",
    },
    status: {
      processed: "נותחה",
      needsReview: "דורשת בדיקה",
      failed: "נכשלה",
    },
    searchPlaceholder: "חיפוש לפי ספק או מספר חשבונית",
    dateFilter: "טווח תאריכים",
    supplierFilter: "ספק",
    emptyTitle: "אין עדיין חשבוניות",
    emptyBody: "העלה חשבוניות כדי לראות אותן כאן.",
    deleteTitle: "מחיקת חשבונית",
    deleteBody:
      "החשבונית והקובץ המקורי יימחקו לצמיתות. הפעולה משפיעה על היסטוריית המחירים ולא ניתנת לביטול.",
    deleteConfirm: "מחק חשבונית",
    deleted: "החשבונית נמחקה",
    itemsTitle: "שורות בחשבונית",
    itemColumns: {
      product: "מוצר",
      quantity: "כמות",
      unitPrice: "מחיר ליחידה",
      total: "סה״כ",
      confidence: "רמת ודאות",
    },
    totalLabel: "סה״כ חשבונית",
  },

  products: {
    title: "מוצרים",
    columns: {
      product: "מוצר",
      category: "קטגוריה",
      supplier: "ספק",
      currentPrice: "מחיר נוכחי",
      previousPrice: "מחיר קודם",
      priceChange: "שינוי מחיר",
      opportunity: "הזדמנות",
    },
    emptyTitle: "אין עדיין מוצרים",
    emptyBody: "מוצרים יזוהו אוטומטית מהחשבוניות שתעלה.",
    uncategorized: "ללא קטגוריה",
  },

  savings: {
    title: "חיסכון",
    total: "סך החיסכון הפוטנציאלי",
    byCategory: "חיסכון לפי קטגוריה",
    bySupplier: "חיסכון לפי ספק",
    history: "הזדמנויות קודמות",
    emptyTitle: "אין עדיין הזדמנויות לחיסכון",
    emptyBody:
      "אחרי שתעלה חשבוניות מכמה תקופות, נוכל להשוות מחירים ולהצביע על התייקרויות.",
  },

  settings: {
    title: "הגדרות",
    business: "פרטי העסק",
    businessName: "שם העסק",
    ownerName: "שם בעל העסק",
    email: "אימייל",
    currency: "מטבע",
    country: "מדינה",
    language: "שפה",
    saved: "ההגדרות נשמרו",
    saveFailed: "שמירת ההגדרות נכשלה",
  },

  errors: {
    generic: "משהו השתבש. נסה שוב.",
    network: "אין חיבור לרשת. בדוק את החיבור ונסה שוב.",
    unreadableInvoice:
      "לא הצלחנו לקרוא את החשבונית באופן אמין. נסה לצלם בתאורה טובה יותר או להעלות PDF.",
    extractionFailed: "חילוץ הנתונים מהחשבונית נכשל.",
    benchmarkUnavailable: "אין מספיק נתוני השוואה עבור המוצר הזה.",
    uploadFailed: "העלאת הקובץ נכשלה. נסה שוב.",
    unauthorized: "אין לך הרשאה לצפות בתוכן הזה.",
    notFound: "לא מצאנו את מה שחיפשת.",
  },
} as const;

export type Dictionary = typeof he;
