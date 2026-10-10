import "./_group.css";
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Coins,
  FileSpreadsheet,
  Landmark,
  Megaphone,
  Plus,
  Receipt,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Vote,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Section = "overview" | "settlements" | "balances" | "transactions" | "commissions";
type SettlementStatus = "Pending" | "Ready" | "Released" | "Completed";

const revenueDays = [
  { date: "Sep 01", amount: 284 }, { date: "Sep 03", amount: 328 }, { date: "Sep 05", amount: 301 },
  { date: "Sep 07", amount: 420 }, { date: "Sep 09", amount: 376 }, { date: "Sep 11", amount: 512 },
  { date: "Sep 13", amount: 410 }, { date: "Sep 15", amount: 540 }, { date: "Sep 17", amount: 620 },
  { date: "Sep 19", amount: 710 }, { date: "Sep 21", amount: 640 }, { date: "Sep 23", amount: 910 },
  { date: "Sep 25", amount: 684 }, { date: "Sep 27", amount: 788 }, { date: "Sep 29", amount: 842 },
];

const pillarData = [
  { name: "Events", amount: "5,420,000", commission: "812,000", transactions: "1,320", rate: "15.0%", icon: CalendarDays, color: "teal" },
  { name: "Elections", amount: "3,860,000", commission: "386,000", transactions: "486", rate: "10.0%", icon: Vote, color: "blue" },
  { name: "Campaigns", amount: "3,200,000", commission: "640,000", transactions: "1,040", rate: "20.0%", icon: Megaphone, color: "gold" },
];

type Settlement = {
  id: number;
  organization: string;
  date: string;
  amount: string;
  currency: string;
  count: number;
  status: SettlementStatus;
};

const initialSettlements: Settlement[] = [
  { id: 284, organization: "Westbridge Alumni Network", date: "Sep 22, 2026", amount: "842,000", currency: "XAF", count: 28, status: "Ready" },
  { id: 283, organization: "Central District Council", date: "Sep 21, 2026", amount: "620,500", currency: "XAF", count: 16, status: "Pending" },
  { id: 282, organization: "Lagos Creative Forum", date: "Sep 20, 2026", amount: "1,450,000", currency: "NGN", count: 42, status: "Released" },
  { id: 281, organization: "National Students Union", date: "Sep 19, 2026", amount: "418,000", currency: "XAF", count: 12, status: "Completed" },
];

const balances = [
  { org: "Westbridge Alumni Network", initials: "WA", earned: "2,840,000", available: "842,000", awaiting: "210,000", released: "1,788,000", currency: "XAF" },
  { org: "Central District Council", initials: "CD", earned: "2,120,500", available: "620,500", awaiting: "0", released: "1,500,000", currency: "XAF" },
  { org: "Lagos Creative Forum", initials: "LC", earned: "6,450,000", available: "1,450,000", awaiting: "680,000", released: "4,320,000", currency: "NGN" },
  { org: "National Students Union", initials: "NS", earned: "1,418,000", available: "0", awaiting: "418,000", released: "1,000,000", currency: "XAF" },
];

type Transaction = {
  id: string;
  org: string;
  initials: string;
  type: "Event" | "Election" | "Campaign";
  date: string;
  gross: string;
  commission: string;
  currency: string;
  status: "Completed" | "Pending";
};

const initialTransactions: Transaction[] = [
  { id: "TX-90318", org: "Westbridge Alumni Network", initials: "WA", type: "Event", date: "Sep 23, 10:42 AM", gross: "320,000", commission: "48,000", currency: "XAF", status: "Completed" },
  { id: "TX-90317", org: "Lagos Creative Forum", initials: "LC", type: "Campaign", date: "Sep 23, 9:18 AM", gross: "820,000", commission: "164,000", currency: "NGN", status: "Completed" },
  { id: "TX-90316", org: "Central District Council", initials: "CD", type: "Election", date: "Sep 22, 4:06 PM", gross: "180,000", commission: "18,000", currency: "XAF", status: "Completed" },
  { id: "TX-90315", org: "National Students Union", initials: "NS", type: "Event", date: "Sep 22, 1:31 PM", gross: "96,000", commission: "14,400", currency: "XAF", status: "Pending" },
  { id: "TX-90314", org: "Westbridge Alumni Network", initials: "WA", type: "Election", date: "Sep 21, 11:12 AM", gross: "450,000", commission: "45,000", currency: "XAF", status: "Completed" },
];

const navItems: { id: Section; label: string; icon: typeof BarChart3 }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "settlements", label: "Settlements", icon: Landmark },
  { id: "balances", label: "Balances", icon: CircleDollarSign },
  { id: "transactions", label: "Transactions", icon: Receipt },
  { id: "commissions", label: "Commissions", icon: Settings2 },
];

const money = (amount: string, currency = "XAF") => `${currency} ${amount}`;

function StatusPill({ status }: { status: string }) {
  return <span className={`fw-status fw-status-${status.toLowerCase()}`}><i />{status}</span>;
}

function PageTitle({ eyebrow, title, description, action }: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="fw-page-title">
      <div>
        <div className="fw-eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action && <div className="fw-page-action">{action}</div>}
    </div>
  );
}

export function FinanceWorkspace() {
  const [section, setSection] = useState<Section>("overview");
  const [settlements, setSettlements] = useState(initialSettlements);
  const [settlementFilter, setSettlementFilter] = useState("All statuses");
  const [pillarFilter, setPillarFilter] = useState("All pillars");
  const [rates, setRates] = useState<Record<string, number>>({ Events: 15, Elections: 10, Campaigns: 20 });
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [rateDraft, setRateDraft] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [settlementOrg, setSettlementOrg] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const filteredSettlements = useMemo(
    () => settlements.filter((row) => settlementFilter === "All statuses" || row.status === settlementFilter),
    [settlements, settlementFilter],
  );
  const filteredTransactions = useMemo(
    () => initialTransactions.filter((row) => (pillarFilter === "All pillars" || row.type === pillarFilter.slice(0, -1)) && row.org.toLowerCase().includes(search.toLowerCase())),
    [pillarFilter, search],
  );

  const flashNotice = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const exportTransactions = () => {
    const rows = [
      ["Transaction", "Organization", "Pillar", "Gross", "Commission", "Currency", "Status"],
      ...filteredTransactions.map((tx) => [tx.id, tx.org, tx.type, tx.gross, tx.commission, tx.currency, tx.status]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = "evenum-finance-transactions.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    flashNotice("Transaction export prepared");
  };

  const advanceSettlement = (id: number) => {
    setSettlements((current) => current.map((row) => row.id !== id ? row : {
      ...row,
      status: row.status === "Pending" ? "Ready" : row.status === "Ready" ? "Released" : row.status === "Released" ? "Completed" : row.status,
    }));
  };

  const createSettlement = () => {
    const balance = balances.find((row) => row.org === settlementOrg);
    if (!balance) return;
    setSettlements((current) => [{
      id: Math.max(...current.map((row) => row.id), 284) + 1,
      organization: balance.org,
      date: "Sep 24, 2026",
      amount: balance.available,
      currency: balance.currency,
      count: 8,
      status: "Pending",
    }, ...current]);
    setCreateOpen(false);
    setSettlementOrg("");
    setSettlementFilter("All statuses");
    setSection("settlements");
    flashNotice("Settlement added to the local preview");
  };

  const saveRate = (name: string) => {
    const nextRate = Number(rateDraft);
    if (Number.isFinite(nextRate) && nextRate >= 0 && nextRate <= 100) {
      setRates((current) => ({ ...current, [name]: nextRate }));
      setEditingRate(null);
      flashNotice(`${name} commission rate updated`);
    }
  };

  const pageDetails: Record<Section, { eyebrow: string; title: string; description: string }> = {
    overview: { eyebrow: "FINANCE / OVERVIEW", title: "Finance overview", description: "Platform revenue and payout activity at a glance." },
    settlements: { eyebrow: "FINANCE / PAYOUTS", title: "Settlements", description: "Review payout batches and move each settlement through its status." },
    balances: { eyebrow: "FINANCE / ORGANIZATIONS", title: "Organization balances", description: "A clear view of earnings, available funds, and completed payouts." },
    transactions: { eyebrow: "FINANCE / LEDGER", title: "Transactions", description: "Browse transaction activity across events, elections, and campaigns." },
    commissions: { eyebrow: "FINANCE / CONFIGURATION", title: "Commission rates", description: "Manage the platform fee applied to each participation pillar." },
  };

  return (
    <main className="finance-workspace">
      <style>{`
        .finance-workspace {
          --fw-ink: #1b2c49; --fw-blue: #0b3f91; --fw-blue-soft: #eaf1fb; --fw-cream: #f6f3eb;
          --fw-paper: #fffefa; --fw-muted: #718096; --fw-line: #e8e5dc; --fw-green: #16815d;
          min-height: 100dvh; color: var(--fw-ink); background: var(--fw-cream); font-family: var(--app-font-sans, 'Plus Jakarta Sans', sans-serif);
        }
        .fw-shell { max-width: 1480px; margin: 0 auto; padding: 0 36px 42px; }
        .fw-topbar { height: 70px; border-bottom: 1px solid var(--fw-line); display:flex; align-items:center; justify-content:space-between; }
        .fw-brand { display:flex; align-items:center; gap:11px; color:var(--fw-blue); font-size:15px; font-weight:800; letter-spacing:.15em; }
        .fw-brand-mark { width:29px; height:29px; border:1px solid #b8c8df; border-radius:8px; display:grid; place-items:center; color:var(--fw-blue); }
        .fw-top-right { display:flex; align-items:center; gap:18px; color:#6f7d91; font-size:12px; }
        .fw-period { display:flex; align-items:center; gap:8px; background:var(--fw-paper); padding:9px 12px; border:1px solid var(--fw-line); border-radius:7px; color:#354966; }
        .fw-admin { display:flex; align-items:center; gap:9px; border-left:1px solid var(--fw-line); padding-left:17px; }
        .fw-admin-avatar { display:grid; place-items:center; width:31px; height:31px; border-radius:50%; background:#dce7f6; color:var(--fw-blue); font-size:11px; font-weight:800; }
        .fw-main { padding-top:30px; }
        .fw-heading-row { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; margin-bottom:23px; }
        .fw-page-title { display:flex; justify-content:space-between; align-items:flex-end; gap:18px; margin-bottom:23px; }
        .fw-eyebrow { color:#75839a; font-size:10px; font-weight:800; letter-spacing:.12em; margin-bottom:8px; }
        .fw-page-title h1,.fw-page-title h2 { margin:0; font-family:var(--app-font-serif, Georgia, serif); font-size:30px; line-height:1.13; font-weight:600; letter-spacing:-.025em; color:#172944; }
        .fw-page-title p { margin:8px 0 0; color:#718096; font-size:13px; }
        .fw-button { border:1px solid #d8dfe9; background:var(--fw-paper); color:#354966; height:37px; border-radius:6px; padding:0 13px; display:inline-flex; align-items:center; gap:8px; font:600 12px inherit; font-size:12px; cursor:pointer; transition:background .16s, color .16s, border-color .16s, transform .16s; white-space:nowrap; }
        .fw-button:hover { background:#f3f6fb; border-color:#b5c7e0; color:var(--fw-blue); transform:translateY(-1px); }
        .fw-button-primary { color:#fff; background:var(--fw-blue); border-color:var(--fw-blue); }
        .fw-button-primary:hover { background:#073575; color:#fff; border-color:#073575; }
        .fw-button-quiet { border-color:transparent; background:transparent; color:var(--fw-blue); padding:0 8px; }
        .fw-button-small { height:30px; padding:0 10px; font-size:11px; }
        .fw-tabs { display:flex; align-items:center; gap:5px; border-bottom:1px solid #deddd6; overflow-x:auto; scrollbar-width:none; }
        .fw-tabs::-webkit-scrollbar { display:none; }
        .fw-tab { display:flex; align-items:center; gap:8px; padding:12px 14px 13px; border:0; border-bottom:2px solid transparent; background:transparent; color:#758197; font-size:12px; font-weight:650; white-space:nowrap; cursor:pointer; }
        .fw-tab svg { opacity:.78; }
        .fw-tab:hover { color:var(--fw-blue); }
        .fw-tab-active { color:var(--fw-blue); border-bottom-color:var(--fw-blue); }
        .fw-tab-active svg { opacity:1; }
        .fw-content { padding-top:23px; animation:fw-arrive .2s ease-out both; }
        @keyframes fw-arrive { from { opacity:.5; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        .fw-kpis { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); border:1px solid var(--fw-line); border-radius:9px; overflow:hidden; background:var(--fw-paper); margin-bottom:19px; }
        .fw-kpi { padding:16px 17px 15px; min-width:0; border-right:1px solid var(--fw-line); }
        .fw-kpi:last-child { border-right:0; }
        .fw-kpi-label { min-height:29px; display:flex; justify-content:space-between; gap:8px; color:#78869a; font-size:10px; font-weight:650; line-height:1.4; }
        .fw-kpi-label svg { color:#6680a5; flex:0 0 auto; }
        .fw-kpi-value { margin-top:9px; color:#1b2c49; font-size:20px; line-height:1.2; font-weight:750; letter-spacing:-.04em; font-variant-numeric:tabular-nums; white-space:nowrap; }
        .fw-kpi-foot { margin-top:6px; color:#8792a0; font-size:10px; display:flex; align-items:center; gap:4px; }
        .fw-kpi-foot .positive { color:var(--fw-green); }
        .fw-panel { border:1px solid var(--fw-line); border-radius:9px; background:var(--fw-paper); }
        .fw-overview-grid { display:grid; grid-template-columns:minmax(0,1.8fr) minmax(270px,.82fr); gap:18px; }
        .fw-chart-panel { padding:19px 20px 14px; min-height:330px; }
        .fw-panel-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
        .fw-panel-heading h3 { margin:0; color:#20324e; font-size:13px; font-weight:750; letter-spacing:-.01em; }
        .fw-panel-subtitle { margin-top:5px; color:#8a95a4; font-size:10px; }
        .fw-chart-total { text-align:right; color:#79869a; font-size:10px; }
        .fw-chart-total strong { display:block; color:#20324e; font-size:16px; margin-top:2px; font-variant-numeric:tabular-nums; }
        .fw-chart { height:243px; width:100%; margin-top:12px; }
        .fw-summary-panel { overflow:hidden; }
        .fw-pending-box { padding:19px 20px 17px; background:#edf3fb; border-bottom:1px solid #dce5f0; }
        .fw-pending-title { display:flex; justify-content:space-between; align-items:center; color:#496080; font-size:11px; font-weight:700; }
        .fw-pending-title svg { color:var(--fw-blue); }
        .fw-pending-amount { margin-top:12px; font-size:25px; font-weight:750; letter-spacing:-.04em; color:var(--fw-blue); font-variant-numeric:tabular-nums; }
        .fw-pending-note { display:flex; align-items:center; justify-content:space-between; color:#72829a; font-size:10px; margin-top:6px; }
        .fw-pending-note strong { color:#4f617a; font-weight:650; }
        .fw-pillar-list { padding:17px 20px 5px; }
        .fw-pillar-list-title { display:flex; justify-content:space-between; align-items:center; margin-bottom:11px; }
        .fw-pillar-list-title h3 { margin:0; font-size:12px; color:#20324e; }
        .fw-subtle-link { border:0; background:none; color:var(--fw-blue); font-size:10px; cursor:pointer; font-weight:700; }
        .fw-pillar-row { display:flex; align-items:center; gap:10px; padding:11px 0; border-top:1px solid #f0eee8; }
        .fw-pillar-icon { width:30px; height:30px; display:grid; place-items:center; border-radius:7px; flex:0 0 auto; }
        .fw-pillar-icon.teal { color:#18866d; background:#e8f4f0; } .fw-pillar-icon.blue { color:#315f9d; background:#eaf1fb; } .fw-pillar-icon.gold { color:#a47829; background:#f8f0dd; }
        .fw-pillar-meta { flex:1; min-width:0; }
        .fw-pillar-meta strong { display:block; font-size:11px; color:#30415d; }
        .fw-pillar-meta span { display:block; margin-top:3px; font-size:9px; color:#8792a0; }
        .fw-pillar-value { color:#263954; text-align:right; font-size:11px; font-weight:700; white-space:nowrap; }
        .fw-workspace-footer { display:flex; justify-content:space-between; color:#98a0aa; font-size:10px; margin-top:14px; }
        .fw-data-panel { overflow:hidden; }
        .fw-data-toolbar { padding:17px 19px; display:flex; justify-content:space-between; align-items:center; gap:14px; border-bottom:1px solid #eeece5; }
        .fw-data-toolbar h3 { margin:0; font-size:13px; color:#243650; }
        .fw-data-toolbar p { margin:4px 0 0; color:#8591a0; font-size:10px; }
        .fw-toolbar-controls { display:flex; gap:8px; align-items:center; }
        .fw-select,.fw-search { border:1px solid #e3e3dc; border-radius:6px; background:#fffefa; color:#43536b; height:34px; padding:0 10px; font:inherit; font-size:11px; outline:none; }
        .fw-select:focus,.fw-search:focus { border-color:#819bc0; box-shadow:0 0 0 2px #eaf1fb; }
        .fw-select { min-width:126px; cursor:pointer; }
        .fw-search-wrap { display:flex; align-items:center; gap:7px; padding-left:10px; border:1px solid #e3e3dc; border-radius:6px; color:#8490a0; background:#fffefa; }
        .fw-search { width:145px; padding-left:0; border:0; }
        .fw-table-wrap { overflow-x:auto; }
        .fw-table { width:100%; border-collapse:collapse; min-width:740px; text-align:left; }
        .fw-table th { padding:10px 15px; color:#8993a0; background:#fbfaf6; font-size:9px; text-transform:uppercase; letter-spacing:.07em; font-weight:750; border-bottom:1px solid #eeece5; white-space:nowrap; }
        .fw-table td { padding:12px 15px; color:#485970; font-size:11px; border-bottom:1px solid #f0eee8; vertical-align:middle; }
        .fw-table tbody tr:last-child td { border-bottom:0; }
        .fw-table tbody tr:hover { background:#fcfbf8; }
        .fw-num { text-align:right !important; font-variant-numeric:tabular-nums; white-space:nowrap; }
        .fw-primary-text { color:var(--fw-blue) !important; font-weight:700; }
        .fw-org-cell { display:flex; align-items:center; gap:10px; min-width:190px; }
        .fw-org-avatar { flex:0 0 auto; width:29px; height:29px; display:grid; place-items:center; border-radius:7px; background:#eef2f8; color:#49658e; font-size:9px; font-weight:800; }
        .fw-org-name { color:#31425d; font-size:11px; font-weight:700; }
        .fw-org-sub { color:#9aa2ad; font-size:9px; margin-top:3px; }
        .fw-status { display:inline-flex; align-items:center; gap:6px; padding:5px 8px; border-radius:99px; font-size:9px; font-weight:750; white-space:nowrap; }
        .fw-status i { width:5px; height:5px; border-radius:50%; background:currentColor; }
        .fw-status-pending { color:#68788f; background:#f0f2f4; } .fw-status-ready { color:#205697; background:#e9f1fb; }
        .fw-status-released { color:#966917; background:#f8f0de; } .fw-status-completed { color:#237653; background:#e8f4ed; }
        .fw-action-cell { text-align:right; }
        .fw-empty { padding:35px; text-align:center; color:#8290a2; font-size:12px; }
        .fw-balance-strip { display:flex; justify-content:space-between; gap:20px; padding:15px 19px; background:#f7f8f8; border-bottom:1px solid #eeece5; }
        .fw-balance-metric span { display:block; color:#8792a0; font-size:9px; }
        .fw-balance-metric strong { display:block; margin-top:4px; color:#2e415c; font-size:13px; font-variant-numeric:tabular-nums; }
        .fw-rate-layout { display:grid; grid-template-columns:minmax(0,1.4fr) minmax(230px,.7fr); gap:18px; align-items:start; }
        .fw-rate-head { padding:18px 20px; border-bottom:1px solid #eeece5; }
        .fw-rate-head h3 { margin:0; font-size:13px; }
        .fw-rate-head p { margin:5px 0 0; color:#8792a0; font-size:10px; }
        .fw-rate-row { display:grid; grid-template-columns:minmax(140px,1fr) minmax(90px,.7fr) minmax(130px,1.2fr) 90px; gap:14px; align-items:center; padding:15px 20px; border-bottom:1px solid #f0eee8; }
        .fw-rate-row:last-child { border-bottom:0; }
        .fw-rate-name { display:flex; align-items:center; gap:10px; color:#33445d; font-size:11px; font-weight:700; }
        .fw-rate-value { color:#1f3553; font-family:var(--app-font-mono,monospace); font-size:13px; font-weight:700; }
        .fw-rate-impact { color:#818c99; font-size:10px; }
        .fw-rate-edit { display:flex; gap:5px; align-items:center; }
        .fw-rate-input { width:63px; height:30px; border:1px solid #d7dfeb; border-radius:5px; padding:0 7px; color:#273b58; background:white; font:inherit; font-size:11px; }
        .fw-rate-tip { padding:20px; background:#edf3fb; border:1px solid #dce5f0; border-radius:9px; }
        .fw-rate-tip svg { color:var(--fw-blue); }
        .fw-rate-tip h3 { color:#28476f; font-size:12px; margin:12px 0 6px; }
        .fw-rate-tip p { color:#71839c; font-size:10px; line-height:1.6; margin:0; }
        .fw-rate-tip-foot { display:flex; align-items:center; gap:7px; border-top:1px solid #d9e3f0; padding-top:12px; margin-top:15px; color:#597293; font-size:9px; }
        .fw-modal-scrim { position:fixed; inset:0; z-index:10; display:grid; place-items:center; background:rgba(20,35,56,.30); padding:18px; }
        .fw-modal { width:min(430px,100%); padding:22px; border-radius:10px; border:1px solid #e4e1d9; background:var(--fw-paper); box-shadow:0 20px 60px rgba(30,45,65,.18); }
        .fw-modal-top { display:flex; justify-content:space-between; align-items:flex-start; }
        .fw-modal h3 { margin:0; font-family:var(--app-font-serif,Georgia,serif); font-size:20px; color:#1d304d; }
        .fw-modal p { margin:7px 0 18px; color:#78869a; font-size:11px; line-height:1.55; }
        .fw-modal label { display:block; color:#566780; font-size:10px; font-weight:700; margin-bottom:7px; }
        .fw-modal .fw-select { width:100%; height:40px; }
        .fw-modal-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:20px; }
        .fw-toast { position:fixed; z-index:20; right:24px; bottom:22px; display:flex; align-items:center; gap:9px; padding:12px 16px; color:#fff; background:#1e426f; border-radius:7px; box-shadow:0 8px 24px rgba(25,45,70,.2); font-size:11px; animation:fw-arrive .18s ease-out both; }
        @media (max-width:1050px) { .fw-shell { padding-left:24px; padding-right:24px; } .fw-kpis { grid-template-columns:repeat(3,minmax(0,1fr)); } .fw-kpi:nth-child(3) { border-right:0; } .fw-kpi:nth-child(-n+3) { border-bottom:1px solid var(--fw-line); } }
        @media (max-width:740px) {
          .fw-shell { padding:0 16px 26px; } .fw-topbar { height:60px; } .fw-top-right { gap:9px; } .fw-period { padding:8px; font-size:10px; } .fw-admin { padding-left:9px; }
          .fw-period span { display:block; white-space:nowrap; } .fw-admin-copy,.fw-top-label { display:none; } .fw-main { padding-top:23px; }
          .fw-heading-row { flex-direction:column; align-items:stretch; gap:13px; } .fw-heading-row > .fw-button { width:100%; justify-content:center; }
          .fw-page-title { flex-direction:column; align-items:flex-start; margin-bottom:18px; }
          .fw-page-title h1,.fw-page-title h2 { font-size:26px; } .fw-page-action { width:100%; } .fw-page-action .fw-button { width:100%; justify-content:center; }
          .fw-tabs { margin-right:-16px; padding-right:16px; } .fw-tab { padding:11px 10px 12px; gap:6px; font-size:10px; }
          .fw-content { padding-top:17px; } .fw-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); margin-bottom:14px; }
          .fw-kpi { padding:12px; border-bottom:1px solid var(--fw-line); } .fw-kpi:nth-child(odd) { border-right:1px solid var(--fw-line); } .fw-kpi:nth-child(even) { border-right:0; }
          .fw-kpi:nth-last-child(-n+2) { border-bottom:0; } .fw-kpi-label { min-height:20px; font-size:9px; } .fw-kpi-label svg { width:14px; } .fw-kpi-value { font-size:17px; margin-top:7px; }
          .fw-overview-grid,.fw-rate-layout { grid-template-columns:1fr; gap:13px; } .fw-chart-panel { min-height:290px; padding:16px 12px 10px; } .fw-chart { height:210px; }
          .fw-chart-total strong { font-size:13px; } .fw-panel-heading h3 { font-size:12px; } .fw-pending-box { padding:16px; } .fw-pillar-list { padding-left:16px; padding-right:16px; }
          .fw-data-toolbar { padding:14px; flex-direction:column; align-items:stretch; } .fw-toolbar-controls { width:100%; } .fw-toolbar-controls .fw-select { flex:1; min-width:0; }
          .fw-search-wrap { flex:1; } .fw-search { width:100%; min-width:0; } .fw-table-wrap { overflow:visible; padding:0 10px 10px; }
          .fw-table { display:block; min-width:0; } .fw-table thead { display:none; } .fw-table tbody { display:grid; gap:8px; }
          .fw-table tr { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 8px; border:1px solid #eeece5; border-radius:7px; padding:8px 10px; background:#fffefa; }
          .fw-table td { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:7px 0; border:0; min-width:0; text-align:right !important; font-size:10px; }
          .fw-table td::before { content:attr(data-label); color:#96a0ad; font-size:8px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; text-align:left; }
          .fw-table td[data-label="Organization"],.fw-table td[data-label="Actions"] { grid-column:1/-1; }
          .fw-table td[data-label="Organization"] { justify-content:flex-start; text-align:left !important; padding-bottom:9px; border-bottom:1px solid #f0eee8; margin-bottom:2px; }
          .fw-table td[data-label="Organization"]::before { display:none; }
          .fw-table td[data-label="Actions"] { justify-content:flex-end; border-top:1px solid #f0eee8; margin-top:3px; padding-top:9px; }
          .fw-table td[data-label="Actions"]::before { margin-right:auto; }
          .fw-table td[data-label="Status"] { justify-content:flex-end; }
          .fw-table td.fw-empty { grid-column:1/-1; justify-content:center; display:block; padding:22px; }
          .fw-table td.fw-empty::before { display:none; }
          .fw-table .fw-num { text-align:right !important; }
          .fw-balance-strip { flex-wrap:wrap; gap:14px 24px; padding:13px 15px; }
          .fw-rate-row { grid-template-columns:1fr auto; gap:8px; padding:13px 15px; }
          .fw-rate-row .fw-rate-impact { grid-column:1; grid-row:2; } .fw-rate-row .fw-rate-edit { grid-column:2; grid-row:1 / span 2; }
          .fw-rate-name { font-size:10px; } .fw-workspace-footer { flex-direction:column; gap:4px; }
        }
        @media (max-width:390px) { .fw-brand { font-size:12px; letter-spacing:.12em; } .fw-period span { max-width:70px; overflow:hidden; text-overflow:ellipsis; } .fw-tab { font-size:9px; padding-left:8px; padding-right:8px; } .fw-kpi-value { font-size:15px; } }
      `}</style>
      <div className="fw-shell">
        <header className="fw-topbar">
          <div className="fw-brand"><span className="fw-brand-mark"><Landmark size={16} /></span> EVENUM</div>
          <div className="fw-top-right">
            <div className="fw-period"><CalendarDays size={13} /><span>September 2026</span><ChevronDown size={12} /></div>
            <span className="fw-top-label">Platform administration</span>
            <div className="fw-admin"><span className="fw-admin-avatar">AM</span><span className="fw-admin-copy">A. Mensah</span></div>
          </div>
        </header>

        <div className="fw-main">
          <div className="fw-heading-row">
            <div className="fw-page-title" style={{ marginBottom: 0 }}>
              <div>
                <div className="fw-eyebrow">PLATFORM ADMINISTRATION</div>
                <h1>Finance</h1>
                <p>Track revenue, manage organization payouts, and maintain fee settings.</p>
              </div>
            </div>
            <button className="fw-button" onClick={exportTransactions}><ArrowDownToLine size={14} /> Export transactions</button>
          </div>

          <nav className="fw-tabs" aria-label="Finance sections">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button key={id} className={`fw-tab ${section === id ? "fw-tab-active" : ""}`} onClick={() => setSection(id)}>
                <Icon size={14} />{label}
              </button>
            ))}
          </nav>

          <section key={section} className="fw-content">
            {section === "overview" && <>
              <PageTitle {...pageDetails.overview} />
              <div className="fw-kpis">
                {[
                  { label: "Platform revenue", value: "XAF 12.48M", icon: Coins, note: "Lifetime" },
                  { label: "Commission collected", value: "XAF 1.86M", icon: Receipt, note: "15.0% blended rate" },
                  { label: "Revenue today", value: "XAF 184K", icon: TrendingUp, note: "Across 42 transactions" },
                  { label: "Revenue this week", value: "XAF 1.24M", icon: Activity, note: "Sep 17–23" },
                  { label: "Revenue this month", value: "XAF 4.61M", icon: BarChart3, note: "September to date" },
                  { label: "Transactions", value: "2,846", icon: FileSpreadsheet, note: "All pillars" },
                ].map(({ label, value, icon: Icon, note }) => (
                  <div className="fw-kpi" key={label}>
                    <div className="fw-kpi-label">{label}<Icon size={15} /></div>
                    <div className="fw-kpi-value">{value}</div>
                    <div className="fw-kpi-foot">{note}</div>
                  </div>
                ))}
              </div>
              <div className="fw-overview-grid">
                <div className="fw-panel fw-chart-panel">
                  <div className="fw-panel-heading">
                    <div><h3>Revenue trend <span style={{ color: "#95a0ac", fontWeight: 500 }}>· 30 days</span></h3><div className="fw-panel-subtitle">Daily gross revenue across all participation pillars</div></div>
                    <div className="fw-chart-total">Last 30 days<strong>XAF 4.61M</strong></div>
                  </div>
                  <div className="fw-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueDays} margin={{ top: 10, right: 2, left: -10, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#eeece5" strokeDasharray="3 4" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#8792a0", fontSize: 9 }} interval={2} dy={8} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#8792a0", fontSize: 9 }} tickFormatter={(value) => `${value}k`} width={38} />
                        <Tooltip cursor={{ fill: "#f3f5f8" }} formatter={(value) => [`${value}k XAF`, "Revenue"]} contentStyle={{ borderRadius: 7, border: "1px solid #e7e4dc", fontSize: 11 }} />
                        <Bar dataKey="amount" fill="#174b91" radius={[3, 3, 0, 0]} maxBarSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="fw-workspace-footer"><span><span style={{ color: "#174b91" }}>●</span> Gross platform revenue</span><span>Source: platform transaction ledger</span></div>
                </div>

                <aside className="fw-panel fw-summary-panel">
                  <div className="fw-pending-box">
                    <div className="fw-pending-title"><span>Pending settlements</span><Clock3 size={15} /></div>
                    <div className="fw-pending-amount">XAF 2,184,500</div>
                    <div className="fw-pending-note"><span><strong>8 batches</strong> awaiting payout</span><button className="fw-subtle-link" onClick={() => setSection("settlements")}>Review <ArrowRight size={11} style={{ verticalAlign: "middle" }} /></button></div>
                  </div>
                  <div className="fw-pillar-list">
                    <div className="fw-pillar-list-title"><h3>Revenue by pillar</h3><button className="fw-subtle-link" onClick={() => setSection("transactions")}>Ledger</button></div>
                    {pillarData.map(({ name, amount, commission, icon: Icon, color }) => (
                      <div className="fw-pillar-row" key={name}>
                        <span className={`fw-pillar-icon ${color}`}><Icon size={15} /></span>
                        <div className="fw-pillar-meta"><strong>{name}</strong><span>Commission XAF {commission}</span></div>
                        <div className="fw-pillar-value">XAF {amount}</div>
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
              <div className="fw-workspace-footer"><span>Reporting period · 01 Sep – 30 Sep 2026</span><span>Values shown in their settlement currency</span></div>
            </>}

            {section === "settlements" && <>
              <PageTitle {...pageDetails.settlements} action={<button className="fw-button fw-button-primary" onClick={() => setCreateOpen(true)}><Plus size={14} /> Create settlement</button>} />
              <div className="fw-panel fw-data-panel">
                <div className="fw-data-toolbar">
                  <div><h3>Settlement batches</h3><p>Manage payouts to organizations · {settlements.length} records</p></div>
                  <div className="fw-toolbar-controls"><SlidersHorizontal size={14} color="#8894a4" /><select aria-label="Filter settlements by status" className="fw-select" value={settlementFilter} onChange={(event) => setSettlementFilter(event.target.value)}><option>All statuses</option><option>Pending</option><option>Ready</option><option>Released</option><option>Completed</option></select></div>
                </div>
                <div className="fw-table-wrap"><table className="fw-table">
                  <thead><tr><th>ID</th><th>Organization</th><th>Date created</th><th className="fw-num">Amount</th><th className="fw-num">Transactions</th><th>Status</th><th className="fw-action-cell">Next action</th></tr></thead>
                  <tbody>{filteredSettlements.length ? filteredSettlements.map((row) => <tr key={row.id}>
                    <td data-label="ID"><span style={{ fontFamily: "var(--app-font-mono,monospace)", color: "#8792a0" }}>#{row.id}</span></td>
                    <td data-label="Organization"><div className="fw-org-cell"><span className="fw-org-avatar">{row.organization.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><span className="fw-org-name">{row.organization}</span></div></td>
                    <td data-label="Date created">{row.date}</td><td data-label="Amount" className="fw-num fw-primary-text">{money(row.amount, row.currency)}</td>
                    <td data-label="Transactions" className="fw-num">{row.count}</td><td data-label="Status"><StatusPill status={row.status} /></td>
                    <td data-label="Actions" className="fw-action-cell">{row.status === "Completed" ? <span style={{ color: "#97a0aa", fontSize: 10 }}>Settled</span> : <button className={`fw-button fw-button-small ${row.status === "Ready" ? "fw-button-primary" : ""}`} onClick={() => { advanceSettlement(row.id); flashNotice(`Settlement #${row.id} status updated`); }}>{row.status === "Pending" ? "Mark ready" : row.status === "Ready" ? "Release" : "Complete"} <ArrowRight size={11} /></button>}</td>
                  </tr>) : <tr><td className="fw-empty" colSpan={7}>No settlements match this status.</td></tr>}</tbody>
                </table></div>
              </div>
              <div className="fw-workspace-footer"><span>Settlement actions in this prototype update the local preview only.</span><span>Amounts are displayed in batch currency</span></div>
            </>}

            {section === "balances" && <>
              <PageTitle {...pageDetails.balances} />
              <div className="fw-panel fw-data-panel">
                <div className="fw-data-toolbar"><div><h3>Organization balances</h3><p>Balances shown by organization and currency</p></div><button className="fw-button fw-button-small" onClick={() => setSection("settlements")}><Landmark size={13} /> Manage payouts</button></div>
                <div className="fw-balance-strip">
                  <div className="fw-balance-metric"><span>Organizations shown</span><strong>4</strong></div>
                  <div className="fw-balance-metric"><span>Available for payout · XAF</span><strong>XAF 1,462,500</strong></div>
                  <div className="fw-balance-metric"><span>Awaiting payout · XAF</span><strong>XAF 628,000</strong></div>
                </div>
                <div className="fw-table-wrap"><table className="fw-table">
                  <thead><tr><th>Organization</th><th className="fw-num">Net earnings</th><th className="fw-num">Available</th><th className="fw-num">Awaiting payout</th><th className="fw-num">Released</th></tr></thead>
                  <tbody>{balances.map((row) => <tr key={row.org}>
                    <td data-label="Organization"><div className="fw-org-cell"><span className="fw-org-avatar">{row.initials}</span><span className="fw-org-name">{row.org}</span></div></td>
                    <td data-label="Net earnings" className="fw-num fw-primary-text">{money(row.earned, row.currency)}</td><td data-label="Available" className="fw-num" style={{ color: "#30415d", fontWeight: 700 }}>{money(row.available, row.currency)}</td>
                    <td data-label="Awaiting payout" className="fw-num">{money(row.awaiting, row.currency)}</td><td data-label="Released" className="fw-num" style={{ color: "#8290a2" }}>{money(row.released, row.currency)}</td>
                  </tr>)}</tbody>
                </table></div>
              </div>
              <div className="fw-workspace-footer"><span>Net earnings reflect post-commission organization proceeds.</span><span>Four organization accounts in this preview</span></div>
            </>}

            {section === "transactions" && <>
              <PageTitle {...pageDetails.transactions} action={<button className="fw-button" onClick={exportTransactions}><ArrowDownToLine size={14} /> Export CSV</button>} />
              <div className="fw-panel fw-data-panel">
                <div className="fw-data-toolbar">
                  <div><h3>Global transaction log</h3><p>Recent platform activity · {filteredTransactions.length} shown</p></div>
                  <div className="fw-toolbar-controls">
                    <label className="fw-search-wrap"><Search size={13} /><input className="fw-search" aria-label="Search organizations" placeholder="Find organization" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
                    <select className="fw-select" aria-label="Filter transactions by pillar" value={pillarFilter} onChange={(event) => setPillarFilter(event.target.value)}><option>All pillars</option><option>Events</option><option>Elections</option><option>Campaigns</option></select>
                  </div>
                </div>
                <div className="fw-table-wrap"><table className="fw-table">
                  <thead><tr><th>Transaction</th><th>Organization</th><th>Pillar</th><th className="fw-num">Gross</th><th className="fw-num">Commission</th><th className="fw-action-cell">Status</th></tr></thead>
                  <tbody>{filteredTransactions.length ? filteredTransactions.map((row) => <tr key={row.id}>
                    <td data-label="Transaction"><span style={{ fontFamily: "var(--app-font-mono,monospace)", color: "#8190a2", fontSize: 10 }}>{row.id}</span></td>
                    <td data-label="Organization"><div className="fw-org-cell"><span className="fw-org-avatar">{row.initials}</span><div><div className="fw-org-name">{row.org}</div><div className="fw-org-sub">{row.date}</div></div></div></td>
                    <td data-label="Pillar">{row.type}</td><td data-label="Gross" className="fw-num">{money(row.gross, row.currency)}</td><td data-label="Commission" className="fw-num fw-primary-text">{money(row.commission, row.currency)}</td>
                    <td data-label="Status" className="fw-action-cell">{row.status === "Completed" ? <StatusPill status="Completed" /> : <StatusPill status="Pending" />}</td>
                  </tr>) : <tr><td className="fw-empty" colSpan={6}>No transactions match your filters.</td></tr>}</tbody>
                </table></div>
              </div>
              <div className="fw-workspace-footer"><span>Showing recent transactions from the platform ledger.</span><span>Export respects the current filters</span></div>
            </>}

            {section === "commissions" && <>
              <PageTitle {...pageDetails.commissions} />
              <div className="fw-rate-layout">
                <div className="fw-panel fw-data-panel">
                  <div className="fw-rate-head"><h3>Platform commission configuration</h3><p>Rates apply to completed gross transactions in each pillar.</p></div>
                  {pillarData.map(({ name, amount, icon: Icon, color }) => (
                    <div className="fw-rate-row" key={name}>
                      <div className="fw-rate-name"><span className={`fw-pillar-icon ${color}`}><Icon size={14} /></span>{name}</div>
                      {editingRate === name
                        ? <div className="fw-rate-edit"><input aria-label={`${name} rate percent`} className="fw-rate-input" type="number" min="0" max="100" step="0.1" value={rateDraft} onChange={(event) => setRateDraft(event.target.value)} /><span style={{ color: "#758197", fontSize: 11 }}>%</span></div>
                        : <div className="fw-rate-value">{rates[name].toFixed(1)}%</div>}
                      <div className="fw-rate-impact">Recent gross: XAF {amount}</div>
                      <div style={{ textAlign: "right" }}>{editingRate === name ? <div className="fw-rate-edit" style={{ justifyContent: "flex-end" }}><button className="fw-button fw-button-small" aria-label="Cancel rate edit" onClick={() => setEditingRate(null)}><X size={12} /></button><button className="fw-button fw-button-primary fw-button-small" aria-label="Save rate" onClick={() => saveRate(name)}><Check size={12} /> Save</button></div> : <button className="fw-button fw-button-small" onClick={() => { setEditingRate(name); setRateDraft(String(rates[name])); }}>Edit rate</button>}</div>
                    </div>
                  ))}
                </div>
                <aside className="fw-rate-tip">
                  <ShieldCheck size={19} />
                  <h3>Fees, clearly accounted for</h3>
                  <p>Commission is recorded against each completed transaction and reflected in organization net earnings. Updates here are local to this visual prototype.</p>
                  <div className="fw-rate-tip-foot"><Activity size={13} /> Current effective rates</div>
                </aside>
              </div>
            </>}
          </section>
        </div>
      </div>

      {createOpen && <div className="fw-modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}>
        <div className="fw-modal" role="dialog" aria-modal="true" aria-labelledby="create-settlement-title">
          <div className="fw-modal-top"><div><h3 id="create-settlement-title">Create settlement</h3><p>Start a payout using an organization’s available balance in its settlement currency.</p></div><button className="fw-button fw-button-small" aria-label="Close dialog" onClick={() => setCreateOpen(false)}><X size={14} /></button></div>
          <label htmlFor="settlement-org">Organization and available balance</label>
          <select id="settlement-org" className="fw-select" value={settlementOrg} onChange={(event) => setSettlementOrg(event.target.value)}>
            <option value="">Select an organization</option>
            {balances.filter((balance) => Number(balance.available.replaceAll(",", "")) > 0).map((balance) => <option key={balance.org} value={balance.org}>{balance.org} — {money(balance.available, balance.currency)}</option>)}
          </select>
          <div className="fw-modal-actions"><button className="fw-button" onClick={() => setCreateOpen(false)}>Cancel</button><button className="fw-button fw-button-primary" disabled={!settlementOrg} onClick={createSettlement} style={!settlementOrg ? { opacity: .55, cursor: "not-allowed" } : undefined}><Plus size={13} /> Create settlement</button></div>
        </div>
      </div>}
      {notice && <div className="fw-toast" role="status"><CheckCircle2 size={15} />{notice}</div>}
    </main>
  );
}
