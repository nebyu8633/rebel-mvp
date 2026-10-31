# Braze, Inc. (NASDAQ: BRZE) – סוכן 1: ניתוח עסקי ותחרותי

תאריך הניתוח: 2026-10-31 | שנת הכספים של Braze מסתיימת ב-31 בינואר (FY2027 = פברואר 2026 עד ינואר 2027).
**מגבלת מתודולוגיה:** הסביבה חסמה גישה ישירה ל-sec.gov, businesswire, braze.com ו-investors.braze.com (WebFetch נכשל עם ENOTFOUND). כל הנתונים נאספו דרך תקצירי חיפוש (WebSearch) שמצטטים הודעות לעיתונות, דוחות 8-K/10-K ותמלילי שיחות. לכן גם נתון "שדווח על ידי החברה" כאן הוא **ראיה משנית** (תקציר חיפוש של מקור ראשוני) ויש לאמת אותו מול המסמך המקורי לפני שימוש סופי. Finviz לא שימש כמקור.

---

## מסקנה ראשונית

Braze היא פלטפורמת customer engagement ארגונית, real-time ו-cross-channel (push, in-app, email, SMS, WhatsApp, web), שמשרתת בעיקר מותגי B2C דיגיטליים/מובייל. ב-Q2 FY2027 (הרבעון שהסתיים ב-31.7.2026) היו לה 2,789 לקוחות ו-361 לקוחות עם ARR של $500K ומעלה, שאחראים ל-65% מה-ARR. ההכנסות צמחו ב-26.2% ל-$227.2M, ו-91% מהן ממנויים. ה-DBNR (dollar-based net retention) נשחק מ-114% (7/2024) לשפל של 108% (7–10/2025), ומאז התאושש בהדרגה ל-110% (112% אצל הלקוחות הגדולים). הצמיחה האורגנית הואצה במשך ארבעה רבעונים ברציפות, לפי החברה. מכאן שהחפיר (moat) **יציב עם סימני התחזקות מתונים** מאז אמצע 2025, אבל לא במגמת התחזקות מובהקת. ה-DBNR עדיין רחוק מרמות העבר (מעל 115%). הטענה ש-AI הוא רוח גבית (OfferFit/Decisioning Studio, BrazeAI Agents) נתמכת בנתוני אימוץ: בערך שליש מהלקוחות הגדולים משלמים על מוצרי AI. עם זאת, המונטיזציה עדיין קטנה (Decisioning Studio תרם $5.7M ברבעון Q1 FY27). הסיכון המרכזי לטווח ארוך הוא AI agentic/LLM שמוריד את ערך שכבת ה-orchestration, וקונסולידציה של תקציבים לטובת Salesforce/Adobe. הסיכון הזה **לא הוכח בנתונים עד כה**, אבל הוא מכביד על המכפיל.

---

## ממצאים לפי שאלה

### 1. מה Braze מוכרת ולמי
- **הפלטפורמה:** הפלטפורמה קולטת ומעבדת נתוני לקוח בזמן אמת ומתזמרת קמפיינים במספר ערוצים (לפי תיאור ה-10-K FY2026; משני). הרכיבים המרכזיים:
  - **Canvas:** כלי ה-journey orchestration הוויזואלי.
  - **Currents:** ייצוא נתוני אירועים בזמן אמת ל-data warehouse. בחיפוש לא נמצאו עדכונים חדשים על Currents.
  - **Catalogs.**
  - **Zero-copy Canvas Triggers:** הפעלת journeys ישירות מנתוני ה-warehouse.
  - **Creative Studio.**
  - **ערוצים:** WhatsApp Commerce, email, SMS, push ו-in-app.
- **BrazeAI** (בעבר Sage AI by Braze; Project Catalyst הוכרז ב-9/2024):
  - **BrazeAI Operator:** בונה צעדי Canvas מתוך פרומפטים.
  - **BrazeAI Agent Console:** סוכנים בתוך Canvas/Catalogs, עם אינטגרציה ל-Amazon Bedrock.
  - **Predictive Suite.**
  - **BrazeAI Decisioning Studio** (לשעבר OfferFit): decisioning מבוסס reinforcement learning.
  - **הכרזות Forge 2026** (28–30.9.2026): Decisioning Studio Go (גרסת self-service), Agentic Standards (QA אוטומטי לקמפיינים), Operator Connect (חיבור סוכנים חיצוניים ל-Braze באופן פרוגרמטי) ו-Conversational Agents. *(המקור הוא DestinationCRM, כלומר משני. היכולות הן הכרזות מוצר ולא ביצועים מוכחים.)*
- **רכישת OfferFit:**
  - הוכרזה ב-27.3.2025 בתמורה ל-$325M במזומן ובמניות Class A, והושלמה בתחילת יוני 2025 (מקור ראשוני: הודעת Braze; המועד מתמליל שיחה).
  - לפי אגרגטור (לא מאומת), המחיר הסופי היה $303.2M.
- **לקוחות:**
  - מותגי B2C במגוון ורטיקלים: retail/e-commerce, media & entertainment, gaming, financial services, healthcare, travel & hospitality (משני).
  - בערך 45% מההכנסות מגיעות מחוץ לארה"ב ב-FY2026, אותו שיעור כמו ב-FY2025, לעומת 43% ב-FY2024 (10-K, דרך תקציר).
  - המיקוד הוא ב-enterprise וב-mid-market עליון. לפי אתרי מתחרים (לא מאומת), המחיר מתחיל בדרך כלל בכ-$50K לשנה.

### 2. מודל ההכנסות
- **[עובדה מדווחת]** דמי המנוי מבוססים בעיקר על התחייבות מראש (upfront commitment) לארבעה רכיבים: נפח הודעות, מספר monthly active users, גישה לפלטפורמה/תמיכה ומוצרי add-on (10-K FY2026).
- **[עובדה מדווחת]** חוזים נמשכים בדרך כלל שנה אחת ולעיתים עד 5 שנים. החיוב מראש מתבצע לרוב שנתית, ולפעמים רבעונית או חצי-שנתית. חלק מהחוזים הרב-שנתיים כוללים מחיר עולה (escalating).
- **[עובדה מדווחת]** ההכרה בהכנסה היא ratable לאורך החוזה, כ-stand-ready obligation. חיובי overage נרשמים כהכנסת מנוי בתקופה שבה נוצרו. ה-variable consideration לא היה מהותי בשנים FY2023 עד FY2025.
- **[עובדה מדווחת]** מנויים היו 91% מההכנסות ב-Q2 FY27. היתרה היא professional services, שמוכרים על פני עד כשישה חודשים.
- **משמעות:** המודל הוא היברידי, מנוי עם רכיב נפח. הצמיחה תלויה בהרחבת הקהל והנפח אצל הלקוחות. הודעות פרימיום (SMS/WhatsApp) לוחצות על הרווח הגולמי: ה-non-GAAP gross margin ירד ל-68.6% מ-69.3% ב-Q2 FY27, לפי ה-CFO בגלל נפחי premium messaging ועובדי Decisioning Studio (מקור משני בגרמנית).

### 3. מנועי צמיחה
1. **הרחבת לקוחות גדולים:** מספר הלקוחות מעל $500K עלה ב-28% בשנה ל-361, וחלקם ב-ARR עלה ל-65% מ-62% שנה קודם [מדווח].
2. **לוגואים חדשים:** נטו 367 לקוחות חדשים בשנה ו-76 ברבעון האחרון [מדווח].
3. **Cross-sell של AI:** Decisioning Studio נמכר במחיר של כ-$250K–$300K ל-use case (לפי ההנהלה). מוצרי AI בתשלום הגיעו לכשליש מקבוצת הלקוחות הגדולים, עלייה של כ-900bp מ-Q1 [טענת הנהלה בשיחה, משני]. ב-Q1 FY27 תרם Decisioning Studio $5.7M להכנסות.
4. **ערוצי פרימיום** (SMS ו-WhatsApp) **והתרחבות בינלאומית** (אירופה ו-APAC).
5. **ראיות לתאוצה:** RPO עמד על כ-$1.09–1.1B ב-Q2 FY27, צמיחה של כ-27% בשנה, ו-cRPO עמד על כ-$691M, צמיחה של כ-24% (משני, Nasdaq). ARR עבר את ה-$800M בתחילת FY2027 [מדווח, משני]. תחזית FY2027 עומדת על $910–913M, כלומר צמיחה של כ-23% [מדווח].
- **הערת זהירות:** חלק מהצמיחה ב-FY26 וב-FY27 מגיע מרכישה. ב-Q1 FY27 הצמיחה המדווחת הייתה 30% והאורגנית 27%. לא נמצא נתון אורגני ל-Q2 FY27, והרכישה "הוקפה" (lapped) ביוני 2026.

### 4. הצעת ערך ללקוח
- **[טענה שיווקית/תפקודית]** הצעת הערך:
  - הפעלת נתונים בזמן אמת (streaming) במקום batch.
  - תזמור אחיד של כל הערוצים.
  - ניסויים ו-personalization ב-1:1 באמצעות RL (Decisioning Studio).
  - ממשק ידידותי למשווק ויכולת scale ברמה ארגונית.
- **[ראיה חיצונית חלקית]** Gartner דירגה את Braze כ-Leader ב-Magic Quadrant for Multichannel Marketing Hubs בשלוש שנים רצופות עד 2025 (2025 נבדקו 11 ספקים). לפי Braze, היא נבחרה ל-Leader גם בשנה הרביעית ב-2026 ודורגה ראשונה בשני use cases ב-Critical Capabilities 2026. *(הדירוג של 2026 מבוסס על דיווח עצמי של Braze ולא אומת מול Gartner.)*
- **[לא מוכח]** טענות ROI ללקוחות (uplift בהמרה וכו') מופיעות בחומרי שיווק. לא נמצאו מחקרים עצמאיים.

### 5. עלויות מעבר (Switching costs)
- **מקורות עלויות המעבר:**
  - אינטגרציית SDK בתוך אפליקציות המובייל וה-web של הלקוח.
  - חיבורי data pipelines (Currents ו-zero-copy מול ה-warehouse).
  - מאות או אלפי Canvases, templates ו-segments שנבנו לאורך זמן.
  - הכשרת צוותי CRM והתאמה לתהליכי עבודה, ציות ו-deliverability (IP warming וכו').
  - חוזים שנתיים או רב-שנתיים עם התחייבות מראש.
- **[מדווח]** עלויות המעבר **אינן מונעות שחיקה בהיקף:**
  - ה-10-K מייחס את ירידת ה-DBNR בעיקר ל-customer turnover ולחידושים ברמות מנוי נמוכות יותר.
  - לקוחות מעדיפים לבצע downsell של נפחים ולא לעזוב לגמרי.
  - Braze לא מפרסמת gross retention.
- **הערכה (לא מוכחת):** עלויות המעבר בינוניות-גבוהות אצל enterprise, ונמוכות יותר אצל לקוחות קטנים, שם Klaviyo, MoEngage ו-CleverTap זולים יותר. קיים סיכון שכלים מבוססי warehouse-native או composable CDP יורידו את עלות המעבר, כי ה-data כבר לא "נעול" בתוך Braze.

### 6. ריכוזיות לקוחות
- **[מדווח]** 361 לקוחות מעל $500K אחראים ל-65% מה-ARR (Q2 FY27), לעומת 62% שנה קודם. **התלות בלקוחות גדולים עולה.** זו תוצאה של אסטרטגיה ולא בהכרח חולשה, אבל זה מגביר את רגישות התוצאות לחידושים של לקוחות גדולים.
  - **[מחושב]** הממוצע לכל לקוח גדול נגזר מ-65% מ-ARR של כ-$800M+ חלקי 361, ויוצא כ-$1.4M ומעלה. החישוב מקורב, כי ה-ARR המדויק ל-Q2 לא נמצא.
- **ריכוזיות ברמת לקוח בודד:** לא נמצא גילוי של לקוח מעל 10% מההכנסות. לא נמצאה עדות לריכוזיות כזו.
- **מגמה, 9 רבעונים (מדווח, דרך תקצירים משניים):**

| רבעון (סוף) | סה"כ לקוחות | לקוחות מעל $500K ARR | DBNR (TTM), כל הלקוחות | DBNR (TTM), לקוחות מעל $500K |
|---|---|---|---|---|
| Q2 FY25 (31.7.2024) | 2,163 | 222 | 114% | 117% |
| Q3 FY25 (31.10.2024) | 2,211 | 234 | 113% | לא נמצא |
| Q4 FY25 (31.1.2025) | 2,296 | 247 | 111% | לא נמצא |
| Q1 FY26 (30.4.2025) | 2,342 | 262 | 109% | 112% (לא מאומת) |
| Q2 FY26 (31.7.2025) | 2,422 | 282 | 108% | 111% |
| Q3 FY26 (31.10.2025) | 2,528 | 303 | 108% | כ-110% (לפי "in line" ב-Q4) |
| Q4 FY26 (31.1.2026) | 2,609 | 333 | 109% | 110% |
| Q1 FY27 (30.4.2026) | 2,713 | 349 | 110% | 111% |
| Q2 FY27 (31.7.2026) | 2,789 | 361 | 110% | 112% |

- **[טענת הנהלה]** ה-in-quarter NRR התייצב: היה מעט מתחת ל-107% ב-Q1 FY26, מעט מעל 107% ב-Q2 FY26, ומעל 107% ב-Q3 FY26.
- **[מחושב]** על פני 8 רבעונים (7/2024 עד 7/2026), הצמיחה הייתה כזו:

| מדד | ערך 7/2024 | ערך 7/2026 | שינוי |
|---|---|---|---|
| לקוחות מעל $500K | 222 | 361 | +62.6% |
| סה"כ לקוחות | 2,163 | 2,789 | +28.9% |
| DBNR, כל הלקוחות | 114% | 110% | 4 נקודות פחות, אבל 2 נקודות מעל השפל |

- תוצאות Q3 FY27 (31.10.2026) צפויות להתפרסם בסביבות דצמבר 2026. הן טרם פורסמו נכון להיום.

### 7. TAM
- **Braze (ישן):** בתשקיף ה-IPO (2021) צוטטה הערכה של IDC לשוק של כ-$15B. בשנת 2022, אנליסט של JMP העריך כ-$16B בארה"ב בלבד. שני הנתונים משניים.
- **TAM עדכני מצד החברה:** לא נמצא. בתקצירי ה-10-K FY2026 לא הופיע מספר TAM.
- **הערכות עצמאיות:** הן משתנות מאוד בגלל הבדלי הגדרה, ורובן מחברות מחקר שוק באיכות נמוכה-בינונית:

| מקור | הערכה |
|---|---|
| Technavio | גידול של $17.7B בשנים 2025–2030, CAGR של 11.9% |
| Report Prime | $36.3B ב-2025 |
| The Business Research Company | $23.5B ב-2025, CAGR של 13.2% עד 2030 |
| Research Nester | $25.9B ב-2025 |
| MarketsandMarkets (marketing automation) | $47B ב-2025, עד $81B ב-2030 |

- **[מחושב]** הכנסות FY2026 של $738M הן כ-2–3% משוק של כ-$25–36B. נתח השוק נמוך, ולכן ה-TAM אינו המגבלה. המגבלה היא התחרות.

### 8. חוזקות וחולשות מול מתחרים

| מתחרה | יתרון Braze | חולשת Braze |
|---|---|---|
| Salesforce Marketing Cloud / Adobe (Journey Optimizer) | real-time ו-mobile-native, ממשק מהיר וזמן הטמעה קצר יותר, חדשנות AI מהירה (דעת אנליסטים bullish, משני) | חבילות suite ו-bundling, קשרי CIO, CDP ונתוני CRM מובנים. סיכון של קונסולידציית תקציבים לטובת "אקוסיסטם" (bear case, משני) |
| Twilio/Segment | Braze היא שכבת orchestration ומשווק. Segment הוא בעיקר CDP ושותף/ספק נתונים | Twilio שולטת בתשתית SMS ויכולה לטפס במעלה ה-stack. עלויות SMS לוחצות על המרווח של Braze |
| Iterable | סקייל גדול יותר (Braze ציבורית, כ-$900M הכנסות), Decisioning Studio | מתחרה ישיר עם מחיר אגרסיבי. Gartner Leader גם הוא (לא אומת) |
| Klaviyo | enterprise ו-cross-channel/mobile, לפי ניתוח משני ש-Braze "דוחקת" את Klaviyo ב-RFPs app-centric | Klaviyo (כ-160K לקוחות, משני) שולטת ב-e-commerce/Shopify ומטפסת למעלה. הכנסה מחושבת לכל לקוח גבוהה מאוד אצל Braze, ולכן הרגישות למחיר בשוק ה-mid-market גבוהה |
| MoEngage, CleverTap, Insider, Bloomreach, Airship, Optimove | מותג, סקייל, מוצר AI decisioning מוביל (OfferFit) | מחיר נמוך יותר וחוזק בשווקים מתעוררים (הודו, MENA, APAC). Bloomreach חזקה ב-commerce/search. CleverTap רכשה את Leanplum (קונסולידציה) |

- **[מדווח]** ה-10-K מזכיר לחצי מחיר תחרותיים שעלולים לפגוע בחידושים ובמרווחים, ומזכיר את רכישת Leanplum על ידי CleverTap.
- **[לא נמצא]** השוואות head-to-head כמותיות (win rates) לא נמצאו.

### 9. השפעת AI: רוח גבית או איום
- **רוח גבית (ראיות):**
  - אימוץ בתשלום של כ-1/3 מהלקוחות הגדולים, עלייה של כ-900bp ברבעון (הנהלה).
  - Decisioning Studio שומר על מחיר של $250K–$300K ל-use case.
  - היו מגבלות היצע: הזמנות הוגבלו באזורים מסוימים ומועדי התחלה נדחו בכמה חודשים (הנהלה, משני). זה סימן לביקוש, אבל גם לצוואר בקבוק של שירותים, כי מדובר במוצר שעתיר כוח אדם ולוחץ על ה-gross margin.
  - Operator Connect ממצב את Braze כ-"system of action" שסוכנים חיצוניים מפעילים אותו.
- **איום (השערות שלא הוכחו):**
  - סוכני LLM של Salesforce (Agentforce), Adobe, OpenAI ו-Google עלולים לבצע את התזמור בעצמם ולהפוך את Braze ל-pipe זול.
  - ספקי מודלים ו-AI-native startups עלולים לשחוק את כוח התמחור.
  - Stifel ו-Piper Sandler ציינו בפברואר 2026 ש"התקדמות של מתחרים AI-native וספקי מודלים מגבירה חששות לעמידות הצמיחה", אף ששמרו על המלצה חיובית (משני).
  - המניה נפגעה בסל-אוף SaaS שנבע מחשש AI (משני).
- **איזון:**
  - **נגד תזת האיום:** מודל התמחור מבוסס MAU ונפח הודעות, לא seats, ולכן חשוף פחות לירידה במספר משתמשים אנושיים. אם AI מגדיל את נפח ההודעות, זה עשוי אף לעזור. *(ניתוח, לא עובדה.)*
  - **בעד תזת האיום:** אם AI מייצר יותר הודעות, עלויות ה-SMS וה-compute עולות, ו-downsell ייתכן אם השוק עובר ל-warehouse-native.
  - **המסקנה הנוכחית:** בטווח הקצר AI הוא tailwind מתון ומדיד. בטווח הארוך הוא סיכון מבני פתוח.

### 10. החפיר: מתחזק, יציב או נשחק?
**הערכה: יציב, עם התחזקות מתונה מאז אמצע 2025. לא ניתן לקבוע התחזקות מובהקת.**
- **בעד התחזקות (מדווח):**
  - DBNR עלה ברבעונים רצופים מ-108% ל-110%, ובלקוחות הגדולים מ-110% ל-112%.
  - לקוחות מעל $500K צמחו ב-28% בשנה, וחלקם ב-ARR עלה.
  - ארבעה רבעונים של האצה אורגנית (לפי הכותרת של Q1 FY27).
  - RPO צמח בכ-27% ומעל צמיחת ההכנסות.
  - Gartner Leader ארבע שנים, לפי Braze.
- **בעד שחיקה (מדווח או משני):**
  - DBNR עדיין נמוך בכ-4 נקודות מ-7/2024 ונמוך מאוד מרמות של מעל 120% בעבר (לא אומת בחיפוש זה).
  - ה-10-K מייחס את הירידה ל-churn ול-downsell.
  - ה-gross margin נשחק (68.6% לעומת 69.3%).
  - cRPO צומח (כ-24%) לאט מעט מה-RPO הכולל, ומשקיעים הגיבו לכך בירידה במניה.
  - מתחרים זולים מתרבים, וקיים איום AI.

### 11. עדכון: הסכם הרכישה על ידי Salesforce (הוכרז ב-2026-10-20)
- **[מדווח, ראשוני לפי המתאם, ואושר בחיפוש]** Salesforce הסכימה לרכוש את Braze תמורת $47.50 במזומן למניית Class A, כלומר EV של כ-$5.66B. ההסגרה צפויה ב-FY2028 של Salesforce (שמתחילה בפברואר 2027) וכפופה לאישור בעלי המניות ולאישורים רגולטוריים. גובה דמי הביטול: $300M ש-Salesforce תשלם (כולל מקרה של חסימה רגולטורית), ו-$191.4M ש-Braze תשלם. התוכנית היא לשלב את Braze ב-Marketing Cloud, ב-Data 360, ב-Customer 360 וב-Agentforce. *(מקור: 8-K Ex. 99.2. לא נקרא ישירות בגלל חסימת sec.gov, אבל הוא מופיע בתוצאות חיפוש ומאומת על ידי המתאם.)*
- **[מחושב/משני]** הפרמיה היא כ-58% על מחיר הסגירה ב-19.10.2026 ($30.04). המחיר נמוך ממחיר ה-IPO מ-2021 (dealroom, משני). מכפיל ה-EV/NTM sales הגלום הוא כ-5.7x (לפי Piper Sandler, משני).

**מה העסקה אומרת על המעמד התחרותי? שני הפירושים נכונים במידה מסוימת.**
- **אישור החפיר (validation):**
  - Salesforce היא ספקית ה-suite הגדולה בתחום, והיא בחרה לקנות את Braze במקום לבנות בעצמה. זה מרמז ש-Marketing Cloud (ExactTarget, מבוסס batch ו-email) לא הצליחה להשתוות ליכולות ה-real-time וה-mobile-native של Braze, ושהשכבה הזו קשה לשכפול.
  - BTIG (משני) ציינה שהעסקה "מסירה מתחרה צומח" עבור Salesforce. כלומר, Braze זכתה בעסקאות על חשבון SFMC.
  - פרמיה של 58% מעידה על ערך אסטרטגי גבוה מבחינת הקונה.
- **לחץ קונסולידציה (ראיה נגדית):**
  - המחיר מתחת ל-IPO ומכפיל של כ-5.7x NTM sales מגלמים ציפייה מתונה לעתיד העצמאי של Braze.
  - שוק ההון תמחר את Braze ב-$30 לפני ההכרזה, על רקע חשש מ-AI ומקונסולידציית תקציבים לטובת אקוסיסטמים. זה ה-bear case שתואר בסעיף 9.
  - המכירה עצמה תואמת את התזה שספקי point-solution, גם המובילים שבהם, מתקשים לעמוד לבד מול suites שמוסיפות שכבת AI agentic.
  - **הערכה:** העסקה מאשרת את איכות המוצר ואת החפיר הטכנולוגי, וחושפת שבעלי המניות והדירקטוריון העדיפו ודאות על פני הסיכון שבמסלול עצמאי. זו **הכרה בחפיר ברמת המוצר, יחד עם חולשה ברמת המבנה העצמאי**.
- **השלכה על ניתוח החפיר:** אם העסקה תיסגר, השאלה "האם החפיר מתחזק" עוברת מבעלי המניות של Braze ל-Salesforce. לבעלי מניות BRZE התשואה נקבעת בעיקר לפי $47.50 וסיכון ההסגרה (merger arbitrage), ולא לפי היסודות העסקיים.

**חפיפה עם Salesforce Marketing Cloud ושאלת ההגבלים העסקיים:**
- **חפיפה ישירה:**
  - שתי החברות מוכרות multichannel marketing / customer engagement ללקוחות B2C ארגוניים: orchestration של journeys, email, SMS, push, personalization ו-AI decisioning.
  - שתיהן מדורגות כ-Leaders ב-Gartner MQ for Multichannel Marketing Hubs. רשימת הספקים ב-2025 כללה את Salesforce ואת Braze, וגם את Adobe, SAP, Iterable, MoEngage, Bloomreach, Insider, Airship, Cordial ו-Optimove.
  - Braze עצמה ציינה את Salesforce כמתחרה ב-10-K.
- **טיעונים שמקלים על אישור:**
  - השוק מפוצל, עם 11 ספקים ב-MQ ועשרות נוספים: Klaviyo, CleverTap, ו-Twilio/Segment הסמוכה.
  - נתח השוק של Braze נמוך: כ-$0.9B מתוך שוק מוערך של כ-$25–36B, כלומר כ-2–4% (מחושב).
  - Adobe, SAP ו-Oracle הם מתחרים חזקים שנשארים בשוק.
- **טיעונים שמחמירים:**
  - זו חפיפה אופקית בין שני Leaders. Braze "מתחרה צומח" (BTIG), והחשש הוא לחיסול מתחרה מתעורר בפלח ה-enterprise B2C ה-real-time.
  - Salesforce מחזיקה בנתח גבוה ב-CRM, ומכאן חשש ל-bundling.
  - הרגולטורים (FTC/DOJ בארה"ב והנציבות האירופית) הגבירו בשנים האחרונות בדיקה של רכישות טכנולוגיה. כ-45% מהכנסות Braze מגיעות מחוץ לארה"ב, ולכן עשויים להידרש אישורים במספר תחומי שיפוט.
- **[עובדה]** Davis Polk ייעצה ל-Braze גם בנושאי antitrust. דמי ביטול של $300M שהקונה תשלם במקרה של חסימה מעידים שהצדדים מכירים בסיכון רגולטורי לא זניח. **לא נמצאה פרשנות antitrust ספציפית** (מאת עורכי דין או רגולטורים). הערכת הסיכון כאן היא ניתוח, לא עובדה.

---

## טבלת מדדים מרכזיים

| מדד | ערך | תקופה | תאריך פרסום | מקור (URL) | מדווח/מחושב/מוערך | ראשוני/משני |
|---|---|---|---|---|---|---|
| הכנסות רבעון | $227.2M (+26.2% YoY) | Q2 FY27 (עד 31.7.2026) | 2026-09-08 | https://pulse2.com/braze-q2-revenue-rises-26-to-227-2-million-as-ai-adoption-accelerates/ ; https://www.01net.it/braze-reports-strong-fiscal-second-quarter-2027-results/ | מדווח | משני (תקציר של הודעת החברה) |
| שיעור הכנסות ממנויים | 91% | Q2 FY27 | 2026-09-08 | https://www.braze.com/ja/press-releases/reports-fiscal-second-quarter-2027-results | מדווח | משני (תקציר חיפוש) |
| סה"כ לקוחות | 2,789 (לעומת 2,422) | 31.7.2026 | 2026-09-08 | https://www.01net.it/braze-reports-strong-fiscal-second-quarter-2027-results/ | מדווח | משני |
| לקוחות מעל $500K ARR | 361 (לעומת 282, +28%) | 31.7.2026 | 2026-09-08 | https://www.nasdaq.com/articles/braze-q2-earnings-call-highlights | מדווח | משני |
| חלק לקוחות מעל $500K מה-ARR | 65% (לעומת 62%) | 31.7.2026 | 2026-09-08 | https://www.01net.it/braze-reports-strong-fiscal-second-quarter-2027-results/ | מדווח | משני |
| DBNR (TTM), כל הלקוחות | 110% (לעומת 108%) | 31.7.2026 | 2026-09-08 | https://www.marketbeat.com/instant-alerts/transcript-braze-q2-earnings-call-highlights-2026-09-08/ | מדווח | משני |
| DBNR (TTM), לקוחות מעל $500K | 112% (לעומת 111% ברבעון הקודם) | 31.7.2026 | 2026-09-08 | https://www.nasdaq.com/articles/braze-q2-earnings-call-highlights | מדווח | משני |
| DBNR (TTM), כל הלקוחות | 114% / 108% | 31.7.2024 / 31.7.2025 | 2025-09-04 | https://www.businesswire.com/news/home/20250904097093/en | מדווח | משני |
| RPO כולל / cRPO | כ-$1.09–1.1B / כ-$691M (+24%) | 31.7.2026 | 2026-09-08 | https://www.nasdaq.com/articles/braze-q2-earnings-call-highlights | מדווח | משני (יש סתירה קלה בין מקורות) |
| RPO / cRPO | $1,079.2M / $670.3M | 30.4.2026 | 2026-05-27 | https://app.edgar.tools/filing/1676238/0001676238-26-000024/a20260430-brazeincxq127ear.htm | מדווח | משני (שיקוף של 8-K) |
| ARR | מעל $800M | תחילת FY27 (לפי שיחת Q4 FY26) | 2026-03-24 | https://www.marketbeat.com/instant-alerts/braze-q4-earnings-call-highlights-2026-03-24/ | מדווח (הנהלה) | משני |
| הכנסות שנתיות | $738.2M (+24.4%) | FY2026 | 2026-03-24 | https://www.sec.gov/Archives/edgar/data/1676238/000167623826000013/brze-20260131.htm | מדווח | משני (תקציר של 10-K) |
| תחזית הכנסות | $910–913M (כ-23%) | FY2027 | 2026-09-08 | https://pulse2.com/braze-q2-revenue-rises-26-to-227-2-million-as-ai-adoption-accelerates/ | מדווח (תחזית) | משני |
| צמיחה אורגנית | 27% (מדווח 30%) | Q1 FY27 | 2026-05-27 | https://www.chartmill.com/news/external/23277/bizwire-2026-5-27-braze-delivers-fourth-straight-quarter-of-organic-revenue-growth-acceleration | מדווח | משני |
| הכנסות Decisioning Studio | $5.7M | Q1 FY27 | 2026-05/06 | https://www.nasdaq.com/articles/braze-q1-earnings-call-highlights | מדווח (הנהלה) | משני |
| אימוץ AI בתשלום, לקוחות גדולים | כשליש (+כ-900bp QoQ) | Q2 FY27 | 2026-09-08 | https://quartr.com/events/braze-inc-brze-q2-2027_oqtK0gwV | טענת הנהלה | משני |
| Non-GAAP gross margin | 68.6% (לעומת 69.3%) | Q2 FY27 | 2026-09 | https://www.tikr.com/de/blog/braze-stock-fell-5-after-q2-earnings-even-with-a-beat-on-every-line-heres-why | מדווח | משני (בגרמנית, נדרש אימות) |
| הכנסות מחוץ לארה"ב | כ-45% | FY2026 | 2026-03 | https://www.sec.gov/Archives/edgar/data/1676238/000167623826000013/brze-20260131.htm | מדווח | משני (תקציר של 10-K) |
| מחיר רכישת OfferFit | $325M (מזומן ומניות) | הוכרז 27.3.2025 | 2025-03-27 | https://www.braze.com/press-releases/braze-announces-agreement-to-acquire-offerfit | מדווח | משני (תקציר של מקור ראשוני) |
| TAM (IDC, IPO) | כ-$15B | 2021 | 2021-11 | https://vivid.money/feed/brazes-ipo-is-today-heres-what-you-need-to-know | מוערך (צד ג' שמצוטט בתשקיף) | משני |
| שוק customer engagement solutions | $23.5B (2025), עד $43.9B (2030) | 2025–2030 | לא ידוע | https://www.thebusinessresearchcompany.com/report/customer-engagement-solution-global-market-report | מוערך | משני |
| ARR ממוצע ללקוח מעל $500K | כ-$1.4M ומעלה | Q2 FY27 | – | חישוב: 65% × $800M ומעלה ÷ 361 | מחושב (מקורב) | – |
| צמיחת לקוחות מעל $500K, 8 רבעונים | +62.6% (222 עד 361) | 7/2024 עד 7/2026 | – | חישוב מנתוני הטבלה | מחושב | – |

---

## אי-ודאויות מרכזיות
1. **אימות ראשוני:** כל הנתונים הגיעו מתקצירי חיפוש. מקורות ראשוניים (8-K, 10-Q, 10-K) לא נקראו ישירות בגלל חסימת רשת. נמצאו סתירות קלות: RPO של $1.09B לעומת $1.1B, ותיאור שונה של כיוון ה-DBNR של הלקוחות הגדולים ב-Q1 FY27.
2. **צמיחה אורגנית ב-Q2 FY27:** לא נמצא נתון. לכן קשה להפריד את תרומת OfferFit מהצמיחה.
3. **Gross retention / logo churn:** החברה לא מפרסמת. ה-10-K מציין churn ו-downsell כגורמים לירידת ה-DBNR.
4. **DBNR של לקוחות גדולים ב-Q3–Q4 FY25 וב-Q1 FY26:** חלקית לא נמצא או לא מאומת.
5. **TAM עדכני מצד החברה:** לא נמצא. ההערכות העצמאיות אינן עקביות.
6. **AI:** לא ידוע אם AI agentic יגדיל את ה-wallet share של Braze או יהפוך אותה ל-commodity. אין עדיין נתוני win/loss מול Agentforce או Adobe.
7. **Decisioning Studio:** עתיר שירותים, ולא ידוע אם המרווח שלו יגיע לרמת ה-SaaS הרגילה.
8. **סקירת Gartner 2026:** מבוססת על דיווח עצמי של Braze. מיקום המתחרים לא אומת.
9. **Q3 FY27:** תוצאות הרבעון שהסתיים ב-31.10.2026 טרם פורסמו.

---

## רשימת מקורות (URLs שבהם נעשה שימוש בפועל, דרך תקצירי חיפוש)
- https://www.01net.it/braze-reports-strong-fiscal-second-quarter-2027-results/
- https://secure.businesswire.com/news/home/20260908586699/en/Braze-Reports-Strong-Fiscal-Second-Quarter-2027-Results (ניסיון WebFetch נכשל עם ENOTFOUND; שימש דרך תקציר חיפוש בלבד)
- https://pulse2.com/braze-q2-revenue-rises-26-to-227-2-million-as-ai-adoption-accelerates/
- https://www.nasdaq.com/articles/braze-q2-earnings-call-highlights
- https://www.marketbeat.com/instant-alerts/transcript-braze-q2-earnings-call-highlights-2026-09-08/
- https://quartr.com/events/braze-inc-brze-q2-2027_oqtK0gwV
- https://www.braze.com/ja/press-releases/reports-fiscal-second-quarter-2027-results
- https://www.tikr.com/de/blog/braze-stock-fell-5-after-q2-earnings-even-with-a-beat-on-every-line-heres-why
- https://parameter.io/why-braze-brze-stock-tumbled-11-despite-surpassing-q2-earnings-expectations/
- https://www.sec.gov/Archives/edgar/data/1676238/000167623826000011/a20260131-brazeincxfy26ear.htm
- https://www.marketbeat.com/instant-alerts/braze-q4-earnings-call-highlights-2026-03-24/
- https://seekingalpha.com/pr/20449885
- https://www.01net.it/braze-reports-fiscal-year-and-fourth-quarter-2026-results/
- https://secure.businesswire.com/news/home/20260527699075/en/Braze-Delivers-Fourth-Straight-Quarter-of-Organic-Revenue-Growth-Acceleration
- https://app.edgar.tools/filing/1676238/0001676238-26-000024/a20260430-brazeincxq127ear.htm
- https://www.chartmill.com/news/external/23277/bizwire-2026-5-27-braze-delivers-fourth-straight-quarter-of-organic-revenue-growth-acceleration
- https://www.nasdaq.com/articles/braze-q1-earnings-call-highlights
- https://www.sec.gov/Archives/edgar/data/0001676238/000167623826000024/a20260430-brazeincxq127ear.htm
- https://www.businesswire.com/news/home/20251209211331/en/Braze-Reports-Fiscal-Third-Quarter-2026-Results
- https://vectorshift.ai/research/companies/braze/earnings/2026-q3-summary.html
- https://www.businesswire.com/news/home/20250904097093/en
- https://vectorshift.ai/research/companies/braze/earnings/2026-q2-summary.html
- https://www.businesswire.com/news/home/20250605620350/en
- https://www.sec.gov/Archives/edgar/data/0001676238/000167623825000077/a20250430-brazeincxq126ear.htm
- https://www.sec.gov/Archives/edgar/data/1676238/000167623826000013/brze-20260131.htm
- https://www.sec.gov/Archives/edgar/data/1676238/000167623825000054/brze-20250131.htm
- https://www.sec.gov/Archives/edgar/data/1676238/000167623823000031/brze-20230131.htm
- https://www.sec.gov/Archives/edgar/data/1676238/000167623822000005/brze-20220131.htm
- https://www.braze.com/press-releases/braze-announces-agreement-to-acquire-offerfit
- https://martech.org/braze-picks-up-ai-decisioning-with-offerfit-acquisition/
- https://vectorshift.ai/research/deals/braze-offerfit-2025
- https://www.destinationcrm.com/Articles/ReadArticle.aspx?ArticleID=176811
- https://www.braze.com/press-releases/braze-named-a-leader-in-2025-gartner-magic-quadrant-for-multichannel-marketing-hubs-for-third-consecutive-year-
- https://www.braze.com/ja/resources/articles/braze-named-leader-2026-gartner-magic-quadrant
- https://visit.bloomreach.com/gartner-mq-mmh-2025
- https://www.insidermonkey.com/blog/analysts-confident-in-braze-brzes-competitive-position-amid-ai-driven-disruption-in-saas-market-1703348/?amp=1
- https://www.barchart.com/story/news/265581/paycom-applovin-braze-salesforce-and-elastic-shares-plummet-what-you-need-to-know
- https://simplywall.st/stocks/us/software/nasdaq-brze/braze/news/can-brazes-brze-ai-marketing-push-redefine-its-competitive-e/amp
- https://genesysgrowth.com/blog/mailchimp-ai-vs-klaviyo-ai-vs-braze-ai
- https://ltv.ai/blog/klaviyo-alternatives-enterprise-ecommerce
- https://www.sequenzy.com/versus/braze-vs-klaviyo
- https://growthsharematrix.com/blogs/competitors/klaviyo
- https://vivid.money/feed/brazes-ipo-is-today-heres-what-you-need-to-know
- https://benzinga.com/news/22/10/29240423/braze-analyst-liked-the-stock-for-long-term-capital-appreciation
- https://www.technavio.com/report/customer-engagement-solutions-market-industry-analysis
- https://www.reportprime.com/customer-engagement-platform-r14509
- https://www.thebusinessresearchcompany.com/report/customer-engagement-solution-global-market-report
- https://www.researchnester.com/reports/customer-engagement-solutions-market/6286
