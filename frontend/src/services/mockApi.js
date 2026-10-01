// Local-only mock data layer — lets the app be visually reviewed (layout,
// wording, empty/populated states) without a live connection to the
// internalops database. Gated behind REACT_APP_MOCK_DATA so it can never
// accidentally activate outside a developer's own local .env.
//
// Each generator mirrors the exact field names the real backend returns
// (cross-checked against how each tab's component actually reads its
// response), so the UI renders exactly as it would with real data.

import { MOCK_ENTITIES, MOCK_TAG_LABELS, GP_INCOME_TAGS } from "./mockEntityData";

const MN_FULL = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthLabels(fromStr, toStr) {
  const [fy, fm] = fromStr.slice(0, 7).split("-").map(Number);
  const [ty, tm] = toStr.slice(0, 7).split("-").map(Number);
  const labels = [];
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    labels.push(`${MN_FULL[m - 1]} ${y}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return labels.length ? labels : [`${MN_FULL[fm - 1]} ${fy}`];
}

function monthCols(fromStr, toStr) {
  const [fy, fm] = fromStr.slice(0, 7).split("-").map(Number);
  const [ty, tm] = toStr.slice(0, 7).split("-").map(Number);
  const cols = [];
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    cols.push(`${y}-m${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return cols.length ? cols : [`${fy}-m${String(fm).padStart(2, "0")}`];
}

const rand = (min, max) => Math.round(min + Math.random() * (max - min));

// ── P&L ──────────────────────────────────────────────────────────────────
// Both P&L versions are built from the same per-account figures, so Classic
// and Beta totals agree. Each entity uses its own P&L template and its real
// P&L accounts (mockEntityData.js, generated from the MA report workbooks).
// Figures are seeded by entity + account + month, so a month always shows
// the same number (stable across reloads and between the two versions).
const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const addTo = (acc, arr) => arr.forEach((v, i) => { acc[i] += v; });
function seeded(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const entityOf = (entity) => MOCK_ENTITIES[entity] || MOCK_ENTITIES.QM;
const tagLabel = (tag) => MOCK_TAG_LABELS[tag] || tag;
// Typical monthly total per tag for QM; smaller entities are scaled down.
const TAG_BASE = { rev: 180000, bsei: 6000, cos: 60000, "other cos": 9000, bse: 12000, "payroll cos": 16000,
  oi: 2500, "fx gain": 600, "mgmt inc": 8000, "rent inc": 3000, payroll: 38000, "dir pay": 14000, bonus: 4000,
  travel: 3500, oe: 6500, prof: 4500, mgmt: 3000, depr: 1800, "tax pl": 7000 };
const ENTITY_SCALE = { QM: 1, QA: 0.35, QAW: 0.3, QArmour: 0.25, QOmnitech: 0.22, CC: 0.18, Daltos: 0.4 };

function pnlFigures(entity, from, to) {
  const labels = monthLabels(from, to);
  const ent = entityOf(entity);
  const scale = ENTITY_SCALE[entity] ?? 0.3;
  const byTag = {};
  Object.entries(ent.accounts).forEach(([tag, accts]) => {
    const per = ((TAG_BASE[tag] ?? 1500) * scale) / accts.length;
    byTag[tag] = accts.map(([acc_no, desc], k) => {
      // Like real data: ~1 in 4 accounts has no amount at all in the period
      // (still listed, at zero — the first account of a line always has
      // some), and ~1 in 5 months has no movement on an active account.
      const idle = k > 0 && seeded(`${entity}|${acc_no}|idle`) < 0.25;
      // Returns and discounts (Return Inwards, Discount Allowed / Received,
      // Purchases Return) reduce their line, as in the MA report: small and
      // negative.
      const contra = /RETURN|DISCOUNT/i.test(desc);
      const months = labels.map(m => {
        const r = seeded(`${entity}|${acc_no}|${m}`);
        if (idle || r < 0.2) return 0;
        return contra ? -Math.round(per * 0.08 * (0.55 + r)) : Math.round(per * (0.55 + r));
      });
      return { acc_no, label: desc, tag, months, total: sum(months) };
    });
  });
  // MFRS recognition of earlier invoices — a small add-on to sales / cost of sales.
  const mfrs = (tag, share) => (byTag[tag] || []).slice(0, 2).map(a => {
    const months = a.months.map((v, i) => Math.round(v * share * seeded(`${entity}|mfrs|${a.acc_no}|${labels[i]}`)));
    return { ...a, months, total: sum(months) };
  });
  return { labels, n: labels.length, ent, byTag, mfrsRev: mfrs("rev", 0.25), mfrsCos: mfrs("cos", 0.2) };
}

export function mockPnl(entity, from, to) {
  const { labels, n, ent, byTag, mfrsRev, mfrsCos } = pnlFigures(entity, from, to);
  const t = ent.template;
  const zero = () => Array(n).fill(0);
  const accountsOf = (tags) => tags.flatMap(tag => byTag[tag] || []);
  const section = (sec, title, tag, accts) => {
    const months = zero(); accts.forEach(a => addTo(months, a.months));
    // Header row first, then its details — PnLTable renders in array order.
    return { months, rows: [
      { section: sec, label: title, row_type: "subtotal", months, total: sum(months), tag },
      ...accts.map(a => ({ section: sec, label: a.label, row_type: "detail", months: a.months, total: a.total, tag })),
    ] };
  };
  const sales = section("SALES", "Total Sales", "rev", [...accountsOf(t.gp.filter(x => GP_INCOME_TAGS.includes(x))), ...mfrsRev]);
  const ri = zero();
  const cogs = section("COST OF GOODS SOLD", "Total Cost of Sales", "cos", [...accountsOf(t.gp.filter(x => !GP_INCOME_TAGS.includes(x))), ...mfrsCos]);
  const oi = section("OTHER INCOME", "Total Other Income", "oi", accountsOf(t.oi));
  const ep = section("OPERATING EXPENSES", "Total Operating Expenses", "ep", accountsOf(t.opex));
  const tx = section("TAXATION", "Total Taxation", "tx", accountsOf(t.tax));
  const netSales = sales.months.map((v, i) => v - ri[i]);
  const grossProfit = netSales.map((v, i) => v - cogs.months[i]);
  const pbt = grossProfit.map((v, i) => v + oi.months[i] - ep.months[i]);
  const pat = pbt.map((v, i) => v - tx.months[i]);
  const rows = [
    ...sales.rows,
    { section: "RETURN INWARDS", label: "Sales Returns", row_type: "subtotal", months: ri, total: 0, tag: "ri" },
    { section: "NET_SALES", label: "Net Sales", row_type: "net_sales", months: netSales, total: sum(netSales) },
    ...cogs.rows,
    { section: "GROSS_PROFIT", label: "Gross Profit", row_type: "summary", months: grossProfit, total: sum(grossProfit) },
    ...oi.rows,
    ...ep.rows,
    { section: "NET_PROFIT_BEFORE", label: "Net Profit Before Tax", row_type: "summary", months: pbt, total: sum(pbt) },
    ...tx.rows,
    { section: "NET_PROFIT_AFTER", label: "Net Profit After Tax", row_type: "summary", months: pat, total: sum(pat) },
  ];
  return { entity, month_labels: labels, rows };
}

// Same tree shape as the backend's pnl_service_v2: one top-level row per
// template line (accounts as children; Sales / Cost of Sales also carry an
// MFRS branch), Other Income and Operating Expenses as umbrella rows of
// per-tag rows, then the summary rows.
export function mockPnlV2(entity, from, to) {
  const { labels, n, ent, byTag, mfrsRev, mfrsCos } = pnlFigures(entity, from, to);
  const t = ent.template;
  const zero = () => Array(n).fill(0);
  const detail = (sec, a) => ({ row_type: "detail", section: sec, acc_no: a.acc_no, label: a.label, tag: a.tag, months: a.months, total: a.total });
  const mfrsBranch = (accts) => {
    if (!accts.length) return [];
    const months = zero(); accts.forEach(a => addTo(months, a.months));
    return [{ row_type: "mfrs", section: "MFRS", label: "MFRS 2025 Recognition", tag: "mfrs", months, total: sum(months),
      children: accts.map(a => ({ ...detail("MFRS", a), tag: "mfrs" })) }];
  };
  const tagRow = (tag, sec) => {
    const children = (byTag[tag] || []).map(a => detail(sec || tag.toUpperCase(), a));
    if (tag === "rev") children.push(...mfrsBranch(mfrsRev));
    if (tag === "cos") children.push(...mfrsBranch(mfrsCos));
    const months = zero(); children.forEach(c => addTo(months, c.months));
    return { row_type: "subtotal", section: sec || tag.toUpperCase(), label: tagLabel(tag), tag, months, total: sum(months), children };
  };
  const groupRow = (tags, label, sec) => {
    const children = tags.map(tag => tagRow(tag, sec));
    const months = zero(); children.forEach(c => addTo(months, c.months));
    return { row_type: "subtotal", section: sec, label, tag: null, months, total: sum(months), children };
  };
  const summary = (sec, label, months) => ({ row_type: "summary", section: sec, label, months, total: sum(months) });

  const rows = [];
  const gp = zero();
  t.gp.forEach(tag => {
    const r = tagRow(tag); rows.push(r);
    const sign = GP_INCOME_TAGS.includes(tag) ? 1 : -1;
    r.months.forEach((v, i) => { gp[i] += sign * v; });
  });
  rows.push(summary("GROSS_PROFIT", "Gross Profit / (Loss)", gp));
  const oi = groupRow(t.oi, "Other Income", "OTHER_INCOME");
  const opex = groupRow(t.opex, "Operating Expenses", "OPERATING_EXPENSES");
  rows.push(oi, opex);
  const pbt = gp.map((v, i) => v + oi.months[i] - opex.months[i]);
  rows.push(summary("NET_PROFIT_BEFORE", "Profit / (Loss) Before Tax", pbt));
  const tax = zero();
  t.tax.forEach(tag => { const r = tagRow(tag); rows.push(r); addTo(tax, r.months); });
  rows.push(summary("NET_PROFIT_AFTER", "Profit / (Loss) After Tax", pbt.map((v, i) => v - tax[i])));
  return { entity, month_labels: labels, rows };
}

// ── Balance Sheet ────────────────────────────────────────────────────────
export function mockBs(entity, from, to) {
  const labels = monthLabels(from, to);
  const acct = (acc_no, acc_desc, acc_type, base) => {
    const monthly = {};
    labels.forEach((m, i) => { monthly[m] = base + i * Math.round(base * 0.01); });
    const closing = monthly[labels[labels.length - 1]];
    return { acc_no, acc_desc, acc_type, monthly, closing_balance: closing, ob_home_balance: base, bf_home_balance: base, period_home_net: closing - base };
  };
  return {
    entity,
    month_labels: labels,
    rows: [
      acct("1000", "Office Equipment", "FA", 85000),
      acct("1100", "Computer Equipment", "FA", 42000),
      acct("1500", "Deposits Paid", "OA", 25000),
      acct("2000", "Trade Receivables", "CA", 310000),
      acct("2100", "Cash at Bank", "CA", 480000),
      acct("3000", "Retained Earnings b/f", "RE", 620000),
      acct("4000", "Trade Payables", "CL", 145000),
      acct("4100", "Accrued Expenses", "CL", 38000),
      acct("5000", "Term Loan", "LL", 200000),
      acct("6000", "Deferred Tax Liability", "OL", 15000),
    ],
  };
}

// ── MFRS ─────────────────────────────────────────────────────────────────
export function mockMfrs(entity, journalType, from, to) {
  const cols = monthCols(from, to);
  const contracts = journalType === "SALES"
    ? [
        { doc_no: "INV-2026-0142", description: "Acme Bhd — Managed Services", days: 365 },
        { doc_no: "INV-2026-0158", description: "Delta Holdings — Support Retainer", days: 180 },
        { doc_no: "INV-2026-0171", description: "Nexa Group — Licence Renewal", days: 365 },
      ]
    : [
        { doc_no: "PINV-2026-0021", description: "CloudHost Sdn Bhd — Hosting", days: 365 },
        { doc_no: "PINV-2026-0034", description: "OfficeSupplies Co — Annual Contract", days: 180 },
      ];
  const year = from.slice(0, 4);
  const rows = contracts.map((c, i) => {
    const monthly = {};
    cols.forEach(col => { monthly[col] = Math.random() > 0.15 ? rand(3000, 12000) : 0; });
    const startMonth = String(1 + (i * 3) % 12).padStart(2, "0");
    const start = `${year}-${startMonth}-01`;
    const endD = new Date(new Date(start).getTime() + (c.days - 1) * 86400000);
    return {
      gl_dtl_key: 5000 + i, split_index: 9000 + i, recognised_year: +year,
      doc_no: c.doc_no, description: c.description, total_days: c.days, monthly,
      trans_date: `${year}-${startMonth}-${String(5 + i).padStart(2, "0")}`,
      proj_no: `PRJ-${100 + (i % 4)}`,
      ref_no2: journalType === "SALES" ? null : `PO-${400 + i}`,
      de_acc_desc: c.description.split(" — ")[0],
      start_date: start,
      end_date: endD.toISOString().slice(0, 10),
    };
  });
  return { entity, journal_type: journalType, month_columns: cols, rows };
}

// ── Sales / Purchases invoices ───────────────────────────────────────────
function mockInvoices(entity, from, to, isSales) {
  const cats = ["PS", "LIC", "HW", "AMS", "TRN", ""];
  // Spread invoices across every month in the requested range (a few per
  // month), so a full-year report shows the whole year, not just `from`'s month.
  const [fy, fm] = from.slice(0, 7).split("-").map(Number);
  const [ty, tm] = to.slice(0, 7).split("-").map(Number);
  const months = [];
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m === 12 ? (y++, m = 1) : m++) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  if (!months.length) months.push(from.slice(0, 7));
  const n = Math.max(14, months.length * 4);
  return Array.from({ length: n }, (_, i) => {
    const day = String(rand(1, 27)).padStart(2, "0");
    const trans_date = `${months[i % months.length]}-${day}`;
    const amount = rand(5000, 45000);
    const cat = cats[i % cats.length];
    return {
      source_key: `${isSales ? "S" : "P"}-${i + 1}`,
      trans_date,
      acc_no: isSales ? `AR-${1000 + i}` : `AP-${2000 + i}`,
      acc_desc: isSales ? `Customer ${i + 1} Sdn Bhd` : `Vendor ${i + 1} Sdn Bhd`,
      de_acc_desc: isSales ? "Trade Receivables" : "Trade Payables",
      proj_no: `PRJ-${100 + (i % 4)}`,
      ref_no1: `${isSales ? "INV" : "PINV"}-2026-${String(200 + i)}`,
      ref_no2: isSales ? `PO-${300 + i}` : `SI-${500 + i}`,   // purchases: supplier invoice no.
      description: isSales ? "Professional services rendered" : "Subcontracted work / supplies",
      home_dr: isSales ? amount : 0,
      home_cr: isSales ? 0 : amount,
      amount,
      category: cat || null,
      // A couple of invoices per tab come back with a genuinely locked split
      // (is_locked: true) so the locked-row styling, the "Period is locked"
      // banner, and the unlock-request flow can all be reviewed — InvoiceTab
      // derives "locked" from split.is_locked, not from a separate endpoint.
      splits: i % 5 === 0 ? [
        { category: "PS", amount: Math.round(amount * 0.6), net_amount: Math.round(amount * 0.6), is_locked: i % 10 === 0,
          end_user: "Celcom Axiata", start_date: "2026-07-01", end_date: "2026-12-31", total_days: 184, remark: "Implementation phase" },
        { category: "LIC", amount: Math.round(amount * 0.4), net_amount: Math.round(amount * 0.4), is_locked: i % 10 === 0,
          end_user: "Maxis Berhad", start_date: "2026-07-01", end_date: "2027-06-30", total_days: 365, remark: "Annual licence" },
      ] : (i === 2 || i === 8) ? [
        { category: cat || "PS", amount, net_amount: amount, is_locked: true,
          end_user: "Petronas Digital", start_date: "2026-08-01", end_date: "2027-07-31", total_days: 365, remark: "Support retainer" },
      ] : [],
    };
  });
}
export const mockSales = (entity, from, to) => mockInvoices(entity, from, to, true);
export const mockPurchases = (entity, from, to) => mockInvoices(entity, from, to, false);

// ── Adj. Log ─────────────────────────────────────────────────────────────
export function mockLog() {
  const types = ["split", "newline", "edit", "unlock"];
  const labels = { split: "Split", newline: "New Line", edit: "Edit", unlock: "Unlock" };
  return Array.from({ length: 10 }, (_, i) => ({
    ts: `2026-08-${String(28 - i).padStart(2, "0")} ${String(9 + (i % 8)).padStart(2, "0")}:14`,
    user: ["Aisha Rahman", "Wei Ming Tan", "Priya Nair"][i % 3],
    type: types[i % types.length],
    tab: i % 2 === 0 ? "sales" : "purchases",
    ref: `${i % 2 === 0 ? "INV" : "PINV"}-2026-${String(200 + i)}`,
    detail: `${labels[types[i % types.length]]} applied to invoice line`,
    period: "Aug 2026",
  }));
}

// ── Adj. Tasks ───────────────────────────────────────────────────────────
export function mockTasks() {
  const statuses = ["open", "inprog", "done", "checked", "cancelled"];
  const general = Array.from({ length: 8 }, (_, i) => ({
    id: 1000 + i,
    todo: `Review ${i % 2 === 0 ? "invoice" : "split"} discrepancy #${200 + i}`,
    description: "Amount doesn't match the supporting document — needs correction.",
    remark: i % 3 === 0 ? "Flagged during month-end close" : "",
    source: i % 2 === 0 ? "sales" : "purchases",
    assigned_to: ["Aisha Rahman", "Wei Ming Tan", "Priya Nair"][i % 3],
    due_date: `2026-09-${String(10 + i).padStart(2, "0")}`,
    status: statuses[i % statuses.length],
    task_type: "general",
    source_key: `S-${i + 1}`,
    journal_type: "SALES",
    created_by: "manager@quandatics.com",
  }));

  // Unlock requests — source_key values line up with the locked splits
  // mockInvoices() hands out (i%5===0 or i===2/8 for both sales "S-n" and
  // purchases "P-n"), so opening the referenced invoice in Sales/Purchases
  // shows the same 🔒 row this request is about. One stays "unlock_pending"
  // (shows the manager Approve/Reject buttons in AdjTasks), one is already
  // resolved so the "Unlocked" status pill/history has something to show too.
  const unlockRequests = [
    {
      id: 2001,
      todo: "Unlock request — invoice INV-2026-201",
      description: "Category was mis-assigned before lock; needs a one-off correction.",
      remark: "Requested by Wei Ming Tan for period-end review.",
      source: "sales",
      assigned_to: "Priya Nair",
      due_date: "2026-09-15",
      status: "unlock_pending",
      task_type: "unlock_request",
      source_key: "S-1",
      journal_type: "SALES",
      created_by: "wei.ming@quandatics.com",
    },
    {
      id: 2002,
      todo: "Unlock request — invoice PINV-2026-403",
      description: "Vendor amount was corrected after lock; split needs to be redone.",
      remark: "",
      source: "purchases",
      assigned_to: "Aisha Rahman",
      due_date: "2026-09-12",
      status: "unlocked",
      task_type: "unlock_request",
      source_key: "P-3",
      journal_type: "PURCHASE",
      created_by: "aisha.rahman@quandatics.com",
    },
  ];

  return [...general, ...unlockRequests];
}

// ── Order List ───────────────────────────────────────────────────────────
export function mockOrderList() {
  const rows = [];
  ["PRJ-101", "PRJ-102", "PRJ-103"].forEach((proj, pi) => {
    for (let i = 0; i < 3; i++) {
      rows.push({
        proj_no: proj, journal_type: "SALES",
        ref_no: `INV-2026-${300 + pi * 10 + i}`,
        description: "Professional services", category: "PS",
        amount: rand(15000, 60000),
        trans_date: `2026-0${7 + (i % 2)}-${String(10 + i).padStart(2, "0")}`,
        start_date: "2026-07-01", end_date: "2026-12-31", total_days: 183,
        acc_desc: `Customer ${pi + 1} Sdn Bhd`,
      });
    }
    for (let i = 0; i < 2; i++) {
      rows.push({
        proj_no: proj, journal_type: "PURCHASE",
        ref_no: `PINV-2026-${400 + pi * 10 + i}`,
        description: "Subcontractor cost", category: "COS",
        amount: rand(8000, 30000),
        trans_date: `2026-0${7 + (i % 2)}-${String(12 + i).padStart(2, "0")}`,
        start_date: "2026-07-01", end_date: "2026-12-31", total_days: 183,
        acc_desc: `Vendor ${pi + 1} Sdn Bhd`,
      });
    }
  });
  return rows;
}

// Distinct from mockOrderList() — OrderListEnhanced.jsx reads a richer,
// SO/PO-linked row shape (so_no/po_no/billing_status/payment_status/etc.)
// that the "classic" order-list view doesn't need at all.
export function mockOrderListEnhanced() {
  const rows = [];
  const billingCycle = ["Not Invoiced", "Invoiced", "Invoiced", "Credit Noted"];
  const paymentCycle = ["Unpaid", "Partial", "Fully Paid", "Fully Paid"];

  ["PRJ-101", "PRJ-102"].forEach((proj, pi) => {
    for (let si = 0; si < 2; si++) {
      const so_no = `SO-${2600 + pi * 10 + si}`;
      const so_amount = rand(40000, 120000);
      const so_date = `2026-0${7 + si}-0${2 + si}`;
      for (let li = 0; li < 2; li++) {
        const idx = si * 2 + li;
        rows.push({
          proj_no: proj,
          so_no, so_amount, so_date,
          po_no: `PO-${3600 + pi * 10 + idx}`,
          po_amount: Math.round(so_amount / 2 * rand(85, 100) / 100),
          po_date: `2026-0${7 + si}-${String(5 + li).padStart(2, "0")}`,
          linked_so_no: so_no,
          item_code: `ITM-${100 + idx}`,
          description: li === 0 ? "Professional services — Phase " + (li + 1) : "Hardware & licences",
          line_status: billingCycle[idx % billingCycle.length],
          billing_status: billingCycle[idx % billingCycle.length],
          payment_status: paymentCycle[idx % paymentCycle.length],
        });
      }
    }
    // One unlinked PO per project — exercises the "pending link" / Pending Sync flow.
    rows.push({
      proj_no: proj,
      so_no: null, so_amount: null, so_date: null,
      po_no: `PO-${3699 + pi}`,
      po_amount: rand(8000, 25000),
      po_date: "2026-08-20",
      linked_so_no: null,
      item_code: `ITM-${199 + pi}`,
      description: "Ad-hoc subcontractor cost — awaiting SO link",
      line_status: "Not Invoiced",
      billing_status: "Not Invoiced",
      payment_status: "Unpaid",
    });
  });
  return rows;
}

// ── Small/misc endpoints ────────────────────────────────────────────────
export const mockConfig = (entity) => ({ entity, staging_refreshed_at: new Date(Date.now() - 42 * 60000).toISOString() });
export const mockEntities = () =>
  Object.entries(MOCK_ENTITIES).map(([entity_code, e]) => ({ entity_code, display_name: e.name }));
export const mockAccounts = () => ({ accounts: [
  { acc_no: "1000", acc_desc: "Office Equipment" },
  { acc_no: "4000", acc_desc: "Trade Payables" },
], de_accounts: [
  { acc_no: "9000", acc_desc: "Deferred Revenue" },
] });

export const mockUsers = () => ([
  { user_id: "aisha@quandatics.com", display_name: "Aisha Rahman", role: "staff" },
  { user_id: "weiming@quandatics.com", display_name: "Wei Ming Tan", role: "staff" },
  { user_id: "priya@quandatics.com", display_name: "Priya Nair", role: "manager" },
]);
