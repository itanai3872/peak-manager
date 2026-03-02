// app/lib/reservations.ts

export type Menu = {
  id: string;
  label: string;
  durationMin: number;
  priceYen: number;
};

export const MENUS: Menu[] = [
  { id: "intl_first_120", label: "インターナショナル初回(120分)", durationMin: 120, priceYen: 18000 },
  { id: "regular_60", label: "レギュラー(60分)", durationMin: 60, priceYen: 12000 },

  { id: "new_120", label: "新規(120分)", durationMin: 120, priceYen: 9000 },
  { id: "standard_45", label: "通常(45分)", durationMin: 45, priceYen: 6800 },
  { id: "maint_30", label: "メンテ(30分)", durationMin: 30, priceYen: 5500 },
  { id: "stu_new_60", label: "学生新規(60分)", durationMin: 60, priceYen: 6600 },
  { id: "stu_maint_30", label: "学生メンテ(30分)", durationMin: 30, priceYen: 4400 },
  { id: "biz_15", label: "業務枠(15分)", durationMin: 15, priceYen: 0 },
];

export type Reservation = {
  id: string;
  date: string;     // YYYY-MM-DD
  startMin: number; // 00:00からの分
  menuId: string;
  name: string;
  memo: string;
  createdAt: number;
  updatedAt: number;
};

export const LS_KEY = "enmeidou_reservations_v3";

// 営業時間（共通）
export const OPEN_MIN = 8 * 60;   // 08:00
export const CLOSE_MIN = 22 * 60; // 22:00
export const SLOT_MIN = 15;       // 15分刻み

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function minToHHMM(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

export function yen(n: number) {
  return new Intl.NumberFormat("ja-JP").format(n);
}

export function uid() {
  return `r_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/** menuId が壊れているデータが混ざった時に“静かにおかしくなる”のを防ぐ */
export function isValidMenuId(id: string) {
  return MENUS.some((m) => m.id === id);
}

export function menuById(id: string) {
  return MENUS.find((m) => m.id === id) ?? MENUS[0];
}

export function durationOf(menuId: string) {
  // menuId 不正なら MENUS[0] の duration を返す（※ここは仕様として固定）
  return menuById(menuId).durationMin;
}

export function priceOf(menuId: string) {
  return menuById(menuId).priceYen;
}

export function endMinOf(r: Pick<Reservation, "startMin" | "menuId">) {
  return r.startMin + durationOf(r.menuId);
}

/** 15分刻みに丸める（最寄り） */
export function snapToSlot(min: number) {
  return Math.round(min / SLOT_MIN) * SLOT_MIN;
}

/** 営業時間内に収める（startを動かす） */
export function clampStartToBusinessHours(startMin: number, menuId: string) {
  const dur = durationOf(menuId);

  // まず刻みに揃える
  let s = snapToSlot(startMin);

  // 営業開始前なら開始へ
  if (s < OPEN_MIN) s = OPEN_MIN;

  // 終了が閉店を超えるなら、開始を前へずらす（それでも無理なら OPEN に寄せる）
  const latestStart = CLOSE_MIN - dur;
  if (s > latestStart) s = Math.max(OPEN_MIN, snapToSlot(latestStart));

  return s;
}

/** 予約として成立するか（営業時間＋刻み＋日付） */
export function isValidReservationShape(r: Pick<Reservation, "date" | "startMin" | "menuId">) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return false;
  if (!isValidMenuId(r.menuId)) return false;

  const s = r.startMin;
  const e = s + durationOf(r.menuId);
  if (s % SLOT_MIN !== 0) return false;
  if (s < OPEN_MIN) return false;
  if (e > CLOSE_MIN) return false;

  return true;
}

export function safeParseReservations(raw: string | null): Reservation[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((x) => x && typeof x === "object")
      .map((x) => {
        const menuId = String((x as any).menuId ?? (MENUS[0]?.id ?? "regular_60"));
        const fixedMenuId = isValidMenuId(menuId) ? menuId : (MENUS[0]?.id ?? "regular_60");

        const date = String((x as any).date ?? "");
        const rawStart = Number((x as any).startMin ?? OPEN_MIN);
        const startMin = clampStartToBusinessHours(rawStart, fixedMenuId);

        const now = Date.now();
        const createdAt = Number((x as any).createdAt ?? now);
        const updatedAt = Number((x as any).updatedAt ?? now);

        return {
          id: String((x as any).id ?? uid()),
          date,
          startMin,
          menuId: fixedMenuId,
          name: String((x as any).name ?? ""),
          memo: String((x as any).memo ?? ""),
          createdAt,
          updatedAt,
        };
      })
      .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date));
  } catch {
    return [];
  }
}

export function loadAll(): Reservation[] {
  if (typeof window === "undefined") return [];
  return safeParseReservations(localStorage.getItem(LS_KEY));
}

export function saveAll(list: Reservation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  // [start, end) で判定
  return aStart < bEnd && bStart < aEnd;
}

export function hasConflict(
  all: Reservation[],
  draft: { id?: string | null; date: string; startMin: number; menuId: string }
) {
  // draft の入力が営業時間外/刻みズレでも、まず補正して判定できるようにする
  const menuId = isValidMenuId(draft.menuId) ? draft.menuId : (MENUS[0]?.id ?? "regular_60");
  const startMin = clampStartToBusinessHours(draft.startMin, menuId);

  const dEnd = startMin + durationOf(menuId);

  return all.some((r) => {
    if (r.date !== draft.date) return false;
    if (draft.id && r.id === draft.id) return false;
    const rEnd = endMinOf(r);
    return overlaps(startMin, dEnd, r.startMin, rEnd);
  });
}

export function upsert(all: Reservation[], r: Reservation) {
  const i = all.findIndex((x) => x.id === r.id);
  if (i >= 0) {
    const copy = [...all];
    copy[i] = r;
    return copy;
  }
  return [...all, r];
}

export function removeById(all: Reservation[], id: string) {
  return all.filter((r) => r.id !== id);
}

export function sumSales(list: Reservation[]) {
  return list.reduce((sum, r) => sum + priceOf(r.menuId), 0);
}

/** 稼働(分)の合計：0円業務枠も含めた“時間”が欲しい時用 */
export function sumWorkMinutes(list: Reservation[]) {
  return list.reduce((sum, r) => sum + durationOf(r.menuId), 0);
}