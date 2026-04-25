"use client";

import React, { useEffect, useMemo, useState } from "react";

// ─── 型定義 ─────────────────────────────────────────────────────
type ReservationStatus = "todo" | "done" | "cancelled";
type Gender = "male" | "female" | "none";
type Reservation = {
  id: string; date: string; start: string; end: string;
  name: string; menuId: string; memo: string;
  status: ReservationStatus; customPrice?: number;
  gender?: Gender; createdAt: number; customLabel?: string;
};
type Menu = { id: string; label: string; minutes: number; price: number; isTask?: boolean; };

const LS_KEY = "enmeidou_reception_v2";

const MENUS: Menu[] = [
  { id: "jp_new_120",   label: "国内新規（120分）",              minutes: 120, price: 9000 },
  { id: "jp_r_45",     label: "国内R（45分）",                  minutes: 45,  price: 6800 },
  { id: "jp_maint_30", label: "国内メンテ（30分）",              minutes: 30,  price: 5500 },
  { id: "int_new_120", label: "インターナショナル新規（120分）", minutes: 120, price: 18000 },
  { id: "int_r_60",    label: "インターナショナルR（60分）",     minutes: 60,  price: 12000 },
  { id: "stu_new_60",  label: "学生新規（高校生迄）（60分）",    minutes: 60,  price: 6600 },
  { id: "stu_r_45",    label: "学生R（高校生迄）（45分）",       minutes: 45,  price: 4400 },
  { id: "task",        label: "業務",                            minutes: 15,  price: 0, isTask: true },
];

// ─── ユーティリティ ─────────────────────────────────────────────
const menuMap = new Map<string, Menu>(MENUS.map(m => [m.id, m]));
function pad2(n: number) { return String(n).padStart(2, "0"); }
function ymdOf(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function money(n: number) { return n.toLocaleString("ja-JP"); }
function monthKey(ymd: string) { return ymd.slice(0, 7); }
function getPrice(r: Reservation): number {
  return r.customPrice !== undefined ? r.customPrice : (menuMap.get(r.menuId)?.price ?? 0);
}
function isSalesTarget(r: Reservation): boolean {
  return r.status !== "cancelled" && r.menuId !== "task";
}
function genderLabel(g?: Gender) { return g === "male" ? "男" : g === "female" ? "女" : "－"; }
function statusLabel(s: ReservationStatus) { return s === "done" ? "完了" : s === "cancelled" ? "取消" : "未"; }
function getMenuLabel(menuId: string) { return menuMap.get(menuId)?.label ?? menuId; }

// ─── スタイル定数 ───────────────────────────────────────────────
const GREEN  = "rgba(34,197,94,0.9)";
const BORDER = "rgba(255,255,255,0.10)";

function card(extra?: React.CSSProperties): React.CSSProperties {
  return {
    borderRadius: 18, padding: 20,
    background: "linear-gradient(160deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))",
    border: "1px solid rgba(255,255,255,0.09)",
    boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
    ...extra,
  };
}
function inputSt(extra?: React.CSSProperties): React.CSSProperties {
  return {
    borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.28)", color: "rgba(255,255,255,0.92)",
    padding: "9px 12px", outline: "none", fontSize: 14,
    colorScheme: "dark" as any,
    ...extra,
  };
}
function dlBtn(color: string): React.CSSProperties {
  return {
    height: 36, padding: "0 18px", borderRadius: 10, fontWeight: 800, fontSize: 13,
    cursor: "pointer", border: `1px solid ${color}55`,
    background: `${color}22`, color,
  };
}

// ─── KPIカード ─────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div style={{ ...card(), flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 8, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: color ?? "rgba(255,255,255,0.92)", letterSpacing: -1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── 月別棒グラフ ───────────────────────────────────────────────
type MonthlySummary = {
  month: string; count: number; expected: number; actual: number; cancelled: number;
};

function BarChart({ data }: { data: MonthlySummary[] }) {
  if (data.length === 0) return <div style={{ opacity: 0.4, fontSize: 14, padding: 16 }}>データなし</div>;
  const max = Math.max(...data.map(d => d.expected), 1);
  const BAR_H = 160;
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, minWidth: data.length * 76, padding: "8px 4px 0" }}>
        {data.map(d => {
          const expH = (d.expected / max) * BAR_H;
          const actH = (d.actual   / max) * BAR_H;
          return (
            <div key={d.month} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1 }}>
              <div style={{ fontSize: 10, opacity: 0.6, textAlign: "center" }}>¥{money(d.actual)}</div>
              <div style={{ position: "relative", width: "100%", height: BAR_H, display: "flex", alignItems: "flex-end", gap: 3, justifyContent: "center" }}>
                <div style={{ width: "42%", height: expH, background: "rgba(88,166,255,0.25)", borderRadius: "4px 4px 0 0", border: "1px solid rgba(88,166,255,0.4)", transition: "height 0.4s ease" }} />
                <div style={{ width: "42%", height: actH, background: "rgba(34,197,94,0.35)", borderRadius: "4px 4px 0 0", border: "1px solid rgba(34,197,94,0.5)", transition: "height 0.4s ease" }} />
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, whiteSpace: "nowrap" }}>{d.month.slice(5)}月</div>
              <div style={{ fontSize: 10, opacity: 0.5 }}>{d.count}件</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, opacity: 0.65 }}>
        <span><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: "rgba(88,166,255,0.4)", marginRight: 5 }} />見込み</span>
        <span><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: "rgba(34,197,94,0.4)", marginRight: 5 }} />実績</span>
      </div>
    </div>
  );
}

// ─── CSV ダウンロード ──────────────────────────────────────────
function downloadCSV(rows: Reservation[], cancelCountMap: Map<string, number>) {
  const BOM = "\uFEFF";
  const header = ["日付け", "氏名", "性別", "メニュー", "開始", "終了", "売上(円)", "ステータス", "メモ", "キャンセル回数（累計）"];
  const lines = [header.join(",")];
  rows.forEach(r => {
    const cols = [
      r.date,
      `"${r.name}"`,
      genderLabel(r.gender),
      `"${getMenuLabel(r.menuId)}"`,
      r.start,
      r.end,
      r.status === "cancelled" ? "" : getPrice(r),
      statusLabel(r.status),
      `"${(r.memo ?? "").replace(/"/g, '""')}"`,
      cancelCountMap.get(r.name) ?? 0,
    ];
    lines.push(cols.join(","));
  });
  const blob = new Blob([BOM + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `円命堂_売上データ_${ymdOf(new Date())}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ─── 型定義（キャンセル分析） ────────────────────────────────
type CancelPerson = { name: string; cancelCount: number; totalCount: number; cancelRate: number; dates: string[]; lostAmount: number; };

// ─── Excel ダウンロード ───────────────────────────────────────
async function downloadExcel(
  rows: Reservation[],
  cancelCountMap: Map<string, number>,
  monthly: MonthlySummary[],
  cancelByPerson: CancelPerson[]
) {
  await new Promise<void>((resolve, reject) => {
    if ((window as any).XLSX) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("SheetJS load failed"));
    document.head.appendChild(s);
  });
  const XLSX = (window as any).XLSX;
  const wb = XLSX.utils.book_new();

  // シート1: 明細
  const detailData = [
    ["日付け", "氏名", "性別", "メニュー", "開始", "終了", "売上(円)", "ステータス", "メモ", "キャンセル回数（累計）"],
    ...rows.map(r => [
      r.date, r.name, genderLabel(r.gender), getMenuLabel(r.menuId),
      r.start, r.end,
      r.status === "cancelled" ? "" : getPrice(r),
      statusLabel(r.status),
      r.memo ?? "",
      cancelCountMap.get(r.name) ?? 0,
    ]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(detailData);
  ws1["!cols"] = [
    { wch: 12 }, { wch: 14 }, { wch: 5 }, { wch: 28 }, { wch: 7 },
    { wch: 7 },  { wch: 11 }, { wch: 8 }, { wch: 30 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, "明細");

  // シート2: 月別サマリー
  const totalE = monthly.reduce((s, m) => s + m.expected, 0);
  const totalA = monthly.reduce((s, m) => s + m.actual, 0);
  const summaryData = [
    ["月", "件数", "見込み売上(円)", "実績売上(円)", "達成率(%)", "キャンセル件数"],
    ...monthly.map(m => [
      m.month, m.count, m.expected, m.actual,
      m.expected > 0 ? Math.round(m.actual / m.expected * 100) : 0,
      m.cancelled,
    ]),
    ["合計", monthly.reduce((s, m) => s + m.count, 0), totalE, totalA,
      totalE > 0 ? Math.round(totalA / totalE * 100) : 0,
      monthly.reduce((s, m) => s + m.cancelled, 0)],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
  ws2["!cols"] = [{ wch: 10 }, { wch: 8 }, { wch: 16 }, { wch: 14 }, { wch: 11 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, "月別サマリー");

  // シート3: キャンセル分析
  const cancelData = [
    ["氏名", "キャンセル率(%)", "キャンセル回数", "総来院回数", "機会損失額(円)", "キャンセル日一覧"],
    ...cancelByPerson.map(p => [p.name, p.cancelRate, p.cancelCount, p.totalCount, p.lostAmount, p.dates.join(" / ")]),
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(cancelData);
  ws3["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws3, "キャンセル分析");

  XLSX.writeFile(wb, `円命堂_売上データ_${ymdOf(new Date())}.xlsx`);
}

// ─── メインコンポーネント ────────────────────────────────────
export default function StatsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const today = new Date();
  const [fromDate, setFromDate] = useState(() => ymdOf(new Date(today.getFullYear(), today.getMonth() - 2, 1)));
  const [toDate,   setToDate]   = useState(() => ymdOf(new Date(today.getFullYear(), today.getMonth() + 1, 0)));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) setReservations(p); }
    } catch {}
  }, []);

  function setPreset(months: number) {
    setFromDate(ymdOf(new Date(today.getFullYear(), today.getMonth() - (months - 1), 1)));
    setToDate(ymdOf(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
  }

  const filtered = useMemo(() =>
    reservations.filter(r => r.date >= fromDate && r.date <= toDate)
      .sort((a, b) => a.date.localeCompare(b.date)),
    [reservations, fromDate, toDate]
  );

  const cancelCountMap = useMemo(() => {
    const map = new Map<string, number>();
    reservations.forEach(r => {
      if (r.status === "cancelled" && r.menuId !== "task")
        map.set(r.name, (map.get(r.name) ?? 0) + 1);
    });
    return map;
  }, [reservations]);

  const kpi = useMemo(() => {
    const targets   = filtered.filter(isSalesTarget);
    const done      = filtered.filter(r => r.status === "done" && r.menuId !== "task");
    const expected  = targets.reduce((s, r) => s + getPrice(r), 0);
    const actual    = done.reduce((s, r) => s + getPrice(r), 0);
    const count     = targets.length;
    const cancelled = filtered.filter(r => r.status === "cancelled" && r.menuId !== "task").length;
    return {
      expected, actual, count, cancelled,
      avg: count > 0 ? Math.round(expected / count) : 0,
      pct: expected > 0 ? Math.round(actual / expected * 100) : 0,
    };
  }, [filtered]);

  const monthlySummary = useMemo((): MonthlySummary[] => {
    const map = new Map<string, MonthlySummary>();
    filtered.forEach(r => {
      const mk = monthKey(r.date);
      if (!map.has(mk)) map.set(mk, { month: mk, count: 0, expected: 0, actual: 0, cancelled: 0 });
      const s = map.get(mk)!;
      if (r.menuId === "task") return;
      if (r.status === "cancelled") { s.cancelled++; return; }
      s.count++;
      s.expected += getPrice(r);
      if (r.status === "done") s.actual += getPrice(r);
    });
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [filtered]);

  const [showCancelOnly, setShowCancelOnly] = useState(false);
  const tableRows = useMemo(() =>
    filtered.filter(r => r.menuId !== "task" && (!showCancelOnly || r.status === "cancelled")),
    [filtered, showCancelOnly]
  );

  const cancelByPerson = useMemo((): CancelPerson[] => {
    const map = new Map<string, CancelPerson>();
    filtered.forEach(r => {
      if (r.menuId === "task") return;
      if (!map.has(r.name)) map.set(r.name, { name: r.name, cancelCount: 0, totalCount: 0, cancelRate: 0, dates: [], lostAmount: 0 });
      const p = map.get(r.name)!;
      p.totalCount++;
      if (r.status === "cancelled") {
        p.cancelCount++;
        p.dates.push(r.date);
        p.lostAmount += getPrice(r);
      }
    });
    return Array.from(map.values())
      .filter(p => p.cancelCount > 0)
      .map(p => ({ ...p, cancelRate: Math.round(p.cancelCount / p.totalCount * 100) }))
      .sort((a, b) => b.cancelRate - a.cancelRate);
  }, [filtered]);

  const presets = [
    { label: "今月", m: 1 }, { label: "3ヶ月", m: 3 }, { label: "6ヶ月", m: 6 }, { label: "1年", m: 12 },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#060910", color: "rgba(255,255,255,0.92)", fontFamily: "'Hiragino Sans','Yu Gothic UI',sans-serif", padding: "16px" }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar{height:6px;width:6px}
        ::-webkit-scrollbar-track{background:rgba(255,255,255,0.04);border-radius:3px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:3px}
        input::placeholder{color:rgba(255,255,255,0.35)}
        tbody tr:hover td { background: rgba(255,255,255,0.03); }
      `}</style>

      <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ヘッダー */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN, boxShadow: `0 0 10px ${GREEN}` }} />
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1 }}>PEAK MANAGER</div>
          <div style={{ opacity: 0.5, fontSize: 14 }}>/ 経営指標</div>
          <a href="/reception" style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", textDecoration: "none", fontWeight: 700 }}>← 予約管理</a>
          <a href="/karute"    style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", textDecoration: "none", fontWeight: 700 }}>📋 カルテ</a>
        </div>

        {/* 期間フィルター＋ダウンロード */}
        <div style={{ ...card(), display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 15, fontWeight: 900 }}>📅 期間</div>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={inputSt()} />
          <span style={{ opacity: 0.5 }}>〜</span>
          <input type="date" value={toDate}   onChange={e => setToDate(e.target.value)}   style={inputSt()} />
          <div style={{ display: "flex", gap: 6 }}>
            {presets.map(p => (
              <button key={p.label} onClick={() => setPreset(p.m)}
                style={{ height: 34, padding: "0 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.13)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)", cursor: "pointer", fontWeight: 800, fontSize: 13 }}>
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={() => downloadCSV(tableRows, cancelCountMap)}                               style={dlBtn("rgba(34,197,94,0.9)")}>⬇ CSV</button>
            <button onClick={() => downloadExcel(tableRows, cancelCountMap, monthlySummary, cancelByPerson)} style={dlBtn("rgba(88,166,255,0.9)")}>⬇ Excel</button>
          </div>
        </div>

        {/* KPI */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <KpiCard label="実績売上"   value={`¥${money(kpi.actual)}`}    color={GREEN} />
          <KpiCard label="見込み売上" value={`¥${money(kpi.expected)}`} />
          <KpiCard label="達成率"     value={`${kpi.pct}%`}              color={kpi.pct >= 80 ? GREEN : "rgba(251,191,36,0.9)"} />
          <KpiCard label="件数"       value={`${kpi.count}件`}            sub={`キャンセル ${kpi.cancelled}件`} />
          <KpiCard label="平均単価"   value={`¥${money(kpi.avg)}`} />
        </div>

        {/* グラフ＋月別テーブル */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 16 }}>
          <div style={card()}>
            <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 14 }}>📊 月別売上</div>
            <BarChart data={monthlySummary} />
          </div>
          <div style={{ ...card(), overflowX: "auto" }}>
            <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 14 }}>月別サマリー</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {["月", "件数", "見込み", "実績", "達成率"].map(h => (
                    <th key={h} style={{ fontSize: 12, opacity: 0.55, fontWeight: 700, padding: "6px 8px", textAlign: h === "月" ? "left" : "right" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlySummary.length === 0 && (
                  <tr><td colSpan={5} style={{ opacity: 0.4, padding: "16px 8px" }}>データなし</td></tr>
                )}
                {monthlySummary.map(m => {
                  const pct = m.expected > 0 ? Math.round(m.actual / m.expected * 100) : null;
                  return (
                    <tr key={m.month} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "8px 8px", fontWeight: 700 }}>{m.month}</td>
                      <td style={{ padding: "8px 8px", textAlign: "right", opacity: 0.8 }}>{m.count}</td>
                      <td style={{ padding: "8px 8px", textAlign: "right", opacity: 0.65 }}>¥{money(m.expected)}</td>
                      <td style={{ padding: "8px 8px", textAlign: "right", color: GREEN, fontWeight: 900 }}>¥{money(m.actual)}</td>
                      <td style={{ padding: "8px 8px", textAlign: "right", fontWeight: 700, color: pct !== null && pct >= 80 ? GREEN : "rgba(251,191,36,0.9)" }}>
                        {pct !== null ? `${pct}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
                {monthlySummary.length > 0 && (() => {
                  const totalE = monthlySummary.reduce((s, m) => s + m.expected, 0);
                  const totalA = monthlySummary.reduce((s, m) => s + m.actual, 0);
                  const totalC = monthlySummary.reduce((s, m) => s + m.count, 0);
                  const pct = totalE > 0 ? Math.round(totalA / totalE * 100) : null;
                  return (
                    <tr style={{ borderTop: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "9px 8px", fontWeight: 900 }}>合計</td>
                      <td style={{ padding: "9px 8px", textAlign: "right", fontWeight: 900 }}>{totalC}</td>
                      <td style={{ padding: "9px 8px", textAlign: "right", opacity: 0.65, fontWeight: 900 }}>¥{money(totalE)}</td>
                      <td style={{ padding: "9px 8px", textAlign: "right", color: GREEN, fontWeight: 900 }}>¥{money(totalA)}</td>
                      <td style={{ padding: "9px 8px", textAlign: "right", fontWeight: 900 }}>{pct !== null ? `${pct}%` : "—"}</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* キャンセル分析 */}
        {cancelByPerson.length > 0 && (
          <div style={{ ...card(), overflowX: "auto" }}>
            <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 14 }}>
              🚫 キャンセル分析
              <span style={{ fontSize: 13, fontWeight: 400, opacity: 0.5, marginLeft: 10 }}>期間内・キャンセル率順</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {["氏名", "キャンセル率", "回数 / 総来院", "機会損失額", "キャンセル日"].map(h => (
                    <th key={h} style={{ fontSize: 12, opacity: 0.55, fontWeight: 700, padding: "6px 10px", textAlign: h === "氏名" || h === "キャンセル日" ? "left" : "right", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cancelByPerson.map(p => {
                  const rateColor = p.cancelRate >= 50 ? "#f87171" : p.cancelRate >= 30 ? "rgba(251,191,36,0.9)" : "rgba(255,255,255,0.7)";
                  const rateBg    = p.cancelRate >= 50 ? "rgba(239,68,68,0.2)" : p.cancelRate >= 30 ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.08)";
                  return (
                    <tr key={p.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "9px 10px", fontWeight: 700 }}>{p.name}</td>
                      <td style={{ padding: "9px 10px", textAlign: "right" }}>
                        <span style={{ fontSize: 13, fontWeight: 900, padding: "2px 10px", borderRadius: 6, background: rateBg, color: rateColor }}>
                          {p.cancelRate}%
                        </span>
                      </td>
                      <td style={{ padding: "9px 10px", textAlign: "right", opacity: 0.75 }}>
                        {p.cancelCount} / {p.totalCount}回
                      </td>
                      <td style={{ padding: "9px 10px", textAlign: "right", color: "rgba(239,68,68,0.7)", fontWeight: 900 }}>
                        ¥{money(p.lostAmount)}
                      </td>
                      <td style={{ padding: "9px 10px", opacity: 0.6, fontSize: 12 }}>
                        {p.dates.join("　")}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.03)" }}>
                  <td style={{ padding: "9px 10px", fontWeight: 900 }}>合計</td>
                  <td />
                  <td style={{ padding: "9px 10px", textAlign: "right", fontWeight: 900 }}>
                    {cancelByPerson.reduce((s, p) => s + p.cancelCount, 0)} / {cancelByPerson.reduce((s, p) => s + p.totalCount, 0)}回
                  </td>
                  <td style={{ padding: "9px 10px", textAlign: "right", color: "rgba(239,68,68,0.7)", fontWeight: 900 }}>
                    ¥{money(cancelByPerson.reduce((s, p) => s + p.lostAmount, 0))}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* 明細テーブル */}
        <div style={{ ...card(), overflowX: "auto" }}>
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
            明細一覧
            <span style={{ fontSize: 13, fontWeight: 400, opacity: 0.5 }}>{tableRows.length}件</span>
            <button onClick={() => setShowCancelOnly(v => !v)} style={{
              height: 30, padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer",
              border: showCancelOnly ? "1px solid rgba(239,68,68,0.6)" : "1px solid rgba(255,255,255,0.13)",
              background: showCancelOnly ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.06)",
              color: showCancelOnly ? "#f87171" : "rgba(255,255,255,0.6)",
            }}>
              {showCancelOnly ? "✕ キャンセルのみ解除" : "🚫 キャンセルのみ表示"}
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 860 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {["日付け", "氏名", "性別", "メニュー", "開始", "終了", "売上(円)", "ステータス", "メモ", "累計キャンセル"].map(h => (
                  <th key={h} style={{ fontSize: 12, opacity: 0.55, fontWeight: 700, padding: "7px 10px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 && (
                <tr><td colSpan={10} style={{ opacity: 0.4, padding: "20px 10px" }}>期間内のデータなし</td></tr>
              )}
              {tableRows.map(r => {
                const isCancelled = r.status === "cancelled";
                const isDone      = r.status === "done";
                const price       = getPrice(r);
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: isCancelled ? 0.55 : 1 }}>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{r.date}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 700, whiteSpace: "nowrap" }}>{r.name}</td>
                    <td style={{ padding: "8px 10px", opacity: 0.7 }}>{genderLabel(r.gender)}</td>
                    <td style={{ padding: "8px 10px", opacity: 0.8, whiteSpace: "nowrap" }}>{getMenuLabel(r.menuId)}</td>
                    <td style={{ padding: "8px 10px", opacity: 0.7, whiteSpace: "nowrap" }}>{r.start}</td>
                    <td style={{ padding: "8px 10px", opacity: 0.7, whiteSpace: "nowrap" }}>{r.end}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 900, textAlign: "right", whiteSpace: "nowrap",
                      color: isCancelled ? "rgba(239,68,68,0.7)" : isDone ? GREEN : "rgba(255,255,255,0.7)" }}>
                      {isCancelled ? "—" : `¥${money(price)}`}
                    </td>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 900, padding: "2px 8px", borderRadius: 5,
                        background: isCancelled ? "rgba(239,68,68,0.2)" : isDone ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)",
                        color: isCancelled ? "#f87171" : isDone ? "#22c55e" : "rgba(255,255,255,0.55)" }}>
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td style={{ padding: "8px 10px", opacity: 0.6, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.memo || "—"}
                    </td>
                    <td style={{ padding: "8px 10px", textAlign: "center", opacity: 0.7 }}>
                      {cancelCountMap.get(r.name) ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}