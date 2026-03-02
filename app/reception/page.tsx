"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";

type ReservationStatus = "todo" | "done" | "cancelled";
type Gender = "male" | "female" | "none";
type Reservation = {
  id: string; date: string; start: string; end: string;
  name: string; menuId: string; memo: string;
  status: ReservationStatus; customPrice?: number;
  gender?: Gender; createdAt: number;
  customLabel?: string;
};
type Menu = { id: string; label: string; minutes: number; price: number; isTask?: boolean; };

const LS_KEY = "enmeidou_reception_v2";
const TASK_LABEL_KEY = "enmeidou_task_label";
const OPEN = "09:00";
const CLOSE = "22:00";
const SNAP_MIN = 30;
const TASK_SNAP_MIN = 15;

const MENUS: Menu[] = [
  { id: "jp_new_120", label: "国内新規（120分）", minutes: 120, price: 9000 },
  { id: "jp_r_45", label: "国内R（45分）", minutes: 45, price: 6800 },
  { id: "jp_maint_30", label: "国内メンテ（30分）", minutes: 30, price: 5500 },
  { id: "int_new_120", label: "インターナショナル新規（120分）", minutes: 120, price: 18000 },
  { id: "int_r_60", label: "インターナショナルR（60分）", minutes: 60, price: 12000 },
  { id: "stu_new_60", label: "学生新規（高校生迄）（60分）", minutes: 60, price: 6600 },
  { id: "stu_r_45", label: "学生R（高校生迄）（45分）", minutes: 45, price: 4400 },
  { id: "task", label: "業務", minutes: 15, price: 0, isTask: true },
];

function pad2(n: number) { return String(n).padStart(2, "0"); }
function ymdOf(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function hhmmToMin(s: string) { const [h,m]=s.split(":").map(Number); return h*60+m; }
function minToHHMM(min: number) { return `${pad2(Math.floor(min/60))}:${pad2(min%60)}`; }
function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
function monthKey(ymd: string) { return ymd.slice(0, 7); }
function money(n: number) { return n.toLocaleString("ja-JP"); }
function uid() { return `${Date.now()}_${Math.random().toString(16).slice(2)}`; }

const openMin = hhmmToMin(OPEN);
const closeMin = hhmmToMin(CLOSE);
const totalMin = closeMin - openMin;

function getSlots(snap: number) {
  const out: string[] = [];
  for (let m = openMin; m <= closeMin; m += snap) out.push(minToHHMM(m));
  return out;
}
function getLabelSlots() {
  const out: string[] = [];
  for (let m = openMin; m <= closeMin; m += 60) out.push(minToHHMM(m));
  return out;
}

const GREEN = "rgba(34,197,94,0.9)";
const BLUE = "rgba(88,166,255,0.9)";
const BORDER = "rgba(255,255,255,0.10)";

const GENDER_COLORS = {
  male:   { text: "#7dd3fc", badge: "#0284c7", label: "男" },
  female: { text: "#f9a8d4", badge: "#be185d", label: "女" },
  none:   { text: "rgba(255,255,255,0.92)", badge: "#374151", label: "－" },
};

const MENU_COLORS = {
  jp:   { bg: "linear-gradient(135deg,rgba(88,166,255,0.28),rgba(88,166,255,0.10))",   border: "rgba(88,166,255,0.55)",  badge: "#58a6ff", label: "国内" },
  int:  { bg: "linear-gradient(135deg,rgba(251,191,36,0.28),rgba(251,191,36,0.10))",   border: "rgba(251,191,36,0.55)",  badge: "#fbbf24", label: "INT" },
  stu:  { bg: "linear-gradient(135deg,rgba(167,139,250,0.28),rgba(167,139,250,0.10))", border: "rgba(167,139,250,0.55)", badge: "#a78bfa", label: "学生" },
  task: { bg: "linear-gradient(135deg,rgba(100,100,100,0.28),rgba(100,100,100,0.10))", border: "rgba(150,150,150,0.55)", badge: "#9ca3af", label: "業務" },
};

function getMenuColor(menuId: string, taskLabel?: string) {
  if (menuId === "task") return { ...MENU_COLORS.task, label: taskLabel || "業務" };
  if (menuId.startsWith("int")) return MENU_COLORS.int;
  if (menuId.startsWith("stu")) return MENU_COLORS.stu;
  return MENU_COLORS.jp;
}

function getPrice(r: { menuId: string; customPrice?: number }, menuMap: Map<string, { price: number }>) {
  return r.customPrice !== undefined ? r.customPrice : (menuMap.get(r.menuId)?.price ?? 0);
}

export default function ReceptionPage() {
  const [selectedDate, setSelectedDate] = useState(() => ymdOf(new Date()));
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;
  });
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("none");
  const [start, setStart] = useState(OPEN);
  const [menuId, setMenuId] = useState(MENUS[0].id);
  const [memo, setMemo] = useState("");
  const [customPriceInput, setCustomPriceInput] = useState<string>("");
  const [taskLabel, setTaskLabel] = useState("業務");
  const [editingTaskLabel, setEditingTaskLabel] = useState(false);
  const draggingRef = useRef<{ id: string; startX: number; origMin: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const isTask = menuId === "task";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) setReservations(p); }
      const savedLabel = localStorage.getItem(TASK_LABEL_KEY);
      if (savedLabel) setTaskLabel(savedLabel);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(reservations)); } catch {}
  }, [reservations]);

  useEffect(() => {
    try { localStorage.setItem(TASK_LABEL_KEY, taskLabel); } catch {}
  }, [taskLabel]);

  const menuMap = useMemo(() => {
    const m = new Map<string, Menu>();
    MENUS.forEach(x => m.set(x.id, x));
    return m;
  }, []);

  function handleMenuChange(newMenuId: string) {
    setMenuId(newMenuId);
    const m = MENUS.find(x => x.id === newMenuId);
    if (m) setCustomPriceInput(m.isTask ? "" : String(m.price));
  }

  const dayReservations = useMemo(() =>
    reservations.filter(r => r.date === selectedDate)
      .sort((a,b) => hhmmToMin(a.start) - hhmmToMin(b.start)),
    [reservations, selectedDate]
  );

  const sales = useMemo(() => {
    const mk = monthKey(selectedDate);
    let expected = 0, actual = 0;
    reservations.forEach(r => {
      if (monthKey(r.date) !== mk) return;
      if (r.status === "cancelled" || r.menuId === "task") return;
      const price = getPrice(r, menuMap);
      expected += price;
      if (r.status === "done") actual += price;
    });
    return { expected, actual, pct: expected > 0 ? Math.round(actual/expected*100) : 0 };
  }, [reservations, selectedDate, menuMap]);

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
      const lc = cells[cells.length-1].date;
      const nx = new Date(lc); nx.setDate(lc.getDate()+1);
      cells.push({ date: nx, inMonth: false });
    }
    return cells;
  }, [monthCursor]);

  const countsByDay = useMemo(() => {
    const mk = monthKey(ymdOf(monthCursor));
    const map = new Map<string, number>();
    reservations.forEach(r => {
      if (monthKey(r.date) !== mk) return;
      if (r.status === "cancelled" || r.menuId === "task") return;
      map.set(r.date, (map.get(r.date) ?? 0) + 1);
    });
    return map;
  }, [reservations, monthCursor]);

  function addReservation() {
    if (!isTask && !name.trim()) return;
    const menu = menuMap.get(menuId) ?? MENUS[0];
    const snap = isTask ? TASK_SNAP_MIN : SNAP_MIN;
    const endMin = clamp(hhmmToMin(start) + menu.minutes, openMin + snap, closeMin);
    const cp = customPriceInput !== "" ? Number(customPriceInput) : undefined;
    setReservations(prev => [...prev, {
      id: uid(), date: selectedDate, start, end: minToHHMM(endMin),
      name: isTask ? taskLabel : name.trim(),
      menuId, memo: memo.trim(), status: "todo",
      customPrice: cp, gender: isTask ? "none" : gender,
      createdAt: Date.now(),
    }]);
    setName(""); setMemo(""); setCustomPriceInput(""); setGender("none");
  }

  function toggleDone(id: string) {
    setReservations(prev => prev.map(r => {
      if (r.id !== id) return r;
      if (r.status === "cancelled") return r;
      return { ...r, status: r.status === "done" ? "todo" : "done" };
    }));
  }

  function toggleCancelled(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setReservations(prev => prev.map(r =>
      r.id === id ? { ...r, status: r.status === "cancelled" ? "todo" : "cancelled" } : r
    ));
  }

  function removeReservation(id: string) {
    setReservations(prev => prev.filter(r => r.id !== id));
  }

  // タイムライン幅を画面に合わせる
  const PX_PER_MIN = useMemo(() => {
    if (typeof window === "undefined") return 1.5;
    const w = window.innerWidth - 48;
    return Math.max(1.0, w / totalMin);
  }, []);

  function onMouseDown(e: React.MouseEvent, id: string) {
    e.preventDefault();
    const r = reservations.find(x => x.id === id);
    if (!r) return;
    draggingRef.current = { id, startX: e.clientX, origMin: hhmmToMin(r.start) };
    const snap = r.menuId === "task" ? TASK_SNAP_MIN : SNAP_MIN;
    function onMouseMove(ev: MouseEvent) {
      if (!draggingRef.current) return;
      const dx = ev.clientX - draggingRef.current.startX;
      const dMin = Math.round(dx / PX_PER_MIN / snap) * snap;
      const newStartMin = clamp(draggingRef.current.origMin + dMin, openMin, closeMin - snap);
      setReservations(prev => prev.map(rv => {
        if (rv.id !== draggingRef.current!.id) return rv;
        const dur = (menuMap.get(rv.menuId)?.minutes) ?? (hhmmToMin(rv.end) - hhmmToMin(rv.start));
        const endMin = clamp(newStartMin + dur, openMin + snap, closeMin);
        const adjStart = clamp(endMin - dur, openMin, closeMin - snap);
        return { ...rv, start: minToHHMM(adjStart), end: minToHHMM(endMin) };
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
  const slots30 = getSlots(SNAP_MIN);
  const labelSlots = getLabelSlots();
  const timelineWidth = totalMin * PX_PER_MIN;
  const gc = GENDER_COLORS[gender];

  return (
    <div style={{ minHeight: "100vh", background: "#060910", color: "rgba(255,255,255,0.92)", fontFamily: "'Hiragino Sans','Yu Gothic UI',sans-serif", padding: 16 }}>
      <style>{`* { box-sizing: border-box; } select,option { background:#0b1220!important; color:rgba(255,255,255,0.92)!important; } ::-webkit-scrollbar{height:6px;width:6px} ::-webkit-scrollbar-track{background:rgba(255,255,255,0.04);border-radius:3px} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:3px} input::placeholder,textarea::placeholder{color:rgba(255,255,255,0.35)} input[type=number]::-webkit-inner-spin-button{opacity:0.4}`}</style>

      <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ヘッダー */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN, boxShadow: `0 0 10px ${GREEN}` }} />
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 1 }}>PEAK MANAGER</div>
          <div style={{ opacity: 0.5, fontSize: 13 }}>/ 円命堂 予約管理</div>
          <a href="/stats" style={{ fontSize: 12, padding: "4px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", textDecoration: "none", fontWeight: 700 }}>📊 経営指標</a>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
              <span style={{ opacity: 0.55 }}>見込み</span>
              <span style={{ fontWeight: 900 }}>¥{money(sales.expected)}</span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span style={{ opacity: 0.55 }}>実績</span>
              <span style={{ fontWeight: 900, color: GREEN }}>¥{money(sales.actual)}</span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span style={{ opacity: 0.55 }}>{sales.pct}%</span>
              <div style={{ width: 80, height: 6, borderRadius: 999, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${clamp(sales.pct,0,100)}%`, background: `linear-gradient(90deg,${GREEN},${BLUE})`, transition: "width 0.4s ease" }} />
              </div>
            </div>
            <div style={{ opacity: 0.5, fontSize: 13 }}>{selectedDate}</div>
          </div>
        </div>

        {/* タイムライン */}
        <div style={card()}>
          <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10 }}>
            📅 タイムライン <span style={{ opacity: 0.5, fontWeight: 400, fontSize: 13 }}>ドラッグで時刻変更（施術30分・業務15分刻み）</span>
          </div>
          <div ref={timelineRef} style={{ overflowX: "auto", paddingBottom: 4 }}>
            <div style={{ width: timelineWidth, minWidth: "100%" }}>
              <div style={{ display: "flex", marginBottom: 6 }}>
                {labelSlots.map(t => (
                  <div key={t} style={{ width: 60*PX_PER_MIN, fontSize: 11, color: "rgba(255,255,255,0.55)", flexShrink: 0 }}>{t}</div>
                ))}
              </div>
              <div style={{ position: "relative", height: 80, background: "rgba(0,0,0,0.25)", borderRadius: 14, border: `1px solid ${BORDER}` }}>
                {labelSlots.map(t => (
                  <div key={t} style={{ position: "absolute", left: (hhmmToMin(t)-openMin)*PX_PER_MIN, top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.14)" }} />
                ))}
                {dayReservations.map(r => {
                  const menu = menuMap.get(r.menuId);
                  const left = (hhmmToMin(r.start)-openMin)*PX_PER_MIN;
                  const width = (hhmmToMin(r.end)-hhmmToMin(r.start))*PX_PER_MIN;
                  const isDone = r.status === "done";
                  const isCancelled = r.status === "cancelled";
                  const mc = getMenuColor(r.menuId, taskLabel);
                  const rgc = GENDER_COLORS[r.gender ?? "none"];
                  return (
                    <div key={r.id} onMouseDown={e => onMouseDown(e, r.id)}
                      style={{ position: "absolute", left, top: 4, height: 72, width: Math.max(width, 40), cursor: "grab", zIndex: 5, userSelect: "none", opacity: isCancelled ? 0.45 : 1 }}>
                      <div style={{ height: "100%", borderRadius: 12, padding: "5px 8px",
                        background: isCancelled ? "rgba(239,68,68,0.12)" : isDone ? "linear-gradient(135deg,rgba(34,197,94,0.22),rgba(34,197,94,0.08))" : mc.bg,
                        border: `1px solid ${isCancelled ? "rgba(239,68,68,0.4)" : isDone ? "rgba(34,197,94,0.5)" : mc.border}`,
                        overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", gap: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 9, fontWeight: 900, padding: "1px 4px", borderRadius: 4, background: isCancelled ? "rgba(239,68,68,0.6)" : isDone ? "rgba(34,197,94,0.5)" : mc.badge, color: "#fff", flexShrink: 0 }}>
                            {isCancelled ? "取消" : isDone ? "済" : mc.label}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.start}–{r.end}</span>
                        </div>
                        {r.menuId !== "task" && (
                          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            {(r.gender ?? "none") !== "none" && (
                              <span style={{ fontSize: 9, fontWeight: 900, padding: "1px 3px", borderRadius: 4, background: rgc.badge, color: "#fff", flexShrink: 0 }}>{rgc.label}</span>
                            )}
                            <span style={{ fontSize: 11, fontWeight: 900, color: rgc.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</span>
                          </div>
                        )}
                        {r.menuId === "task" && r.memo && (
                          <div style={{ fontSize: 10, opacity: 0.8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.memo}</div>
                        )}
                        <div style={{ fontSize: 9, opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.menuId === "task" ? (getPrice(r, menuMap) > 0 ? `¥${money(getPrice(r, menuMap))}` : "") : `${menu?.label} · ¥${money(getPrice(r, menuMap))}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 下段3カラム */}
        <div style={{ display: "grid", gridTemplateColumns: "420px 1fr 320px", gap: 14, alignItems: "start" }}>

          {/* カレンダー */}
          <div style={card()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>{monthCursor.getFullYear()} / {monthCursor.getMonth()+1}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["◀","今日","▶"] as const).map((label, i) => (
                  <button key={label} onClick={() => {
                    if (i===1) { const t=new Date(); t.setDate(1); t.setHours(0,0,0,0); setMonthCursor(t); setSelectedDate(ymdOf(new Date())); }
                    else { const d=new Date(monthCursor); d.setMonth(d.getMonth()+(i===0?-1:1)); setMonthCursor(d); }
                  }} style={miniBtn()}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
              {["日","月","火","水","木","金","土"].map((w,i) => (
                <div key={w} style={{ textAlign: "center", fontSize: 11, opacity: 0.55, color: i===0?"rgba(255,100,100,0.8)":i===6?"rgba(100,180,255,0.8)":undefined }}>{w}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
              {monthDays.map((cell,i) => {
                const ymd = ymdOf(cell.date);
                const isSelected = ymd===selectedDate;
                const isToday = ymd===todayYMD;
                const count = countsByDay.get(ymd)??0;
                const dow = cell.date.getDay();
                return (
                  <button key={`${ymd}_${i}`} onClick={() => setSelectedDate(ymd)} style={{
                    height: 52, borderRadius: 12, position: "relative",
                    border: isSelected?"2px solid rgba(88,166,255,0.8)":`1px solid ${BORDER}`,
                    background: isSelected?"rgba(88,166,255,0.12)":isToday?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.18)",
                    color: !cell.inMonth?"rgba(255,255,255,0.25)":dow===0?"rgba(255,120,120,0.9)":dow===6?"rgba(100,180,255,0.9)":"rgba(255,255,255,0.92)",
                    cursor: "pointer", overflow: "hidden",
                  }}>
                    <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1 }}>{cell.date.getDate()}</div>
                    {count>0 && <div style={{ position: "absolute", right: 5, bottom: 5, fontSize: 11, fontWeight: 900, color: "rgba(34,197,94,1)", textShadow: "0 0 8px rgba(34,197,94,0.9)" }}>{count}</div>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 予約入力 */}
          <div style={card()}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 14 }}>予約入力</div>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={labelSt()}>メニュー</label>
                <select value={menuId} onChange={e => handleMenuChange(e.target.value)} style={inputSt()}>
                  {MENUS.map(m => <option key={m.id} value={m.id}>{m.label}{!m.isTask ? `　¥${money(m.price)}` : "　（売上手入力）"}</option>)}
                </select>
              </div>

              {/* 業務ラベル編集 */}
              {isTask && (
                <div>
                  <label style={labelSt()}>業務名称 <span style={{ opacity: 0.55, fontSize: 11, fontWeight: 400 }}>（変更可）</span></label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {editingTaskLabel ? (
                      <>
                        <input value={taskLabel} onChange={e => setTaskLabel(e.target.value)} style={{ ...inputSt(), flex: 1 }} />
                        <button onClick={() => setEditingTaskLabel(false)} style={{ ...miniBtn(), background: "rgba(88,166,255,0.2)" }}>確定</button>
                      </>
                    ) : (
                      <>
                        <div style={{ ...inputSt(), flex: 1, display: "flex", alignItems: "center", opacity: 0.9 }}>{taskLabel}</div>
                        <button onClick={() => setEditingTaskLabel(true)} style={miniBtn()}>変更</button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {!isTask && (
                <div>
                  <label style={labelSt()}>氏名 <span style={{ color: "rgba(255,100,100,0.8)", fontSize: 11 }}>※必須</span></label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["male","female","none"] as Gender[]).map(g => {
                      const gc2 = GENDER_COLORS[g];
                      const isActive = gender === g;
                      return (
                        <button key={g} onClick={() => setGender(g)} style={{
                          flexShrink: 0, height: 44, padding: "0 14px", borderRadius: 12,
                          border: isActive ? `2px solid ${gc2.badge}` : "1px solid rgba(255,255,255,0.12)",
                          background: isActive ? `${gc2.badge}33` : "rgba(0,0,0,0.25)",
                          color: isActive ? gc2.text : "rgba(255,255,255,0.55)",
                          fontWeight: 900, fontSize: 13, cursor: "pointer",
                        }}>{gc2.label}</button>
                      );
                    })}
                    <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key==="Enter"&&addReservation()} placeholder="例：山田 太郎"
                      style={{ ...inputSt(), color: gc.text, fontWeight: name ? 900 : undefined }} />
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelSt()}>開始時刻</label>
                  <select value={start} onChange={e => setStart(e.target.value)} style={inputSt()}>
                    {getSlots(isTask ? TASK_SNAP_MIN : SNAP_MIN).slice(0,-1).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt()}>対象日</label>
                  <input value={selectedDate} readOnly style={inputSt({ opacity: 0.75 })} />
                </div>
              </div>

              <div>
                <label style={labelSt()}>金額 {isTask ? <span style={{ opacity: 0.55, fontSize: 11, fontWeight: 400 }}>（売上に計上する場合は入力）</span> : <span style={{ opacity: 0.55, fontSize: 11, fontWeight: 400 }}>（自動入力・変更可）</span>}</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.7, fontSize: 14, pointerEvents: "none" }}>¥</span>
                  <input type="number" value={customPriceInput} onChange={e => setCustomPriceInput(e.target.value)}
                    placeholder={isTask ? "0" : String(MENUS.find(m => m.id === menuId)?.price ?? "")}
                    style={{ ...inputSt(), paddingLeft: 24 }} />
                </div>
              </div>

              <div>
                <label style={labelSt()}>メモ（任意）</label>
                <textarea value={memo} onChange={e => setMemo(e.target.value)} placeholder={isTask ? "例：セミナー準備・会計作業…" : "例：腰痛 / 自律神経 / 紹介…"} style={inputSt({ minHeight: 72, resize: "vertical" })} />
              </div>

              <button onClick={addReservation} disabled={!isTask && !name.trim()} style={{
                height: 48, borderRadius: 14, border: `1px solid ${isTask ? "rgba(150,150,150,0.4)" : "rgba(88,166,255,0.40)"}`,
                background: (isTask || name.trim()) ? isTask ? "linear-gradient(135deg,rgba(150,150,150,0.4),rgba(150,150,150,0.2))" : "linear-gradient(135deg,rgba(88,166,255,0.75),rgba(88,166,255,0.40))" : "rgba(255,255,255,0.06)",
                color: (isTask || name.trim()) ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.35)",
                fontWeight: 900, fontSize: 15, cursor: (isTask || name.trim()) ? "pointer" : "not-allowed",
              }}>＋ {isTask ? taskLabel : "予約"}を追加</button>
            </div>
          </div>

          {/* 右: 名簿 */}
          <div style={card()}>
            <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>名簿 <span style={{ opacity: 0.5, fontSize: 11, fontWeight: 400 }}>（当日 / 最大10件）</span></div>
            {dayReservations.length===0 ? (
              <div style={{ fontSize: 13, opacity: 0.45, padding: "8px 0" }}>予約なし</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {dayReservations.slice(0,10).map(r => {
                  const menu = menuMap.get(r.menuId);
                  const isDone = r.status==="done";
                  const isCancelled = r.status==="cancelled";
                  const mc = getMenuColor(r.menuId, taskLabel);
                  const rgc = GENDER_COLORS[r.gender ?? "none"];
                  const price = getPrice(r, menuMap);
                  const isCustom = r.customPrice !== undefined && r.customPrice !== menu?.price;
                  const isTaskItem = r.menuId === "task";
                  return (
                    <div key={r.id} onClick={() => toggleDone(r.id)} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 12,
                      background: isCancelled?"rgba(239,68,68,0.08)":isDone?"rgba(34,197,94,0.10)":"rgba(255,255,255,0.04)",
                      border: `1px solid ${isCancelled?"rgba(239,68,68,0.3)":isDone?"rgba(34,197,94,0.25)":BORDER}`,
                      cursor: "pointer", opacity: isCancelled ? 0.7 : 1,
                    }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                        border: isCancelled?"2px solid #f87171":isDone?`2px solid ${GREEN}`:"2px solid rgba(255,255,255,0.25)",
                        background: isCancelled?"rgba(239,68,68,0.2)":isDone?"rgba(34,197,94,0.25)":"transparent",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
                        color: isCancelled?"#f87171":GREEN }}>
                        {isCancelled?"✕":isDone?"✓":""}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                          <span style={{ fontSize: 9, fontWeight: 900, padding: "1px 5px", borderRadius: 4, background: isCancelled?"rgba(239,68,68,0.5)":isDone?"rgba(34,197,94,0.4)":mc.badge, color: "#fff", flexShrink: 0 }}>{isCancelled?"取消":isDone?"済":mc.label}</span>
                          {!isTaskItem && (r.gender ?? "none") !== "none" && (
                            <span style={{ fontSize: 9, fontWeight: 900, padding: "1px 4px", borderRadius: 4, background: rgc.badge, color: "#fff", flexShrink: 0 }}>{rgc.label}</span>
                          )}
                          <span style={{ fontSize: 12, fontWeight: 900, color: isTaskItem?"rgba(255,255,255,0.7)":rgc.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: isCancelled?"line-through":"none" }}>
                            {r.start}–{r.end}　{isTaskItem ? taskLabel : r.name}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.65, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {isTaskItem ? (r.memo || taskLabel) : menu?.label}
                          {price > 0 && <span style={{ color: isCustom?"#fbbf24":undefined, fontWeight: isCustom?900:undefined }}>　¥{money(price)}</span>}
                          {isCustom && !isTaskItem && <span style={{ fontSize: 10, marginLeft: 4, color: "#fbbf24" }}>変更</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
                        <button onClick={e => toggleCancelled(r.id, e)} style={{ width: 40, height: 20, borderRadius: 6, border: `1px solid ${isCancelled?"rgba(239,68,68,0.6)":"rgba(255,255,255,0.12)"}`, background: isCancelled?"rgba(239,68,68,0.25)":"rgba(255,255,255,0.06)", color: isCancelled?"#f87171":"rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 9, fontWeight: 900 }}>取消</button>
                        <button onClick={e => { e.stopPropagation(); removeReservation(r.id); }} style={{ width: 40, height: 20, borderRadius: 6, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 11 }}>×</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {dayReservations.length>0 && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.7 }}>
                <span>本日 {dayReservations.filter(r=>r.status!=="cancelled"&&r.menuId!=="task").length}件</span>
                <span>¥{money(dayReservations.filter(r=>r.status!=="cancelled"&&r.menuId!=="task").reduce((s,r)=>s+getPrice(r,menuMap),0))}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function card(): React.CSSProperties {
  return { borderRadius: 18, padding: 16, background: "linear-gradient(160deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 12px 32px rgba(0,0,0,0.35)" };
}
function miniBtn(): React.CSSProperties {
  return { height: 32, padding: "0 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.13)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.85)", cursor: "pointer", fontWeight: 800, fontSize: 13 };
}
function labelSt(): React.CSSProperties {
  return { display: "block", fontSize: 12, opacity: 0.7, marginBottom: 6, fontWeight: 700 };
}
function inputSt(extra?: React.CSSProperties): React.CSSProperties {
  return { width: "100%", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(0,0,0,0.28)", color: "rgba(255,255,255,0.92)", padding: "10px 12px", outline: "none", fontSize: 14, ...extra };
}
