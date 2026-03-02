"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Reservation = {
  id: string;
  date: string;
  start: string;
  end: string;
  name: string;
  menuId: string;
  memo: string;
};

const LS_KEY = "enmeidou_reservations"; // ✅ 統一

const MENU_PRICE: Record<string, number> = {
  intl_new_120: 18000,
  intl_r_60: 12000,
  dom_new_120: 9000,
  dom_r_45: 6800,
  dom_m_30: 6000,
  biz_15: 0,
};

const BUSINESS_OPEN = "08:00";
const BUSINESS_CLOSE = "20:00";
const MIN_GAP_MINUTES = 15;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function safeRead(): Reservation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad(h)}:${pad(m)}`;
}

type TimelineItem =
  | { kind: "gap"; start: string; end: string; minutes: number }
  | { kind: "res"; r: Reservation };

export default function TodayPage() {
  const sp = useSearchParams();
  const date = sp.get("date") || todayStr();
  const [reservations, setReservations] = useState<Reservation[]>([]);

  useEffect(() => {
    setReservations(safeRead());
  }, []);

  const dayReservations = useMemo(() => {
    return reservations
      .filter((r) => r.date === date)
      .slice()
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [reservations, date]);

  const totalSales = useMemo(() => {
    return dayReservations.reduce((sum, r) => sum + (MENU_PRICE[r.menuId] ?? 0), 0);
  }, [dayReservations]);

  const totalMinutes = useMemo(() => {
    return dayReservations.reduce((sum, r) => sum + (toMin(r.end) - toMin(r.start)), 0);
  }, [dayReservations]);

  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];
    const openMin = toMin(BUSINESS_OPEN);
    const closeMin = toMin(BUSINESS_CLOSE);

    const list = dayReservations
      .map((r) => ({ r, s: toMin(r.start), e: toMin(r.end) }))
      .filter((x) => x.e > x.s)
      .sort((a, b) => a.s - b.s);

    let cursor = openMin;

    for (const x of list) {
      const gap = x.s - cursor;
      if (gap >= MIN_GAP_MINUTES) {
        items.push({ kind: "gap", start: toHHMM(cursor), end: toHHMM(x.s), minutes: gap });
      }
      items.push({ kind: "res", r: x.r });
      cursor = Math.max(cursor, x.e);
    }

    const tail = closeMin - cursor;
    if (tail >= MIN_GAP_MINUTES) {
      items.push({ kind: "gap", start: toHHMM(cursor), end: toHHMM(closeMin), minutes: tail });
    }

    return items;
  }, [dayReservations]);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 12 }}>
        予約一覧（{date}）
      </h1>

      <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
        <Link href="/">← 月表示へ</Link>
        <Link href="/reception">＋ 予約入力へ</Link>
      </div>

      <div
        style={{
          marginBottom: 16,
          padding: 12,
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 10,
        }}
      >
        <div>件数：{dayReservations.length}件</div>
        <div>予約時間：{totalMinutes}分</div>
        <div style={{ fontWeight: "bold", fontSize: 18 }}>
          売上合計：{totalSales.toLocaleString()}円
        </div>
      </div>

      {timeline.length === 0 ? (
        <div>この日の予約はありません。</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {timeline.map((it, idx) => {
            if (it.kind === "gap") {
              return (
                <div
                  key={`gap-${idx}`}
                  style={{
                    border: "1px dashed rgba(255,255,255,0.25)",
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  空き：{it.start} 〜 {it.end}（{it.minutes}分）
                </div>
              );
            }

            const r = it.r;
            const price = MENU_PRICE[r.menuId] ?? 0;

            return (
              <div
                key={r.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: "bold" }}>
                  {r.start} 〜 {r.end}
                </div>
                <div>{r.name}</div>
                <div style={{ fontSize: 12 }}>メニュー: {r.menuId}</div>
                <div style={{ fontSize: 12 }}>金額: {price.toLocaleString()}円</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}