"use client";

import React, { useEffect, useMemo, useState } from "react";

type ReservationStatus = "todo" | "done" | "cancelled";
type Reservation = {
  id: string; date: string; start: string; end: string;
  name: string; menuId: string; memo: string;
  status: ReservationStatus; customPrice?: number;
  gender?: string; createdAt: number;
};
type Menu = { id: string; label: string; minutes: number; price: number; };

const LS_KEY = "enmeidou_reception_v2";

const MENUS: Menu[] = [
  { id: "jp_new_120", label: "国内新規（120分）", minutes: 120, price: 9000 },
  { id: "jp_r_45", label: "国内R（45分）", minutes: 45, price: 6800 },
  { id: "jp_maint_30", label: "国内メンテ（30分）", minutes: 30, price: 5500 },
  { id: "int_new_120", label: "インターナショナル新規（120分）", minutes: 120, price: 18000 },
  { id: "int_r_60", label: "インターナショナルR（60分）", minutes: 60, price: 12000 },
  { id: "stu_new_60", label: "学生新規（高校生迄）（60分）", minutes: 60, price: 6600 },
  { id: "stu_r_45", label: "学生R（高校生迄）（45分）", minutes: 45, price: 4400 },
];

function pad2(n: number) { return String(n).padStart(2, "0"); }
function monthKey(ymd: string) { return ymd.slice(0, 7); }
function money(n: number) { return n.toLocaleString("ja-JP"); }
function getPrice(r: { menuId: string; customPrice?: number }, menuMap: Map<string, { price: number }>) {
  return r.customPrice !== undefined ? r.customPrice : (menuMap.get(r.menuId)?.price ?? 0);
}

const GREEN = "rgba(34,197,94,0.9)";
const BLUE = "rgba(88,166,255,0.9)";
const BORDER = "rgba(255,255,255,0.10)";
const CHART_COLORS = ["#58a6ff","#34d399","#fbbf24","#a78bfa","#f87171","#fb923c","#38bdf8"];

export default function StatsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) setReservations(p); }
    } catch {}
  }, []);

  const menuMap = useMemo(() => {
    const m = new Map<string, Menu>();
    MENUS.forEach(x => m.set(x.id, x));
    return m;
  }, []);

  const validRes = useMemo(() => reservations.filter(r => r.status !== "cancelled"), [reservations]);

  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const mk = `${selectedYear}-${pad2(i + 1)}`;
      const monthRes = reservations.filter(r => monthKey(r.date) === mk);
      const validMonthRes = monthRes.filter(r => r.status !== "cancelled");
      const sales = validMonthRes.reduce((s, r) => s + getPrice(r, menuMap), 0);
      const actual = validMonthRes.filter(r => r.status === "done").reduce((s, r) => s + getPrice(r, menuMap), 0);
      return {
        mk, month: i + 1, sales, actual,
        count: validMonthRes.length,
        cancelled: monthRes.filter(r => r.status === "cancelled").length,
        newCount: monthRes.filter(r => r.menuId.includes("new")).length,
        maleCount: monthRes.filter(r => r.gender === "male").length,
        femaleCount: monthRes.filter(r => r.gender === "female").length,
      };
    });
  }, [reservations, selectedYear, menuMap]);

  const maxSales = useMemo(() => Math.max(...monthlyData.map(m => m.sales), 1), [monthlyData]);
  const maxCount = useMemo(() => Math.max(...monthlyData.map(m => m.count), 1), [monthlyData]);

  const menuSales = useMemo(() => MENUS.map(menu => ({
    ...menu,
    total: validRes.filter(r => r.menuId === menu.id).reduce((s, r) => s + getPrice(r, menuMap), 0),
    count: validRes.filter(r => r.menuId === menu.id).length,
  })).filter(m => m.total > 0).sort((a, b) => b.total - a.total), [validRes, menuMap]);

  const totalMenuSales = useMemo(() => menuSales.reduce((s, m) => s + m.total, 0), [menuSales]);

  const totalStats = useMemo(() => {
    const yearRes = reservations.filter(r => r.date.startsWith(String(selectedYear)));
    const yearValid = yearRes.filter(r => r.status !== "cancelled");
    const totalCancelled = yearRes.filter(r => r.status === "cancelled").length;
    const newCount = yearValid.filter(r => r.menuId.includes("new")).length;
    const nameCounts = new Map<string, number>();
    yearValid.forEach(r => { if (r.name) nameCounts.set(r.name, (nameCounts.get(r.name) ?? 0) + 1); });
    const repeatClients = [...nameCounts.values()].filter(v => v >= 2).length;
    const totalClients = nameCounts.size;
    return {
      totalSales: yearValid.reduce((s, r) => s + getPrice(r, menuMap), 0),
      totalCount: yearValid.length,
      totalCancelled,
      cancelRate: yearRes.length > 0 ? Math.round(totalCancelled / yearRes.length * 100) : 0,
      newRate: yearValid.length > 0 ? Math.round(newCount / yearValid.length * 100) : 0,
      maleCount: yearValid.filter(r => r.gender === "male").length,
      femaleCount: yearValid.filter(r => r.gender === "female").length,
      repeatRate: totalClients > 0 ? Math.round(repeatClients / totalClients * 100) : 0,
      totalClients, repeatClients,
    };
  }, [reservations, selectedYear, menuMap]);

  const genderTotal = totalStats.maleCount + totalStats.femaleCount;
  const maleRate = genderTotal > 0 ? Math.round(totalStats.maleCount / genderTotal * 100) : 50;
  const femaleRate = genderTotal > 0 ? 100 - maleRate : 50;

  const years = useMemo(() => {
    const ys = new Set<number>();
    reservations.forEach(r => ys.add(parseInt(r.date.slice(0, 4))));
    ys.add(new Date().getFullYear());
    return [...ys].sort();
  }, [reservations]);

  return (
    <div style={{ minHeight: "100vh", background: "#060910", color: "rgba(255,255,255,0.92)", fontFamily: "'Hiragino Sans','Yu Gothic UI',sans-serif", padding: 16 }}>
      <style>{`* { box-sizing: border-box; } ::-webkit-scrollbar{height:6px;width:6px} ::-webkit-scrollbar-track{background:rgba(255,255,255,0.04);border-radius:3px} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:3px}`}</style>
      <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ヘッダー */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN, boxShadow: `0 0 10px ${GREEN}` }} />
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1 }}>PEAK MANAGER</div>
          <div style={{ opacity: 0.5, fontSize: 13 }}>/ 経営指標</div>
          <a href="/reception" style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", textDecoration: "none", fontWeight: 700 }}>← 予約管理</a>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, opacity: 0.6 }}>年度：</span>
            {years.map(y => (
              <button key={y} onClick={() => setSelectedYear(y)} style={{
                padding: "4px 14px", borderRadius: 8, fontWeight: 900, fontSize: 13, cursor: "pointer",
                border: selectedYear===y?`2px solid ${BLUE}`:"1px solid rgba(255,255,255,0.15)",
                background: selectedYear===y?"rgba(88,166,255,0.15)":"rgba(255,255,255,0.05)",
                color: selectedYear===y?BLUE:"rgba(255,255,255,0.7)",
              }}>{y}</button>
            ))}
          </div>
        </div>

        {/* KPI */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
          {[
            { label: "年間売上（実績）", value: `¥${money(totalStats.totalSales)}`, color: GREEN },
            { label: "総予約件数", value: `${totalStats.totalCount}件`, color: BLUE },
            { label: "リピート率", value: `${totalStats.repeatRate}%`, color: "#fbbf24" },
            { label: "新規率", value: `${totalStats.newRate}%`, color: "#a78bfa" },
            { label: "キャンセル率", value: `${totalStats.cancelRate}%`, color: "#f87171" },
          ].map(kpi => (
            <div key={kpi.label} style={card()}>
              <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 8 }}>{kpi.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: kpi.color }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* グラフ2つ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={card()}>
            <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 16 }}>📈 月別売上（見込み）</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160 }}>
              {monthlyData.map(m => {
                const h = Math.round((m.sales / maxSales) * 140);
                return (
                  <div key={m.mk} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ fontSize: 9, opacity: 0.6 }}>{m.sales > 0 ? `¥${money(Math.round(m.sales/1000))}k` : ""}</div>
                    <div style={{ width: "100%", height: Math.max(h,2), borderRadius: "4px 4px 0 0", background: m.sales > 0 ? `linear-gradient(180deg,${BLUE},rgba(88,166,255,0.4))` : "rgba(255,255,255,0.05)" }} />
                    <div style={{ fontSize: 10, opacity: 0.6 }}>{m.month}月</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={card()}>
            <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 16 }}>📊 月間予約件数推移</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160 }}>
              {monthlyData.map(m => {
                const h = Math.round((m.count / maxCount) * 140);
                return (
                  <div key={m.mk} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ fontSize: 9, opacity: 0.6 }}>{m.count > 0 ? `${m.count}件` : ""}</div>
                    <div style={{ width: "100%", height: Math.max(h,2), borderRadius: "4px 4px 0 0", background: m.count > 0 ? `linear-gradient(180deg,${GREEN},rgba(34,197,94,0.4))` : "rgba(255,255,255,0.05)" }} />
                    <div style={{ fontSize: 10, opacity: 0.6 }}>{m.month}月</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* メニュー別 + 男女比 + リピート */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px 300px", gap: 14 }}>
          <div style={card()}>
            <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 14 }}>🍽 メニュー別売上比率</div>
            {menuSales.length === 0 ? <div style={{ opacity: 0.4, fontSize: 13 }}>データなし</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {menuSales.map((m, i) => {
                  const pct = totalMenuSales > 0 ? Math.round(m.total / totalMenuSales * 100) : 0;
                  return (
                    <div key={m.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700 }}>{m.label}</span>
                        <span style={{ opacity: 0.7 }}>{m.count}件　¥{money(m.total)}　<span style={{ color: CHART_COLORS[i%CHART_COLORS.length], fontWeight: 900 }}>{pct}%</span></span>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: CHART_COLORS[i%CHART_COLORS.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div style={card()}>
            <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 14 }}>👥 男女比</div>
            {genderTotal === 0 ? <div style={{ opacity: 0.4, fontSize: 13 }}>データなし</div> : (
              <>
                <div style={{ display: "flex", height: 24, borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ width: `${maleRate}%`, background: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff" }}>{maleRate > 15 ? `男 ${maleRate}%` : ""}</div>
                  <div style={{ width: `${femaleRate}%`, background: "#be185d", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff" }}>{femaleRate > 15 ? `女 ${femaleRate}%` : ""}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-around" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "#7dd3fc", marginBottom: 4 }}>男性</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#7dd3fc" }}>{totalStats.maleCount}</div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>件</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "#f9a8d4", marginBottom: 4 }}>女性</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#f9a8d4" }}>{totalStats.femaleCount}</div>
                    <div style={{ fontSize: 11, opacity: 0.6 }}>件</div>
                  </div>
                </div>
              </>
            )}
          </div>
          <div style={card()}>
            <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 14 }}>🔁 来店・リピート</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>総来店者数（ユニーク）</div>
                <div style={{ fontSize: 28, fontWeight: 900 }}>{totalStats.totalClients}<span style={{ fontSize: 14, opacity: 0.6, marginLeft: 4 }}>名</span></div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ opacity: 0.7 }}>リピート率</span>
                  <span style={{ fontWeight: 900, color: "#fbbf24" }}>{totalStats.repeatRate}%</span>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${totalStats.repeatRate}%`, background: "linear-gradient(90deg,#fbbf24,#f59e0b)" }} />
                </div>
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 4 }}>{totalStats.repeatClients}名がリピーター</div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ opacity: 0.7 }}>新規率</span>
                  <span style={{ fontWeight: 900, color: "#a78bfa" }}>{totalStats.newRate}%</span>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${totalStats.newRate}%`, background: "linear-gradient(90deg,#a78bfa,#8b5cf6)" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 月別テーブル */}
        <div style={card()}>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 14 }}>📋 月別詳細（{selectedYear}年）</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {["月","予約件数","取消","売上（見込み）","売上（実績）","新規件数","男性","女性"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "right", opacity: 0.6, fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyData.map(m => (
                  <tr key={m.mk} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 900 }}>{m.month}月</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: m.count>0?BLUE:"rgba(255,255,255,0.3)" }}>{m.count}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: m.cancelled>0?"#f87171":"rgba(255,255,255,0.3)" }}>{m.cancelled}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>¥{money(m.sales)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: GREEN, fontWeight: 700 }}>¥{money(m.actual)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "#a78bfa" }}>{m.newCount}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "#7dd3fc" }}>{m.maleCount}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: "#f9a8d4" }}>{m.femaleCount}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: `2px solid ${BORDER}`, fontWeight: 900 }}>
                  <td style={{ padding: "10px 12px" }}>合計</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: BLUE }}>{monthlyData.reduce((s,m)=>s+m.count,0)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "#f87171" }}>{monthlyData.reduce((s,m)=>s+m.cancelled,0)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>¥{money(monthlyData.reduce((s,m)=>s+m.sales,0))}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: GREEN }}>¥{money(monthlyData.reduce((s,m)=>s+m.actual,0))}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "#a78bfa" }}>{monthlyData.reduce((s,m)=>s+m.newCount,0)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "#7dd3fc" }}>{monthlyData.reduce((s,m)=>s+m.maleCount,0)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "#f9a8d4" }}>{monthlyData.reduce((s,m)=>s+m.femaleCount,0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function card(): React.CSSProperties {
  return { borderRadius: 18, padding: 16, background: "linear-gradient(160deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 12px 32px rgba(0,0,0,0.35)" };
}