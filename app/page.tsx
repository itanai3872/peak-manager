"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

/* =========================
   型
========================= */
type Reservation = {
  id: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string; // HH:mm
  name: string;
  menuId: string;
  memo: string;
  createdAt: number;
};

type Menu = {
  id: string;
  label: string;
  minutes: number;
  price: number;
  color: "blue" | "green" | "yellow" | "gray";
};

/* =========================
   固定値
========================= */
const LS_KEY = "enmeidou_reservations";
const OPEN = "08:00";
const CLOSE = "20:00";
const SLOT_MIN = 30;
const SLOT_W = 110;

const MENUS: Menu[] = [
  { id: "intl_new_120", label: "インターナショナル新規", minutes: 120, price: 18000, color: "blue" },
  { id: "intl_r_60", label: "インターナショナルR", minutes: 60, price: 12000, color: "green" },
  { id: "dom_new_120", label: "国内新規", minutes: 120, price: 9000, color: "blue" },
  { id: "dom_r_45", label: "国内R", minutes: 45, price: 6800, color: "green" },
  { id: "dom_m_30", label: "国内メンテ", minutes: 30, price: 6000, color: "yellow" },
  { id: "biz_15", label: "業務", minutes: 15, price: 0, color: "gray" },
];

/* =========================
   util
========================= */
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function ymdOf(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function timeToMin(hhmm: string) {
  const m = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}
function minToHHMM(min: number) {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}
function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
function snapToSlot(min: number, slotMin: number) {
  return Math.round(min / slotMin) * slotMin;
}
function overlaps(aS: number, aE: number, bS: number, bE: number) {
  return aS < bE && bS < aE;
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function menuById(id: string) {
  return MENUS.find((m) => m.id === id) ?? MENUS[0];
}
function yen(n: number) {
  return `¥${n.toLocaleString("ja-JP")}`;
}
function colorToBg(c: Menu["color"]) {
  if (c === "blue") return "rgba(80,140,255,0.92)";
  if (c === "green") return "rgba(34,197,94,0.90)";
  if (c === "yellow") return "rgba(250,204,21,0.92)";
  return "rgba(148,163,184,0.85)";
}
function ymToDays(year: number, month: number) {
  const last = new Date(year, month, 0).getDate();
  return Array.from({ length: last }, (_, i) => {
    const dd = pad2(i + 1);
    return `${year}-${pad2(month)}-${dd}`;
  });
}
function btnStyle(): React.CSSProperties {
  return {
    background: "rgba(255,255,255,0.06)",
    color: "white",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 12,
    padding: "10px 12px",
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

/* =========================
   DnD parts
========================= */
function DraggableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        cursor: "grab",
        touchAction: "none",
        userSelect: "none",
        opacity: isDragging ? 0.78 : 1,
      }}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}

function DroppableBox({
  id,
  style,
  children,
}: {
  id: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: isOver ? "rgba(255,255,255,0.12)" : style?.background ?? "transparent",
      }}
    >
      {children}
    </div>
  );
}

/* =========================
   Page（左に「タイムライン→カレンダー」、右に入力）
========================= */
export default function Page() {
  const OPEN_MIN = timeToMin(OPEN);
  const CLOSE_MIN = timeToMin(CLOSE);

  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(2);
  const days = useMemo(() => ymToDays(year, month), [year, month]);

  const [selectedDate, setSelectedDate] = useState(() => ymdOf(new Date()));
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const timelineTimes = useMemo(() => {
    const out: string[] = [];
    for (let m = OPEN_MIN; m <= CLOSE_MIN - SLOT_MIN; m += SLOT_MIN) out.push(minToHHMM(m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return out;
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setReservations(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(reservations));
    } catch {}
  }, [reservations]);

  const selectedReservations = useMemo(() => {
    return reservations
      .filter((r) => r.date === selectedDate)
      .slice()
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [reservations, selectedDate]);

  const daySummary = useMemo(() => {
    const map = new Map<string, { count: number; sales: number }>();
    for (const d of days) map.set(d, { count: 0, sales: 0 });
    for (const r of reservations) {
      const v = map.get(r.date);
      if (!v) continue;
      v.count += 1;
      v.sales += menuById(r.menuId).price;
    }
    return map;
  }, [days, reservations]);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;

    const overId = String(over.id);
    const activeId = String(active.id);

    let newDate = "";
    let newStart: string | null = null;

    if (overId.includes("|")) {
      const [d, t] = overId.split("|");
      newDate = d;
      newStart = t;
    } else {
      newDate = overId;
    }

    setReservations((prev) => {
      const target = prev.find((r) => r.id === activeId);
      if (!target) return prev;

      const dur = timeToMin(target.end) - timeToMin(target.start);

      if (newStart) {
        let startMin = timeToMin(newStart);
        startMin = snapToSlot(startMin, SLOT_MIN);
        startMin = clamp(startMin, OPEN_MIN, CLOSE_MIN - dur);
        const endMin = startMin + dur;

        const conflict = prev.some((r) => {
          if (r.id === activeId) return false;
          if (r.date !== newDate) return false;
          return overlaps(startMin, endMin, timeToMin(r.start), timeToMin(r.end));
        });
        if (conflict) {
          alert("⚠️ その時間は既に予約があります（かぶり防止）");
          return prev;
        }

        return prev.map((r) =>
          r.id !== activeId ? r : { ...r, date: newDate, start: minToHHMM(startMin), end: minToHHMM(endMin) }
        );
      }

      const s = timeToMin(target.start);
      const e2 = timeToMin(target.end);
      const conflict = prev.some((r) => {
        if (r.id === activeId) return false;
        if (r.date !== newDate) return false;
        return overlaps(s, e2, timeToMin(r.start), timeToMin(r.end));
      });
      if (conflict) {
        alert("⚠️ その日/その時間は既に予約があります（かぶり防止）");
        return prev;
      }

      return prev.map((r) => (r.id !== activeId ? r : { ...r, date: newDate }));
    });

    setSelectedDate(newDate);
  }

  function addTestOnSelected() {
    const menu = MENUS[0];
    const dur = menu.minutes;

    let startMin = snapToSlot(timeToMin("13:00"), SLOT_MIN);
    startMin = clamp(startMin, OPEN_MIN, CLOSE_MIN - dur);
    const endMin = startMin + dur;

    setReservations((prev) => {
      const conflict = prev.some((r) => {
        if (r.date !== selectedDate) return false;
        return overlaps(startMin, endMin, timeToMin(r.start), timeToMin(r.end));
      });
      if (conflict) {
        alert("⚠️ テスト追加：その時間は既に予約があります");
        return prev;
      }
      return [
        ...prev,
        {
          id: uid(),
          date: selectedDate,
          start: minToHHMM(startMin),
          end: minToHHMM(endMin),
          name: "テスト",
          menuId: menu.id,
          memo: "",
          createdAt: Date.now(),
        },
      ];
    });
  }

  return (
    <div
      style={{
        background: "#0b1220",
        color: "white",
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
        height: "100vh",
        overflow: "hidden",
        padding: 18,
        boxSizing: "border-box",
      }}
    >
      {/* ヘッダ */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 22, fontWeight: 900 }}>
          案内｜{year}年 {month}月
        </div>

        <Link href="/reception" style={{ color: "white", textDecoration: "underline", opacity: 0.9 }}>
          受付（入力）へ
        </Link>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          <button
            onClick={() => {
              const m = month - 1;
              if (m === 0) {
                setYear((y) => y - 1);
                setMonth(12);
              } else setMonth(m);
            }}
            style={btnStyle()}
          >
            ◀ 前月
          </button>
          <button
            onClick={() => {
              const m = month + 1;
              if (m === 13) {
                setYear((y) => y + 1);
                setMonth(1);
              } else setMonth(m);
            }}
            style={btnStyle()}
          >
            次月 ▶
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
        {/* ✅ 左メイン（上:タイムライン / 下:カレンダー） + 右（入力） */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 420px",
            gap: 14,
            height: "calc(100vh - 56px)",
          }}
        >
          {/* 左：縦2段 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
            {/* 上：タイムライン */}
            <div
              style={{
                borderRadius: 18,
                padding: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                height: 280, // ✅ 上に置くので少し薄く
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 8 }}>タイムライン（{selectedDate}）</div>

              <div style={{ overflowX: "auto", overflowY: "hidden", paddingBottom: 6 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `80px repeat(${timelineTimes.length}, ${SLOT_W}px)`,
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 8,
                    minWidth: 80 + timelineTimes.length * (SLOT_W + 8),
                  }}
                >
                  <div style={{ opacity: 0.7, fontWeight: 800, fontSize: 12 }}>時間</div>
                  {timelineTimes.map((t) => (
                    <div key={t} style={{ fontSize: 11, opacity: 0.6 }}>
                      {t}
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `80px repeat(${timelineTimes.length}, ${SLOT_W}px)`,
                    gap: 8,
                    alignItems: "stretch",
                    minWidth: 80 + timelineTimes.length * (SLOT_W + 8),
                  }}
                >
                  <div
                    style={{
                      borderRadius: 14,
                      padding: 10,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      fontWeight: 900,
                      opacity: 0.9,
                    }}
                  >
                    予約
                  </div>

                  {timelineTimes.map((t) => (
                    <DroppableBox
                      key={t}
                      id={`${selectedDate}|${t}`}
                      style={{
                        height: 92,
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(255,255,255,0.02)",
                      }}
                    />
                  ))}

                  {selectedReservations.map((r) => {
                    const menu = menuById(r.menuId);
                    const startMin = timeToMin(r.start);
                    const endMin = timeToMin(r.end);
                    const startIdx = Math.floor((startMin - OPEN_MIN) / SLOT_MIN);
                    const span = Math.max(1, Math.round((endMin - startMin) / SLOT_MIN));

                    return (
                      <div
                        key={r.id}
                        style={{
                          gridColumn: `${2 + startIdx} / span ${span}`,
                          gridRow: 2,
                          zIndex: 5,
                          alignSelf: "stretch",
                        }}
                      >
                        <DraggableCard id={r.id}>
                          <div
                            style={{
                              height: 92,
                              background: colorToBg(menu.color),
                              borderRadius: 12,
                              padding: "10px 12px",
                              boxShadow: "0 10px 20px rgba(0,0,0,0.25)",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "center",
                            }}
                          >
                            <div style={{ fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {menu.label}（{r.name}）
                            </div>
                            <div style={{ marginTop: 4, fontWeight: 900 }}>
                              {r.start} - {r.end}　{yen(menu.price)}
                            </div>
                            <div style={{ marginTop: 6, fontSize: 11, opacity: 0.95 }}>
                              ※掴んで時間枠/別日へ（かぶりは拒否）
                            </div>
                          </div>
                        </DraggableCard>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={addTestOnSelected} style={btnStyle()}>
                  テスト予約を追加（選択日 13:00）
                </button>
                <div style={{ fontSize: 11, opacity: 0.75 }}>横スクロールのみ</div>
              </div>
            </div>

            {/* 下：月カレンダー（小さめで全週） */}
            <div
              style={{
                borderRadius: 18,
                padding: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 10 }}>月カレンダー</div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 8,
                  marginBottom: 8,
                  opacity: 0.8,
                }}
              >
                {["月", "火", "水", "木", "金", "土", "日"].map((w) => (
                  <div key={w} style={{ textAlign: "center", fontWeight: 800, fontSize: 12 }}>
                    {w}
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8, flex: 1, minHeight: 0 }}>
                {days.map((date) => {
                  const dd = date.slice(-2);
                  const sum = daySummary.get(date) ?? { count: 0, sales: 0 };
                  const isSelected = date === selectedDate;

                  const dayRes = reservations
                    .filter((r) => r.date === date)
                    .slice()
                    .sort((a, b) => a.start.localeCompare(b.start));
                  const first = dayRes[0];

                  return (
                    <div
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      style={{
                        outline: isSelected ? "2px solid rgba(59,130,246,0.9)" : "none",
                        outlineOffset: 2,
                        borderRadius: 14,
                        cursor: "pointer",
                      }}
                    >
                      <DroppableBox
                        id={date}
                        style={{
                          borderRadius: 14,
                          padding: 10,
                          height: "100%",
                          minHeight: 86,
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ fontSize: 16, fontWeight: 900 }}>{Number(dd)}</div>
                          <div style={{ marginLeft: "auto", fontSize: 11, opacity: 0.75, fontWeight: 800 }}>
                            {sum.count}件 / {yen(sum.sales)}
                          </div>
                        </div>

                        <div style={{ marginTop: "auto" }}>
                          {first ? (
                            <DraggableCard id={first.id}>
                              <div
                                style={{
                                  background: colorToBg(menuById(first.menuId).color),
                                  borderRadius: 12,
                                  padding: "6px 8px",
                                  fontSize: 11,
                                  fontWeight: 900,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {first.start}-{first.end} / {yen(menuById(first.menuId).price)}
                              </div>
                            </DraggableCard>
                          ) : (
                            <div style={{ fontSize: 11, opacity: 0.55 }}>0件 / 稼働0%</div>
                          )}

                          {dayRes.length > 1 && (
                            <div style={{ marginTop: 4, fontSize: 11, opacity: 0.65, fontWeight: 900 }}>
                              +{dayRes.length - 1}件
                            </div>
                          )}
                        </div>
                      </DroppableBox>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 右：予約入力（縦長） */}
          <div
            style={{
              borderRadius: 18,
              padding: 14,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>予約入力</div>
            <div style={{ opacity: 0.85, marginBottom: 10 }}>
              選択日：<b>{selectedDate}</b>
            </div>
            <Link href="/reception" style={{ color: "white", textDecoration: "underline" }}>
              → 受付（入力）へ
            </Link>

            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75, lineHeight: 1.55 }}>
              ・左上：タイムライン（横だけスクロール）<br />
              ・左下：カレンダー（全週1画面）<br />
              ・右：入力（ここに済/売上も置く）
            </div>
          </div>
        </div>
      </DndContext>
    </div>
  );
}