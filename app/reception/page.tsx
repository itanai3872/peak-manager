"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";

const LS_KEY = "enmeidou_reception_v2";
const TASK_LABEL_KEY = "enmeidou_task_label";
const KARUTE_KEY = "enmeidou_karute_v1";
const HOLIDAY_KEY = "enmeidou_holidays_v1";

const GAS_URL = "https://script.google.com/macros/s/AKfycbwuywlJv48PAfmEsGc-RcEsSFdYFmW7hbaQD0w8AO7TGRZja--y1qMLA-VFvYLNJMYL/exec";
const SHEET_ID = "17xTuYtuaUdATKvqWPP8Qd7ucHhyfwCh9jpinprAgSp4";

const OPEN = "09:00";
const CLOSE = "22:00";
const SNAP_MIN = 30;
const TASK_SNAP_MIN = 15;

type ReservationStatus = "todo" | "done" | "cancelled";
type Gender = "male" | "female" | "none";
type Reservation = {
  id: string; date: string; start: string; end: string;
  name: string; menuId: string; memo: string;
  status: ReservationStatus; customPrice?: number;
  gender?: Gender; createdAt: number; customLabel?: string;
};
type Menu = { id: string; label: string; minutes: number; price: number; isTask?: boolean; };

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
function getPrice(r: { menuId: string; customPrice?: number }, menuMap: Map<string, { price: number }>) {
  return r.customPrice !== undefined ? r.customPrice : (menuMap.get(r.menuId)?.price ?? 0);
}

const BG = "#f5f0e8";
const CARD_BG = "#ffffff";
const CARD_BOR = "rgba(0,0,0,0.08)";
const TEXT = "#1a1a1a";
const TEXT_SUB = "rgba(0,0,0,0.45)";
const BORDER = "rgba(0,0,0,0.10)";

const MENU_COLORS = {
  jp:   { bg: "linear-gradient(135deg,#dbeafe,#eff6ff)", border: "#3b82f6", badge: "#2563eb", badgeTxt: "#fff", label: "国内" },
  int:  { bg: "linear-gradient(135deg,#fef3c7,#fffbeb)", border: "#f59e0b", badge: "#d97706", badgeTxt: "#fff", label: "INT" },
  stu:  { bg: "linear-gradient(135deg,#ede9fe,#f5f3ff)", border: "#8b5cf6", badge: "#7c3aed", badgeTxt: "#fff", label: "学生" },
  task: { bg: "linear-gradient(135deg,#f3f4f6,#f9fafb)", border: "#9ca3af", badge: "#6b7280", badgeTxt: "#fff", label: "業務" },
};
const DONE_COLORS = { bg: "linear-gradient(135deg,#dcfce7,#f0fdf4)", border: "#22c55e", badge: "#16a34a", badgeTxt: "#fff" };
const CANCEL_COLORS = { bg: "linear-gradient(135deg,#fee2e2,#fff1f2)", border: "#ef4444", badge: "#dc2626", badgeTxt: "#fff" };
const GENDER_COLORS = {
  male:   { text: "#1d4ed8", badge: "#2563eb", label: "男" },
  female: { text: "#be185d", badge: "#db2777", label: "女" },
  none:   { text: TEXT, badge: "#9ca3af", label: "－" },
};

function getMenuColor(menuId: string, taskLabel?: string) {
  if (menuId === "task") return { ...MENU_COLORS.task, label: taskLabel || "業務" };
  if (menuId.startsWith("int")) return MENU_COLORS.int;
  if (menuId.startsWith("stu")) return MENU_COLORS.stu;
  return MENU_COLORS.jp;
}

function card(extra?: React.CSSProperties): React.CSSProperties {
  return { borderRadius: 16, padding: 20, background: CARD_BG, border: `1px solid ${CARD_BOR}`, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", ...extra };
}
function miniBtn(active?: boolean): React.CSSProperties {
  return { height: 34, padding: "0 12px", borderRadius: 10, border: active ? "1.5px solid #2563eb" : `1px solid ${BORDER}`, background: active ? "#dbeafe" : "#f9fafb", color: active ? "#1d4ed8" : TEXT, cursor: "pointer", fontWeight: 800, fontSize: 14 };
}
function labelSt(): React.CSSProperties {
  return { display: "block", fontSize: 13, color: TEXT_SUB, marginBottom: 7, fontWeight: 700 };
}
function inputSt(extra?: React.CSSProperties): React.CSSProperties {
  return { width: "100%", borderRadius: 12, border: `1px solid ${BORDER}`, background: "#fafafa", color: TEXT, padding: "11px 14px", outline: "none", fontSize: 15, ...extra };
}

async function syncToSheet(reservations: Reservation[]) {
  try {
    await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ sheetId: SHEET_ID, reservations }),
    });
  } catch {}
}

async function loadFromSheet(): Promise<Reservation[] | null> {
  try {
    const res = await fetch(`${GAS_URL}?sheetId=${SHEET_ID}`);
    const data = await res.json();
    if (data.ok && Array.isArray(data.reservations) && data.reservations.length > 0) {
      return data.reservations;
    }
  } catch {}
  return null;
}

function CustomSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <div onClick={() => setOpen(o => !o)} style={{ width: "100%", borderRadius: 12, border: `1px solid ${open ? "#2563eb" : BORDER}`, background: "#fafafa", color: TEXT, padding: "11px 36px 11px 14px", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", userSelect: "none" }}>
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected?.label ?? ""}</span>
        <span style={{ position: "absolute", right: 12, opacity: 0.4, fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999, background: "#fff", border: `1px solid #2563eb44`, borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", maxHeight: 260, overflowY: "auto" }}>
          {options.map(o => (
            <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
              style={{ padding: "11px 14px", fontSize: 14, cursor: "pointer", background: o.value === value ? "#dbeafe" : "transparent", color: o.value === value ? "#1d4ed8" : TEXT, borderBottom: `1px solid ${BORDER}` }}
              onMouseEnter={e => (e.currentTarget.style.background = o.value === value ? "#dbeafe" : "#f5f5f5")}
              onMouseLeave={e => (e.currentTarget.style.background = o.value === value ? "#dbeafe" : "transparent")}
            >{o.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function NameInput({ value, onChange, karuteNames, color }: {
  value: string; onChange: (v: string) => void;
  karuteNames: { kanji: string; kana: string }[]; color: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    if (!value.trim()) return karuteNames;
    return karuteNames.filter(k => k.kanji.includes(value) || k.kana.includes(value));
  }, [value, karuteNames]);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      <input value={value} onChange={e => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="例：山田 太郎"
        style={{ ...inputSt(), color, fontWeight: value ? 900 : undefined, width: "100%" }} />
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999, background: "#fff", border: `1px solid #2563eb44`, borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", maxHeight: 200, overflowY: "auto" }}>
          {filtered.map(k => (
            <div key={k.kanji} onClick={() => { onChange(k.kanji); setOpen(false); }}
              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f5f5f5")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: 14, color: TEXT }}>{k.kanji}</span>
              <span style={{ fontSize: 12, color: TEXT_SUB }}>{k.kana}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContextMenu({ x, y, onDelete, onClose }: { x: number; y: number; onDelete: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  return (
    <div ref={ref} style={{ position: "fixed", left: x, top: y, zIndex: 99999, background: "#fff", border: "1px solid #fca5a5", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", overflow: "hidden", minWidth: 140 }}>
      <div onClick={onDelete} style={{ padding: "10px 16px", cursor: "pointer", color: "#dc2626", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}
        onMouseEnter={e => (e.currentTarget.style.background = "#fee2e2")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >🗑 削除</div>
    </div>
  );
}

export default function ReceptionPage() {
  const [selectedDate, setSelectedDate] = useState(() => ymdOf(new Date()));
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [showHolidayMgr, setShowHolidayMgr] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "ok" | "offline">("idle");
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("none");
  const [start, setStart] = useState(OPEN);
  const [menuId, setMenuId] = useState(MENUS[0].id);
  const [memo, setMemo] = useState("");
  const [customPriceInput, setCustomPriceInput] = useState<string>(String(MENUS[0].price));
  const [taskLabel, setTaskLabel] = useState("業務");
  const [editingTaskLabel, setEditingTaskLabel] = useState(false);
  const [karuteNames, setKaruteNames] = useState<{ kanji: string; kana: string }[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [doubleBookWarn, setDoubleBookWarn] = useState<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingRef = useRef<{ id: string; startX: number; origMin: number } | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  const isTask = menuId === "task";
  const isHoliday = holidays.includes(selectedDate);

  useEffect(() => {
    try {
      const savedLabel = localStorage.getItem(TASK_LABEL_KEY);
      if (savedLabel) setTaskLabel(savedLabel);
      const karuteRaw = localStorage.getItem(KARUTE_KEY);
      if (karuteRaw) {
        const list = JSON.parse(karuteRaw);
        setKaruteNames(list.map((k: any) => ({ kanji: k.kanji || "", kana: k.kana || "" })).sort((a: any, b: any) => a.kana.localeCompare(b.kana, "ja")));
      }
      const holRaw = localStorage.getItem(HOLIDAY_KEY);
      if (holRaw) { const h = JSON.parse(holRaw); if (Array.isArray(h)) setHolidays(h); }
    } catch {}

    setSyncStatus("syncing");
    loadFromSheet().then(data => {
      if (data && data.length > 0) {
        setReservations(data);
        localStorage.setItem(LS_KEY, JSON.stringify(data));
        setSyncStatus("ok");
      } else {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) setReservations(p); }
        setSyncStatus("offline");
      }
      isInitialLoad.current = false;
    });
  }, []);

  useEffect(() => {
    if (isInitialLoad.current) return;
    localStorage.setItem(LS_KEY, JSON.stringify(reservations));
    localStorage.setItem(TASK_LABEL_KEY, taskLabel);
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    setSyncStatus("syncing");
    syncTimerRef.current = setTimeout(() => {
      syncToSheet(reservations).then(() => setSyncStatus("ok")).catch(() => setSyncStatus("offline"));
    }, 1500);
  }, [reservations, taskLabel]);

  useEffect(() => {
    try { localStorage.setItem(HOLIDAY_KEY, JSON.stringify(holidays)); } catch {}
  }, [holidays]);

  function toggleHoliday(ymd: string) {
    setHolidays(prev => prev.includes(ymd) ? prev.filter(d => d !== ymd) : [...prev, ymd]);
  }

  function exportData() {
    const data = { reservations, holidays, taskLabel, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `円命堂_バックアップ_${ymdOf(new Date())}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.reservations) { setReservations(data.reservations); syncToSheet(data.reservations); }
        if (data.holidays) setHolidays(data.holidays);
        if (data.taskLabel) setTaskLabel(data.taskLabel);
        alert("復元しました");
      } catch { alert("ファイルが正しくありません"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const menuMap = useMemo(() => { const m = new Map<string, Menu>(); MENUS.forEach(x => m.set(x.id, x)); return m; }, []);

  function handleMenuChange(newMenuId: string) {
    setMenuId(newMenuId);
    const m = MENUS.find(x => x.id === newMenuId);
    if (m) setCustomPriceInput(m.isTask ? "" : String(m.price));
  }

  const dayReservations = useMemo(() =>
    reservations.filter(r => r.date === selectedDate).sort((a,b) => hhmmToMin(a.start) - hhmmToMin(b.start)),
    [reservations, selectedDate]);

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
    const first = new Date(y, m, 1), last = new Date(y, m+1, 0);
    const startDay = first.getDay();
    const cells: { date: Date; inMonth: boolean }[] = [];
    const prevLast = new Date(y, m, 0).getDate();
    for (let i=0; i<startDay; i++) cells.push({ date: new Date(y, m-1, prevLast-(startDay-1-i)), inMonth: false });
    for (let d=1; d<=last.getDate(); d++) cells.push({ date: new Date(y, m, d), inMonth: true });
    while (cells.length < 42) { const lc = cells[cells.length-1].date; const nx = new Date(lc); nx.setDate(lc.getDate()+1); cells.push({ date: nx, inMonth: false }); }
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

  function checkDoubleBooking(newStart: string, newEnd: string, excludeId?: string): string | null {
    const ns = hhmmToMin(newStart), ne = hhmmToMin(newEnd);
    for (const r of reservations) {
      if (r.date !== selectedDate) continue;
      if (r.id === excludeId) continue;
      if (r.status === "cancelled") continue;
      const rs = hhmmToMin(r.start), re = hhmmToMin(r.end);
      if (ns < re && ne > rs) return r.name || "業務";
    }
    return null;
  }

  function addReservation() {
    if (!isTask && !name.trim()) return;
    const menu = menuMap.get(menuId) ?? MENUS[0];
    const snap = isTask ? TASK_SNAP_MIN : SNAP_MIN;
    const endMin = clamp(hhmmToMin(start) + menu.minutes, openMin + snap, closeMin);
    const endStr = minToHHMM(endMin);
    const conflict = checkDoubleBooking(start, endStr);
    if (conflict) {
      setDoubleBookWarn(`⚠️ 「${conflict}」と時間が重複しています`);
      setTimeout(() => setDoubleBookWarn(null), 4000);
      return;
    }
    const cp = customPriceInput !== "" ? Number(customPriceInput) : undefined;
    setReservations(prev => [...prev, { id: uid(), date: selectedDate, start, end: endStr, name: isTask ? taskLabel : name.trim(), menuId, memo: memo.trim(), status: "todo", customPrice: cp, gender: isTask ? "none" : gender, createdAt: Date.now() }]);
    setName(""); setMemo(""); setGender("none");
    const m = menuMap.get(menuId);
    setCustomPriceInput(m?.isTask ? "" : String(m?.price ?? ""));
  }

  function toggleDone(id: string) {
    setReservations(prev => prev.map(r => { if (r.id !== id) return r; if (r.status === "cancelled") return r; return { ...r, status: r.status === "done" ? "todo" : "done" }; }));
  }
  function toggleCancelled(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status: r.status === "cancelled" ? "todo" : "cancelled" } : r));
  }
  function removeReservation(id: string) { setReservations(prev => prev.filter(r => r.id !== id)); setContextMenu(null); }

  const PX_PER_MIN = useMemo(() => {
    if (typeof window === "undefined") return 2.0;
    return Math.max(1.0, ((window.innerWidth - 120) / totalMin) * 0.92);
  }, []);

  function onContextMenu(e: React.MouseEvent, id: string) { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, id }); }
  function onTouchStart(e: React.TouchEvent, id: string) { longPressRef.current = setTimeout(() => { const t = e.touches[0]; setContextMenu({ x: t.clientX, y: t.clientY, id }); }, 600); }
  function onTouchEnd() { if (longPressRef.current) clearTimeout(longPressRef.current); }

  function onMouseDown(e: React.MouseEvent, id: string) {
    if (e.button === 2) return;
    e.preventDefault();
    const r = reservations.find(x => x.id === id); if (!r) return;
    draggingRef.current = { id, startX: e.clientX, origMin: hhmmToMin(r.start) };
    const snap = r.menuId === "task" ? TASK_SNAP_MIN : SNAP_MIN;
    function onMouseMove(ev: MouseEvent) {
      if (!draggingRef.current) return;
      const dMin = Math.round((ev.clientX - draggingRef.current.startX) / PX_PER_MIN / snap) * snap;
      const newStartMin = clamp(draggingRef.current.origMin + dMin, openMin, closeMin - snap);
      setReservations(prev => prev.map(rv => {
        if (rv.id !== draggingRef.current!.id) return rv;
        const dur = (menuMap.get(rv.menuId)?.minutes) ?? (hhmmToMin(rv.end) - hhmmToMin(rv.start));
        const endMin = clamp(newStartMin + dur, openMin + snap, closeMin);
        return { ...rv, start: minToHHMM(clamp(endMin - dur, openMin, closeMin - snap)), end: minToHHMM(endMin) };
      }));
    }
    function onMouseUp() { draggingRef.current = null; window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  const todayYMD = ymdOf(new Date());
  const labelSlots = getLabelSlots();
  const timelineWidth = totalMin * PX_PER_MIN;
  const gc = GENDER_COLORS[gender];
  const menuOptions = MENUS.map(m => ({ value: m.id, label: m.isTask ? `${m.label}　（売上手入力）` : `${m.label}　¥${money(m.price)}` }));
  const startOptions = getSlots(isTask ? TASK_SNAP_MIN : SNAP_MIN).slice(0, -1).map(t => ({ value: t, label: t }));

  const syncLabel = syncStatus === "syncing" ? "⏳ 同期中..." : syncStatus === "ok" ? "✅ 同期済" : syncStatus === "offline" ? "⚠️ オフライン" : "";
  const syncColor = syncStatus === "syncing" ? "#f59e0b" : syncStatus === "ok" ? "#16a34a" : syncStatus === "offline" ? "#ef4444" : TEXT_SUB;

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'Hiragino Sans','Yu Gothic UI',sans-serif", padding: "16px" }}
      onClick={() => setContextMenu(null)}>
      <style>{`* { box-sizing: border-box; } ::-webkit-scrollbar{height:6px;width:6px} ::-webkit-scrollbar-track{background:rgba(0,0,0,0.04);border-radius:3px} ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.18);border-radius:3px} input::placeholder,textarea::placeholder{color:rgba(0,0,0,0.3)}`}</style>

      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} onDelete={() => removeReservation(contextMenu.id)} onClose={() => setContextMenu(null)} />}
      {doubleBookWarn && <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 99999, background: "#dc2626", color: "#fff", padding: "12px 24px", borderRadius: 12, fontWeight: 900, fontSize: 15 }}>{doubleBookWarn}</div>}

      <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 4, flexWrap: "wrap" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 10px #22c55e" }} />
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1 }}>PEAK MANAGER</div>
          <div style={{ color: TEXT_SUB, fontSize: 14 }}>/ 円命堂 予約管理</div>
          <a href="/stats" style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "#f0f0f0", color: TEXT_SUB, textDecoration: "none", fontWeight: 700 }}>📊 経営指標</a>
          <a href="/karute" style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "#f0f0f0", color: TEXT_SUB, textDecoration: "none", fontWeight: 700 }}>📋 クライアントカルテ</a>
          <button onClick={() => setShowHolidayMgr(v => !v)} style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8, fontWeight: 700, cursor: "pointer", border: showHolidayMgr ? "1.5px solid #dc2626" : `1px solid ${BORDER}`, background: showHolidayMgr ? "#fee2e2" : "#f0f0f0", color: showHolidayMgr ? "#dc2626" : TEXT_SUB }}>🗓 休日管理</button>
          <button onClick={exportData} style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8, border: "1px solid #16a34a44", background: "#dcfce7", color: "#16a34a", cursor: "pointer", fontWeight: 700 }}>📤 バックアップ</button>
          <label style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8, border: "1px solid #2563eb44", background: "#dbeafe", color: "#2563eb", cursor: "pointer", fontWeight: 700 }}>
            📥 復元<input type="file" accept=".json" onChange={importData} style={{ display: "none" }} />
          </label>
          {syncLabel && <div style={{ fontSize: 13, fontWeight: 700, color: syncColor }}>{syncLabel}</div>}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
            <span style={{ color: TEXT_SUB }}>見込み</span><span style={{ fontWeight: 900 }}>¥{money(sales.expected)}</span>
            <span style={{ color: TEXT_SUB }}>|</span>
            <span style={{ color: TEXT_SUB }}>実績</span><span style={{ fontWeight: 900, color: "#16a34a" }}>¥{money(sales.actual)}</span>
            <span style={{ color: TEXT_SUB }}>|</span>
            <span style={{ color: TEXT_SUB }}>{sales.pct}%</span>
            <div style={{ width: 80, height: 6, borderRadius: 999, background: "rgba(0,0,0,0.08)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${clamp(sales.pct,0,100)}%`, background: "linear-gradient(90deg,#22c55e,#3b82f6)", transition: "width 0.4s ease" }} />
            </div>
            <div style={{ color: TEXT_SUB, fontSize: 14 }}>{selectedDate}</div>
          </div>
        </div>

        {showHolidayMgr && (
          <div style={{ ...card(), background: "#fff8f8", border: "1.5px solid #fca5a5" }}>
            <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10, color: "#dc2626" }}>🗓 休日設定</div>
            <div style={{ fontSize: 13, color: TEXT_SUB, marginBottom: 12 }}>カレンダーで日付を選択 → 下のボタンで休日設定／解除</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>選択中：{selectedDate}</div>
              <button onClick={() => toggleHoliday(selectedDate)} style={{ height: 36, padding: "0 18px", borderRadius: 10, fontWeight: 900, cursor: "pointer", fontSize: 14, border: isHoliday ? "1.5px solid #16a34a" : "1.5px solid #dc2626", background: isHoliday ? "#dcfce7" : "#fee2e2", color: isHoliday ? "#16a34a" : "#dc2626" }}>
                {isHoliday ? "✓ 休日を解除する" : "✕ 休日にする"}
              </button>
              {holidays.length > 0 && <div style={{ fontSize: 13, color: TEXT_SUB }}>設定済み：{holidays.sort().join("　")}</div>}
            </div>
          </div>
        )}

        {isHoliday && <div style={{ borderRadius: 12, padding: "12px 20px", background: "#fee2e2", border: "1.5px solid #fca5a5", fontWeight: 900, color: "#dc2626", fontSize: 15 }}>🚫 {selectedDate} は休日に設定されています</div>}

        <div style={card()}>
          <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 10 }}>📅 タイムライン <span style={{ color: TEXT_SUB, fontWeight: 400, fontSize: 13 }}>ドラッグで時刻変更（右クリック／長押しで削除）</span></div>
          <div style={{ overflowX: "auto", paddingBottom: 4 }}>
            <div style={{ width: timelineWidth, minWidth: "100%" }}>
              <div style={{ display: "flex", marginBottom: 6 }}>
                {labelSlots.map(t => <div key={t} style={{ width: 60*PX_PER_MIN, fontSize: 12, color: TEXT_SUB, flexShrink: 0 }}>{t}</div>)}
              </div>
              <div style={{ position: "relative", height: 96, background: "#f8f6f2", borderRadius: 14, border: `1px solid ${BORDER}` }}>
                {labelSlots.map(t => <div key={t} style={{ position: "absolute", left: (hhmmToMin(t)-openMin)*PX_PER_MIN, top: 0, bottom: 0, width: 1, background: "rgba(0,0,0,0.08)" }} />)}
                {dayReservations.map(r => {
                  const menu = menuMap.get(r.menuId);
                  const left = (hhmmToMin(r.start)-openMin)*PX_PER_MIN;
                  const width = (hhmmToMin(r.end)-hhmmToMin(r.start))*PX_PER_MIN;
                  const isDone = r.status==="done", isCancelled = r.status==="cancelled";
                  const mc = isCancelled ? CANCEL_COLORS : isDone ? DONE_COLORS : getMenuColor(r.menuId, taskLabel) as any;
                  const rgc = GENDER_COLORS[r.gender ?? "none"];
                  return (
                    <div key={r.id} onMouseDown={e => onMouseDown(e, r.id)} onContextMenu={e => onContextMenu(e, r.id)} onTouchStart={e => onTouchStart(e, r.id)} onTouchEnd={onTouchEnd} onTouchMove={onTouchEnd}
                      style={{ position: "absolute", left, top: 4, height: 88, width: Math.max(width, 48), cursor: "grab", zIndex: 5, userSelect: "none", opacity: isCancelled ? 0.6 : 1 }}>
                      <div style={{ height: "100%", borderRadius: 10, padding: "6px 8px", background: mc.bg, border: `1.5px solid ${mc.border}`, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.10)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 900, padding: "1px 5px", borderRadius: 4, background: mc.badge, color: mc.badgeTxt, flexShrink: 0 }}>{isCancelled?"取消":isDone?"済":mc.label}</span>
                          <span style={{ fontSize: 11, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: TEXT }}>{r.start}–{r.end}</span>
                        </div>
                        {r.menuId !== "task" && (
                          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            {(r.gender ?? "none") !== "none" && <span style={{ fontSize: 10, fontWeight: 900, padding: "1px 4px", borderRadius: 4, background: rgc.badge, color: "#fff", flexShrink: 0 }}>{rgc.label}</span>}
                            <span style={{ fontSize: 12, fontWeight: 900, color: rgc.text, wordBreak: "break-all", lineHeight: 1.2 }}>{r.name}</span>
                          </div>
                        )}
                        {r.menuId === "task" && r.memo && <div style={{ fontSize: 11, color: TEXT_SUB, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.memo}</div>}
                        <div style={{ fontSize: 10, color: TEXT_SUB, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.menuId === "task" ? (getPrice(r,menuMap)>0?`¥${money(getPrice(r,menuMap))}`:"") : `${menu?.label} · ¥${money(getPrice(r,menuMap))}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "480px 1fr 360px", gap: 16, alignItems: "start" }}>
          <div style={card()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{monthCursor.getFullYear()} / {monthCursor.getMonth()+1}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["◀","今日","▶"] as const).map((label, i) => (
                  <button key={label} onClick={() => { if(i===1){const t=new Date();t.setDate(1);t.setHours(0,0,0,0);setMonthCursor(t);setSelectedDate(ymdOf(new Date()));}else{const d=new Date(monthCursor);d.setMonth(d.getMonth()+(i===0?-1:1));setMonthCursor(d);} }} style={miniBtn()}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 11, color: TEXT_SUB, flexWrap: "wrap" }}>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#fee2e2", border: "1px solid #fca5a5", marginRight: 4 }} />休日</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#dbeafe", border: "1px solid #3b82f6", marginRight: 4 }} />選択中</span>
              <span><span style={{ color: "#16a34a", fontWeight: 900, marginRight: 4 }}>●</span>予約あり</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5, marginBottom: 8 }}>
              {["日","月","火","水","木","金","土"].map((w,i) => <div key={w} style={{ textAlign: "center", fontSize: 12, color: i===0?"#ef4444":i===6?"#3b82f6":TEXT_SUB }}>{w}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
              {monthDays.map((cell,i) => {
                const ymd = ymdOf(cell.date);
                const isSelected = ymd===selectedDate, isToday = ymd===todayYMD, isHol = holidays.includes(ymd);
                const count = countsByDay.get(ymd)??0, dow = cell.date.getDay();
                return (
                  <button key={`${ymd}_${i}`} onClick={() => setSelectedDate(ymd)} style={{ height: 58, borderRadius: 12, position: "relative", border: isSelected?"2px solid #2563eb":isHol?"1.5px solid #fca5a5":`1px solid ${BORDER}`, background: isHol?"#fee2e2":isSelected?"#dbeafe":isToday?"#f0fdf4":CARD_BG, color: !cell.inMonth?"rgba(0,0,0,0.2)":dow===0?"#ef4444":dow===6?"#2563eb":TEXT, cursor: "pointer", overflow: "hidden" }}>
                    <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{cell.date.getDate()}</div>
                    {isHol && <div style={{ fontSize: 9, color: "#dc2626", fontWeight: 900 }}>休</div>}
                    {count>0 && <div style={{ position: "absolute", right: 5, bottom: 5, fontSize: 12, fontWeight: 900, color: "#16a34a" }}>{count}</div>}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={card()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>予約入力</div>
              <button onClick={addReservation} disabled={!isTask && !name.trim()} style={{ height: 36, padding: "0 16px", borderRadius: 10, border: (isTask||name.trim())?"1.5px solid #2563eb":`1px solid ${BORDER}`, background: (isTask||name.trim())?"#2563eb":"#f0f0f0", color: (isTask||name.trim())?"#fff":TEXT_SUB, fontWeight: 900, fontSize: 13, cursor: (isTask||name.trim())?"pointer":"not-allowed", whiteSpace: "nowrap" }}>＋ {isTask?taskLabel:"予約"}を追加</button>
            </div>
            {(() => {
              const menu = menuMap.get(menuId); if (!menu) return null;
              const snap = isTask?TASK_SNAP_MIN:SNAP_MIN;
              const endMin = clamp(hhmmToMin(start)+menu.minutes, openMin+snap, closeMin);
              const conflict = checkDoubleBooking(start, minToHHMM(endMin));
              if (!conflict) return null;
              return <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 10, background: "#fef3c7", border: "1.5px solid #f59e0b", color: "#92400e", fontWeight: 700, fontSize: 13 }}>⚠️ この時間帯は「{conflict}」と重複します</div>;
            })()}
            <div style={{ display: "grid", gap: 14 }}>
              <div><label style={labelSt()}>メニュー</label><CustomSelect value={menuId} onChange={handleMenuChange} options={menuOptions} /></div>
              {isTask ? (
                <div>
                  <label style={labelSt()}>業務名称</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {editingTaskLabel ? (<><input value={taskLabel} onChange={e => setTaskLabel(e.target.value)} style={{ ...inputSt(), flex: 1 }} /><button onClick={() => setEditingTaskLabel(false)} style={miniBtn(true)}>確定</button></>) : (<><div style={{ ...inputSt(), flex: 1, display: "flex", alignItems: "center" }}>{taskLabel}</div><button onClick={() => setEditingTaskLabel(true)} style={miniBtn()}>変更</button></>)}
                  </div>
                </div>
              ) : (
                <div>
                  <label style={labelSt()}>氏名 <span style={{ color: "#ef4444", fontSize: 11 }}>※必須</span></label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["male","female","none"] as Gender[]).map(g => { const gc2=GENDER_COLORS[g]; const isActive=gender===g; return <button key={g} onClick={() => setGender(g)} style={{ flexShrink:0, height:46, padding:"0 16px", borderRadius:12, border: isActive?`2px solid ${gc2.badge}`:`1px solid ${BORDER}`, background: isActive?`${gc2.badge}22`:CARD_BG, color: isActive?gc2.text:TEXT_SUB, fontWeight:900, fontSize:14, cursor:"pointer" }}>{gc2.label}</button>; })}
                    <NameInput value={name} onChange={setName} karuteNames={karuteNames} color={gc.text} />
                  </div>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={labelSt()}>開始時刻</label><CustomSelect value={start} onChange={setStart} options={startOptions} /></div>
                <div><label style={labelSt()}>対象日</label><input value={selectedDate} readOnly style={inputSt({ opacity: 0.75 })} /></div>
              </div>
              <div>
                <label style={labelSt()}>金額（自動入力・変更可）</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:TEXT_SUB, fontSize:15, pointerEvents:"none" }}>¥</span>
                  <input type="number" value={customPriceInput} onChange={e => setCustomPriceInput(e.target.value)} style={{ ...inputSt(), paddingLeft:26 }} />
                </div>
              </div>
              <div><label style={labelSt()}>メモ（任意）</label><textarea value={memo} onChange={e => setMemo(e.target.value)} placeholder="例：腰痛 / 自律神経 / 紹介…" style={inputSt({ minHeight:80, resize:"vertical" })} /></div>
            </div>
          </div>

          <div style={card()}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12 }}>名簿 <span style={{ color: TEXT_SUB, fontSize: 12, fontWeight: 400 }}>（当日 / 最大10件）</span></div>
            {dayReservations.length===0 ? <div style={{ fontSize:14, color:TEXT_SUB, padding:"8px 0" }}>予約なし</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {dayReservations.slice(0,10).map(r => {
                  const menu=menuMap.get(r.menuId), isDone=r.status==="done", isCancelled=r.status==="cancelled";
                  const mc=isCancelled?CANCEL_COLORS:isDone?DONE_COLORS:getMenuColor(r.menuId,taskLabel) as any;
                  const rgc=GENDER_COLORS[r.gender??"none"], price=getPrice(r,menuMap);
                  const isCustom=r.customPrice!==undefined&&r.customPrice!==menu?.price, isTaskItem=r.menuId==="task";
                  return (
                    <div key={r.id} onClick={() => toggleDone(r.id)} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", borderRadius:12, background:isCancelled?"#fee2e2":isDone?"#dcfce7":CARD_BG, border:`1.5px solid ${mc.border}`, cursor:"pointer", opacity:isCancelled?0.75:1, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
                      <div style={{ width:22, height:22, borderRadius:"50%", flexShrink:0, border:`2px solid ${mc.border}`, background:isCancelled?"#fca5a5":isDone?"#86efac":"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:isCancelled?"#dc2626":"#16a34a" }}>{isCancelled?"✕":isDone?"✓":""}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
                          <span style={{ fontSize:10, fontWeight:900, padding:"2px 6px", borderRadius:4, background:mc.badge, color:mc.badgeTxt, flexShrink:0 }}>{isCancelled?"取消":isDone?"済":mc.label}</span>
                          {!isTaskItem&&(r.gender??"none")!=="none"&&<span style={{ fontSize:10, fontWeight:900, padding:"2px 5px", borderRadius:4, background:rgc.badge, color:"#fff", flexShrink:0 }}>{rgc.label}</span>}
                          <span style={{ fontSize:13, fontWeight:900, color:isTaskItem?TEXT_SUB:rgc.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", textDecoration:isCancelled?"line-through":"none" }}>{r.start}–{r.end}　{isTaskItem?taskLabel:r.name}</span>
                        </div>
                        <div style={{ fontSize:12, color:TEXT_SUB, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {isTaskItem?(r.memo||taskLabel):menu?.label}
                          {price>0&&<span style={{ color:isCustom?"#d97706":undefined, fontWeight:isCustom?900:undefined }}>　¥{money(price)}</span>}
                        </div>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:3, flexShrink:0 }}>
                        <button onClick={e=>toggleCancelled(r.id,e)} style={{ width:44, height:22, borderRadius:6, border:isCancelled?"1.5px solid #dc2626":`1px solid ${BORDER}`, background:isCancelled?"#fee2e2":CARD_BG, color:isCancelled?"#dc2626":TEXT_SUB, cursor:"pointer", fontSize:10, fontWeight:900 }}>取消</button>
                        <button onClick={e=>{e.stopPropagation();removeReservation(r.id);}} style={{ width:44, height:22, borderRadius:6, border:`1px solid ${BORDER}`, background:CARD_BG, color:TEXT_SUB, cursor:"pointer", fontSize:12 }}>×</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {dayReservations.length>0&&(
              <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${BORDER}`, display:"flex", justifyContent:"space-between", fontSize:13, color:TEXT_SUB }}>
                <span>本日 {dayReservations.filter(r=>r.status!=="cancelled"&&r.menuId!=="task").length}件</span>
                <span>¥{money(dayReservations.filter(r=>r.status!=="cancelled"&&r.menuId!=="task").reduce((s,r)=>s+getPrice(r,menuMap),0))}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";

const LS_KEY = "enmeidou_reception_v2";
const TASK_LABEL_KEY = "enmeidou_task_label";
const KARUTE_KEY = "enmeidou_karute_v1";
const HOLIDAY_KEY = "enmeidou_holidays_v1";

const GAS_URL = "https://script.google.com/macros/s/AKfycbwuywlJv48PAfmEsGc-RcEsSFdYFmW7hbaQD0w8AO7TGRZja--y1qMLA-VFvYLNJMYL/exec";
const SHEET_ID = "17xTuYtuaUdATKvqWPP8Qd7ucHhyfwCh9jpinprAgSp4";

const OPEN = "09:00";
const CLOSE = "22:00";
const SNAP_MIN = 30;
const TASK_SNAP_MIN = 15;

type ReservationStatus = "todo" | "done" | "cancelled";
type Gender = "male" | "female" | "none";
type Reservation = {
  id: string; date: string; start: string; end: string;
  name: string; menuId: string; memo: string;
  status: ReservationStatus; customPrice?: number;
  gender?: Gender; createdAt: number; customLabel?: string;
};
type Menu = { id: string; label: string; minutes: number; price: number; isTask?: boolean; };

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
function getPrice(r: { menuId: string; customPrice?: number }, menuMap: Map<string, { price: number }>) {
  return r.customPrice !== undefined ? r.customPrice : (menuMap.get(r.menuId)?.price ?? 0);
}

const BG = "#f5f0e8";
const CARD_BG = "#ffffff";
const CARD_BOR = "rgba(0,0,0,0.08)";
const TEXT = "#1a1a1a";
const TEXT_SUB = "rgba(0,0,0,0.45)";
const BORDER = "rgba(0,0,0,0.10)";

const MENU_COLORS = {
  jp:   { bg: "linear-gradient(135deg,#dbeafe,#eff6ff)", border: "#3b82f6", badge: "#2563eb", badgeTxt: "#fff", label: "国内" },
  int:  { bg: "linear-gradient(135deg,#fef3c7,#fffbeb)", border: "#f59e0b", badge: "#d97706", badgeTxt: "#fff", label: "INT" },
  stu:  { bg: "linear-gradient(135deg,#ede9fe,#f5f3ff)", border: "#8b5cf6", badge: "#7c3aed", badgeTxt: "#fff", label: "学生" },
  task: { bg: "linear-gradient(135deg,#f3f4f6,#f9fafb)", border: "#9ca3af", badge: "#6b7280", badgeTxt: "#fff", label: "業務" },
};
const DONE_COLORS = { bg: "linear-gradient(135deg,#dcfce7,#f0fdf4)", border: "#22c55e", badge: "#16a34a", badgeTxt: "#fff" };
const CANCEL_COLORS = { bg: "linear-gradient(135deg,#fee2e2,#fff1f2)", border: "#ef4444", badge: "#dc2626", badgeTxt: "#fff" };
const GENDER_COLORS = {
  male:   { text: "#1d4ed8", badge: "#2563eb", label: "男" },
  female: { text: "#be185d", badge: "#db2777", label: "女" },
  none:   { text: TEXT, badge: "#9ca3af", label: "－" },
};

function getMenuColor(menuId: string, taskLabel?: string) {
  if (menuId === "task") return { ...MENU_COLORS.task, label: taskLabel || "業務" };
  if (menuId.startsWith("int")) return MENU_COLORS.int;
  if (menuId.startsWith("stu")) return MENU_COLORS.stu;
  return MENU_COLORS.jp;
}

function card(extra?: React.CSSProperties): React.CSSProperties {
  return { borderRadius: 16, padding: 20, background: CARD_BG, border: `1px solid ${CARD_BOR}`, boxShadow: "0 2px 12px rgba(0,0,0,0.07)", ...extra };
}
function miniBtn(active?: boolean): React.CSSProperties {
  return { height: 34, padding: "0 12px", borderRadius: 10, border: active ? "1.5px solid #2563eb" : `1px solid ${BORDER}`, background: active ? "#dbeafe" : "#f9fafb", color: active ? "#1d4ed8" : TEXT, cursor: "pointer", fontWeight: 800, fontSize: 14 };
}
function labelSt(): React.CSSProperties {
  return { display: "block", fontSize: 13, color: TEXT_SUB, marginBottom: 7, fontWeight: 700 };
}
function inputSt(extra?: React.CSSProperties): React.CSSProperties {
  return { width: "100%", borderRadius: 12, border: `1px solid ${BORDER}`, background: "#fafafa", color: TEXT, padding: "11px 14px", outline: "none", fontSize: 15, ...extra };
}

async function syncToSheet(reservations: Reservation[]) {
  try {
    await fetch(GAS_URL, {
      method: "POST",
      body: JSON.stringify({ sheetId: SHEET_ID, reservations }),
    });
  } catch {}
}

async function loadFromSheet(): Promise<Reservation[] | null> {
  try {
    const res = await fetch(`${GAS_URL}?sheetId=${SHEET_ID}`);
    const data = await res.json();
    if (data.ok && Array.isArray(data.reservations) && data.reservations.length > 0) {
      return data.reservations;
    }
  } catch {}
  return null;
}

function CustomSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <div onClick={() => setOpen(o => !o)} style={{ width: "100%", borderRadius: 12, border: `1px solid ${open ? "#2563eb" : BORDER}`, background: "#fafafa", color: TEXT, padding: "11px 36px 11px 14px", fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", userSelect: "none" }}>
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected?.label ?? ""}</span>
        <span style={{ position: "absolute", right: 12, opacity: 0.4, fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999, background: "#fff", border: `1px solid #2563eb44`, borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", maxHeight: 260, overflowY: "auto" }}>
          {options.map(o => (
            <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
              style={{ padding: "11px 14px", fontSize: 14, cursor: "pointer", background: o.value === value ? "#dbeafe" : "transparent", color: o.value === value ? "#1d4ed8" : TEXT, borderBottom: `1px solid ${BORDER}` }}
              onMouseEnter={e => (e.currentTarget.style.background = o.value === value ? "#dbeafe" : "#f5f5f5")}
              onMouseLeave={e => (e.currentTarget.style.background = o.value === value ? "#dbeafe" : "transparent")}
            >{o.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function NameInput({ value, onChange, karuteNames, color }: {
  value: string; onChange: (v: string) => void;
  karuteNames: { kanji: string; kana: string }[]; color: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    if (!value.trim()) return karuteNames;
    return karuteNames.filter(k => k.kanji.includes(value) || k.kana.includes(value));
  }, [value, karuteNames]);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} style={{ position: "relative", flex: 1 }}>
      <input value={value} onChange={e => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="例：山田 太郎"
        style={{ ...inputSt(), color, fontWeight: value ? 900 : undefined, width: "100%" }} />
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 9999, background: "#fff", border: `1px solid #2563eb44`, borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.12)", maxHeight: 200, overflowY: "auto" }}>
          {filtered.map(k => (
            <div key={k.kanji} onClick={() => { onChange(k.kanji); setOpen(false); }}
              style={{ padding: "10px 14px", cursor: "pointer", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f5f5f5")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontSize: 14, color: TEXT }}>{k.kanji}</span>
              <span style={{ fontSize: 12, color: TEXT_SUB }}>{k.kana}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContextMenu({ x, y, onDelete, onClose }: { x: number; y: number; onDelete: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  return (
    <div ref={ref} style={{ position: "fixed", left: x, top: y, zIndex: 99999, background: "#fff", border: "1px solid #fca5a5", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", overflow: "hidden", minWidth: 140 }}>
      <div onClick={onDelete} style={{ padding: "10px 16px", cursor: "pointer", color: "#dc2626", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}
        onMouseEnter={e => (e.currentTarget.style.background = "#fee2e2")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >🗑 削除</div>
    </div>
  );
}

export default function ReceptionPage() {
  const [selectedDate, setSelectedDate] = useState(() => ymdOf(new Date()));
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [showHolidayMgr, setShowHolidayMgr] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "ok" | "offline">("idle");
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; });
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("none");
  const [start, setStart] = useState(OPEN);
  const [menuId, setMenuId] = useState(MENUS[0].id);
  const [memo, setMemo] = useState("");
  const [customPriceInput, setCustomPriceInput] = useState<string>(String(MENUS[0].price));
  const [taskLabel, setTaskLabel] = useState("業務");
  const [editingTaskLabel, setEditingTaskLabel] = useState(false);
  const [karuteNames, setKaruteNames] = useState<{ kanji: string; kana: string }[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [doubleBookWarn, setDoubleBookWarn] = useState<string | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingRef = useRef<{ id: string; startX: number; origMin: number } | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  const isTask = menuId === "task";
  const isHoliday = holidays.includes(selectedDate);

  useEffect(() => {
    try {
      const savedLabel = localStorage.getItem(TASK_LABEL_KEY);
      if (savedLabel) setTaskLabel(savedLabel);
      const karuteRaw = localStorage.getItem(KARUTE_KEY);
      if (karuteRaw) {
        const list = JSON.parse(karuteRaw);
        setKaruteNames(list.map((k: any) => ({ kanji: k.kanji || "", kana: k.kana || "" })).sort((a: any, b: any) => a.kana.localeCompare(b.kana, "ja")));
      }
      const holRaw = localStorage.getItem(HOLIDAY_KEY);
      if (holRaw) { const h = JSON.parse(holRaw); if (Array.isArray(h)) setHolidays(h); }
    } catch {}

    setSyncStatus("syncing");
    loadFromSheet().then(data => {
      if (data && data.length > 0) {
        setReservations(data);
        localStorage.setItem(LS_KEY, JSON.stringify(data));
        setSyncStatus("ok");
      } else {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) setReservations(p); }
        setSyncStatus("offline");
      }
      isInitialLoad.current = false;
    });
  }, []);

  useEffect(() => {
    if (isInitialLoad.current) return;
    localStorage.setItem(LS_KEY, JSON.stringify(reservations));
    localStorage.setItem(TASK_LABEL_KEY, taskLabel);
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    setSyncStatus("syncing");
    syncTimerRef.current = setTimeout(() => {
      syncToSheet(reservations).then(() => setSyncStatus("ok")).catch(() => setSyncStatus("offline"));
    }, 1500);
  }, [reservations, taskLabel]);

  useEffect(() => {
    try { localStorage.setItem(HOLIDAY_KEY, JSON.stringify(holidays)); } catch {}
  }, [holidays]);

  function toggleHoliday(ymd: string) {
    setHolidays(prev => prev.includes(ymd) ? prev.filter(d => d !== ymd) : [...prev, ymd]);
  }

  function exportData() {
    const data = { reservations, holidays, taskLabel, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `円命堂_バックアップ_${ymdOf(new Date())}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.reservations) { setReservations(data.reservations); syncToSheet(data.reservations); }
        if (data.holidays) setHolidays(data.holidays);
        if (data.taskLabel) setTaskLabel(data.taskLabel);
        alert("復元しました");
      } catch { alert("ファイルが正しくありません"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const menuMap = useMemo(() => { const m = new Map<string, Menu>(); MENUS.forEach(x => m.set(x.id, x)); return m; }, []);

  function handleMenuChange(newMenuId: string) {
    setMenuId(newMenuId);
    const m = MENUS.find(x => x.id === newMenuId);
    if (m) setCustomPriceInput(m.isTask ? "" : String(m.price));
  }

  const dayReservations = useMemo(() =>
    reservations.filter(r => r.date === selectedDate).sort((a,b) => hhmmToMin(a.start) - hhmmToMin(b.start)),
    [reservations, selectedDate]);

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
    const first = new Date(y, m, 1), last = new Date(y, m+1, 0);
    const startDay = first.getDay();
    const cells: { date: Date; inMonth: boolean }[] = [];
    const prevLast = new Date(y, m, 0).getDate();
    for (let i=0; i<startDay; i++) cells.push({ date: new Date(y, m-1, prevLast-(startDay-1-i)), inMonth: false });
    for (let d=1; d<=last.getDate(); d++) cells.push({ date: new Date(y, m, d), inMonth: true });
    while (cells.length < 42) { const lc = cells[cells.length-1].date; const nx = new Date(lc); nx.setDate(lc.getDate()+1); cells.push({ date: nx, inMonth: false }); }
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

  function checkDoubleBooking(newStart: string, newEnd: string, excludeId?: string): string | null {
    const ns = hhmmToMin(newStart), ne = hhmmToMin(newEnd);
    for (const r of reservations) {
      if (r.date !== selectedDate) continue;
      if (r.id === excludeId) continue;
      if (r.status === "cancelled") continue;
      const rs = hhmmToMin(r.start), re = hhmmToMin(r.end);
      if (ns < re && ne > rs) return r.name || "業務";
    }
    return null;
  }

  function addReservation() {
    if (!isTask && !name.trim()) return;
    const menu = menuMap.get(menuId) ?? MENUS[0];
    const snap = isTask ? TASK_SNAP_MIN : SNAP_MIN;
    const endMin = clamp(hhmmToMin(start) + menu.minutes, openMin + snap, closeMin);
    const endStr = minToHHMM(endMin);
    const conflict = checkDoubleBooking(start, endStr);
    if (conflict) {
      setDoubleBookWarn(`⚠️ 「${conflict}」と時間が重複しています`);
      setTimeout(() => setDoubleBookWarn(null), 4000);
      return;
    }
    const cp = customPriceInput !== "" ? Number(customPriceInput) : undefined;
    setReservations(prev => [...prev, { id: uid(), date: selectedDate, start, end: endStr, name: isTask ? taskLabel : name.trim(), menuId, memo: memo.trim(), status: "todo", customPrice: cp, gender: isTask ? "none" : gender, createdAt: Date.now() }]);
    setName(""); setMemo(""); setGender("none");
    const m = menuMap.get(menuId);
    setCustomPriceInput(m?.isTask ? "" : String(m?.price ?? ""));
  }

  function toggleDone(id: string) {
    setReservations(prev => prev.map(r => { if (r.id !== id) return r; if (r.status === "cancelled") return r; return { ...r, status: r.status === "done" ? "todo" : "done" }; }));
  }
  function toggleCancelled(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setReservations(prev => prev.map(r => r.id === id ? { ...r, status: r.status === "cancelled" ? "todo" : "cancelled" } : r));
  }
  function removeReservation(id: string) { setReservations(prev => prev.filter(r => r.id !== id)); setContextMenu(null); }

  const PX_PER_MIN = useMemo(() => {
    if (typeof window === "undefined") return 2.0;
    return Math.max(1.0, ((window.innerWidth - 120) / totalMin) * 0.92);
  }, []);

  function onContextMenu(e: React.MouseEvent, id: string) { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, id }); }
  function onTouchStart(e: React.TouchEvent, id: string) { longPressRef.current = setTimeout(() => { const t = e.touches[0]; setContextMenu({ x: t.clientX, y: t.clientY, id }); }, 600); }
  function onTouchEnd() { if (longPressRef.current) clearTimeout(longPressRef.current); }

  function onMouseDown(e: React.MouseEvent, id: string) {
    if (e.button === 2) return;
    e.preventDefault();
    const r = reservations.find(x => x.id === id); if (!r) return;
    draggingRef.current = { id, startX: e.clientX, origMin: hhmmToMin(r.start) };
    const snap = r.menuId === "task" ? TASK_SNAP_MIN : SNAP_MIN;
    function onMouseMove(ev: MouseEvent) {
      if (!draggingRef.current) return;
      const dMin = Math.round((ev.clientX - draggingRef.current.startX) / PX_PER_MIN / snap) * snap;
      const newStartMin = clamp(draggingRef.current.origMin + dMin, openMin, closeMin - snap);
      setReservations(prev => prev.map(rv => {
        if (rv.id !== draggingRef.current!.id) return rv;
        const dur = (menuMap.get(rv.menuId)?.minutes) ?? (hhmmToMin(rv.end) - hhmmToMin(rv.start));
        const endMin = clamp(newStartMin + dur, openMin + snap, closeMin);
        return { ...rv, start: minToHHMM(clamp(endMin - dur, openMin, closeMin - snap)), end: minToHHMM(endMin) };
      }));
    }
    function onMouseUp() { draggingRef.current = null; window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  const todayYMD = ymdOf(new Date());
  const labelSlots = getLabelSlots();
  const timelineWidth = totalMin * PX_PER_MIN;
  const gc = GENDER_COLORS[gender];
  const menuOptions = MENUS.map(m => ({ value: m.id, label: m.isTask ? `${m.label}　（売上手入力）` : `${m.label}　¥${money(m.price)}` }));
  const startOptions = getSlots(isTask ? TASK_SNAP_MIN : SNAP_MIN).slice(0, -1).map(t => ({ value: t, label: t }));

  const syncLabel = syncStatus === "syncing" ? "⏳ 同期中..." : syncStatus === "ok" ? "✅ 同期済" : syncStatus === "offline" ? "⚠️ オフライン" : "";
  const syncColor = syncStatus === "syncing" ? "#f59e0b" : syncStatus === "ok" ? "#16a34a" : syncStatus === "offline" ? "#ef4444" : TEXT_SUB;

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'Hiragino Sans','Yu Gothic UI',sans-serif", padding: "16px" }}
      onClick={() => setContextMenu(null)}>
      <style>{`* { box-sizing: border-box; } ::-webkit-scrollbar{height:6px;width:6px} ::-webkit-scrollbar-track{background:rgba(0,0,0,0.04);border-radius:3px} ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.18);border-radius:3px} input::placeholder,textarea::placeholder{color:rgba(0,0,0,0.3)}`}</style>

      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} onDelete={() => removeReservation(contextMenu.id)} onClose={() => setContextMenu(null)} />}
      {doubleBookWarn && <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 99999, background: "#dc2626", color: "#fff", padding: "12px 24px", borderRadius: 12, fontWeight: 900, fontSize: 15 }}>{doubleBookWarn}</div>}

      <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 4, flexWrap: "wrap" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 10px #22c55e" }} />
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1 }}>PEAK MANAGER</div>
          <div style={{ color: TEXT_SUB, fontSize: 14 }}>/ 円命堂 予約管理</div>
          <a href="/stats" style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "#f0f0f0", color: TEXT_SUB, textDecoration: "none", fontWeight: 700 }}>📊 経営指標</a>
          <a href="/karute" style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "#f0f0f0", color: TEXT_SUB, textDecoration: "none", fontWeight: 700 }}>📋 クライアントカルテ</a>
          <button onClick={() => setShowHolidayMgr(v => !v)} style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8, fontWeight: 700, cursor: "pointer", border: showHolidayMgr ? "1.5px solid #dc2626" : `1px solid ${BORDER}`, background: showHolidayMgr ? "#fee2e2" : "#f0f0f0", color: showHolidayMgr ? "#dc2626" : TEXT_SUB }}>🗓 休日管理</button>
          <button onClick={exportData} style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8, border: "1px solid #16a34a44", background: "#dcfce7", color: "#16a34a", cursor: "pointer", fontWeight: 700 }}>📤 バックアップ</button>
          <label style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8, border: "1px solid #2563eb44", background: "#dbeafe", color: "#2563eb", cursor: "pointer", fontWeight: 700 }}>
            📥 復元<input type="file" accept=".json" onChange={importData} style={{ display: "none" }} />
          </label>
          {syncLabel && <div style={{ fontSize: 13, fontWeight: 700, color: syncColor }}>{syncLabel}</div>}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
            <span style={{ color: TEXT_SUB }}>見込み</span><span style={{ fontWeight: 900 }}>¥{money(sales.expected)}</span>
            <span style={{ color: TEXT_SUB }}>|</span>
            <span style={{ color: TEXT_SUB }}>実績</span><span style={{ fontWeight: 900, color: "#16a34a" }}>¥{money(sales.actual)}</span>
            <span style={{ color: TEXT_SUB }}>|</span>
            <span style={{ color: TEXT_SUB }}>{sales.pct}%</span>
            <div style={{ width: 80, height: 6, borderRadius: 999, background: "rgba(0,0,0,0.08)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${clamp(sales.pct,0,100)}%`, background: "linear-gradient(90deg,#22c55e,#3b82f6)", transition: "width 0.4s ease" }} />
            </div>
            <div style={{ color: TEXT_SUB, fontSize: 14 }}>{selectedDate}</div>
          </div>
        </div>

        {showHolidayMgr && (
          <div style={{ ...card(), background: "#fff8f8", border: "1.5px solid #fca5a5" }}>
            <div style={{ fontSize: 15, fontWeight: 900, marginBottom: 10, color: "#dc2626" }}>🗓 休日設定</div>
            <div style={{ fontSize: 13, color: TEXT_SUB, marginBottom: 12 }}>カレンダーで日付を選択 → 下のボタンで休日設定／解除</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>選択中：{selectedDate}</div>
              <button onClick={() => toggleHoliday(selectedDate)} style={{ height: 36, padding: "0 18px", borderRadius: 10, fontWeight: 900, cursor: "pointer", fontSize: 14, border: isHoliday ? "1.5px solid #16a34a" : "1.5px solid #dc2626", background: isHoliday ? "#dcfce7" : "#fee2e2", color: isHoliday ? "#16a34a" : "#dc2626" }}>
                {isHoliday ? "✓ 休日を解除する" : "✕ 休日にする"}
              </button>
              {holidays.length > 0 && <div style={{ fontSize: 13, color: TEXT_SUB }}>設定済み：{holidays.sort().join("　")}</div>}
            </div>
          </div>
        )}

        {isHoliday && <div style={{ borderRadius: 12, padding: "12px 20px", background: "#fee2e2", border: "1.5px solid #fca5a5", fontWeight: 900, color: "#dc2626", fontSize: 15 }}>🚫 {selectedDate} は休日に設定されています</div>}

        <div style={card()}>
          <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 10 }}>📅 タイムライン <span style={{ color: TEXT_SUB, fontWeight: 400, fontSize: 13 }}>ドラッグで時刻変更（右クリック／長押しで削除）</span></div>
          <div style={{ overflowX: "auto", paddingBottom: 4 }}>
            <div style={{ width: timelineWidth, minWidth: "100%" }}>
              <div style={{ display: "flex", marginBottom: 6 }}>
                {labelSlots.map(t => <div key={t} style={{ width: 60*PX_PER_MIN, fontSize: 12, color: TEXT_SUB, flexShrink: 0 }}>{t}</div>)}
              </div>
              <div style={{ position: "relative", height: 96, background: "#f8f6f2", borderRadius: 14, border: `1px solid ${BORDER}` }}>
                {labelSlots.map(t => <div key={t} style={{ position: "absolute", left: (hhmmToMin(t)-openMin)*PX_PER_MIN, top: 0, bottom: 0, width: 1, background: "rgba(0,0,0,0.08)" }} />)}
                {dayReservations.map(r => {
                  const menu = menuMap.get(r.menuId);
                  const left = (hhmmToMin(r.start)-openMin)*PX_PER_MIN;
                  const width = (hhmmToMin(r.end)-hhmmToMin(r.start))*PX_PER_MIN;
                  const isDone = r.status==="done", isCancelled = r.status==="cancelled";
                  const mc = isCancelled ? CANCEL_COLORS : isDone ? DONE_COLORS : getMenuColor(r.menuId, taskLabel) as any;
                  const rgc = GENDER_COLORS[r.gender ?? "none"];
                  return (
                    <div key={r.id} onMouseDown={e => onMouseDown(e, r.id)} onContextMenu={e => onContextMenu(e, r.id)} onTouchStart={e => onTouchStart(e, r.id)} onTouchEnd={onTouchEnd} onTouchMove={onTouchEnd}
                      style={{ position: "absolute", left, top: 4, height: 88, width: Math.max(width, 48), cursor: "grab", zIndex: 5, userSelect: "none", opacity: isCancelled ? 0.6 : 1 }}>
                      <div style={{ height: "100%", borderRadius: 10, padding: "6px 8px", background: mc.bg, border: `1.5px solid ${mc.border}`, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.10)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 900, padding: "1px 5px", borderRadius: 4, background: mc.badge, color: mc.badgeTxt, flexShrink: 0 }}>{isCancelled?"取消":isDone?"済":mc.label}</span>
                          <span style={{ fontSize: 11, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: TEXT }}>{r.start}–{r.end}</span>
                        </div>
                        {r.menuId !== "task" && (
                          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                            {(r.gender ?? "none") !== "none" && <span style={{ fontSize: 10, fontWeight: 900, padding: "1px 4px", borderRadius: 4, background: rgc.badge, color: "#fff", flexShrink: 0 }}>{rgc.label}</span>}
                            <span style={{ fontSize: 12, fontWeight: 900, color: rgc.text, wordBreak: "break-all", lineHeight: 1.2 }}>{r.name}</span>
                          </div>
                        )}
                        {r.menuId === "task" && r.memo && <div style={{ fontSize: 11, color: TEXT_SUB, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.memo}</div>}
                        <div style={{ fontSize: 10, color: TEXT_SUB, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.menuId === "task" ? (getPrice(r,menuMap)>0?`¥${money(getPrice(r,menuMap))}`:"") : `${menu?.label} · ¥${money(getPrice(r,menuMap))}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "480px 1fr 360px", gap: 16, alignItems: "start" }}>
          <div style={card()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{monthCursor.getFullYear()} / {monthCursor.getMonth()+1}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["◀","今日","▶"] as const).map((label, i) => (
                  <button key={label} onClick={() => { if(i===1){const t=new Date();t.setDate(1);t.setHours(0,0,0,0);setMonthCursor(t);setSelectedDate(ymdOf(new Date()));}else{const d=new Date(monthCursor);d.setMonth(d.getMonth()+(i===0?-1:1));setMonthCursor(d);} }} style={miniBtn()}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 11, color: TEXT_SUB, flexWrap: "wrap" }}>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#fee2e2", border: "1px solid #fca5a5", marginRight: 4 }} />休日</span>
              <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#dbeafe", border: "1px solid #3b82f6", marginRight: 4 }} />選択中</span>
              <span><span style={{ color: "#16a34a", fontWeight: 900, marginRight: 4 }}>●</span>予約あり</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5, marginBottom: 8 }}>
              {["日","月","火","水","木","金","土"].map((w,i) => <div key={w} style={{ textAlign: "center", fontSize: 12, color: i===0?"#ef4444":i===6?"#3b82f6":TEXT_SUB }}>{w}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
              {monthDays.map((cell,i) => {
                const ymd = ymdOf(cell.date);
                const isSelected = ymd===selectedDate, isToday = ymd===todayYMD, isHol = holidays.includes(ymd);
                const count = countsByDay.get(ymd)??0, dow = cell.date.getDay();
                return (
                  <button key={`${ymd}_${i}`} onClick={() => setSelectedDate(ymd)} style={{ height: 58, borderRadius: 12, position: "relative", border: isSelected?"2px solid #2563eb":isHol?"1.5px solid #fca5a5":`1px solid ${BORDER}`, background: isHol?"#fee2e2":isSelected?"#dbeafe":isToday?"#f0fdf4":CARD_BG, color: !cell.inMonth?"rgba(0,0,0,0.2)":dow===0?"#ef4444":dow===6?"#2563eb":TEXT, cursor: "pointer", overflow: "hidden" }}>
                    <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{cell.date.getDate()}</div>
                    {isHol && <div style={{ fontSize: 9, color: "#dc2626", fontWeight: 900 }}>休</div>}
                    {count>0 && <div style={{ position: "absolute", right: 5, bottom: 5, fontSize: 12, fontWeight: 900, color: "#16a34a" }}>{count}</div>}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={card()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>予約入力</div>
              <button onClick={addReservation} disabled={!isTask && !name.trim()} style={{ height: 36, padding: "0 16px", borderRadius: 10, border: (isTask||name.trim())?"1.5px solid #2563eb":`1px solid ${BORDER}`, background: (isTask||name.trim())?"#2563eb":"#f0f0f0", color: (isTask||name.trim())?"#fff":TEXT_SUB, fontWeight: 900, fontSize: 13, cursor: (isTask||name.trim())?"pointer":"not-allowed", whiteSpace: "nowrap" }}>＋ {isTask?taskLabel:"予約"}を追加</button>
            </div>
            {(() => {
              const menu = menuMap.get(menuId); if (!menu) return null;
              const snap = isTask?TASK_SNAP_MIN:SNAP_MIN;
              const endMin = clamp(hhmmToMin(start)+menu.minutes, openMin+snap, closeMin);
              const conflict = checkDoubleBooking(start, minToHHMM(endMin));
              if (!conflict) return null;
              return <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 10, background: "#fef3c7", border: "1.5px solid #f59e0b", color: "#92400e", fontWeight: 700, fontSize: 13 }}>⚠️ この時間帯は「{conflict}」と重複します</div>;
            })()}
            <div style={{ display: "grid", gap: 14 }}>
              <div><label style={labelSt()}>メニュー</label><CustomSelect value={menuId} onChange={handleMenuChange} options={menuOptions} /></div>
              {isTask ? (
                <div>
                  <label style={labelSt()}>業務名称</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {editingTaskLabel ? (<><input value={taskLabel} onChange={e => setTaskLabel(e.target.value)} style={{ ...inputSt(), flex: 1 }} /><button onClick={() => setEditingTaskLabel(false)} style={miniBtn(true)}>確定</button></>) : (<><div style={{ ...inputSt(), flex: 1, display: "flex", alignItems: "center" }}>{taskLabel}</div><button onClick={() => setEditingTaskLabel(true)} style={miniBtn()}>変更</button></>)}
                  </div>
                </div>
              ) : (
                <div>
                  <label style={labelSt()}>氏名 <span style={{ color: "#ef4444", fontSize: 11 }}>※必須</span></label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["male","female","none"] as Gender[]).map(g => { const gc2=GENDER_COLORS[g]; const isActive=gender===g; return <button key={g} onClick={() => setGender(g)} style={{ flexShrink:0, height:46, padding:"0 16px", borderRadius:12, border: isActive?`2px solid ${gc2.badge}`:`1px solid ${BORDER}`, background: isActive?`${gc2.badge}22`:CARD_BG, color: isActive?gc2.text:TEXT_SUB, fontWeight:900, fontSize:14, cursor:"pointer" }}>{gc2.label}</button>; })}
                    <NameInput value={name} onChange={setName} karuteNames={karuteNames} color={gc.text} />
                  </div>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={labelSt()}>開始時刻</label><CustomSelect value={start} onChange={setStart} options={startOptions} /></div>
                <div><label style={labelSt()}>対象日</label><input value={selectedDate} readOnly style={inputSt({ opacity: 0.75 })} /></div>
              </div>
              <div>
                <label style={labelSt()}>金額（自動入力・変更可）</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:TEXT_SUB, fontSize:15, pointerEvents:"none" }}>¥</span>
                  <input type="number" value={customPriceInput} onChange={e => setCustomPriceInput(e.target.value)} style={{ ...inputSt(), paddingLeft:26 }} />
                </div>
              </div>
              <div><label style={labelSt()}>メモ（任意）</label><textarea value={memo} onChange={e => setMemo(e.target.value)} placeholder="例：腰痛 / 自律神経 / 紹介…" style={inputSt({ minHeight:80, resize:"vertical" })} /></div>
            </div>
          </div>

          <div style={card()}>
            <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 12 }}>名簿 <span style={{ color: TEXT_SUB, fontSize: 12, fontWeight: 400 }}>（当日 / 最大10件）</span></div>
            {dayReservations.length===0 ? <div style={{ fontSize:14, color:TEXT_SUB, padding:"8px 0" }}>予約なし</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {dayReservations.slice(0,10).map(r => {
                  const menu=menuMap.get(r.menuId), isDone=r.status==="done", isCancelled=r.status==="cancelled";
                  const mc=isCancelled?CANCEL_COLORS:isDone?DONE_COLORS:getMenuColor(r.menuId,taskLabel) as any;
                  const rgc=GENDER_COLORS[r.gender??"none"], price=getPrice(r,menuMap);
                  const isCustom=r.customPrice!==undefined&&r.customPrice!==menu?.price, isTaskItem=r.menuId==="task";
                  return (
                    <div key={r.id} onClick={() => toggleDone(r.id)} style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 12px", borderRadius:12, background:isCancelled?"#fee2e2":isDone?"#dcfce7":CARD_BG, border:`1.5px solid ${mc.border}`, cursor:"pointer", opacity:isCancelled?0.75:1, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
                      <div style={{ width:22, height:22, borderRadius:"50%", flexShrink:0, border:`2px solid ${mc.border}`, background:isCancelled?"#fca5a5":isDone?"#86efac":"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:isCancelled?"#dc2626":"#16a34a" }}>{isCancelled?"✕":isDone?"✓":""}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
                          <span style={{ fontSize:10, fontWeight:900, padding:"2px 6px", borderRadius:4, background:mc.badge, color:mc.badgeTxt, flexShrink:0 }}>{isCancelled?"取消":isDone?"済":mc.label}</span>
                          {!isTaskItem&&(r.gender??"none")!=="none"&&<span style={{ fontSize:10, fontWeight:900, padding:"2px 5px", borderRadius:4, background:rgc.badge, color:"#fff", flexShrink:0 }}>{rgc.label}</span>}
                          <span style={{ fontSize:13, fontWeight:900, color:isTaskItem?TEXT_SUB:rgc.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", textDecoration:isCancelled?"line-through":"none" }}>{r.start}–{r.end}　{isTaskItem?taskLabel:r.name}</span>
                        </div>
                        <div style={{ fontSize:12, color:TEXT_SUB, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {isTaskItem?(r.memo||taskLabel):menu?.label}
                          {price>0&&<span style={{ color:isCustom?"#d97706":undefined, fontWeight:isCustom?900:undefined }}>　¥{money(price)}</span>}
                        </div>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:3, flexShrink:0 }}>
                        <button onClick={e=>toggleCancelled(r.id,e)} style={{ width:44, height:22, borderRadius:6, border:isCancelled?"1.5px solid #dc2626":`1px solid ${BORDER}`, background:isCancelled?"#fee2e2":CARD_BG, color:isCancelled?"#dc2626":TEXT_SUB, cursor:"pointer", fontSize:10, fontWeight:900 }}>取消</button>
                        <button onClick={e=>{e.stopPropagation();removeReservation(r.id);}} style={{ width:44, height:22, borderRadius:6, border:`1px solid ${BORDER}`, background:CARD_BG, color:TEXT_SUB, cursor:"pointer", fontSize:12 }}>×</button>
                      </div>
                    </div>
                  );
                })}v
              </div>
            )}
            {dayReservations.length>0&&(
              <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${BORDER}`, display:"flex", justifyContent:"space-between", fontSize:13, color:TEXT_SUB }}>
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