"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";

/* =========================
   型
========================= */
type ReservationStatus = "todo" | "done";

type Reservation = {
  id: string;
  date: string;
  start: string;
  end: string;
  name: string;
  menuId: string;
  memo: string;
  status: ReservationStatus;
  createdAt: number;
};

type Menu = {
  id: string;
  label: string;
  minutes: number;
  price: number;
};

/* =========================
   定数
========================= */
const LS_KEY = "enmeidou_reception_v2";
const OPEN = "08:00";
const CLOSE = "22:00";
const SNAP_MIN = 30;

const MENUS: Menu[] = [
  { id: "jp_new_120", label: "国内新規（120分）", minutes: 120, price: 9000 },
  { id: "jp_r_45", label: "国内R（45分）", minutes: 45, price: 6800 },
  { id: "jp_maint_30", label: "国内メンテ（30分）", minutes: 30, price: 5500 },
  { id: "int_new_120", label: "インターナショナル新規（120分）", minutes: 120, price: 18000 },
  { id: "int_r_60", label: "インターナショナルR（60分）", minutes: 60, price: 12000 },
  { id: "stu_new_60", label: "学生新規（高校生迄）（60分）", minutes: 60, price: 6600 },
  { id: "stu_r_45", label: "学生R（高校生迄）（45分）", minutes: 45, price: 4400 },
];

/* =========================
   ユーティリティ
========================= */
function pad2(n: number) { return String(n).padStart(2, "0"); }
function ymdOf(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function hhmmToMin(s: string) { const [h,m]=s.split(":").map(Number); return h*60+m; }
function minToHHMM(min: number) { return `${pad2(Math.floor(min/60))}:${pad2(min%60)}`; }
function addMin(hhmm: string, plus: number) { return minToHHMM(hhmmToMin(hhmm)+plus); }
function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
function monthKey(ymd: string) { return ymd.slice(0, 7); }
function money(n: number) { return n.toLocaleString("ja-JP"); }
function uid() { return `${Date.now()}_${Math.random().toString(16).slice(2)}`; }

const openMin = hhmmToMin(OPEN);
const closeMin = hhmmToMin(CLOSE);
const totalMin = closeMin - openMin;
const PX_PER_MIN = 2.2;

/* =========================
   時刻スロット生成
========================= */
function getSlots() {
  const out: string[] = [];
  for (let m = openMin; m <= closeMin; m += SNAP_MIN) out.push(minToHHMM(m));
  return out;
}
function getLabelSlots() {
  const out: string[] = [];
  for (let m = openMin; m <= closeMin; m += 60) out.push(minToHHMM(m));
  return out;
}

/* =========================
   COLORS
========================= */
const BLUE = "rgba(88,166,255,0.9)";
const GREEN = "rgba(34,197,94,0.9)";
const BLUE_DIM = "rgba(88,166,255,0.18)";
const GREEN_DIM = "rgba(34,197,94,0.18)";
const BORDER = "rgba(255,255,255,0.10)";
const CARD_BG = "rgba(255,255,255,0.04)";
const INPUT_BG = "rgba(0,0,0,0.30)";

export default function ReceptionPage() {
  const [selectedDate, setSelectedDate] = useState(() => ymdOf(new Date()));
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;
  });

  // フォーム
  const [name, setName] = useState("");
  const [start, setStart] = useState(OPEN);
  const [menuId, setMenuId] = useState(MENUS[0].id);
  const [memo, setMemo] = useState("");

  // ドラッグ
  const draggingRef = useRef<{ id: string; startX: number; origMin: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  /* ---- localStorage ---- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setReservations(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(reservations)); } catch {}
  }, [reservations]);

  const menuMap = useMemo(() => {
    const m = new Map<string, Menu>();
    MENUS.forEach(x => m.set(x.id, x));
    return m;
  }, []);

  /* ---- 対象日の予約 ---- */
  const dayReservations = useMemo(() =>
    reservations
      .filter(r => r.date === selectedDate)
      .sort((a,b) => hhmmToMin(a.start) - hhmmToMin(b.start)),
    [reservations, selectedDate]
  );

  /* ---- 売上 ---- */
  const sales = useMemo(() => {
    const mk = monthKey(selectedDate);
    let expected = 0, actual = 0;
    reservations.forEach(r => {
      if (monthKey(r.date) !== mk) return;
      const price = menuMap.get(r.menuId)?.price ?? 0;
      expected += price;
      if (r.status === "done") actual += price;
    });
    const pct = expected > 0 ? Math.round(actual/expected*100) : 0;
    return { expected, actual, pct };
  }, [reservations, selectedDate, menuMap]);

  /* ---- カレンダー ---- */
  const monthDays = useMemo(() => {
    const y = monthCursor.getFullYear(), m = monthCursor.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m+1, 0);
    const startDay = first.getDay();
    const cells: { date: Date; inMonth: boolean }[] = [];
    const prevLast = new Date(y, m, 0).getDate();
    for (let i=0; i<startDay; i++)
      cells.push({ date: new Date(y, m-1, prevLast-(startDay-1-i)), inMonth: false });
    for (let d=1; d<=last.getDate(); d++)
      cells.push({ date: new Date(y, m, d), inMonth: true });
    while (cells.length < 42) {
      const last = cells[cells.length-1].date;
      const next = new Date(last); next.setDate(last.getDate()+1);
      cells.push({ date: next, inMonth: false });
    }
    return cells;
  }, [monthCursor]);

  const countsByDay = useMemo(() => {
    const mk = monthKey(ymdOf(monthCursor));
    const map = new Map<string, number>();
    reservations.forEach(r => {
      if (monthKey(r.date) !== mk) return;
      map.set(r.date, (map.get(r.date) ?? 0) + 1);
    });
    return map;
  }, [reservations, monthCursor]);

  /* ---- 予約追加 ---- */
  function addReservation() {
    if (!name.trim()) return;
    const menu = menuMap.get(menuId) ?? MENUS[0];
    const endMin = clamp(hhmmToMin(start) + menu.minutes, openMin + SNAP_MIN, closeMin);
    const r: Reservation = {
      id: uid(), date: selectedDate, start,
      end: minToHHMM(endMin),
      name: name.trim(), menuId, memo: memo.trim(),
      status: "todo", createdAt: Date.now(),
    };
    setReservations(prev => [...prev, r]);
    setName(""); setMemo("");
  }

  function toggleDone(id: string) {
    setReservations(prev => prev.map(r =>
      r.id === id ? { ...r, status: r.status === "done" ? "todo" : "done" } : r
    ));
  }

  function removeReservation(id: string) {
    setReservations(prev => prev.filter(r => r.id !== id));
  }

  /* ---- ドラッグ（ネイティブ） ---- */
  function onMouseDown(e: React.MouseEvent, id: string) {
    e.preventDefault();
    const r = reservations.find(x => x.id === id);
    if (!r) return;
    draggingRef.current = {
      id,
      startX: e.clientX,
      origMin: hhmmToMin(r.start),
    };

    function onMouseMove(ev: MouseEvent) {
      if (!draggingRef.current || !timelineRef.current) return;
      const dx = ev.clientX - draggingRef.current.startX;
      const dMin = Math.round(dx / PX_PER_MIN / SNAP_MIN) * SNAP_MIN;
      let newStartMin = clamp(draggingRef.current.origMin + dMin, openMin, closeMin - SNAP_MIN);

      setReservations(prev => prev.map(rv => {
        if (rv.id !== draggingRef.current!.id) return rv;
        const menu = menuMap.get(rv.menuId);
        const dur = menu?.minutes ?? (hhmmToMin(rv.end) - hhmmToMin(rv.start));
        const endMin = clamp(newStartMin + dur, openMin + SNAP_MIN, closeMin);
        const adjustedStart = clamp(endMin - dur, openMin, closeMin - SNAP_MIN);
        return { ...rv, start: minToHHMM(adjustedStart), end: minToHHMM(endMin) };
      }));
    }

    function onMouseUp() {
      draggingRef.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  const todayYMD = ymdOf(new Date());
  const slots = getSlots();
  const labelSlots = getLabelSlots();
  const timelineWidth = totalMin * PX_PER_MIN;

  /* =========================
     レンダリング
  ========================= */
  return (
    <div style={{
      minHeight: "100vh",
      background: "#060910",
      color: "rgba(255,255,255,0.92)",
      fontFamily: "'Hiragino Sans', 'Yu Gothic UI', sans-serif",
      padding: "16px",
    }}>
      <style>{`
        * { box-sizing: border-box; }
        select, option { background: #0b1220 !important; color: rgba(255,255,255,0.92) !important; }
        ::-webkit-scrollbar { height: 6px; width: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.04); border-radius: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.35); }
      `}</style>

      <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ===== ヘッダー ===== */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 4 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: GREEN, boxShadow: `0 0 10px ${GREEN}`,
          }} />
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1 }}>PEAK MANAGER</div>
          <div style={{ opacity: 0.5, fontSize: 13 }}>/ 円明堂 予約管理</div>
          <div style={{ marginLeft: "auto", opacity: 0.6, fontSize: 13 }}>{selectedDate}</div>
        </div>

        {/* ===== タイムライン ===== */}
        <div style={card()}>
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10, opacity: 0.9 }}>
            📅 タイムライン <span style={{ opacity: 0.55, fontWeight: 400, fontSize: 13 }}>ブロックをドラッグして時刻変更（30分刻み）</span>
          </div>

          <div ref={timelineRef} style={{ overflowX: "auto", paddingBottom: 4 }}>
            <div style={{ width: timelineWidth, minWidth: "100%" }}>

              {/* 時刻ラベル */}
              <div style={{ display: "flex", marginBottom: 6 }}>
                {labelSlots.map(t => (
                  <div key={t} style={{
                    width: 60 * PX_PER_MIN, fontSize: 12,
                    color: "rgba(255,255,255,0.55)", flexShrink: 0,
                  }}>{t}</div>
                ))}
              </div>

              {/* グリッド + ブロック */}
              <div style={{
                position: "relative", height: 72,
                background: "rgba(0,0,0,0.25)",
                borderRadius: 14,
                border: `1px solid ${BORDER}`,
              }}>
                {/* 縦線 */}
                {slots.map(t => {
                  const left = (hhmmToMin(t) - openMin) * PX_PER_MIN;
                  const strong = hhmmToMin(t) % 60 === 0;
                  return (
                    <div key={t} style={{
                      position: "absolute", left, top: 0, bottom: 0, width: 1,
                      background: strong ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
                    }} />
                  );
                })}

                {/* 予約ブロック */}
                {dayReservations.map(r => {
                  const menu = menuMap.get(r.menuId);
                  const left = (hhmmToMin(r.start) - openMin) * PX_PER_MIN;
                  const width = (hhmmToMin(r.end) - hhmmToMin(r.start)) * PX_PER_MIN;
                  const isDone = r.status === "done";

                  return (
                    <div
                      key={r.id}
                      onMouseDown={e => onMouseDown(e, r.id)}
                      style={{
                        position: "absolute",
                        left, top: 8, height: 56,
                        width: Math.max(width, 50),
                        cursor: "grab",
                        zIndex: 5,
                        userSelect: "none",
                      }}
                    >
                      <div style={{
                        height: "100%",
                        borderRadius: 12,
                        padding: "6px 10px",
                        background: isDone
                          ? `linear-gradient(135deg, ${GREEN_DIM}, rgba(34,197,94,0.08))`
                          : `linear-gradient(135deg, ${BLUE_DIM}, rgba(88,166,255,0.08))`,
                        border: `1px solid ${isDone ? "rgba(34,197,94,0.4)" : "rgba(88,166,255,0.4)"}`,
                        boxShadow: `0 4px 16px ${isDone ? "rgba(34,197,94,0.12)" : "rgba(88,166,255,0.12)"}`,
                        overflow: "hidden",
                        display: "flex", flexDirection: "column", justifyContent: "center", gap: 2,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.start}–{r.end}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.name} · {menu?.label ?? ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ===== 下段3カラム ===== */}
        <div style={{ display: "grid", gridTemplateColumns: "420px 1fr 320px", gap: 14, alignItems: "start" }}>

          {/* ===== カレンダー ===== */}
          <div style={card()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>
                {monthCursor.getFullYear()} / {monthCursor.getMonth()+1}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {["◀","今日","▶"].map((label, i) => (
                  <button key={label} onClick={() => {
                    if (i === 1) {
                      const t = new Date(); t.setDate(1); t.setHours(0,0,0,0);
                      setMonthCursor(t); setSelectedDate(ymdOf(new Date()));
                    } else {
                      const d = new Date(monthCursor);
                      d.setMonth(d.getMonth() + (i === 0 ? -1 : 1));
                      setMonthCursor(d);
                    }
                  }} style={miniBtn()}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 曜日 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
              {["日","月","火","水","木","金","土"].map((w,i) => (
                <div key={w} style={{
                  textAlign: "center", fontSize: 11, opacity: 0.55,
                  color: i === 0 ? "rgba(255,100,100,0.8)" : i === 6 ? "rgba(100,180,255,0.8)" : undefined,
                }}>{w}</div>
              ))}
            </div>

            {/* 日付 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
              {monthDays.map((cell, i) => {
                const ymd = ymdOf(cell.date);
                const isSelected = ymd === selectedDate;
                const isToday = ymd === todayYMD;
                const count = countsByDay.get(ymd) ?? 0;
                const dow = cell.date.getDay();

                return (
                  <button key={`${ymd}_${i}`} onClick={() => setSelectedDate(ymd)} style={{
                    height: 52, borderRadius: 12, position: "relative",
                    border: isSelected ? "2px solid rgba(88,166,255,0.8)" : `1px solid ${BORDER}`,
                    background: isSelected ? "rgba(88,166,255,0.12)" : isToday ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.18)",
                    color: !cell.inMonth ? "rgba(255,255,255,0.25)"
                      : dow === 0 ? "rgba(255,120,120,0.9)"
                      : dow === 6 ? "rgba(100,180,255,0.9)"
                      : "rgba(255,255,255,0.92)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    overflow: "hidden",
                  }}>
                    <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1 }}>{cell.date.getDate()}</div>
                    {count > 0 && (
                      <div style={{
                        position: "absolute", right: 5, bottom: 5,
                        fontSize: 11, fontWeight: 900,
                        color: "rgba(34,197,94,1)",
                        textShadow: "0 0 8px rgba(34,197,94,0.9), 0 0 16px rgba(34,197,94,0.5)",
                      }}>{count}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ===== 予約入力 ===== */}
          <div style={card()}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 14 }}>予約入力</div>

            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={labelSt()}>氏名 <span style={{ color: "rgba(255,100,100,0.8)", fontSize: 11 }}>※必須</span></label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addReservation()}
                  placeholder="例：山田 太郎"
                  style={inputSt()}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelSt()}>開始時刻</label>
                  <select value={start} onChange={e => setStart(e.target.value)} style={inputSt()}>
                    {slots.slice(0, -1).map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelSt()}>対象日</label>
                  <input value={selectedDate} readOnly style={inputSt({ opacity: 0.75 })} />
                </div>
              </div>

              <div>
                <label style={labelSt()}>メニュー</label>
                <select value={menuId} onChange={e => setMenuId(e.target.value)} style={inputSt()}>
                  {MENUS.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.label}　¥{money(m.price)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelSt()}>メモ（任意）</label>
                <textarea
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  placeholder="例：腰痛 / 自律神経 / 紹介…"
                  style={inputSt({ minHeight: 72, resize: "vertical" })}
                />
              </div>

              <button
                onClick={addReservation}
                disabled={!name.trim()}
                style={{
                  height: 48, borderRadius: 14,
                  border: `1px solid rgba(88,166,255,0.40)`,
                  background: name.trim()
                    ? "linear-gradient(135deg, rgba(88,166,255,0.75), rgba(88,166,255,0.40))"
                    : "rgba(255,255,255,0.06)",
                  color: name.trim() ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.35)",
                  fontWeight: 900, fontSize: 15,
                  cursor: name.trim() ? "pointer" : "not-allowed",
                  transition: "all 0.2s",
                  boxShadow: name.trim() ? "0 8px 24px rgba(88,166,255,0.20)" : "none",
                }}
              >
                ＋ 予約を追加
              </button>
            </div>
          </div>

          {/* ===== 右: 売上 + 名簿 ===== */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* 売上 */}
            <div style={card()}>
              <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 12 }}>
                📊 売上進捗 <span style={{ opacity: 0.5, fontSize: 11, fontWeight: 400 }}>{monthKey(selectedDate)}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div style={miniCard()}>
                  <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>見込み</div>
                  <div style={{ fontSize: 20, fontWeight: 900 }}>¥{money(sales.expected)}</div>
                </div>
                <div style={miniCard()}>
                  <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>実績</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: GREEN }}>{money(sales.actual) ? `¥${money(sales.actual)}` : "¥0"}</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
                <span>進捗</span><span style={{ fontWeight: 900 }}>{sales.pct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${clamp(sales.pct, 0, 100)}%`,
                  background: `linear-gradient(90deg, ${GREEN}, ${BLUE})`,
                  transition: "width 0.4s ease",
                }} />
              </div>
            </div>

            {/* 名簿 */}
            <div style={card()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 900 }}>
                  名簿 <span style={{ opacity: 0.5, fontSize: 11, fontWeight: 400 }}>（当日 / 最大10件）</span>
                </div>
              </div>

              {dayReservations.length === 0 ? (
                <div style={{ fontSize: 13, opacity: 0.45, padding: "8px 0" }}>予約なし</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {dayReservations.slice(0, 10).map(r => {
                    const menu = menuMap.get(r.menuId);
                    const isDone = r.status === "done";
                    return (
                      <div
                        key={r.id}
                        onClick={() => toggleDone(r.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "8px 10px",
                          borderRadius: 12,
                          background: isDone ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${isDone ? "rgba(34,197,94,0.25)" : BORDER}`,
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        {/* 済チェック */}
                        <div style={{
                          width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                          border: isDone ? `2px solid ${GREEN}` : "2px solid rgba(255,255,255,0.25)",
                          background: isDone ? "rgba(34,197,94,0.25)" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, color: GREEN,
                        }}>
                          {isDone ? "✓" : ""}
                        </div>

                        {/* 情報 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {r.start}–{r.end}　{r.name || "（氏名なし）"}
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.65, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {menu?.label}　¥{money(menu?.price ?? 0)}
                          </div>
                        </div>

                        {/* 削除 */}
                        <button
                          onClick={e => { e.stopPropagation(); removeReservation(r.id); }}
                          style={{
                            flexShrink: 0, width: 26, height: 26,
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "rgba(255,255,255,0.06)",
                            color: "rgba(255,255,255,0.6)",
                            cursor: "pointer", fontSize: 13,
                          }}
                        >×</button>
                      </div>
                    );
                  })}
                </div>
              )}

              {dayReservations.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
                  <span>本日合計 {dayReservations.length}件</span>
                  <span>¥{money(dayReservations.reduce((s,r) => s + (menuMap.get(r.menuId)?.price ?? 0), 0))}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   スタイルヘルパー
========================= */
function card(): React.CSSProperties {
  return {
    borderRadius: 18, padding: 16,
    background: "linear-gradient(160deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025))",
    border: "1px solid rgba(255,255,255,0.09)",
    boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
  };
}

function miniCard(): React.CSSProperties {
  return {
    borderRadius: 12, padding: 12,
    background: "rgba(0,0,0,0.22)",
    border: "1px solid rgba(255,255,255,0.08)",
  };
}

function miniBtn(): React.CSSProperties {
  return {
    height: 32, padding: "0 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.13)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.85)",
    cursor: "pointer", fontWeight: 800, fontSize: 13,
  };
}

function labelSt(): React.CSSProperties {
  return { display: "block", fontSize: 12, opacity: 0.7, marginBottom: 6, fontWeight: 700 };
}

function inputSt(extra?: React.CSSProperties): React.CSSProperties {
  return {
    width: "100%", borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.28)",
    color: "rgba(255,255,255,0.92)",
    padding: "10px 12px",
    outline: "none",
    fontSize: 14,
    ...extra,
  };
}
