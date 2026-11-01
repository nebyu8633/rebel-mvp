# Agent A — מודל עסקי ויתרון תחרותי: Synopsys, Inc. (NASDAQ: SNPS)

תאריך הכנה: 2026-11-01 | מקורות: חיפוש רשת בלבד (WebSearch). הגישה הישירה ל-sec.gov / synopsys.com נחסמה, ולכן כל הנתונים **משניים** (מתוך תקצירי חיפוש של מסמכי SEC, הודעות לעיתונות ואנליסטים). Finviz לא שימש. אין המלצת מסחר.

סימון רמת ביטחון: **[עובדה]** = נתון מדווח בדוחות / הודעת חברה (דרך snippet); **[הנהלה]** = טענה או תחזית של ההנהלה; **[אנליסט]** = הערכת צד שלישי; **[חישוב]** = חישוב שלי מנתונים מדווחים.

---

## 1. מסקנה ראשונית

Synopsys היא אחת משתי ספקיות ה-EDA הדומיננטיות בעולם (יחד עם Cadence), עם עסק Design IP מוביל, ומאז 17.7.2025 גם בעלת Ansys (סימולציה מולטי-פיזיקלית). המודל עסקי **חוזר ברובו** (כ-82%–84% מההכנסות ברבעונים של FY2026), עם backlog של כ-10.9 מיליארד דולר — רמת נראות גבוהה מאוד. עלויות המעבר עצומות (תהליכי עבודה מוסמכים מול foundries, הכשרת מהנדסים, תסריטים פנימיים, מתודולוגיית signoff).

**הערכת חפיר (moat): יציב, עם הטיה קלה לחיזוק בליבת EDA/מערכות ושחיקה מקומית בסין וב-IP.**
- מחזק: Ansys מרחיבה ל"silicon-to-systems"; ביקוש AI/hyperscalers מעלה עוצמת אימות (emulation שיא); השקעת Nvidia (2B$) ושותפות; AgentEngineer.
- שוחק: ירידת הכנסות סין (−22% ללא Ansys ב-FY2025, ושיתוף נתח לטובת מתחרים מקומיים לפי ההנהלה); משבר Design IP ב-2025 (לקוח foundry גדול — ככל הנראה Intel — ו"roadmap missteps"); Cadence צומחת מהר יותר אורגנית ב-2026 (~21% מול EDA של Synopsys ~8.5% ב-Q3); סטארטאפים AI-native ממומנים היטב.
- AI נראה כרגע **מגדיל את השוק** (יותר תכנונים, יותר אימות, יותר צרכנות compute/רישיונות) יותר משהוא מאיים — אך מודל התמחור (per-seat מול per-token/agent) עלול להשתנות; זה הסיכון ארוך הטווח המרכזי.

---

## 2. ממצאים

### (1) מוצרים ושירותים
- **שני מגזרים מדווחים** [עובדה]: Design Automation (כולל Ansys) ו-Design IP. בנוסף מוצגות קבוצות מוצר: EDA, Design IP, Ansys, Other.
- **FY2025 (שנה שהסתיימה 31.10.2025)** [עובדה]: הכנסות 7.054 מיליארד $; Design Automation כ-5.302B$ (75.2%), Design IP כ-1.752B$ (24.8%). Ansys תרמה 756.6M$ (מ-17.7.2025 בלבד).
- **Ansys** [עובדה]: הרכישה (~35B$) הושלמה ב-17.7.2025, אחרי אישור מותנה של רגולטור סין; כוללת סימולציית SoC/IC וכלי פיזיקה (מבני, תרמי, CFD). צפי Ansys ל-FY2026: כ-2.98B$ [הנהלה]. מוצר משותף ראשון: Multiphysics Fusion (Q3 FY2026).
- **מכירות/פיצולים**:
  - Software Integrity (בדיקות אבטחת תוכנה) — נמכר, הושלם 30.9.2024 [עובדה].
  - Optical Solutions Group (Code V, LightTools, RSoft וכו') ו-Ansys PowerArtist (ניתוח הספק ב-RTL) — נמכרו ל-Keysight כתנאי רגולטורי, הושלם ~17.10.2025; "לא מהותי" [עובדה/הנהלה].
  - Processor IP Solutions (ARC CPU/DSP/NPU, ASIP Designer) — נמכר ל-GlobalFoundries (יחידת MIPS); הושלם בתחילת יוני 2026 (הכרזה 2.6.2026) [עובדה, משני]. Synopsys שומרת על interface ו-foundation IP. ברבעון Q3 FY2026 נרשם רווח GAAP מהמכירה, וה-backlog ירד מעט בשל הפיצול.

### (2) איך EDA עובד (הסבר)
זרימת תכנון שבב: (א) תיאור RTL (Verilog/VHDL) → (ב) **סינתזה לוגית** (Fusion Compiler/Design Compiler) ממירה RTL לרשת שערים (netlist) לפי ספריית תאים של ה-foundry → (ג) **Place & Route** (Fusion Compiler/IC Compiler II) — מיקום פיזי, ניתוב, עץ שעון, אופטימיזציית PPA (הספק-ביצועים-שטח) → (ד) **אימות** פונקציונלי (סימולטור VCS, אימות פורמלי) — חלק הארי של מאמץ ההנדסה → (ה) **Emulation/Prototyping** (ZeBu, HAPS) — חומרה ייעודית להרצת השבב לפני ייצור, כולל הרצת תוכנה → (ו) **Signoff** (PrimeTime לתזמון, IC Validator ל-DRC/LVS, RedHawk/Totem של Ansys לשלמות הספק) — אישור לפני tape-out. עבור 3D-IC/chiplets נדרשת גם סימולציה תרמית/מכנית (Ansys). כלי signoff "מוסמכים" ע"י TSMC/Samsung/Intel לכל צומת תהליך.

### (3) תפקיד ה-Semiconductor IP
בלוקים מוכנים ומאומתים (interface: PCIe, USB, DDR/HBM, UCIe die-to-die, Ethernet/SerDes; foundation: ספריות תאים, זיכרונות). לקוחות קונים במקום לפתח בעצמם — חוסך זמן וסיכון. Synopsys נחשבת מובילה ב-interface IP. ה-IP צריך להיות מותאם לכל צומת תהליך בכל foundry — השקעה כבדה מראש, ולכן הימור על foundry לא מצליח (Intel 18A, לפי J.P. Morgan [אנליסט]) פגע ב-2025. ב-Q3 FY2025 Design IP ירד 7.7% ל-428M$ (~120M$ מתחת לקונצנזוס) והמניה ירדה ~35%–36% ביום אחד [עובדה, משני]. ההנהלה אמרה ש-IP הגיע לתחתית ב-Q1 FY2026 [הנהלה]; Q3 FY2026: 473.8M$, +10.8% [עובדה]. ה-IP גם יוצר "נעילה" — לקוח שמשתמש ב-IP של Synopsys נוטה להשתמש בכלי ה-EDA שלה.

### (4) מקורות הכנסה
מתוך ה-supplement של Q4 FY2025 [עובדה, משני]:
- **Time-based products** (רישיונות לתקופה, לרוב 3 שנים): 3,489.6M$ ≈ 49.5% [חישוב].
- **Upfront products** (הכרה בנקודת זמן — חומרת emulation, רישיונות perpetual/IP, וחלק ה-license בחלק מהעסקאות): 2,010.6M$ ≈ 28.5% [חישוב].
- **Maintenance & service** (תחזוקה, תמיכה, שירותים; כולל תחזוקת Ansys): 1,554.0M$ ≈ 22% [חישוב].
- IP: דמי רישוי + תמלוגים (royalties) — פירוט תמלוגים **לא נמצא**.
- הערה חשבונאית: ה-10-K מתאר הפרדה בין license ו-support כמחויבויות ביצוע נפרדות; ב-subscriptions (בעיקר Ansys) חלק ה-license מוכר מראש — מה שמגדיל תנודתיות רבעונית ביחס להיסטוריה הישנה של Synopsys (בעיקר ratable).

### (5) הכנסה חוזרת, backlog וצפיות
- **Recurring revenue** [עובדה, משני; supplement Q3 FY2026]: 84% (Q1), 83% (Q2), 82% (Q3 FY2026). הגדרה: time-based + חוזי IP רב-שנתיים + maintenance & services. ירידה הדרגתית — עקב ריבוי upfront (חומרה, Ansys).
- **Backlog**: 8.1B$ (31.10.2024) → 11.4B$ (31.10.2025; כ-45% להכרה תוך 12 חודשים) → ~11.4B$ (Q1 FY26) → 11.0B$ (Q2) → 10.9B$ (Q3 FY2026; כ-49% תוך 12 חודשים) [עובדה, משני]. הירידה מוסברת ע"י ההנהלה בתזמון חידושים ובפיצול processor IP [הנהלה].
- **תחזית FY2026** [הנהלה]: הכנסות 9.69–9.74B$ (מרכז 9.715B$); Q4: 2.53–2.58B$; EDA צפוי לצמיחה דו-ספרתית ב-Q4 וב-FY2026.
- צפיות: גבוהה — backlog ≈ 1.1x הכנסות שנתיות [חישוב: 10.9/9.715].

### (6) עלויות מעבר
גבוהות מאוד [ניתוח]: (א) זרימות עבודה ותסריטים (TCL) שנבנו לאורך שנים; (ב) הסמכת foundry ו-correlation של signoff (שינוי כלי signoff = סיכון tape-out שעולה עשרות-מאות מיליוני $ במסכות בצמתים מתקדמים); (ג) הכשרת מהנדסים — שוק עבודה סטנדרטי סביב כלי Synopsys/Cadence; (ד) IP משולב בתכנון; (ה) חוזים רב-שנתיים עם "חבילות" (FSA). אחד המקורות [אנליסט] מציין שתהליכים מוסמכי-foundry "יקרים לשכפול" עבור סטארטאפים.

### (7) ריכוזיות לקוחות/ספקים וגיאוגרפיה
- **לקוח גדול**: FY2024 — לקוח אחד (מזוהה ע"י SemiAnalysis כ-Intel) 12.6%; FY2023 — 13.5%; שיא 17.9% ב-FY2017 [אנליסט/משני]. FY2025 — לפי סיכומים משניים **אין לקוח מעל 10%** (בעיקר בגלל הגדלת המכנה ע"י Ansys) — **לא אומת מהמסמך הראשי**.
- **סין**: FY2025 — 814.3M$ ≈ 12% מההכנסות (FY2024: 989.5M$, 16%) [עובדה, משני; supplement]. ירידה 18% (22% ללא Ansys). הגבלות ייצוא EDA לסין (BIS, 23.5.2025) בוטלו ב-2–3.7.2025 [עובדה]. ההנהלה ציינה העברת נתח בתוך סין למתחרים מקומיים [הנהלה].
- **ספקים**: עסק תוכנה — תלות נמוכה; חומרת emulation (ZeBu) מבוססת FPGA (ספק FPGA — לא נמצא פירוט במקורות; ידוע בשוק כ-AMD/Xilinx — **לא אומת**). תלות "אקוסיסטמית" ב-foundries (TSMC) להסמכות.

### (8) חפיר מול מתחרים
- **נתחי שוק EDA גלובליים 2024** [אנליסט, TrendForce]: Synopsys 31%, Cadence 30%, Siemens EDA 13%. שלוש הגדולות: 75%–85%+ לפי מקור.
- **Cadence**: מתחרה שקולה; חזקה ב-analog/custom (Virtuoso), emulation (Palladium), ומתרחבת בסימולציה/מערכות. Q3 2026: הכנסות 1.633B$ (+22%), backlog שיא 8.2B$, תחזית צמיחה 2026 ~21% [עובדה, משני]. **ב-2026 Cadence צומחת מהר יותר אורגנית** — סימן שאין "חיזוק" יחסי ברור ל-Synopsys ב-EDA.
- **Siemens EDA** (Mentor לשעבר): חזקה ב-Calibre (signoff פיזי), DFT, PCB; הכנסות מוערכות 2.2–2.5B$ [אנליסט, SemiAnalysis].
- **Keysight**: בעיקר RF/מיקרוגל EDA ו-test; התחזקה ע"י רכישת OSG ו-PowerArtist מ-Synopsys — מתחרה נישתית.
- **Empyrean (华大九天) וסין**: ~5.9%–6% מהשוק הסיני [אנליסט]; הכנסות ~1.22B CNY (~168M$) [אנליסט]. שלוש הגדולות ~78% בסין ב-2024 [Omdia]. איום מקומי אמיתי בסין (מדיניות "החלפה מקומית"), לא גלובלי בטווח הנראה.
- **יתרון Synopsys**: הרחבה ביותר (EDA + IP + סימולציה), מובילה ב-synthesis/P&R ו-signoff תזמון (PrimeTime), interface IP, ועכשיו מולטי-פיזיקה של Ansys.

### (9) חסמי כניסה
עשרות שנות R&D ואלגוריתמיקה; הסמכת foundries לכל צומת; צורך ב-"זרימה מלאה" (לקוחות לא רוצים לחבר 10 ספקים); נתוני אימות ומעגלי משוב עם לקוחות מובילים; מאגר כישרונות; אמון — כשל בכלי = כשל tape-out. סטארטאפים נכנסים בעיקר בנקודות (RTL/verification agents) ולא בזרימה המלאה. הגבלות ייצוא אמריקאיות מחזקות דווקא שחקנים מקומיים בסין.

### (10) השפעת AI
- **Synopsys.ai / AgentEngineer** [עובדה/הנהלה]: בסוף ספטמבר 2026 הושקה פלטפורמת Autopilot + AgentEngineer — סוכנים ייעודיים ב-6 תחומים (verification, system validation, implementation, AMS, manufacturing, simulation). GA מתוכנן לסוף 2026. שותפים: MediaTek, Samsung, TSMC; שילוב עם Nvidia Agent Toolkit/Nemotron. טענת יעילות "2x tokens" — מלקוח לא מזוהה [הנהלה/לא מאומת]. תמחור: "צור קשר" — **לא נמצא**.
- **Nvidia** [עובדה]: השקיעה 2B$ במניות Synopsys ב-414.79$ למניה (1.12.2025), שותפות רב-שנתית לא בלעדית (האצת כלים ב-GPU, AI). ההנהלה: אין התחייבות לקנות GPU של Nvidia. היו טענות על "עסקאות מעגליות" [פרשנות].
- **ביקוש AI / hyperscalers** [הנהלה/אנליסט]: AI מגדיל design starts ועוצמת אימות; hyperscalers מגדילים emulation/prototyping; Q3 FY2026 — רבעון שיא ב-hardware-assisted verification (12 לקוחות חדשים, 66 חוזרים); IP נהנה מביקוש AI (HBM, die-to-die, interface) ועסקאות IP גדולות עם custom silicon. Hyperscalers (Google TPU, AWS Trainium, Microsoft Maia, Meta MTIA) = לקוחות חדשים ישירים (+ דרך Broadcom/Marvell).
- **סטארטאפים AI-native** [עובדה, משני]: ChipAgents — גיוסים מצטברים ~134M$ (Series A 21M$ 10/2025, A1 50M$ 2/2026, ~60M$ 7/2026), 120 פריסות, שותפות Nvidia; Cognichip — 60M$ Series A (סה"כ ~93M$), Lip-Bu Tan (מנכ"ל Intel) בדירקטוריון. הערכת שווי 4B$ ל-Cognichip — **לא מאומתת**. כרגע פועלים בעיקר "מעל" כלי ה-incumbents (שכבת סוכנים) ולא מחליפים את מנועי הסינתזה/signoff.
- **מסקנה**: בטווח קצר-בינוני AI = רוח גבית. סיכון ארוך-טווח: סוכנים מצמצמים מספר "מושבים" (seats) של מהנדסים → לחץ על תמחור per-seat; Synopsys מנסה לעבור לתמחור לפי ערך/צריכה — לא נמצאו פרטים.

---

## 3. טבלת מדדים

| מדד | ערך | תקופה | תאריך פרסום | מקור | סוג | ראשוני/משני |
|---|---|---|---|---|---|---|
| הכנסות | 7,054.2M$ | FY2025 (עד 31.10.25) | 10.12.2025 | https://news.synopsys.com/2025-12-10-Synopsys-Posts-Financial-Results-for-Fourth-Quarter-and-Fiscal-Year-2025 | מדווח | משני (snippet) |
| Design Automation | ~5,302M$ (75.2%) | FY2025 | 10.12.2025 | https://s201.q4cdn.com/778493406/files/doc_earnings/2025/q4/supplemental-info/Synopsys-Q4-FY2025-Financial-Supplement.pdf | מדווח | משני |
| Design IP | ~1,752M$ (24.8%) | FY2025 | 10.12.2025 | כנ"ל | מדווח | משני |
| הכנסות Ansys | 756.6M$ | FY2025 (מ-17.7.25) | 12/2025 | https://www.sec.gov/Archives/edgar/data/883241/000088324125000028/snps-20251031.htm | מדווח | משני |
| Time-based / Upfront / Maint. | 3,489.6 / 2,010.6 / 1,554.0M$ (≈49.5%/28.5%/22%) | FY2025 | 10.12.2025 | Q4 FY2025 supplement (לעיל) | מדווח; אחוזים מחושבים | משני |
| Recurring revenue % | 84% / 83% / 82% | Q1/Q2/Q3 FY2026 | 26.8.2026 | https://s201.q4cdn.com/778493406/files/doc_earnings/2026/q3/supplemental-info/Synopsys-Q3-FY2026-Financial-Supplement.pdf | מדווח | משני |
| Backlog | 11.4B$ (~45% תוך 12 ח') | 31.10.2025 | 12/2025 | 10-K FY2025 (לעיל); https://futurumgroup.com/insights/synopsys-q4-fy-2025-earnings-highlight-resilient-demand-ansys-integration/ | מדווח | משני |
| Backlog | 10.9B$ (~49% תוך 12 ח') | 31.7.2026 | 26.8.2026 | https://www.sec.gov/Archives/edgar/data/0000883241/000119312526368620/d157153dex991.htm ; https://www.marketbeat.com/instant-alerts/transcript-synopsys-q3-earnings-call-highlights-2026-08-26/ | מדווח | משני |
| Backlog | 8.1B$ | 31.10.2024 | 12/2025 | 10-K FY2025 | מדווח | משני |
| הכנסות Q3 FY2026 | 2,477M$ (מול 1,740M$) | Q3 FY2026 | 26.8.2026 | 8-K לעיל | מדווח | משני |
| Design IP Q3 FY2026 | 473.8M$ (+10.8%) | Q3 FY2026 | 26.8.2026 | https://www.zacks.com/stock/news/2981139/snps-q3-earnings-beat-estimates-on-eda-and-ansys-strength | מדווח | משני |
| EDA צמיחה | +8.5% YoY | Q3 FY2026 | 26.8.2026 | https://www.nasdaq.com/articles/snps-q3-earnings-call-highlights-eda-acceleration-outlook-raised | מדווח | משני |
| Ansys ברבעון | ~711M$ (~29% מההכנסות) | Q3 FY2026 | 26.8.2026 | Zacks לעיל | מדווח; % מחושב | משני |
| תחזית הכנסות | 9.69–9.74B$ | FY2026 | 26.8.2026 | 8-K לעיל | תחזית הנהלה | משני |
| תחזית Ansys | ~2.98B$ | FY2026 | 26.8.2026 | 8-K/Zacks | תחזית הנהלה | משני |
| Backlog / תחזית הכנסות | ~1.12x | FY2026 | — | — | מחושב | — |
| סין | 814.3M$ (12%) מול 989.5M$ (16%) | FY2025 מול FY2024 | 10.12.2025 | Q4 FY2025 supplement | מדווח | משני |
| שינוי סין | −18% (−22% ללא Ansys) | FY2025 | 12/2025 | 10-K FY2025; https://www.fool.com/earnings/call-transcripts/2025/12/10/synopsys-snps-q4-2025-earnings-call-transcript/ | מדווח | משני |
| הלקוח הגדול | 12.6% (FY24), 13.5% (FY23); FY25: אין לקוח >10% | FY2023–25 | — | https://policyrisk.com/world/company/SNPS ; https://newsletter.semianalysis.com/p/eda-market-primer | מדווח (לפי סיכום) | משני — לא אומת |
| נתח שוק EDA | Synopsys 31%, Cadence 30%, Siemens 13% | 2024 | 2025 | https://www.trendforce.com/news/?p=41931 | הערכת אנליסט | משני |
| Empyrean בסין | ~5.9%–6% | 2024–25 | 2025 | https://omdia.tech.informa.com/om129004/china-semiconductor-market-brief--march-2025 | הערכת אנליסט | משני |
| Cadence Q3 2026 | 1,633M$ (+22%), backlog 8.2B$ | Q3 2026 | 26.10.2026 | https://www.sec.gov/Archives/edgar/data/0000813672/000081367226000116/cdns10262026ex9901.htm | מדווח | משני |
| השקעת Nvidia | 2B$ ב-414.79$/מניה | 1.12.2025 | 1.12.2025 | https://www.bnnbloomberg.ca/business/2025/12/01/nvidia-invests-us2-billion-in-chip-design-software-provider-synopsys | מדווח | משני |
| Design IP Q3 FY2025 | 428M$ (−7.7%) | Q3 FY2025 | 9.9.2025 | https://futurumgroup.com/insights/synopsys-q3-fy-2025-ip-business-weakness-and-transformation-pose-concerns-but-long-term-thesis-unchanged | מדווח | משני |
| ChipAgents גיוסים | ~134M$ מצטבר | 10/2025–7/2026 | 7/2026 | https://thenextweb.com/news/nvidia-partner-chipagents-raises-60m-for-agentic-chip-design | מדווח (חברה פרטית) | משני |

---

## 4. אי-ודאויות ופערים
1. כל הנתונים משניים — לא ניתן היה לפתוח את ה-10-K/10-Q ישירות. יש לאמת מול EDGAR.
2. ריכוזיות לקוחות FY2025 ("אין לקוח >10%") — מבוסס סיכומים משניים בלבד.
3. אחוז סין ב-FY2026 (רבעונים) — **לא נמצא**.
4. פירוק תמלוגי IP מול דמי רישוי — **לא נמצא**.
5. אחוז recurring לשנת FY2025 המלאה — **לא נמצא** (רק רבעוני FY2026).
6. תמחור AgentEngineer וההשפעה על מודל per-seat — **לא נמצא**.
7. נתחי שוק 2025/2026 לאחר Ansys — אין השוואה עקבית (מקורות שונים, לעיתים כוללים Ansys).
8. תוצאות Q4 FY2026 טרם פורסמו (צפויות בדצמבר 2026).
9. תביעה ייצוגית בגין הצהרות על Design IP (2025) — טענה, לא ממצא; תוצאה לא ידועה.
10. השפעת ביטול/חידוש עתידי של הגבלות ייצוא לסין — סיכון מדיניות פתוח.
11. המקור לחלק מנתוני שוק סין (QYResearch, Omdia) — באיכות בינונית ולא אחידה.

## 5. רשימת מקורות
- 10-K FY2025: https://www.sec.gov/Archives/edgar/data/883241/000088324125000028/snps-20251031.htm
- הודעת תוצאות Q4/FY2025: https://news.synopsys.com/2025-12-10-Synopsys-Posts-Financial-Results-for-Fourth-Quarter-and-Fiscal-Year-2025
- Q4 FY2025 Supplement: https://s201.q4cdn.com/778493406/files/doc_earnings/2025/q4/supplemental-info/Synopsys-Q4-FY2025-Financial-Supplement.pdf
- Q3 FY2026 Supplement: https://s201.q4cdn.com/778493406/files/doc_earnings/2026/q3/supplemental-info/Synopsys-Q3-FY2026-Financial-Supplement.pdf
- 8-K Q3 FY2026: https://www.sec.gov/Archives/edgar/data/0000883241/000119312526368620/d157153dex991.htm
- Investor release Q3 FY2026: https://investor.synopsys.com/news/news-details/2026/Synopsys-Posts-Financial-Results-for-Third-Quarter-Fiscal-Year-2026/default.aspx
- MarketBeat Q3 FY26 call: https://www.marketbeat.com/instant-alerts/transcript-synopsys-q3-earnings-call-highlights-2026-08-26/
- Nasdaq Q3 FY26: https://www.nasdaq.com/articles/snps-q3-earnings-call-highlights-eda-acceleration-outlook-raised
- Zacks Q3 FY26: https://www.zacks.com/stock/news/2981139/snps-q3-earnings-beat-estimates-on-eda-and-ansys-strength
- Futurum Q2 FY26: https://futurumgroup.com/insights/synopsys-q2-fy-2026-ai-driven-chip-design-demand-lifts-outlook/
- Futurum Q4 FY25: https://futurumgroup.com/insights/synopsys-q4-fy-2025-earnings-highlight-resilient-demand-ansys-integration/
- Futurum Q3 FY25 IP: https://futurumgroup.com/insights/synopsys-q3-fy-2025-ip-business-weakness-and-transformation-pose-concerns-but-long-term-thesis-unchanged
- Fool (ירידת 35%): https://www.fool.com/investing/2025/09/17/this-technology-stock-just-crashed-35-in-one-day
- Fool Q4 FY25 call: https://www.fool.com/earnings/call-transcripts/2025/12/10/synopsys-snps-q4-2025-earnings-call-transcript/
- Ansys closing: https://www.datacenterdynamics.com/en/news/synopsys-closes-35bn-acquisition-of-ansys/
- OSG/PowerArtist approval: https://news.synopsys.com/2025-10-10-Synopsys-Receives-Final-Regulatory-Approval-to-Close-Planned-Divestitures-of-Synopsys-Optical-Solutions-Group-and-Ansys-PowerArtist
- Keysight completion: https://www.digitalengineering247.com/article/keysight-finalizes-acquisition-of-a-synopsys-optical-group-and-ansys-powerartist
- ARC ל-GF: https://evertiq.com/design/2026-06-04-gf-completes-acquisition-of-synopsys-arc-processor-ip-business ; https://www.nasdaq.com/press-release/globalfoundries-completes-acquisition-synopsys-processor-ip-solutions-business
- Nvidia: https://www.bnnbloomberg.ca/business/2025/12/01/nvidia-invests-us2-billion-in-chip-design-software-provider-synopsys ; https://www.dealstreetasia.com/stories/nvidia-buys-stake-in-synopsys-465099
- AgentEngineer: https://tomshardware.com/tech-industry/semiconductors/synopsys-debuts-autopilot-platform-for-developing-chips-autonomously-using-ai-new-agentengineer-platform-is-poised-for-general-availability-by-the-end-of-2026 ; https://www.synopsys.com/blogs/chip-design/long-horizon-agentengineer-solutions.html?tags=AI ; https://aicybr.com/blog/synopsys-agentengineer-autopilot-autonomous-chip-design
- הגבלות ייצוא: https://www.scmp.com/tech/policy/article/3316742/tech-war-us-lifts-export-control-chip-design-software-china ; https://www.caixinglobal.com/2025-07-03/us-lifts-export-ban-on-chip-design-software-to-china-amid-trade-thaw-102337708.html
- TrendForce (נתח שוק / סין 14.2%): https://www.trendforce.com/news/?p=41931 ; https://www.trendforce.com/news/2025/09/10/news-synopsys-reportedly-to-cut-10-staff-by-fy26-china-foundry-woes-expected-through-4q/
- SemiAnalysis EDA primer: https://newsletter.semianalysis.com/p/eda-market-primer
- Omdia China: https://omdia.tech.informa.com/om129004/china-semiconductor-market-brief--march-2025
- PolicyRisk (ריכוזיות): https://policyrisk.com/world/company/SNPS
- Cadence Q3 2026: https://www.sec.gov/Archives/edgar/data/0000813672/000081367226000116/cdns10262026ex9901.htm ; https://www.tikr.com/blog/cadence-soars-6-on-record-8-2-billion-backlog-raising-outlook-for-the-third-time-this-year
- ChipAgents / Cognichip: https://thenextweb.com/news/nvidia-partner-chipagents-raises-60m-for-agentic-chip-design ; https://www.tamradar.com/funding-rounds/cognichip-series-a-60m
- Hyperscaler custom silicon: https://introl.com/blog/custom-silicon-inflection-2026-hyperscaler-asics-nvidia-gpu
