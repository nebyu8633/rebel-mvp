#!/usr/bin/env python3
"""
Agent E - Synopsys (SNPS) valuation model.
Valuation date: 2026-11-01 (start of FY2027; SNPS fiscal year ends ~Oct 31).
Price: last close Fri 2026-10-30 = $467.61 (Yahoo/Gurufocus/Trefis via WebSearch snippets).

All $ figures in USD billions unless noted; per-share in USD.
Labels: [R] reported, [G] company guidance, [D] derived by this script, [A] analyst assumption.
Run: python3 -I valuation_model.py > valuation_model_output.txt
Pure standard library; no external data access.
"""

import math

# ----------------------------------------------------------------------------
# 1. INPUTS
# ----------------------------------------------------------------------------
PRICE = 467.61                 # [R] close 2026-10-30
PRICE_DATE = "2026-10-30"
MKT_CAP_SRC = 89.61            # [R] market cap quoted in same snippet (basic shares basis)

# Diluted shares: Q3 FY26 non-GAAP NI / non-GAAP EPS  (752.5M / 3.91)
Q_NONGAAP = {  # quarter: (non-GAAP NI $M, non-GAAP EPS)
    "Q1FY26": (718.5, 3.77),
    "Q2FY26": (643.7, 3.35),
    "Q3FY26": (752.5, 3.91),
}
DIL_SHARES = Q_NONGAAP["Q3FY26"][0] / Q_NONGAAP["Q3FY26"][1] / 1000.0   # [D] bn shares

CASH = 3.61                    # [R] cash & ST investments, 2026-07-31 (Q3 FY26)
DEBT = 10.037                  # [R] total debt, 2026-07-31 (Q3 FY26 financial supplement)
NET_DEBT = DEBT - CASH         # [D]

# Quarterly reported (TTM = Q4FY25..Q3FY26)
Q_REV = {"Q4FY25": 2.255, "Q1FY26": 2.409, "Q2FY26": 2.276, "Q3FY26": 2.477}       # [R]
Q_GAAP_EPS = {"Q4FY25": 2.39, "Q1FY26": 0.34, "Q2FY26": 0.09, "Q3FY26": 2.84}      # [R]
Q_NG_EPS = {"Q4FY25": 2.90, "Q1FY26": 3.77, "Q2FY26": 3.35, "Q3FY26": 3.91}        # [R]

FY25 = dict(rev=7.054, gaap_eps=8.07, ng_eps=12.91)                                  # [R]

# FY26 guidance (raised 2026-08-26). FY26 ended ~2026-10-31 => near-LTM proxy, not yet reported.
FY26 = dict(
    rev=(9.690 + 9.740) / 2,   # [G]
    ng_eps=(15.04 + 15.10) / 2,  # [G]
    gaap_eps=(3.84 + 4.08) / 2,  # [G]
    ng_op_margin=0.415,        # [G] ~41.5% midpoint
    ocf=2.8, fcf=2.6,          # [G] approx
    sbc=0.945,                 # [D] 9M SBC 712.6M [R] + Q4 ~232M [A] (~$4.90-4.95/sh guide)
    amort=1.6125,              # [G] acquired-intangible amortization 1,610-1,615M
    dep=0.22,                  # [A] PP&E depreciation (not disclosed in gathered sources)
)
# FY27 guidance (Investor Day 2026-09-30)
FY27 = dict(
    rev=11.15,                 # [G] 11.10-11.20
    ng_eps=(19.04 + 19.12) / 2,  # [G]
    gaap_eps=(8.16 + 8.61) / 2,  # [G]
    ng_op_margin=0.44,         # [G]
    gaap_op_margin=0.207,      # [G]
    ocf=3.6, capex=0.5, fcf=3.1,  # [G] approx
    sbc=1.00,                  # [A] ~9% of revenue
    dep=0.25,                  # [A]
)
FY27_CONS_PRE_GUIDE = dict(rev=(10.73, 10.81), ng_eps=(16.78, 17.81))  # [R] pre-Investor-Day consensus range across providers

INT_RATE_PRETAX = 0.045        # [A] blended cost of existing debt
TAX = 0.17                     # [A] cash/non-GAAP tax rate approx

# ----------------------------------------------------------------------------
def hr(t):
    print("\n" + "=" * 78)
    print(t)
    print("=" * 78)


def fmt(x, d=2):
    return f"{x:,.{d}f}"


hr("1. INPUTS")
mcap = PRICE * DIL_SHARES
ev = mcap + NET_DEBT
print(f"Price ({PRICE_DATE} close)              : ${PRICE}")
print(f"Diluted shares (Q3FY26, derived)        : {DIL_SHARES*1000:.1f} M")
print(f"Implied basic shares from quoted mcap   : {MKT_CAP_SRC/PRICE*1000:.1f} M")
print(f"Diluted market cap                      : ${fmt(mcap)} bn")
print(f"Cash & ST inv (2026-07-31)              : ${CASH} bn")
print(f"Total debt (2026-07-31)                 : ${DEBT} bn")
print(f"Net debt                                : ${fmt(NET_DEBT)} bn")
print(f"Enterprise value                        : ${fmt(ev)} bn")

ttm_rev = sum(Q_REV.values())
ttm_gaap = sum(Q_GAAP_EPS.values())
ttm_ng = sum(Q_NG_EPS.values())
print(f"\nTTM (Q4FY25-Q3FY26) revenue            : ${fmt(ttm_rev,3)} bn")
print(f"TTM GAAP EPS                            : ${fmt(ttm_gaap)} (Q3 incl. ~$425M pre-tax Processor IP gain)")
print(f"TTM non-GAAP EPS                        : ${fmt(ttm_ng)}")

for name, d in (("FY26E (guide)", FY26), ("FY27E (guide)", FY27)):
    ng_ebit = d["rev"] * d["ng_op_margin"]
    d["ng_ebit"] = ng_ebit
    d["adj_ebitda"] = ng_ebit + d["dep"]
    if "gaap_op_margin" in d:
        d["gaap_ebit"] = d["rev"] * d["gaap_op_margin"]
    else:
        # upper bound: excludes acquisition/restructuring/other GAAP items
        d["gaap_ebit"] = ng_ebit - d["sbc"] - d["amort"]
    d["gaap_ebitda_approx"] = d["gaap_ebit"] + d["dep"] + (d.get("amort", 1.61))
    print(f"\n{name}: rev ${fmt(d['rev'],3)}bn | non-GAAP EBIT ${fmt(ng_ebit)}bn "
          f"| adj. EBITDA ${fmt(d['adj_ebitda'])}bn | GAAP EBIT ~${fmt(d['gaap_ebit'])}bn "
          f"| GAAP EBITDA ~${fmt(d['gaap_ebitda_approx'])}bn")
    print(f"   non-GAAP EPS ${fmt(d['ng_eps'])} | GAAP EPS ${fmt(d['gaap_eps'])} "
          f"| FCF ${d['fcf']}bn | SBC ~${d['sbc']}bn | FCF-SBC ${fmt(d['fcf']-d['sbc'])}bn")
print("\nNote: FY26 GAAP EBIT = non-GAAP EBIT - SBC - amortization (excludes other GAAP charges => upper bound).")
print(f"FY27 pre-guidance consensus range: rev {FY27_CONS_PRE_GUIDE['rev']} bn; non-GAAP EPS {FY27_CONS_PRE_GUIDE['ng_eps']}")

# ----------------------------------------------------------------------------
hr("2. MULTIPLES AT CURRENT PRICE")
rows = [
    ("P/E GAAP TTM", PRICE / ttm_gaap),
    ("P/E GAAP FY26E", PRICE / FY26["gaap_eps"]),
    ("P/E GAAP FY27E", PRICE / FY27["gaap_eps"]),
    ("P/E non-GAAP TTM", PRICE / ttm_ng),
    ("P/E non-GAAP FY26E", PRICE / FY26["ng_eps"]),
    ("P/E non-GAAP FY27E", PRICE / FY27["ng_eps"]),
    ("EV/Revenue TTM", ev / ttm_rev),
    ("EV/Revenue FY26E", ev / FY26["rev"]),
    ("EV/Revenue FY27E", ev / FY27["rev"]),
    ("EV/non-GAAP EBIT FY26E", ev / FY26["ng_ebit"]),
    ("EV/non-GAAP EBIT FY27E", ev / FY27["ng_ebit"]),
    ("EV/GAAP EBIT FY26E (approx)", ev / FY26["gaap_ebit"]),
    ("EV/GAAP EBIT FY27E", ev / FY27["gaap_ebit"]),
    ("EV/adj. EBITDA FY26E", ev / FY26["adj_ebitda"]),
    ("EV/adj. EBITDA FY27E", ev / FY27["adj_ebitda"]),
    ("EV/(GAAP EBITDA) FY27E approx", ev / FY27["gaap_ebitda_approx"]),
]
for k, v in rows:
    print(f"{k:34s}: {v:6.1f}x")
for name, d in (("FY26E", FY26), ("FY27E", FY27)):
    print(f"FCF yield {name}                   : {d['fcf']/mcap*100:5.2f}%  | (FCF-SBC) yield: {(d['fcf']-d['sbc'])/mcap*100:5.2f}%")
eps_g_27 = FY27["ng_eps"] / FY26["ng_eps"] - 1
print(f"\nNon-GAAP EPS growth FY27/FY26 (guide): {eps_g_27*100:.1f}%")
for lt_g in (0.15, 0.18, 0.20):
    print(f"PEG (FY27 P/E / assumed {lt_g*100:.0f}% LT EPS CAGR) : {PRICE/FY27['ng_eps']/(lt_g*100):.2f}")
print(f"EV/non-GAAP EBIT FY27 / revenue growth 15% (x per pt): {ev/FY27['ng_ebit']/15:.2f}")

# ----------------------------------------------------------------------------
hr("3. PEERS (APPROXIMATE, UNVERIFIED AT VALUATION DATE - see md)")
# Values are approximate ranges from analyst background knowledge (pre mid-2026), NOT
# verified at 2026-10-30 because web-search budget was exhausted. Midpoints used only for
# illustrative growth-adjusted comparison.
peers = [
    # name, fwd P/E range, NTM rev growth, non-GAAP op margin, net debt/EBITDA
    ("CDNS", (40, 50), 0.13, 0.44, "net cash"),
    ("ARM", (70, 100), 0.20, 0.45, "net cash"),
    ("ADSK", (26, 32), 0.11, 0.38, "~0.5x"),
    ("PTC", (24, 30), 0.09, 0.46, "~1x"),
    ("DSY", (20, 26), 0.06, 0.32, "~0x"),
]
print(f"{'Peer':6s}{'fwdPE lo-hi':>14s}{'mid':>6s}{'growth':>8s}{'margin':>8s}{'PE/growth':>11s}{'lev':>10s}")
for n, (lo, hi), g, m, lev in peers:
    mid = (lo + hi) / 2
    print(f"{n:6s}{lo:>8d}-{hi:<5d}{mid:>6.0f}{g*100:>7.0f}%{m*100:>7.0f}%{mid/(g*100):>11.2f}{lev:>10s}")
snps_pe27 = PRICE / FY27["ng_eps"]
print(f"{'SNPS':6s}{'':>14s}{snps_pe27:>6.1f}{15:>7.0f}%{44:>7.0f}%{snps_pe27/15:>11.2f}{NET_DEBT/FY27['adj_ebitda']:>9.1f}x")
print("ANSS take-out (2024 announce): ~$35bn EV ~ 15x trailing revenue, ~35-38x trailing non-GAAP EBIT (approx).")
print(f"Implied SNPS price at CDNS-like 40-50x FY27 non-GAAP EPS: "
      f"${40*FY27['ng_eps']:.0f}-${50*FY27['ng_eps']:.0f} (CDNS warrants premium: net cash, purer EDA)")
for disc in (0.25, 0.35):
    pe = 45 * (1 - disc)
    print(f"  At {disc*100:.0f}% discount to CDNS mid (45x) -> {pe:.1f}x -> ${pe*FY27['ng_eps']:.0f}")

# ----------------------------------------------------------------------------
# 4. SCENARIO DCF
# ----------------------------------------------------------------------------
YEARS = list(range(2027, 2037))  # FY27..FY36 (10 years)
BASE_REV = FY26["rev"]


def build(growth, margin, sbc_pct, conv):
    """Return per-year dicts. conv = unlevered FCF (pre-SBC deduction) / non-GAAP EBIT."""
    out = []
    rev = BASE_REV
    for i, y in enumerate(YEARS):
        rev = rev * (1 + growth[i])
        ebit = rev * margin[i]
        ufcf = ebit * conv[i]                 # unlevered FCF as companies report it (SBC added back)
        sbc = rev * sbc_pct[i]
        out.append(dict(y=y, rev=rev, g=growth[i], m=margin[i], ebit=ebit,
                        ufcf=ufcf, sbc=sbc, ufcf_sbc=ufcf - sbc))
    return out


def interp(a, b, n):
    return [a + (b - a) * i / (n - 1) for i in range(n)]


SCEN = {
    "bear": dict(
        growth=[0.09, 0.08, 0.07, 0.065, 0.06, 0.055, 0.05, 0.045, 0.04, 0.035],
        margin=[0.42, 0.43, 0.44, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.45],
        sbc=[0.095] * 3 + [0.09] * 7,
        conv=[0.70] * 10,
        wacc=0.095, g=0.03, exit_ebit=15.0,
        note="FY27 misses guide (9%); Ansys revenue synergies largely fail; China/export & IP weakness; "
             "margin peaks 45% (vs 50% target); SBC stays ~9%"),
    "base": dict(
        growth=[0.148, 0.13, 0.12, 0.11, 0.10, 0.09, 0.08, 0.07, 0.06, 0.055],
        margin=[0.44, 0.46, 0.475, 0.49, 0.49, 0.49, 0.49, 0.49, 0.49, 0.49],
        sbc=interp(0.09, 0.07, 10),
        conv=interp(0.71, 0.75, 10),
        wacc=0.09, g=0.035, exit_ebit=19.0,
        note="FY27 = guidance; ~$0.4bn Ansys revenue synergies phased in by FY30 within 11-13% growth; "
             "cost synergies get margin to ~49% (just below 50% FY30 target); SBC fades 9%->7%"),
    "bull": dict(
        growth=[0.16, 0.16, 0.15, 0.14, 0.12, 0.11, 0.10, 0.09, 0.08, 0.07],
        margin=[0.445, 0.47, 0.49, 0.51, 0.52, 0.52, 0.52, 0.52, 0.52, 0.52],
        sbc=interp(0.09, 0.065, 10),
        conv=interp(0.72, 0.77, 10),
        wacc=0.085, g=0.04, exit_ebit=23.0,
        note="AI-driven chip design demand + full synergy capture; beats 50% margin target; SBC fades to 6.5%"),
}


def dcf(rows, wacc, g, net_debt=NET_DEBT, shares=DIL_SHARES, use_sbc=True,
        exit_mult=None, dilution=0.0):
    """Mid-year discounting from 2026-11-01. If use_sbc False -> FCF pre-SBC with share dilution."""
    key = "ufcf_sbc" if use_sbc else "ufcf"
    pv = 0.0
    for i, r in enumerate(rows):
        t = i + 0.5
        pv += r[key] / (1 + wacc) ** t
    n = len(rows)
    last = rows[-1]
    if exit_mult is None:
        tv = last[key] * (1 + g) / (wacc - g)
    else:
        tv = last["ebit"] * exit_mult
        if use_sbc:
            pass  # exit multiple applied to non-GAAP EBIT is the market's (SBC-inclusive) convention
    pv_tv = tv / (1 + wacc) ** n
    ev_ = pv + pv_tv
    eq = ev_ - net_debt
    sh = shares * (1 + dilution) ** n if not use_sbc else shares
    # dilution: when SBC NOT deducted, approximate dilution by growing share count;
    # we value per *future* share at end of horizon - conservative simplification.
    return dict(ev=ev_, pv_fcf=pv, pv_tv=pv_tv, tv_share=pv_tv / ev_, eq=eq, ps=eq / sh)


hr("4. SCENARIO DCF (FY27-FY36, mid-year, valuation 2026-11-01)")
results = {}
for name, s in SCEN.items():
    rows = build(s["growth"], s["margin"], s["sbc"], s["conv"])
    s["rows"] = rows
    print(f"\n--- {name.upper()} --- {s['note']}")
    print(f"WACC {s['wacc']*100:.1f}% | terminal g {s['g']*100:.1f}% | exit EV/non-GAAP EBIT {s['exit_ebit']}x")
    print(f"{'FY':>5}{'Rev':>8}{'g%':>6}{'OpM%':>6}{'EBIT':>7}{'uFCF':>7}{'SBC':>6}{'uFCF-SBC':>9}{'FCF-SBC m%':>11}")
    for r in rows:
        print(f"{r['y']:>5}{r['rev']:>8.2f}{r['g']*100:>6.1f}{r['m']*100:>6.1f}{r['ebit']:>7.2f}"
              f"{r['ufcf']:>7.2f}{r['sbc']:>6.2f}{r['ufcf_sbc']:>9.2f}{r['ufcf_sbc']/r['rev']*100:>11.1f}")
    rev_cagr = (rows[4]["rev"] / BASE_REV) ** (1 / 4) - 1
    print(f"Revenue CAGR FY26-FY30: {rev_cagr*100:.1f}% | FY30 rev ${rows[3]['rev']:.2f}bn")
    a = dcf(rows, s["wacc"], s["g"])                                   # Gordon, FCF-SBC
    b = dcf(rows, s["wacc"], s["g"], exit_mult=s["exit_ebit"])         # exit multiple, FCF-SBC flows
    c = dcf(rows, s["wacc"], s["g"], use_sbc=False, dilution=0.015)    # FCF pre-SBC + 1.5%/yr dilution
    d_ = dcf(rows, s["wacc"], s["g"], use_sbc=False, dilution=0.0)     # FCF pre-SBC, no dilution (aggressive)
    for lbl, r in (("A Gordon, FCF-SBC (primary)", a), ("B Exit multiple, FCF-SBC flows", b),
                   ("C Gordon, FCF pre-SBC, 1.5%/yr dilution", c),
                   ("D Gordon, FCF pre-SBC, no dilution (NOT used)", d_)):
        print(f"  {lbl:45s} EV ${r['ev']:7.1f}bn | TV share {r['tv_share']*100:4.0f}% | equity ${r['eq']:7.1f}bn"
              f" | ${r['ps']:7.0f}/sh | vs price {(r['ps']/PRICE-1)*100:+5.0f}%")
    blend = (a["ps"] + b["ps"]) / 2
    print(f"  Blended (A+B)/2: ${blend:.0f}/sh  vs price {(blend/PRICE-1)*100:+.0f}%")
    implied_g = (a["ev"] * 0 + 0)  # placeholder
    tv_impl_mult = a["pv_tv"] * (1 + s["wacc"]) ** 10 / rows[-1]["ebit"]
    print(f"  Gordon TV implies {tv_impl_mult:.1f}x FY36 non-GAAP EBIT")
    results[name] = dict(A=a["ps"], B=b["ps"], C=c["ps"], blend=blend)

pw = {"bear": 0.25, "base": 0.5, "bull": 0.25}
pwv = sum(results[k]["blend"] * w for k, w in pw.items())
print(f"\nProbability-weighted (25/50/25) blended value: ${pwv:.0f}/sh vs price {(pwv/PRICE-1)*100:+.0f}%")

# ----------------------------------------------------------------------------
hr("5. SENSITIVITIES (per-share, FCF-SBC basis, base scenario unless noted)")
base = SCEN["base"]

print("\n5a. Revenue growth shift (pp applied to every year) x terminal non-GAAP op margin (Gordon, WACC 9%, g 3.5%)")
gshifts = [-0.04, -0.02, 0.0, 0.02, 0.04]
margins = [0.42, 0.45, 0.49, 0.52, 0.55]
print(f"{'g shift':>9}" + "".join(f"{m*100:>8.0f}%" for m in margins))
for gs in gshifts:
    line = f"{gs*100:>+8.0f}p"
    for mt in margins:
        mpath = [0.44 + (mt - 0.44) * min(1, i / 3) for i in range(10)]
        rows = build([x + gs for x in base["growth"]], mpath, base["sbc"], base["conv"])
        line += f"{dcf(rows, 0.09, 0.035)['ps']:>9.0f}"
    print(line)

print("\n5b. WACC x terminal growth (Gordon, base cash flows)")
waccs = [0.08, 0.085, 0.09, 0.095, 0.10, 0.105]
gs = [0.025, 0.03, 0.035, 0.04, 0.045]
print(f"{'WACC':>7}" + "".join(f"{g*100:>8.1f}%" for g in gs))
for w in waccs:
    print(f"{w*100:>6.1f}%" + "".join(f"{dcf(base['rows'], w, g)['ps']:>9.0f}" for g in gs))

print("\n5c. Exit EV/non-GAAP EBIT multiple (FY36) x discount rate (base cash flows)")
mults = [13, 16, 19, 22, 25]
print(f"{'WACC':>7}" + "".join(f"{m:>8d}x" for m in mults))
for w in waccs:
    print(f"{w*100:>6.1f}%" + "".join(f"{dcf(base['rows'], w, 0.035, exit_mult=m)['ps']:>9.0f}" for m in mults))

print("\n5d. Price-implied check (NOT used to set assumptions): uniform growth shift that makes base Gordon = price")
lo, hi = -0.10, 0.10
for _ in range(60):
    mid = (lo + hi) / 2
    rows = build([x + mid for x in base["growth"]], base["margin"], base["sbc"], base["conv"])
    if dcf(rows, 0.09, 0.035)["ps"] > PRICE:
        hi = mid
    else:
        lo = mid
rows = build([x + mid for x in base["growth"]], base["margin"], base["sbc"], base["conv"])
cagr = (rows[9]["rev"] / BASE_REV) ** 0.1 - 1
print(f"   growth shift {mid*100:+.1f}pp/yr -> 10y revenue CAGR {cagr*100:.1f}% (base path CAGR "
      f"{((base['rows'][9]['rev']/BASE_REV)**0.1-1)*100:.1f}%)")

print("\n5e. Per-share base value vs alternative prices (in case price data is disputed)")
for p in (420, 450, 467.61, 490, 520):
    mc = p * DIL_SHARES
    print(f"   price ${p:>7.2f}: EV ${mc+NET_DEBT:6.1f}bn | FY27 P/E {p/FY27['ng_eps']:4.1f}x | "
          f"FY27 EV/EBIT {(mc+NET_DEBT)/FY27['ng_ebit']:4.1f}x | base blend gap {(results['base']['blend']/p-1)*100:+.0f}%")
