#!/usr/bin/env python3
"""BRZE valuation model (Agent 3). Valuation date 2026-10-31 (last close Fri 2026-10-30).

All money in USD millions except per-share figures. Fiscal year ends Jan 31
(FY28 = Feb 2027 - Jan 2028). Run: python3 -I valuation_model.py
Every input is tagged in INPUTS with its source; see 03-valuation.md.
"""
import math

# ----------------------------------------------------------------------------
# 1. INPUTS (reported = company filing/release as relayed by secondary search;
#    calc = computed here; est = analyst assumption)
# ----------------------------------------------------------------------------
PRICE = 45.75            # close 2026-10-30 (Yahoo/CNN via web search; secondary)
DEAL_PRICE = 47.50       # Salesforce all-cash offer, announced 2026-10-20 (reported)
DEAL_EV = 5660.0         # deal enterprise value as announced (reported)
UNDISTURBED = 30.04      # close 2026-10-19, day before announcement (secondary)

BASIC_SHARES = 113.584   # Class A outstanding 2026-09-01, 10-Q cover (reported)
WAVG_DILUTED_NG = 114.2  # Q2 FY27 non-GAAP diluted weighted avg (reported)
CASH = 413.9             # cash+equivalents+restricted+marketable sec. 2026-07-31 (reported)
DEBT = 0.0               # no borrowings found (est; leases excluded) -- verify in 10-Q

# Quarterly revenue (reported)
Q = {"Q1FY26": 162.1, "Q2FY26": 180.1, "Q3FY26": 190.8, "Q4FY26": 205.2,
     "Q1FY27": 211.0, "Q2FY27": 227.2}
Q3FY27_GUIDE = 229.5     # midpoint of 229-230 (reported guidance)
FY27_GUIDE = 911.5       # midpoint of 910-913 (reported guidance)
GAAP_GM_Q2 = 0.668       # Q2 FY27 GAAP gross margin (reported); applied to TTM (est)
NG_GM_Q2 = 0.686
# FCF (reported): FY26 58.1; Q1FY26 22.9; Q2FY26 3.5; Q1FY27 26.8; Q2FY27 21.7
FCF_FY26, FCF_Q1FY26, FCF_Q2FY26, FCF_Q1FY27, FCF_Q2FY27 = 58.1, 22.9, 3.5, 26.8, 21.7
SBC_FY26, SBC_Q2FY27 = 144.9, 35.7  # reported
NG_OPINC_FY27_GUIDE = 76.0          # midpoint 75.5-76.5 (reported)

# ----------------------------------------------------------------------------
# 2. Derived share count, EV, multiples
# ----------------------------------------------------------------------------
FD_DEAL = (DEAL_EV + CASH - DEBT) / DEAL_PRICE  # deal-implied fully diluted (calc)

ttm_rev = Q["Q3FY26"] + Q["Q4FY26"] + Q["Q1FY27"] + Q["Q2FY27"]
fy26_rev = Q["Q1FY26"] + Q["Q2FY26"] + Q["Q3FY26"] + Q["Q4FY26"]
q4fy27_implied = FY27_GUIDE - Q["Q1FY27"] - Q["Q2FY27"] - Q3FY27_GUIDE
NTM_G_EST = 0.22  # est y/y growth for Q1-Q2 FY28 (decel from 26%)
ntm_rev = (Q3FY27_GUIDE + q4fy27_implied + Q["Q1FY27"] * (1 + NTM_G_EST)
           + Q["Q2FY27"] * (1 + NTM_G_EST))
ttm_fcf = (FCF_FY26 - FCF_Q1FY26 - FCF_Q2FY26) + FCF_Q1FY27 + FCF_Q2FY27
ttm_gp_gaap = ttm_rev * GAAP_GM_Q2


def ev_at(price, shares):
    return price * shares - CASH + DEBT


def section(t):
    print("\n" + "=" * 78 + "\n" + t + "\n" + "=" * 78)


section("1. INPUTS & DERIVED")
print(f"Price (2026-10-30 close)            {PRICE:10.2f}")
print(f"Deal price / spread to price        {DEAL_PRICE:10.2f}  spread {DEAL_PRICE/PRICE-1:6.2%}")
print(f"Basic shares (2026-09-01)           {BASIC_SHARES:10.3f}M")
print(f"Non-GAAP diluted wavg Q2 FY27       {WAVG_DILUTED_NG:10.3f}M")
print(f"Deal-implied FD shares (calc)       {FD_DEAL:10.3f}M  =(5660+413.9)/47.50")
print(f"Cash & mkt sec (2026-07-31)         {CASH:10.1f}   debt {DEBT:.1f}")
print(f"FY26 revenue (sum of quarters)      {fy26_rev:10.1f}")
print(f"TTM revenue (Q3FY26-Q2FY27)         {ttm_rev:10.1f}")
print(f"Implied Q4 FY27 rev (guide mid)     {q4fy27_implied:10.1f}  y/y {q4fy27_implied/Q['Q4FY26']-1:6.2%}")
print(f"FY27 guide midpoint                 {FY27_GUIDE:10.1f}  y/y {FY27_GUIDE/fy26_rev-1:6.2%}")
print(f"NTM revenue est (Q3FY27-Q2FY28)     {ntm_rev:10.1f}  (Q1-Q2 FY28 at +{NTM_G_EST:.0%})")
print(f"TTM GAAP gross profit (est @66.8%)  {ttm_gp_gaap:10.1f}")
print(f"TTM FCF                             {ttm_fcf:10.1f}  margin {ttm_fcf/ttm_rev:6.2%}")
print(f"FY26 SBC / revenue                  {SBC_FY26/fy26_rev:10.2%}   Q2FY27 SBC/rev {SBC_Q2FY27/Q['Q2FY27']:6.2%}")
print(f"TTM FCF - SBC (SBC est: FY26 H2 ~{SBC_FY26/2:.0f} + Q1 ~36 + Q2 35.7)")
ttm_sbc_est = SBC_FY26 / 2 + 36.0 + SBC_Q2FY27  # Q1FY27 SBC not found -> est 36
print(f"   TTM SBC est {ttm_sbc_est:.1f}; FCF-SBC {ttm_fcf-ttm_sbc_est:.1f} ({(ttm_fcf-ttm_sbc_est)/ttm_rev:.1%})")

section("2. MULTIPLES AT MARKET PRICE (two share counts)")
for label, sh in (("basic 113.6M", BASIC_SHARES), ("deal-FD 127.9M", FD_DEAL)):
    mc = PRICE * sh
    ev = ev_at(PRICE, sh)
    print(f"[{label}] MktCap {mc:8.0f}  EV {ev:8.0f}")
    print(f"   EV/TTM rev {ev/ttm_rev:5.2f}x | EV/FY27 guide {ev/FY27_GUIDE:5.2f}x | EV/NTM {ev/ntm_rev:5.2f}x"
          f" | EV/TTM GP {ev/ttm_gp_gaap:5.2f}x | P/S TTM {mc/ttm_rev:5.2f}x | EV/TTM FCF {ev/ttm_fcf:5.1f}x"
          f" | EV/FY27 NG EBIT {ev/NG_OPINC_FY27_GUIDE:5.1f}x")
print("Deal (EV 5660): EV/TTM {:.2f}x  EV/FY27 {:.2f}x  EV/NTM {:.2f}x  EV/TTM GP {:.2f}x".format(
    DEAL_EV/ttm_rev, DEAL_EV/FY27_GUIDE, DEAL_EV/ntm_rev, DEAL_EV/ttm_gp_gaap))
ev_und = ev_at(UNDISTURBED, FD_DEAL)
ev_und_b = ev_at(UNDISTURBED, BASIC_SHARES)
print(f"Undisturbed $30.04: EV {ev_und_b:.0f}-{ev_und:.0f}, EV/NTM {ev_und_b/ntm_rev:.2f}-{ev_und/ntm_rev:.2f}x")
print("Implied multiple by price (deal-FD shares):")
for p in (30, 35, 40, 45.75, 47.5, 55):
    ev = ev_at(p, FD_DEAL)
    print(f"   ${p:6.2f}: EV {ev:7.0f}  EV/TTM {ev/ttm_rev:4.2f}x  EV/NTM {ev/ntm_rev:4.2f}x")

# Peer table (secondary, mixed dates -- see md)
section("3. PEERS: growth-adjusted EV/NTM revenue")
peers = [  # (ticker, EV/NTM rev, growth, source/date)
    ("KVYO", 2.8, 0.213, "Scalar Aug-2026"),
    ("HUBS", 2.8, 0.165, "Scalar Aug-2026 (TIKR ~Oct-20: 2.70x)"),
    ("TWLO", 4.8, 0.126, "Scalar Aug-2026"),
    ("CXM", 1.3, None, "Scalar Aug-2026 (growth n/a)"),
    ("ADBE", 3.43, None, "TIKR ~Oct-2026 fwd (growth n/a)"),
]
for t, m, g, s in peers:
    ga = f"{m/(g*100):.3f}" if g else "  n/a"
    print(f"{t:5s} EV/NTM {m:4.2f}x growth {('%.1f%%' % (g*100)) if g else ' n/a '}  EV/NTM/g {ga}  [{s}]")
brze_g = ntm_rev / ttm_rev - 1
ev_mkt = ev_at(PRICE, FD_DEAL)
print(f"BRZE  EV/NTM {ev_mkt/ntm_rev:4.2f}x growth {brze_g:.1%} EV/NTM/g {ev_mkt/ntm_rev/(brze_g*100):.3f} (at market, deal-FD)")
print(f"BRZE undisturbed EV/NTM {ev_und/ntm_rev:4.2f}x  EV/NTM/g {ev_und/ntm_rev/(brze_g*100):.3f}")
med_ga = sorted([m/(g*100) for _, m, g, _ in peers if g])[1]
print(f"Peer median growth-adj (3 names) {med_ga:.3f} -> BRZE at that ratio: EV/NTM {med_ga*brze_g*100:.2f}x"
      f" -> per share {(med_ga*brze_g*100*ntm_rev + CASH)/FD_DEAL:.2f} (FD) / {(med_ga*brze_g*100*ntm_rev + CASH)/BASIC_SHARES:.2f} (basic)")

# ----------------------------------------------------------------------------
# 4. Scenario model + DCF
# ----------------------------------------------------------------------------
YEARS = ["FY28", "FY29", "FY30", "FY31", "FY32"]
# cash-flow mid-points in years from 2026-10-31 (FY28 mid = 2027-07-31)
T_MID = [0.75 + i for i in range(5)]
T_END = 5.25  # 2032-01-31, end FY32

SCEN = {
    "bear": dict(g=[0.17, 0.15, 0.13, 0.11, 0.10], fcf=[0.11, 0.13, 0.15, 0.17, 0.18],
                 sbc=[0.16, 0.15, 0.14, 0.13, 0.12], dil=0.030, exit=2.5, wacc=0.110, tg=0.030),
    "base": dict(g=[0.21, 0.19, 0.17, 0.15, 0.13], fcf=[0.12, 0.155, 0.19, 0.22, 0.25],
                 sbc=[0.15, 0.135, 0.12, 0.105, 0.09], dil=0.025, exit=4.0, wacc=0.100, tg=0.035),
    "bull": dict(g=[0.25, 0.23, 0.21, 0.19, 0.17], fcf=[0.13, 0.17, 0.21, 0.25, 0.29],
                 sbc=[0.14, 0.12, 0.105, 0.09, 0.08], dil=0.020, exit=5.5, wacc=0.095, tg=0.040),
}


def project(g, base_rev=FY27_GUIDE):
    revs, r = [], base_rev
    for x in g:
        r *= 1 + x
        revs.append(r)
    return revs


def cagr(revs, base=FY27_GUIDE):
    return (revs[-1] / base) ** (1 / len(revs)) - 1


def dcf(revs, fcf_m, sbc_m, wacc, tg, deduct_sbc=True):
    """Gordon DCF on FCF (optionally minus SBC). Returns EV."""
    pv, last = 0.0, None
    for r, f, s, t in zip(revs, fcf_m, sbc_m, T_MID):
        cf = r * (f - (s if deduct_sbc else 0.0))
        pv += cf / (1 + wacc) ** t
        last = cf
    tv = last * (1 + tg) / (wacc - tg)
    pv_tv = tv / (1 + wacc) ** T_END  # TV at end FY32 (conservative vs mid-year)
    return pv + pv_tv, pv_tv


def exit_value(revs, fcf_m, g_next, mult, dil, ke, shares):
    """Future equity/share at end FY32 = (mult x FY33 rev + cash + cum FCF) /
    (shares grown at dil), discounted at ke. FCF is pre-SBC; SBC enters via dilution."""
    cum_fcf = sum(r * f for r, f in zip(revs, fcf_m))
    ev_exit = mult * revs[-1] * (1 + g_next)
    eq = ev_exit + CASH + cum_fcf - DEBT
    sh = shares * (1 + dil) ** 5
    fut = eq / sh
    return fut / (1 + ke) ** T_END, fut, ev_exit, cum_fcf


section("4. SCENARIOS (FY27 base = guide midpoint 911.5)")
results = {}
for name, s in SCEN.items():
    revs = project(s["g"])
    c = cagr(revs)
    print(f"\n--- {name.upper()} --- rev CAGR FY27-32 {c:.1%}; WACC/ke {s['wacc']:.1%}; tg {s['tg']:.1%};"
          f" exit {s['exit']}x NTM rev; dilution {s['dil']:.1%}/yr")
    print("      " + "".join(f"{y:>9s}" for y in YEARS))
    print("Rev   " + "".join(f"{r:9.0f}" for r in revs))
    print("g     " + "".join(f"{x:9.1%}" for x in s["g"]))
    print("FCF%  " + "".join(f"{x:9.1%}" for x in s["fcf"]))
    print("SBC%  " + "".join(f"{x:9.1%}" for x in s["sbc"]))
    print("FCF   " + "".join(f"{r*f:9.0f}" for r, f in zip(revs, s["fcf"])))
    print("F-SBC " + "".join(f"{r*(f-b):9.0f}" for r, f, b in zip(revs, s["fcf"], s["sbc"])))
    row = {}
    for lab, sh in (("FD", FD_DEAL), ("basic", BASIC_SHARES)):
        ev_a, tv_a = dcf(revs, s["fcf"], s["sbc"], s["wacc"], s["tg"], True)
        ev_b, _ = dcf(revs, s["fcf"], s["sbc"], s["wacc"], s["tg"], False)
        ps_a = (ev_a + CASH - DEBT) / sh
        ps_b = (ev_b + CASH - DEBT) / sh
        ps_b_dil = (ev_b + CASH - DEBT) / (sh * (1 + s["dil"]) ** 5)
        g_next = s["g"][-1] - 0.01
        ps_x, fut, ev_exit, cum = exit_value(revs, s["fcf"], g_next, s["exit"], s["dil"], s["wacc"], sh)
        row[lab] = dict(dcf_sbc=ps_a, dcf_nosbc=ps_b, dcf_nosbc_dil=ps_b_dil, exit=ps_x,
                        ev_a=ev_a, tv_share=tv_a/ev_a, fut=fut, ev_exit=ev_exit, cum=cum)
    results[name] = row
    f = row["FD"]
    print(f"DCF (FCF-SBC) EV {f['ev_a']:.0f} (TV {f['tv_share']:.0%} of EV)")
    for lab in ("FD", "basic"):
        r = row[lab]
        print(f"  [{lab:5s}] DCF FCF-SBC ${r['dcf_sbc']:6.2f} | DCF FCF(no SBC deduction) ${r['dcf_nosbc']:6.2f}"
              f" | same, dilution-adj ${r['dcf_nosbc_dil']:6.2f} | Exit-multiple PV ${r['exit']:6.2f}"
              f" (FY32 value ${r['fut']:.2f}; exit EV {r['ev_exit']:.0f}; cum FCF {r['cum']:.0f})")
    blend = 0.5 * f["dcf_sbc"] + 0.5 * f["exit"]
    row["blend"] = blend
    print(f"  Blend (50% DCF FCF-SBC + 50% exit, FD) ${blend:.2f}  vs price {blend/PRICE-1:+.1%}  vs deal {blend/DEAL_PRICE-1:+.1%}")

# probability-weighted standalone
W = {"bear": 0.25, "base": 0.50, "bull": 0.25}
pw = sum(W[k] * results[k]["blend"] for k in W)
print(f"\nProbability-weighted standalone (25/50/25) ${pw:.2f}  vs price {pw/PRICE-1:+.1%}")

section("5. MERGER-ARB VIEW")
T_CLOSE = 0.6   # est ~mid-2027 (deal guided to close in CRM FY28 = Feb-27..Jan-28)
RF = 0.04       # est annual opportunity rate for arb discounting
for fb_label, fb in (("undisturbed $30.04", UNDISTURBED), ("standalone base", results["base"]["blend"]),
                     ("standalone bear", results["bear"]["blend"])):
    # price = (p*deal + (1-p)*fallback)/(1+rf)^t  -> p
    p = (PRICE * (1 + RF) ** T_CLOSE - fb) / (DEAL_PRICE - fb)
    print(f"Fallback {fb_label:20s} ${fb:6.2f} -> market-implied close prob {p:6.1%}")
ann = (DEAL_PRICE / PRICE) ** (1 / T_CLOSE) - 1
print(f"Gross spread {DEAL_PRICE/PRICE-1:.2%}; annualised at {T_CLOSE}y {ann:.1%}")
for p in (0.85, 0.90, 0.95):
    ev_ = (p * DEAL_PRICE + (1 - p) * UNDISTURBED) / (1 + RF) ** T_CLOSE
    print(f"  P(close)={p:.0%}, fallback 30.04: expected PV ${ev_:.2f} vs price {ev_/PRICE-1:+.1%}")

section("6. SENSITIVITIES (base case, deal-FD shares)")
b = SCEN["base"]
shape = [0.04, 0.02, 0.0, -0.02, -0.04]
print("6a. DCF (FCF-SBC) $/share: rows = rev CAGR FY27-32 (decelerating path), cols = terminal FCF margin (pre-SBC)")
term_m = [0.18, 0.21, 0.25, 0.28, 0.31]
print("CAGR\\FCF " + "".join(f"{m:8.0%}" for m in term_m))
for cg in (0.10, 0.13, 0.16, 0.19, 0.22):
    g = [cg + x for x in shape]
    revs = project(g)
    line = f"{cagr(revs):7.1%}  "
    for m in term_m:
        start = 0.12
        fcf = [start + (m - start) * i / 4 for i in range(5)]
        ev, _ = dcf(revs, fcf, b["sbc"], b["wacc"], b["tg"], True)
        line += f"{(ev + CASH)/FD_DEAL:8.2f}"
    print(line)

print("\n6b. DCF (FCF-SBC) $/share: rows = WACC, cols = terminal growth")
revs = project(b["g"])
tgs = [0.025, 0.03, 0.035, 0.04, 0.045]
print("WACC\\g  " + "".join(f"{t:8.1%}" for t in tgs))
for w in (0.085, 0.09, 0.10, 0.11, 0.12):
    line = f"{w:6.1%}  "
    for t in tgs:
        ev, _ = dcf(revs, b["fcf"], b["sbc"], w, t, True)
        line += f"{(ev + CASH)/FD_DEAL:8.2f}"
    print(line)

print("\n6c. Exit-multiple PV $/share: rows = discount rate, cols = exit EV/NTM rev")
mults = [2.5, 3.0, 4.0, 5.0, 6.0]
print("ke\\mult " + "".join(f"{m:8.1f}x" for m in mults))
for w in (0.085, 0.09, 0.10, 0.11, 0.12):
    line = f"{w:6.1%}  "
    for m in mults:
        ps, *_ = exit_value(revs, b["fcf"], b["g"][-1] - 0.01, m, b["dil"], w, FD_DEAL)
        line += f"{ps:9.2f}"
    print(line)

print("\n6d. Base DCF (FCF-SBC) at basic vs FD shares: "
      f"basic ${results['base']['basic']['dcf_sbc']:.2f}, FD ${results['base']['FD']['dcf_sbc']:.2f}")

section("7. DEAL FRAMEWORK (coordinator-verified terms: $47.50 cash, EV ~$5.66B, 8-K ex.99.2)")
import datetime as _dt
VAL = _dt.date(2026, 10, 30)
gross = DEAL_PRICE / PRICE - 1
print(f"Gross spread ${DEAL_PRICE-PRICE:.2f} = {gross:.2%}")
for d in (_dt.date(2027, 3, 31), _dt.date(2027, 6, 30), _dt.date(2027, 9, 30), _dt.date(2028, 1, 31)):
    t = (d - VAL).days / 365.25
    print(f"  close {d}: {t:4.2f}y  annualised (compound) {(1+gross)**(1/t)-1:6.2%}  simple {gross/t:6.2%}")
print("Implied break probability = (deal - price)/(deal - standalone)  [undiscounted]")
for lab, sv in (("undisturbed $30.04", UNDISTURBED), ("bear blend", results["bear"]["blend"]),
                ("base blend", results["base"]["blend"]), ("prob-wtd standalone", pw),
                ("peer growth-adj (FD) $31.09", 31.09)):
    print(f"  standalone {lab:28s} ${sv:6.2f}: P(break) {(DEAL_PRICE-PRICE)/(DEAL_PRICE-sv):6.1%}")
print(f"Offer vs base standalone: {DEAL_PRICE/results['base']['blend']-1:+.1%}; vs prob-weighted {DEAL_PRICE/pw-1:+.1%};"
      f" vs bull {DEAL_PRICE/results['bull']['blend']-1:+.1%}")
print("Payoff: deal closes +${:.2f}; breaks to base ${:.2f} ({:+.1%}), to $30.04 ({:+.1%}), to bear ({:+.1%})".format(
    DEAL_PRICE-PRICE, results['base']['blend'], results['base']['blend']/PRICE-1, UNDISTURBED/PRICE-1,
    results['bear']['blend']/PRICE-1))
print("Cross-check share count / net cash vs deal EV 5660:")
eq_basic = DEAL_PRICE * BASIC_SHARES
print(f"  basic equity at $47.50 = {eq_basic:.0f}; minus cash 413.9 -> EV {eq_basic-CASH:.0f};"
      f" gap to 5660 = {DEAL_EV-(eq_basic-CASH):.0f} -> {(DEAL_EV-(eq_basic-CASH))/DEAL_PRICE:.1f}M extra FD shares (RSU/options) if net cash=413.9")
print(f"  if FD shares were the 114.2M non-GAAP diluted count, deal EV 5660 implies net cash {DEAL_PRICE*WAVG_DILUTED_NG-DEAL_EV:.0f}"
      " (implausible: < 0 while Braze has ~414 cash, no debt) -> FD count must be well above 114M")
print("\nDone.")
