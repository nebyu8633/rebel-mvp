# סוכן D — ניתוח תעשיית המוליכים למחצה והשלכותיה על Synopsys (SNPS)

**תאריך:** 2026-11-01 | **שיטה:** WebSearch בלבד (WebFetch חסום ברוב האתרים). לא נעשה שימוש ב-Finviz. מקורות משניים מסומנים כמשניים. מספרים שהם **תחזית** מסומנים [תחזית]; נתונים מדווחים מסומנים [עובדה]; חישובים שלי מסומנים [חישוב].
**מגבלה:** תקציב החיפוש המשותף (200 חיפושים) נגמר לפני השלמת שני נושאים: (א) אימוץ multi-die/3DIC ונתח שוק UCIe; (ב) חשיפת SNPS ל-Intel כ"לקוח foundry מרכזי" ושיעור ההכנסות מ-systems companies/hyperscalers. בנושאים אלו הניתוח איכותי בלבד ומסומן "לא אומת".

---

## 1. מסקנה ראשונית

**הרוח הגבית התעשייתית ל-SNPS חזקה ומבנית, אך ההמרה שלה להכנסות SNPS מתונה יותר מהכותרות.**

- **תומך (חזק):** מחזור AI: שוק השבבים העולמי צפוי לכ-1.5 טריליון דולר ב-2026 (+~90%, WSTS אביב 2026 [תחזית]), עיקר הזינוק מגיע מזיכרון/תמחור. מספר ה-tape-outs ב-N2 של TSMC גבוה פי ~4 מ-N3 באותו שלב (DigiTimes, מפי בכיר TSMC [עובדה, משני]). ASIC מותאמים של hyperscalers צפויים לצמוח ~45% במשלוחים ב-2026 [תחזית]. עלות תכנון שבב 2nm מוערכת ב-~725 מיליון דולר (IBS [הערכה]; לפי מקורות בתעשייה ההערכה מנופחת ב-50–66%). כל אלה מגדילים את הביקוש לכלי EDA, לאמולציה (HAV) ול-IP ממשקים.
- **בפועל אצל SNPS:** ברבעון Q3 FY26, הכנסות EDA צמחו +8.5% עם רבעון שיא ב-HAV. Design IP חזר לצמיחה של +11% (474 מיליון דולר). ההנהלה צופה צמיחה אורגנית דו-ספרתית ב-EDA ל-FY26 [תחזית חברה]. לעומת זאת, ענף ה-ESD כולו צמח 12.2% ב-Q2 2026 (ESD Alliance [עובדה]), ו-Cadence מעלה תחזית לצמיחה של ~21% ב-2026 עם backlog שיא של 8.2 מיליארד דולר. **SNPS צומחת אורגנית לאט מהשוק ומ-Cadence**, בעיקר בגלל IP חלש ב-FY25, סין והוצאת עסקי Processor IP.
- **פוגע (בינוני):** (1) סין: הכנסות SNPS מסין ירדו 22% ב-FY25 (לא כולל Ansys, 10-K [עובדה]). ההשעיה של "כלל ה-50% affiliates" פוקעת ב-10.11.2026, כלומר סיכון אירוע מיידי. (2) חולשת foundry של Intel/Samsung פגעה ב-IP ב-FY25: הרווח התפעולי המותאם של IP ירד 43%. (3) Cadence (ו-Qualcomm אחרי רכישת Alphawave) מתחרות חזק ב-IP ממשקים. (4) מגבלות רגולטוריות על M&A (SAMR/EU) הוכחו כגורם מעכב ומחייב מכירת נכסים. (5) ריבית: הפד **העלה** ריבית בספטמבר 2026 לטווח 3.75–4.00% (משני). ההשפעה הישירה על EDA קטנה, כי מדובר במנויים, אבל היא לוחצת על מכפילים.
- **שורה תחתונה (ראשונית):** המבנה התעשייתי (אוליגופול של 3 שחקנים עם >85% נתח, ו-SNPS מעל 80% בסינתזה וב-signoff) והביקוש מ-AI תומכים בצמיחה **אורגנית** של כ-8–12% בטווח הבינוני ל-EDA ול-IP גם יחד [הערכה שלי]. הסיכונים העיקריים הם גיאופוליטיקה (סין ≈ 12–16% מההכנסות) ותלות בלקוחות foundry חלשים. **ציון תעשייתי: חיובי-מתון.**

---

## 2. טבלת מגמות

| # | מגמה | ראיות (תאריך / סוג) | השפעה על SNPS | עוצמה | מקור |
|---|------|---------------------|---------------|--------|------|
| 1 | הוצאות R&D של יצרניות שבבים | 20 החברות הגדולות הוציאו 98.7 מיליארד דולר על R&D ב-2024, +17% (Intel ‏16.55, Nvidia ‏12.5, Samsung ‏9.5, ‏TSMC ‏6.36). Intel מקצצת, ו-Nvidia צפויה לעקוף אותה ב-2026 [תחזית]. Samsung: ‏37.7 טריליון וון R&D ב-2025 | **+** הכנסות EDA הן נגזרת של תקציבי R&D, ותקציבים אלה ממשיכים לגדול. **−** Intel, לקוח גדול היסטורית, מקצצת | בינוני+ | TechInsights דרך Korea JoongAng / mobileworldlive (משני); CEO Score (משני) |
| 2 | צמתים מתקדמים (2nm / A16 / 18A / 14A) | N2 בייצור המוני מ-Q4/2025. מספר ה-tape-outs פי ~4 מ-N3 באותו שלב (קיימת גם טענה סותרת של פי 1.5, ממקור חלש). A16 צפוי בייצור המוני ב-H2/2026. Intel 18A משלוחים (Panther Lake). 14A: ייצור סיכון ב-2028, Tesla לקוח | **+** כל tape-out בצומת מתקדם דורש יותר רישיונות, יותר זמן ריצה ו-IP חדש (PHY לכל צומת) | גבוה | DigiTimes 7/2026, Guru3D (משני); Tweaktown, notateslaapp (משני) |
| 3 | עלות תכנון לפי צומת | IBS [הערכה]: ‏5nm ≈ 449–479 מיליון דולר, ‏3nm ≈ 581–585, ‏2nm ≈ 725 (מתוכם ~314 תוכנה ו-~154 אימות). לפי מקורות בתעשייה ו-SemiAnalysis, ההערכות גבוהות ב-50–66% מהמציאות | **+** נתח ה-EDA, האימות וה-IP בתקציב הפרויקט עולה עם כל צומת. **−** עלות גבוהה מצמצמת את מספר הלקוחות שיכולים לתכנן בצמתים המתקדמים | בינוני | siliconanalysts.com, techbang (משני) |
| 4 | AI וביקוש למחשוב, וכיצד הוא מתבטא בהכנסות SNPS | Q3 FY26: הכנסות 2.477 מיליארד דולר (+42%, כולל Ansys ‏711 מיליון). EDA ‏+8.5% עם רבעון שיא ב-HAV (ZeBu / HAPS), ‏12 לקוחות HAV חדשים ו-66 לקוחות חוזרים. IP ‏+11%, בהובלת PCIe 7 ו-LPDDR6. תחזית FY26: ‏9.69–9.74 מיליארד דולר | **+** ארבעה ערוצים: (א) יותר design starts של מאיצים; (ב) שבבים גדולים ומורכבים יותר דורשים יותר רישיונות וזמן ריצה בענן; (ג) אמולציה ופרוטוטייפינג (חומרה, נמכרת כ-upfront ולכן תנודתית); (ד) IP ל-HBM / UCIe / PCIe 7 / 224G. ‏**לא אומת:** נתון ספציפי על HBM4 או 224G ב-Q3 FY26 | גבוה | Synopsys 8-K 26.8.2026 (ראשוני); MarketBeat, Yahoo (משני) |
| 5 | ASIC מותאמים של hyperscalers | משלוחי ASIC צפויים ב-+44.6% ב-2026, לעומת +16.1% ב-GPU, ונתח של 27.8% משרתי ה-AI [תחזית]. ל-Broadcom ‏backlog AI של 73 מיליארד דולר. Marvell: עד 11 מיליארד דולר ב-2026 [תחזית]. Broadcom ו-Marvell מחזיקות יחד ~95% מעיצוב ASIC משותף. capex של hyperscalers ב-2026: ‏660–690 מיליארד דולר [הערכה, מקור חלש] | **+** בסיס לקוחות חדש ורחב (Google, AWS, Meta, Microsoft, OpenAI) שקונה EDA, HAV ו-IP. **−** חלק מה-IP מגיע מ-Broadcom/Marvell עצמן ולא מ-SNPS | גבוה | Tom's Hardware 5/2026; Introl (בלוג, אמינות נמוכה) |
| 6 | Chiplets / ‏3DIC / ‏multi-die | ‏**לא אומת בחיפוש** (התקציב נגמר). איכותית: מאיצי AI עוברים לארכיטקטורה של ריבוי dies עם HBM ו-UCIe | **+** גידול בביקוש ל-3DIC Compiler, ל-IP של UCIe/HBM, ולסימולציה תרמית/מכנית (סינרגיה עם Ansys) | בינוני+ (לא כומת) | — |
| 7 | שוק ה-IP ונתחים | שוק ה-design IP ב-2025: ‏9.45 מיליארד דולר (+12.7%), אחרי 8.5 מיליארד ב-2024 (+20%). נתחים ב-2025: ‏Arm ‏49.4%, ‏SNPS ‏18.5%, ‏Cadence ‏6.4%. ב-2024: ‏SNPS ‏23% (ומקום 1 בהכנסות רישוי, 32%). IP ממשקים ב-2025: ‏2.44 מיליארד דולר, ‏SNPS ‏57%, ‏Cadence ‏17%. ‏SNPS רשמה ירידה קלה ב-2025 | **−** SNPS איבדה נתח ב-2025 (מ-23% ל-18.5%) בשוק שצמח. **+** Q3 FY26 מראה התאוששות; IP ממשקים צפוי ל-CAGR של 13.2% עד 2030 [תחזית] | בינוני | IPnest דרך SemiWiki (משני; הדוח עצמו בתשלום) |
| 8 | רה-ארגון בתחום ה-IP | ‏SNPS מכרה את Processor IP (ARC / RISC-V / NPU) ל-GlobalFoundries ב-1.6.2026 תמורת 443 מיליון דולר. Qualcomm השלימה את רכישת Alphawave (כ-2.4 מיליארד דולר) ב-18.12.2025 | **±** מיקוד בממשקים, בזיכרון ובספריות; קיטון בבסיס ההכנסות. Alphawave בתוך Qualcomm הופכת למתחרה ב-224G/chiplets שהיא גם לקוחה | נמוך-בינוני | Synopsys 10-Q 7/2026 (ראשוני); BusinessWire (ראשוני) |
| 9 | פיקוח ייצוא וגיאופוליטיקה | הגבלות EDA על סין הוטלו בסוף מאי 2025 (23 או 29 במאי, יש סתירה בין המקורות) ובוטלו ב-2.7.2025, כלומר נמשכו כ-40 יום. זה קרה במסגרת עסקת עפרות נדירות. ישויות ברשימת Entity List עדיין זקוקות לרישיון. "כלל ה-affiliates 50%" (מ-29.9.2025) הושעה מ-10.11.2025 ל-10.11.2026 | **−** הכנסות SNPS מסין ירדו 22% ב-FY25 (לא כולל Ansys). היסטורית סין ≈ 16% מההכנסות; תחזית Visible Alpha [תחזית] הייתה ~830 מיליון דולר, ≈ 12%. **סיכון אירוע ב-10.11.2026** | גבוה (סיכון) | 10-K FY25 (ראשוני); The Register, TechNode (משני); Arnold & Porter, DLA Piper (משני) |
| 10 | EDA סיני מקומי | ‏Empyrean מחזיקה ~5.9% מהשוק הסיני (2025). שלושת הגדולים ≈ 78–80%+ מהשוק בסין. שיעור הייצור העצמי בסין >10% (2024). ‏Empyrean, ‏Primarius ו-Broadway יחד ≈ 2+ מיליארד יואן (FY25). מספר קטגוריות הכלים המקומיים בפריסה רחבה עלה מ-17 ל-26 (2026) | **−** שחיקה איטית בצמתים בוגרים בסין; הממשלה מעודדת תחליפים | נמוך-בינוני (מבני, איטי) | Omdia, TrendForce 9/2026, SCMP (משני) |
| 11 | מגבלות רגולטוריות על M&A | ‏SAMR אישרה את Ansys ב-14.7.2025 בתנאים: מכירת נכסי האופטיקה של SNPS ו-PowerArtist של Ansys ל-Keysight, ו-10 שנים של תנאים התנהגותיים (בלי bundling, אספקה לסין בתנאים "הוגנים ולא מפלים", ותאימות לצד שלישי). ה-EU אישרה בינואר 2025 | **−** מגביל bundling של Ansys ו-EDA בסין ל-10 שנים. סין יכולה להשתמש ב-SAMR כמנוף. עסקאות גדולות עתידיות קשות יותר | בינוני | Schnitger Corp, Law360/MLex, TechCrunch (משני) |
| 12 | ריבית ו-capex של לקוחות | הפד העלה ריבית בספטמבר 2026 ל-3.75–4.00%, החזיק באוקטובר בהצבעה 10–2 (2 מתנגדים בעד העלאה), והחציון צופה 4.1% בסוף 2026 [משני]. ‏SEMI: ‏WFE ‏116.9 מיליארד דולר ב-2025, ‏143.9 מיליארד ב-2026 (+23%), ‏+21.8% ב-2027 [תחזית] | **±** ‏capex שבבים חזק הוא אינדיקטור עקיף לצמתים חדשים. ריבית גבוהה לוחצת על מכפיל ה-SNPS ועל הסטארט-אפים בשבבים; ההשפעה הישירה על הכנסות EDA, שהן מנויים, נמוכה | נמוך (הכנסות), בינוני (תמחור) | SEMI 14.7.2026 (ראשוני); Admiral Markets, InvestingLive (משני, דורש אימות מול federalreserve.gov) |
| 13 | תחרות EDA | ‏ESD Q2 2026: ‏5.71 מיליארד דולר (+12.2%). ‏EDA טהור (CAE ועוד) +6.5%. ‏APAC ‏+22.4%. ‏Cadence: ‏Q3 2026 ‏1.633 מיליארד דולר, תחזית 2026 ≈ 6.39–6.42 מיליארד (+~21%), ‏backlog שיא 8.2 מיליארד. ‏SNPS ‏backlog ‏10.9 מיליארד דולר (ירידה קלה רבעונית בגלל המכירה) | **−** ‏Cadence צומחת מהר יותר וצוברת backlog. **+** ‏SNPS מחזיקה ≈ 84–85% בסינתזה ו-90%+ ב-PrimeTime (signoff) [הערכת SemiAnalysis] | בינוני | ESD Alliance/SEMI 19.10.2026 (ראשוני); Cadence 8-K 26.10.2026 (ראשוני); SemiAnalysis (משני, בתשלום) |
| 14 | ריכוז לקוחות ומחזוריות (Intel / Samsung) | ב-FY25 הרווח התפעולי המותאם של IP ירד 43% ל-419 מיליון דולר (מרווח 24% לעומת 38%), בגלל סין, "ביקוש חלש מלקוח foundry מרכזי" (ככל הנראה Intel, ‏**לא אומת**), והחלטות roadmap שגויות. Samsung foundry מפסידה כ-1 טריליון וון ברבעון מאז 2022, ו-1.4nm נדחה ל-2029. Intel מקצצת capex ב-~30% (2025) | **−** חשיפה ל-foundries חלשים (IP לצמתים של Intel ו-Samsung). **+** הצלחת Intel 14A / Tesla ו-Samsung SF2 (Tesla AI6, ‏16.5 מיליארד דולר) יכולה להחזיר ביקוש ל-IP | בינוני | 10-K FY25 (ראשוני); Korea Herald, Digitimes (משני) |
| 15 | שוק השבבים הכולל | ‏WSTS אביב 2026: ‏2026 ≈ 1.51 טריליון דולר (+89.9%), ‏2027 ≈ 1.9 טריליון (+27%) [תחזית]. עדכון אוגוסט מדווח על ~1.65–1.7 טריליון (משני, נתונים סותרים) | **±** עיקר הזינוק נובע ממחירי זיכרון. הקשר להכנסות EDA חלש בטווח הקצר, כי הכנסות EDA תלויות ב-R&D ולא במכירות | נמוך-בינוני | WSTS 2.6.2026 (ראשוני); bits-chips, technews.tw (משני) |

---

## 3. טבלת גודלי שוק

| שוק | גודל | שנה | צמיחה | סוג | מקור |
|-----|------|-----|-------|------|------|
| ענף ה-ESD (‏EDA, ‏CAE, ‏IP ושירותים, ‏ESD Alliance) | 5.71 מיליארד דולר לרבעון (Q2 2026); 5.75 מיליארד (Q1 2026). קצב שנתי ≈ 23 מיליארד [חישוב] | 2026 | ‏+12.2% (Q2), ‏+12.7% (Q1) | עובדה | ESD Alliance / SEMI |
| ‏EDA "שלושת הגדולים" | ≈ 16 מיליארד דולר (SNPS כ-8, כולל Ansys; ‏CDNS ‏5.3; ‏Siemens ‏2.2–2.5 [הערכה]) | CY2025 | — | הערכה | SemiAnalysis (משני) |
| ‏TAM של EDA | ≈ 18 מיליארד דולר; 28–31 מיליארד בהגדרה רחבה עם סימולציה ו-Ansys | 2025 | — | הערכה | SemiAnalysis (משני) |
| נתח שלושת הגדולים | >85% (גלובלי); ≈ 78–80%+ (בסין) | 2024–25 | — | הערכה | SemiAnalysis; Omdia (משני) |
| ‏Design IP | 9.45 מיליארד דולר | 2025 | ‏+12.7% (2024: ‏+20%, ‏8.5 מיליארד) | עובדה (סקר) | IPnest דרך SemiWiki |
| נתחי Design IP | ‏Arm ‏49.4% / ‏SNPS ‏18.5% / ‏CDNS ‏6.4% (ב-2024: ‏SNPS ‏23%) | 2025 | — | סקר | IPnest דרך SemiWiki |
| ‏IP ממשקים | 2.44 מיליארד דולר, ו-4.54 מיליארד ב-2030 [תחזית] | 2025 | ‏CAGR ‏13.2% [תחזית] | סקר / תחזית | SemiWiki (נתח SNPS: ‏57%) |
| שוק השבבים העולמי | ≈ 1.51 טריליון דולר; ≈ 1.9 טריליון ב-2027 | 2026 | ‏+89.9% / ‏+27% | תחזית | WSTS אביב 2026 |
| ‏WFE (ציוד ייצור) | 143.9 מיליארד דולר (2025: ‏116.9) | 2026 | ‏+23.1%, ו-+21.8% ב-2027 | תחזית | SEMI 7/2026 |
| ‏R&D של 20 יצרניות השבבים הגדולות | 98.7 מיליארד דולר | 2024 | ‏+17% | עובדה | TechInsights (משני) |
| ‏EDA סיני מקומי (3 חברות) | ≈ 2+ מיליארד יואן (≈ 0.3 מיליארד דולר [חישוב]) | FY2025 | — | משני | faxiangongchang (אמינות נמוכה) |

### נתוני SNPS רלוונטיים (להקשר)

| מדד | ערך | מקור |
|-----|-----|------|
| הכנסות FY25 | 7,054 מיליון דולר (Ansys תרמה 756.6 מיליון) | 10-K |
| ‏Design IP ב-FY25 | ≈ 1.75 מיליארד דולר (‏−8%) | משני |
| תחזית FY26 | 9.69–9.74 מיליארד דולר (Ansys ≈ 2.98 מיליארד); בלי Ansys ≈ 6.73 מיליארד, לעומת ≈ 6.30 ב-FY25, כלומר ≈ ‏+7% [חישוב גס, כולל השפעת המכירה, לא אורגני] | 8-K |
| ‏Backlog | 10.9 מיליארד דולר (Q3 FY26) | משני |

---

## 4. מה תומך ומה פוגע (סיכום כמותי)

**תומך:**
1. ‏tape-outs ב-N2 (פי ~4 מ-N3) ו-A16 / ‏14A מגדילים את הביקוש ל-EDA ול-IP לכל צומת חדש.
2. ‏ASIC של hyperscalers (משלוחים ‏+~45% [תחזית]) מרחיבים את בסיס הלקוחות.
3. רבעון שיא ב-HAV מבטא את גודל השבבים ומורכבותם.
4. ‏IP ממשקים (נתח ‏57%, ו-CAGR ‏13% [תחזית]).
5. ‏R&D של התעשייה גדל בקצב של ~17% לשנה (2024).
6. מבנה אוליגופולי ועלויות מעבר גבוהות.

**פוגע:**
1. סין: ‏−22% ב-FY25. ההשעיה של כלל ה-affiliates פוקעת ב-10.11.2026. ‏EDA מקומי מתקדם.
2. אובדן נתח ב-design IP ב-2025 (מ-23% ל-18.5%) ותחרות מ-Cadence ו-Qualcomm/Alphawave.
3. חולשת foundry של Intel ו-Samsung.
4. תנאי SAMR ל-10 שנים מגבילים bundling בסין.
5. ‏Cadence צומחת מהר יותר (‏~21% מול צמיחה אורגנית חד-ספרתית גבוהה עד דו-ספרתית נמוכה ב-SNPS).
6. ריבית במגמת עלייה (לחץ על מכפיל).

---

## 5. מקורות (כולם נאספו ב-WebSearch ב-1.11.2026. "ראשוני" = SEC או הודעת חברה/ארגון)

- Synopsys 10-K FY2025 (ראשוני): https://www.sec.gov/Archives/edgar/data/883241/000088324125000028/snps-20251031.htm
- Synopsys 8-K, תוצאות Q3 FY26, ‏26.8.2026 (ראשוני): https://www.sec.gov/Archives/edgar/data/0000883241/000119312526368620/d157153dex991.htm
- Synopsys 10-Q, ‏31.7.2026: מכירת Processor IP (ראשוני): https://www.sec.gov/Archives/edgar/data/0000883241/000088324126000025/snps-20260731.htm
- Synopsys PR, הסכם עם GlobalFoundries, ‏14.1.2026: https://news.synopsys.com/2026-01-14-Synopsys-Enters-Definitive-Agreement-with-GlobalFoundries-For-Sale-of-Processor-IP-Solutions-Business
- MarketBeat, עיקרי שיחת Q3 FY26: https://www.marketbeat.com/instant-alerts/transcript-synopsys-q3-earnings-call-highlights-2026-08-26/
- Yahoo Finance, עיקרי Q3 FY26: https://finance.yahoo.com/markets/stocks/articles/synopsys-q3-earnings-call-highlights-230418702.html
- ConvergeDigest, אזהרת SNPS על חולשת IP: https://convergedigest.com/synopsys-warns-of-continued-ip-weakness-amid-china-and-foundry-headwinds/
- Visible Alpha, תחזית הכנסות SNPS מסין: https://visiblealpha.com/?p=36489
- ESD Alliance, ‏Q2 2026 (ראשוני): https://www.semi.org/en/semi-press-release/electronic-system-design-industry-posts-$5.7-billion-in-revenue-in-q2-2026-esd-alliance-reports
- ESD Alliance, ‏Q1 2026: https://www.semi.org/en/semi-press-release/esd-alliance-reports-electronic-system-design-industry-posts-5.7-billion-dollars-in-revenue-in-q1-2026
- Cadence 8-K, ‏Q3 2026 (ראשוני): https://www.sec.gov/Archives/edgar/data/0000813672/000081367226000116/cdns10262026ex9901.htm
- TIKR על Cadence (backlog): https://www.tikr.com/blog/cadence-soars-6-on-record-8-2-billion-backlog-raising-outlook-for-the-third-time-this-year
- finsee, הערכת סין של Cadence: https://finsee.ai/earnings/cdns/2026/q3/en/
- SemiAnalysis, ‏EDA Market Primer: https://newsletter.semianalysis.com/p/eda-market-primer
- SemiWiki/IPnest, שוק Design IP ב-2025 (9.5 מיליארד דולר): https://semiwiki.com/ip/373010-the-9-5-billion-design-ip-market-shifting-boundaries-arms-monopoly-and-the-risc-v-response/
- SemiWiki/IPnest, ‏IP ממשקים: https://semiwiki.com/ip/370809-consolidation-and-competition-who-is-winning-the-4-5-billion-interface-ip-race/
- SemiWiki/IPnest, ‏Design IP ב-2024: https://semiwiki.com/semiconductor-services/ipnest/354823-design-ip-market-increased-by-all-time-high-20-in-2024/
- The Register, ביטול הגבלות EDA (3.7.2025): https://www.theregister.com/2025/07/03/us_eda_export_ban_lifted/
- TechNode, חידוש האספקה לסין: https://technode.com/2025/07/04/synopsys-cadence-and-siemens-resume-eda-supply-to-china/
- Caixin, ביטול האיסור: https://www.caixinglobal.com/2025-07-03/us-lifts-export-ban-on-chip-design-software-to-china-amid-trade-thaw-102337708.html
- Arnold & Porter, השעיית כלל ה-affiliates: https://www.arnoldporter.com/en/perspectives/blogs/enforcement-edge/2025/11/doc-suspends-enforcement-of-the-affiliates-rule-for-one-year
- DLA Piper, השעיית כלל ה-50%: https://www.dlapiper.com/insights/publications/2025/11/bis-to-suspend-50-percent-ownership-rule
- Schnitger Corp, אישור SAMR ל-Ansys: https://schnitgercorp.com/2025/07/14/china-finally-grants-approval-for-synopsysansys/
- Law360/MLex, תנאי SAMR: https://www.law360.com/mlex/technology/articles/2364096/synopsys-ansys-merger-approved-by-china-s-samr-with-conditions
- TechCrunch, אישור ה-EU: https://techcrunch.com/2025/01/10/eu-approves-35b-synopsys-and-ansys-merger-subject-to-divestment-conditions
- Korea JoongAng Daily, ‏R&D של Samsung (TechInsights): https://www.koreajoongangdaily.com/business/samsung-hikes-rd-spending-a-world-topping-71-percent/12294892
- mobileworldlive, ‏Nvidia ב-R&D ב-2026: https://www.mobileworldlive.com/nvidia/nvidia-tipped-to-top-chipmaker-rd-spending-in-2026
- KrAsia, ‏capex ו-R&D ב-2025 (CEO Score): https://kr-asia.com/semiconductor-investment-rebounds-on-ai-but-not-everyone-is-winning
- Silicon Analysts, עלות תכנון לפי צומת: https://siliconanalysts.com/market-data/nre-design-cost
- Techbang, פירוט עלות 2nm: https://www.techbang.com/posts/112044-how-much-does-it-cost-to-develop-a-2nm-chip
- DigiTimes, ‏tape-outs ב-N2 (7/2026): https://apps.digitimes.com/news/a20260716VL228.html?chid=10
- Guru3D, ‏tape-outs ב-N2: https://www.guru3d.com/story/tsmc-2nm-node-records-fourfold-increase-in-customer-tapeout-activity/
- Tom's Hardware, ‏ASIC מותאמים (5/2026): https://tomshardware.com/tech-industry/semiconductors/custom-ai-asics-examined-from-broadcom-to-mtia
- Introl, ‏custom silicon (בלוג, אמינות נמוכה): https://introl.com/fr/blog/custom-silicon-inflection-2026-hyperscaler-asics-nvidia-gpu
- Tweaktown, ‏Intel 14A: https://www.tweaktown.com/news/111778/intels-14a-node-will-enter-risk-production-in-2028-while-10a-and-7a-nodes-are-on-the-roadmap/index.html
- Not a Tesla App, ‏Intel ו-Tesla: https://notateslaapp.com/news/4887/intel-to-make-mystery-chip-for-tesla-ai6-or-something-new
- Korea Herald, ‏Samsung foundry: https://www.koreaherald.com/article/10727433
- SCMP, ‏Empyrean: https://www.scmp.com/tech/article/3315237/chinas-top-player-empyrean-eyes-opportunities-us-chip-curbs-design-software
- Omdia, ‏China market brief (3/2025): https://omdia.tech.informa.com/om129004/china-semiconductor-market-brief--march-2025
- faxiangongchang, ‏China industrial software 2026 (אמינות נמוכה): https://faxiangongchang.com/en/reports/china-industrial-software-2026
- BusinessWire, ‏Qualcomm השלימה את רכישת Alphawave: https://www.businesswire.com/news/home/20251218292351/en/qualcomm-completes-acquisition-of-alphawave-semi
- WSTS, תחזית אביב 2026 (ראשוני): https://www.wsts.org/esraCMS/extension/media/f/WST/7618/WSTS_FC-Release-2026-May.pdf
- bits-chips, עדכון WSTS: https://bits-chips.com/article/global-semiconductor-market-doubles-in-h1-2026/
- technews.tw, עדכון WSTS (8/2026): https://technews.tw/2026/08/07/global-semiconductor-market-records-exceptional-growth-in-q2-2026/
- SEMI, תחזית ציוד (7/2026, ראשוני): https://www.semi.org/en/semi-press-release/global-semiconductor-equipment-sales-forecast-to-reach-a-record-229-billion-dollars-in-2028-semi-reports
- Admiral Markets, ‏FOMC אוקטובר 2026 (משני): https://admiralmarkets.com/analytics/traders-blog/fomc-october-2026-fed-holds-rates
- InvestingLive, החלטת ה-FOMC (28.10): https://investinglive.com/central-banks/fomc-decision-oct-28/
- Siemens, תוצאות Q2 FY25 (EDA חלש): https://press.siemens.com/global/en/pressrelease/successful-second-quarter-outlook-confirmed

**פערים פתוחים לאימות:** שיעור הכנסות SNPS מסין ב-FY25 בדולרים (טבלת הגיאוגרפיה ב-10-K); זהות "לקוח ה-foundry המרכזי"; נתוני multi-die ו-UCIe; החלטת BIS לגבי כלל ה-affiliates אחרי 10.11.2026; אימות החלטת הפד מול federalreserve.gov; ההכנסות המלאות של Siemens EDA ב-FY25.
