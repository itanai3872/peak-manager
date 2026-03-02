"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";

const KARUTE_KEY = "enmeidou_karute_v1";
const GREEN = "rgba(34,197,94,0.9)";
const BORDER = "rgba(255,255,255,0.10)";

function uid() { return `${Date.now()}_${Math.random().toString(16).slice(2)}`; }
function pad2(n: number) { return String(n).padStart(2, "0"); }

type LR = "left" | "right" | "both" | "none";
type SymptomEntry = { checked: boolean; lr?: LR; memo?: string; };

type KaruteClient = {
  id: string;
  kanji: string;
  kana: string;
  gender: "male" | "female" | "none";
  birthdate: string;
  age?: number;
  address: string;
  tel: string;
  email: string;
  job: string;
  jobDetail: string;
  referrer: string;
  height: string;
  weight: string;
  dominantHand: "right" | "left";
  surgeryHistory: string;
  medications: string;
  allergies: string;
  sleep: string;
  sleepQuality: string;
  exercise: string;
  diet: string;
  alcohol: string;
  smoking: string;
  hobbies: string;
  visitReason: string;
  otherClinicExp: string;
  expectation: string;
  chiefComplaint: string;
  symptoms: Record<string, SymptomEntry>;
  symptomFreeText: string;
  sessionNotes: { date: string; note: string; id: string }[];
  createdAt: number;
  updatedAt: number;
};

const SYMPTOM_GROUPS = [
  {
    label: "頭部・顔面",
    items: [
      { key: "headache", label: "頭痛", lr: false },
      { key: "sinusitis", label: "副鼻腔炎", lr: false },
      { key: "tmj", label: "顎関節症", lr: false },
      { key: "eye_fatigue", label: "目の疲れ", lr: false },
      { key: "glaucoma", label: "緑内障", lr: false },
      { key: "cataract", label: "白内障", lr: false },
      { key: "vertigo", label: "めまい・耳鳴り", lr: false },
    ]
  },
  {
    label: "頸部・肩・上肢",
    items: [
      { key: "neck_pain", label: "首の痛み", lr: false },
      { key: "cervical_hernia", label: "頸椎ヘルニア", lr: false },
      { key: "thoracic_outlet", label: "胸郭出口症候群", lr: false },
      { key: "frozen_shoulder", label: "五十肩", lr: true },
      { key: "shoulder_stiff", label: "肩こり", lr: true },
      { key: "tennis_elbow", label: "テニス肘", lr: true },
      { key: "golf_elbow", label: "ゴルフ肘", lr: true },
      { key: "baseball_elbow", label: "野球肘", lr: true },
      { key: "tenosynovitis", label: "腱鞘炎", lr: true },
      { key: "trigger_finger", label: "バネ指", lr: true },
    ]
  },
  {
    label: "背中・体幹",
    items: [
      { key: "back_tension", label: "背中の張り", lr: true },
      { key: "breathing_difficulty", label: "呼吸不全・息苦しさ", lr: false },
      { key: "palpitation", label: "動悸・息切れ", lr: false },
    ]
  },
  {
    label: "腹部・内臓",
    items: [
      { key: "constipation", label: "便秘", lr: false },
      { key: "bloating", label: "膨満感", lr: false },
      { key: "gastroptosis", label: "胃下垂", lr: false },
      { key: "visceral_discomfort", label: "内臓の違和感", lr: false },
      { key: "liver_cirrhosis", label: "肝硬変", lr: false },
    ]
  },
  {
    label: "腰・骨盤・下肢",
    items: [
      { key: "pregnancy_lumbago", label: "妊婦腰痛", lr: false },
      { key: "postpartum_lumbago", label: "産後腰痛", lr: false },
      { key: "pms", label: "PMS", lr: false },
      { key: "menstrual_pain", label: "生理痛", lr: false },
      { key: "pelvic_pain", label: "骨盤痛", lr: false },
      { key: "hip_pain", label: "股関節痛", lr: true },
      { key: "chronic_lumbago", label: "慢性腰痛", lr: true, memo: true },
      { key: "sciatica", label: "坐骨神経痛", lr: true },
      { key: "spinal_stenosis", label: "脊柱管狭窄症", lr: false },
      { key: "spondylolisthesis", label: "すべり症", lr: false },
      { key: "knee_pain", label: "膝痛", lr: true },
      { key: "plantar_fasciitis", label: "足底筋膜炎", lr: true },
      { key: "hallux_valgus", label: "外反母趾", lr: true },
      { key: "heel_pain", label: "踵の痛み", lr: true },
      { key: "coldness", label: "冷え性", lr: true },
      { key: "edema", label: "むくみ", lr: true },
    ]
  },
  {
    label: "全身・自律神経",
    items: [
      { key: "autonomic_disorder", label: "自律神経失調症", lr: false },
      { key: "insomnia", label: "不眠", lr: false },
      { key: "fatigue", label: "倦怠感・無気力", lr: false },
      { key: "hypertension", label: "高血圧・低血圧", lr: false },
      { key: "diabetes1", label: "糖尿病Ⅰ型", lr: false },
      { key: "diabetes2", label: "糖尿病Ⅱ型", lr: false },
      { key: "interstitial_pneumonia", label: "間質性肺炎", lr: false },
      { key: "sjogren", label: "シェーグレン症候群", lr: false },
      { key: "rheumatism", label: "リウマチ", lr: false },
      { key: "atopy", label: "アトピー", lr: false },
      { key: "hay_fever", label: "花粉症", lr: false },
      { key: "cancer", label: "癌", lr: false, memo: true },
    ]
  },
];

const BODY_REGIONS: Record<string, { front?: string[]; back?: string[] }> = {
  headache:           { front: ["head_front"], back: ["head_back"] },
  sinusitis:          { front: ["face"] },
  tmj:                { front: ["jaw"] },
  eye_fatigue:        { front: ["eyes"] },
  glaucoma:           { front: ["eyes"] },
  cataract:           { front: ["eyes"] },
  vertigo:            { front: ["ear_left", "ear_right"] },
  neck_pain:          { front: ["neck_front"], back: ["neck_back"] },
  cervical_hernia:    { back: ["neck_back", "upper_back"] },
  thoracic_outlet:    { front: ["shoulder_left", "shoulder_right"] },
  frozen_shoulder:    { front: ["shoulder_left", "shoulder_right"], back: ["shoulder_back_left", "shoulder_back_right"] },
  shoulder_stiff:     { back: ["shoulder_back_left", "shoulder_back_right"] },
  tennis_elbow:       { front: ["elbow_left", "elbow_right"] },
  golf_elbow:         { front: ["elbow_left", "elbow_right"] },
  baseball_elbow:     { front: ["elbow_left", "elbow_right"] },
  tenosynovitis:      { front: ["wrist_left", "wrist_right"] },
  trigger_finger:     { front: ["hand_left", "hand_right"] },
  back_tension:       { back: ["mid_back", "lower_back"] },
  breathing_difficulty: { front: ["chest"] },
  palpitation:        { front: ["chest"] },
  constipation:       { front: ["abdomen"] },
  bloating:           { front: ["abdomen"] },
  gastroptosis:       { front: ["abdomen"] },
  visceral_discomfort:{ front: ["abdomen"] },
  liver_cirrhosis:    { front: ["abdomen_right"] },
  pregnancy_lumbago:  { back: ["lower_back"] },
  postpartum_lumbago: { back: ["lower_back"] },
  pms:                { front: ["lower_abdomen"] },
  menstrual_pain:     { front: ["lower_abdomen"] },
  pelvic_pain:        { front: ["lower_abdomen"], back: ["pelvis_back"] },
  hip_pain:           { front: ["hip_left", "hip_right"], back: ["hip_back_left", "hip_back_right"] },
  chronic_lumbago:    { back: ["lower_back"] },
  sciatica:           { back: ["lower_back", "thigh_back_left", "thigh_back_right"] },
  spinal_stenosis:    { back: ["lower_back"] },
  spondylolisthesis:  { back: ["lower_back"] },
  knee_pain:          { front: ["knee_left", "knee_right"], back: ["knee_back_left", "knee_back_right"] },
  plantar_fasciitis:  { front: ["foot_left", "foot_right"] },
  hallux_valgus:      { front: ["foot_left", "foot_right"] },
  heel_pain:          { back: ["heel_left", "heel_right"] },
  coldness:           { front: ["hand_left", "hand_right", "foot_left", "foot_right"] },
  edema:              { front: ["leg_left", "leg_right"] },
  autonomic_disorder: { front: ["chest", "abdomen"] },
};

function BodySVG({ side, glowRegions }: { side: "front" | "back"; glowRegions: Set<string> }) {
  const glow = (regions: string[]) => regions.some(r => glowRegions.has(r));
  const glowStyle = (regions: string[]): React.CSSProperties => ({
    fill: glow(regions) ? "rgba(239,68,68,0.7)" : "none",
    filter: glow(regions) ? "blur(8px)" : "none",
    opacity: glow(regions) ? 0.8 : 0,
    transition: "all 0.3s ease",
  });

  if (side === "front") {
    return (
      <svg viewBox="0 0 120 300" style={{ width: "100%", height: "100%" }}>
        <ellipse cx="60" cy="22" rx="18" ry="18" style={glowStyle(["head_front"])} />
        <ellipse cx="60" cy="18" rx="12" ry="8" style={glowStyle(["face"])} />
        <ellipse cx="51" cy="16" rx="5" ry="3" style={glowStyle(["eyes"])} />
        <ellipse cx="69" cy="16" rx="5" ry="3" style={glowStyle(["eyes"])} />
        <ellipse cx="51" cy="20" rx="4" ry="3" style={glowStyle(["jaw"])} />
        <ellipse cx="69" cy="20" rx="4" ry="3" style={glowStyle(["jaw"])} />
        <ellipse cx="60" cy="30" rx="10" ry="5" style={glowStyle(["neck_front"])} />
        <ellipse cx="60" cy="50" rx="22" ry="20" style={glowStyle(["chest"])} />
        <ellipse cx="32" cy="50" rx="12" ry="8" style={glowStyle(["shoulder_left"])} />
        <ellipse cx="88" cy="50" rx="12" ry="8" style={glowStyle(["shoulder_right"])} />
        <ellipse cx="22" cy="75" rx="8" ry="10" style={glowStyle(["elbow_left"])} />
        <ellipse cx="98" cy="75" rx="8" ry="10" style={glowStyle(["elbow_right"])} />
        <ellipse cx="18" cy="100" rx="6" ry="7" style={glowStyle(["wrist_left"])} />
        <ellipse cx="102" cy="100" rx="6" ry="7" style={glowStyle(["wrist_right"])} />
        <ellipse cx="15" cy="115" rx="8" ry="8" style={glowStyle(["hand_left"])} />
        <ellipse cx="105" cy="115" rx="8" ry="8" style={glowStyle(["hand_right"])} />
        <ellipse cx="55" cy="75" rx="18" ry="18" style={glowStyle(["abdomen"])} />
        <ellipse cx="65" cy="70" rx="10" ry="10" style={glowStyle(["abdomen_right"])} />
        <ellipse cx="60" cy="95" rx="15" ry="12" style={glowStyle(["lower_abdomen"])} />
        <ellipse cx="45" cy="115" rx="10" ry="10" style={glowStyle(["hip_left"])} />
        <ellipse cx="75" cy="115" rx="10" ry="10" style={glowStyle(["hip_right"])} />
        <ellipse cx="44" cy="160" rx="12" ry="18" style={glowStyle(["thigh_front_left"])} />
        <ellipse cx="76" cy="160" rx="12" ry="18" style={glowStyle(["thigh_front_right"])} />
        <ellipse cx="44" cy="205" rx="10" ry="12" style={glowStyle(["knee_left"])} />
        <ellipse cx="76" cy="205" rx="10" ry="12" style={glowStyle(["knee_right"])} />
        <ellipse cx="42" cy="240" rx="9" ry="16" style={glowStyle(["leg_left"])} />
        <ellipse cx="78" cy="240" rx="9" ry="16" style={glowStyle(["leg_right"])} />
        <ellipse cx="40" cy="270" rx="10" ry="8" style={glowStyle(["foot_left"])} />
        <ellipse cx="80" cy="270" rx="10" ry="8" style={glowStyle(["foot_right"])} />
        {/* 輪郭線 */}
        <ellipse cx="60" cy="22" rx="18" ry="18" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
        <line x1="52" y1="38" x2="48" y2="48" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <line x1="68" y1="38" x2="72" y2="48" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <path d="M38 48 Q25 52 20 70 L18 110 Q28 118 40 118 L48 118 L48 105 Q38 100 38 95 L38 55 Z" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <path d="M82 48 Q95 52 100 70 L102 110 Q92 118 80 118 L72 118 L72 105 Q82 100 82 95 L82 55 Z" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <path d="M38 55 Q60 60 82 55 L82 95 Q60 105 38 95 Z" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <path d="M38 48 L25 60 L18 80 L15 100 L12 115 L20 120 L22 100 L27 80 L38 60 Z" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <path d="M82 48 L95 60 L102 80 L105 100 L108 115 L100 120 L98 100 L93 80 L82 60 Z" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <path d="M38 95 Q30 110 35 125 L45 130 L60 128 L75 130 L85 125 Q90 110 82 95" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <path d="M38 125 L35 155 L33 180 L34 205 L36 220 L42 280 L50 280 L52 220 L52 205 L50 180 L48 155 L48 125 Z" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <path d="M82 125 L85 155 L87 180 L86 205 L84 220 L78 280 L70 280 L68 220 L68 205 L70 180 L72 155 L72 125 Z" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <ellipse cx="53" cy="18" rx="3" ry="2" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
        <ellipse cx="67" cy="18" rx="3" ry="2" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
        <path d="M55 26 Q60 30 65 26" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 300" style={{ width: "100%", height: "100%" }}>
      <ellipse cx="60" cy="22" rx="18" ry="18" style={glowStyle(["head_back"])} />
      <ellipse cx="60" cy="30" rx="10" ry="5" style={glowStyle(["neck_back"])} />
      <ellipse cx="32" cy="50" rx="12" ry="8" style={glowStyle(["shoulder_back_left"])} />
      <ellipse cx="88" cy="50" rx="12" ry="8" style={glowStyle(["shoulder_back_right"])} />
      <ellipse cx="60" cy="55" rx="22" ry="15" style={glowStyle(["upper_back"])} />
      <ellipse cx="60" cy="75" rx="20" ry="15" style={glowStyle(["mid_back"])} />
      <ellipse cx="60" cy="95" rx="18" ry="14" style={glowStyle(["lower_back"])} />
      <ellipse cx="60" cy="112" rx="20" ry="12" style={glowStyle(["pelvis_back"])} />
      <ellipse cx="45" cy="115" rx="10" ry="10" style={glowStyle(["hip_back_left"])} />
      <ellipse cx="75" cy="115" rx="10" ry="10" style={glowStyle(["hip_back_right"])} />
      <ellipse cx="44" cy="160" rx="12" ry="18" style={glowStyle(["thigh_back_left"])} />
      <ellipse cx="76" cy="160" rx="12" ry="18" style={glowStyle(["thigh_back_right"])} />
      <ellipse cx="44" cy="205" rx="10" ry="12" style={glowStyle(["knee_back_left"])} />
      <ellipse cx="76" cy="205" rx="10" ry="12" style={glowStyle(["knee_back_right"])} />
      <ellipse cx="40" cy="268" rx="10" ry="8" style={glowStyle(["heel_left"])} />
      <ellipse cx="80" cy="268" rx="10" ry="8" style={glowStyle(["heel_right"])} />
      {/* 輪郭線 */}
      <ellipse cx="60" cy="22" rx="18" ry="18" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
      <line x1="52" y1="38" x2="48" y2="48" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <line x1="68" y1="38" x2="72" y2="48" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <path d="M38 48 Q25 52 20 70 L18 110 Q28 118 40 118 L48 118 L48 105 Q38 100 38 95 L38 55 Z" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <path d="M82 48 Q95 52 100 70 L102 110 Q92 118 80 118 L72 118 L72 105 Q82 100 82 95 L82 55 Z" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <path d="M38 55 Q60 60 82 55 L82 95 Q60 105 38 95 Z" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <path d="M38 48 L25 60 L18 80 L15 100 L12 115 L20 120 L22 100 L27 80 L38 60 Z" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <path d="M82 48 L95 60 L102 80 L105 100 L108 115 L100 120 L98 100 L93 80 L82 60 Z" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <path d="M38 95 Q30 110 35 125 L45 130 L60 128 L75 130 L85 125 Q90 110 82 95" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <path d="M38 125 L35 155 L33 180 L34 205 L36 220 L42 280 L50 280 L52 220 L52 205 L50 180 L48 155 L48 125 Z" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <path d="M82 125 L85 155 L87 180 L86 205 L84 220 L78 280 L70 280 L68 220 L68 205 L70 180 L72 155 L72 125 Z" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <line x1="60" y1="40" x2="60" y2="110" stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3,3" />
    </svg>
  );
}

function newClient(): KaruteClient {
  return {
    id: uid(), kanji: "", kana: "", gender: "none",
    birthdate: "", address: "", tel: "", email: "",
    job: "", jobDetail: "", referrer: "",
    height: "", weight: "", dominantHand: "right",
    surgeryHistory: "", medications: "", allergies: "",
    sleep: "", sleepQuality: "", exercise: "", diet: "",
    alcohol: "", smoking: "", hobbies: "",
    visitReason: "", otherClinicExp: "", expectation: "",
    chiefComplaint: "", symptoms: {}, symptomFreeText: "",
    sessionNotes: [],
    createdAt: Date.now(), updatedAt: Date.now(),
  };
}

function calcAge(birthdate: string): number | undefined {
  if (!birthdate) return undefined;
  const b = new Date(birthdate);
  const today = new Date();
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

function calcBMI(height: string, weight: string): string {
  const h = parseFloat(height);
  const w = parseFloat(weight);
  if (!h || !w) return "—";
  return (w / ((h/100) ** 2)).toFixed(1);
}

export default function KarutePage() {
  const [clients, setClients] = useState<KaruteClient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<KaruteClient | null>(null);
  const [activeTab, setActiveTab] = useState<"basic" | "symptoms" | "notes">("basic");
  const [newNote, setNewNote] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KARUTE_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) setClients(list);
      }
    } catch {}
  }, []);

  function saveClients(list: KaruteClient[]) {
    setClients(list);
    try { localStorage.setItem(KARUTE_KEY, JSON.stringify(list)); } catch {}
  }

  function saveEditing() {
    if (!editing) return;
    const updated = { ...editing, updatedAt: Date.now(), age: calcAge(editing.birthdate) };
    const exists = clients.find(c => c.id === updated.id);
    if (exists) {
      saveClients(clients.map(c => c.id === updated.id ? updated : c));
    } else {
      saveClients([...clients, updated]);
    }
    setSelectedId(updated.id);
    setEditing(null);
  }

  function deleteClient(id: string) {
    if (!confirm("このクライアントを削除しますか？")) return;
    const next = clients.filter(c => c.id !== id);
    saveClients(next);
    if (selectedId === id) { setSelectedId(null); setEditing(null); }
  }

  function addNote() {
    if (!editing || !newNote.trim()) return;
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${pad2(today.getMonth()+1)}-${pad2(today.getDate())}`;
    setEditing({ ...editing, sessionNotes: [{ date: dateStr, note: newNote.trim(), id: uid() }, ...editing.sessionNotes] });
    setNewNote("");
  }

  function toggleSymptom(key: string, side: "left" | "right" | "none") {
    if (!editing) return;
    const prev = editing.symptoms[key] || { checked: false, lr: "none" };
    let next: SymptomEntry;
    if (side === "none") {
      next = { ...prev, checked: !prev.checked, lr: "none" };
    } else {
      const currentLR = prev.lr || "none";
      let newLR: LR;
      if (currentLR === "none") newLR = side;
      else if (currentLR === side) newLR = "none";
      else if ((currentLR === "left" && side === "right") || (currentLR === "right" && side === "left")) newLR = "both";
      else if (currentLR === "both") newLR = side === "left" ? "right" : "left";
      else newLR = "none";
      next = { checked: newLR !== "none", lr: newLR };
    }
    setEditing({ ...editing, symptoms: { ...editing.symptoms, [key]: next } });
  }

  function updateSymptomMemo(key: string, memo: string) {
    if (!editing) return;
    const prev = editing.symptoms[key] || { checked: false };
    setEditing({ ...editing, symptoms: { ...editing.symptoms, [key]: { ...prev, memo } } });
  }

  const glowRegionsFront = useMemo(() => {
    if (!editing) return new Set<string>();
    const regions = new Set<string>();
    Object.entries(editing.symptoms).forEach(([key, val]) => {
      if (!val.checked) return;
      const bodyMap = BODY_REGIONS[key];
      if (!bodyMap?.front) return;
      bodyMap.front.forEach(r => {
        const lr = val.lr || "none";
        if (lr === "none" || lr === "both") { regions.add(r); return; }
        if (lr === "left" && r.endsWith("_left")) regions.add(r);
        if (lr === "right" && r.endsWith("_right")) regions.add(r);
        if (!r.endsWith("_left") && !r.endsWith("_right")) regions.add(r);
      });
    });
    return regions;
  }, [editing?.symptoms]);

  const glowRegionsBack = useMemo(() => {
    if (!editing) return new Set<string>();
    const regions = new Set<string>();
    Object.entries(editing.symptoms).forEach(([key, val]) => {
      if (!val.checked) return;
      const bodyMap = BODY_REGIONS[key];
      if (!bodyMap?.back) return;
      bodyMap.back.forEach(r => {
        const lr = val.lr || "none";
        if (lr === "none" || lr === "both") { regions.add(r); return; }
        if (lr === "left" && r.endsWith("_left")) regions.add(r);
        if (lr === "right" && r.endsWith("_right")) regions.add(r);
        if (!r.endsWith("_left") && !r.endsWith("_right")) regions.add(r);
      });
    });
    return regions;
  }, [editing?.symptoms]);

  const sortedClients = useMemo(() => {
    return [...clients]
      .filter(c => !search || c.kanji.includes(search) || c.kana.includes(search))
      .sort((a, b) => a.kana.localeCompare(b.kana, "ja"));
  }, [clients, search]);

  const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
    width: "100%", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.28)", color: "rgba(255,255,255,0.92)",
    padding: "9px 12px", outline: "none", fontSize: 14, ...extra,
  });

  const lbl = (): React.CSSProperties => ({
    display: "block", fontSize: 12, opacity: 0.6, marginBottom: 5, fontWeight: 700,
  });

  return (
    <div style={{ minHeight: "100vh", background: "#060910", color: "rgba(255,255,255,0.92)", fontFamily: "'Hiragino Sans','Yu Gothic UI',sans-serif", padding: "16px" }}>
      <style>{`* { box-sizing: border-box; } ::-webkit-scrollbar{height:6px;width:6px} ::-webkit-scrollbar-track{background:rgba(255,255,255,0.04);border-radius:3px} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:3px} input::placeholder,textarea::placeholder{color:rgba(255,255,255,0.35)}`}</style>

      <div style={{ maxWidth: 1600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ヘッダー */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN, boxShadow: `0 0 10px ${GREEN}` }} />
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 1 }}>PEAK MANAGER</div>
          <div style={{ opacity: 0.5, fontSize: 14 }}>/ クライアントカルテ</div>
          <a href="/reception" style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", textDecoration: "none", fontWeight: 700 }}>← 予約管理</a>
          <a href="/stats" style={{ fontSize: 13, padding: "5px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", textDecoration: "none", fontWeight: 700 }}>📊 経営指標</a>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, alignItems: "start" }}>

          {/* 左: クライアント一覧 */}
          <div style={{ borderRadius: 18, padding: 16, background: "linear-gradient(160deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 12px 32px rgba(0,0,0,0.35)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 900 }}>クライアント一覧</div>
              <button onClick={() => { setEditing(newClient()); setSelectedId(null); setActiveTab("basic"); }}
                style={{ height: 30, padding: "0 10px", borderRadius: 8, border: "1px solid rgba(88,166,255,0.4)", background: "rgba(88,166,255,0.15)", color: "#58a6ff", cursor: "pointer", fontWeight: 900, fontSize: 13 }}>＋新規</button>
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="氏名・カナで検索…"
              style={{ ...inp(), marginBottom: 10, fontSize: 13 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: "calc(100vh - 200px)", overflowY: "auto" }}>
              {sortedClients.length === 0 && <div style={{ fontSize: 13, opacity: 0.45, padding: "8px 0" }}>クライアントなし</div>}
              {sortedClients.map(c => (
                <div key={c.id} onClick={() => { setSelectedId(c.id); setEditing({ ...c }); setActiveTab("basic"); }}
                  style={{
                    padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                    background: selectedId === c.id ? "rgba(88,166,255,0.15)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${selectedId === c.id ? "rgba(88,166,255,0.4)" : BORDER}`,
                  }}>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>{c.kanji || "（未入力）"}</div>
                  <div style={{ fontSize: 12, opacity: 0.5 }}>{c.kana}{c.birthdate ? `　${calcAge(c.birthdate)}歳` : ""}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 右: カルテ詳細 */}
          {editing ? (
            <div style={{ borderRadius: 18, padding: 20, background: "linear-gradient(160deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 12px 32px rgba(0,0,0,0.35)" }}>

              {/* タブ */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {(["basic", "symptoms", "notes"] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} style={{
                    height: 36, padding: "0 16px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer",
                    border: `1px solid ${activeTab === tab ? "rgba(88,166,255,0.6)" : "rgba(255,255,255,0.12)"}`,
                    background: activeTab === tab ? "rgba(88,166,255,0.2)" : "rgba(255,255,255,0.04)",
                    color: activeTab === tab ? "#58a6ff" : "rgba(255,255,255,0.7)",
                  }}>
                    {tab === "basic" ? "👤 基本情報" : tab === "symptoms" ? "🫀 症状・人体図" : "📝 施術記録"}
                  </button>
                ))}
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button onClick={saveEditing} style={{ height: 36, padding: "0 20px", borderRadius: 10, border: "1px solid rgba(34,197,94,0.5)", background: "rgba(34,197,94,0.2)", color: "#22c55e", cursor: "pointer", fontWeight: 900, fontSize: 13 }}>💾 保存</button>
                  {selectedId && <button onClick={() => deleteClient(selectedId)} style={{ height: 36, padding: "0 14px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.1)", color: "#f87171", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>🗑</button>}
                </div>
              </div>

              {/* 基本情報タブ */}
              {activeTab === "basic" && (
                <div style={{ display: "grid", gap: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={lbl()}>氏名（漢字・アルファベット）<span style={{ color: "rgba(255,100,100,0.8)", marginLeft: 4 }}>※必須</span></label>
                      <input value={editing.kanji} onChange={e => setEditing({ ...editing, kanji: e.target.value })} placeholder="山田 太郎 / Taro Yamada" style={inp()} />
                    </div>
                    <div>
                      <label style={lbl()}>カナ（アカサタナ順用）</label>
                      <input value={editing.kana} onChange={e => setEditing({ ...editing, kana: e.target.value })} placeholder="ヤマダ タロウ" style={inp()} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={lbl()}>性別</label>
                      <div style={{ display: "flex", gap: 6 }}>
                        {([["male","男"],["female","女"],["none","—"]] as const).map(([g, label]) => (
                          <button key={g} onClick={() => setEditing({ ...editing, gender: g })} style={{
                            flex: 1, height: 38, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer",
                            border: editing.gender === g ? "2px solid rgba(88,166,255,0.7)" : "1px solid rgba(255,255,255,0.12)",
                            background: editing.gender === g ? "rgba(88,166,255,0.2)" : "rgba(0,0,0,0.2)",
                            color: "rgba(255,255,255,0.9)",
                          }}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={lbl()}>生年月日</label>
                      <input type="date" value={editing.birthdate} onChange={e => setEditing({ ...editing, birthdate: e.target.value })}
                        style={{ ...inp(), colorScheme: "dark" }} />
                    </div>
                    <div>
                      <label style={lbl()}>年齢（自動）</label>
                      <div style={{ ...inp(), opacity: 0.7 }}>{editing.birthdate ? `${calcAge(editing.birthdate)}歳` : "—"}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={lbl()}>電話番号</label>
                      <input value={editing.tel} onChange={e => setEditing({ ...editing, tel: e.target.value })} placeholder="090-0000-0000" style={inp()} />
                    </div>
                    <div>
                      <label style={lbl()}>メールアドレス</label>
                      <input value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} placeholder="example@mail.com" style={inp()} />
                    </div>
                    <div>
                      <label style={lbl()}>住所</label>
                      <input value={editing.address} onChange={e => setEditing({ ...editing, address: e.target.value })} placeholder="倉敷市…" style={inp()} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={lbl()}>職種</label>
                      <input value={editing.job} onChange={e => setEditing({ ...editing, job: e.target.value })} placeholder="例：デスクワーク・立ち仕事・主婦…" style={inp()} />
                    </div>
                    <div>
                      <label style={lbl()}>仕事内容（詳細）</label>
                      <input value={editing.jobDetail} onChange={e => setEditing({ ...editing, jobDetail: e.target.value })} placeholder="例：PC作業8時間/日、重量物運搬…" style={inp()} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={lbl()}>身長 (cm)</label>
                      <input type="number" value={editing.height} onChange={e => setEditing({ ...editing, height: e.target.value })} placeholder="165" style={inp()} />
                    </div>
                    <div>
                      <label style={lbl()}>体重 (kg)</label>
                      <input type="number" value={editing.weight} onChange={e => setEditing({ ...editing, weight: e.target.value })} placeholder="60" style={inp()} />
                    </div>
                    <div>
                      <label style={lbl()}>BMI（自動）</label>
                      <div style={{ ...inp(), opacity: 0.7 }}>{calcBMI(editing.height, editing.weight)}</div>
                    </div>
                    <div>
                      <label style={lbl()}>利き手</label>
                      <div style={{ display: "flex", gap: 6 }}>
                        {([["right","右"],["left","左"]] as const).map(([h, label]) => (
                          <button key={h} onClick={() => setEditing({ ...editing, dominantHand: h })} style={{
                            flex: 1, height: 38, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer",
                            border: editing.dominantHand === h ? "2px solid rgba(88,166,255,0.7)" : "1px solid rgba(255,255,255,0.12)",
                            background: editing.dominantHand === h ? "rgba(88,166,255,0.2)" : "rgba(0,0,0,0.2)",
                            color: "rgba(255,255,255,0.9)",
                          }}>{label}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={lbl()}>過去の手術・骨折歴</label>
                      <textarea value={editing.surgeryHistory} onChange={e => setEditing({ ...editing, surgeryHistory: e.target.value })} placeholder="例：2018年 虫垂炎手術…" style={{ ...inp(), minHeight: 70, resize: "vertical" }} />
                    </div>
                    <div>
                      <label style={lbl()}>常用薬・サプリメント</label>
                      <textarea value={editing.medications} onChange={e => setEditing({ ...editing, medications: e.target.value })} placeholder="例：降圧剤、マグネシウム…" style={{ ...inp(), minHeight: 70, resize: "vertical" }} />
                    </div>
                    <div>
                      <label style={lbl()}>アレルギー</label>
                      <textarea value={editing.allergies} onChange={e => setEditing({ ...editing, allergies: e.target.value })} placeholder="例：卵・花粉・金属…" style={{ ...inp(), minHeight: 70, resize: "vertical" }} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={lbl()}>睡眠時間・質</label>
                      <input value={editing.sleep} onChange={e => setEditing({ ...editing, sleep: e.target.value })} placeholder="例：6時間、途中で目が覚める" style={inp()} />
                    </div>
                    <div>
                      <label style={lbl()}>運動習慣</label>
                      <input value={editing.exercise} onChange={e => setEditing({ ...editing, exercise: e.target.value })} placeholder="例：週3回ウォーキング" style={inp()} />
                    </div>
                    <div>
                      <label style={lbl()}>食生活</label>
                      <input value={editing.diet} onChange={e => setEditing({ ...editing, diet: e.target.value })} placeholder="例：外食多め、朝食抜き" style={inp()} />
                    </div>
                    <div>
                      <label style={lbl()}>飲酒</label>
                      <input value={editing.alcohol} onChange={e => setEditing({ ...editing, alcohol: e.target.value })} placeholder="例：週2〜3回、ビール350ml" style={inp()} />
                    </div>
                    <div>
                      <label style={lbl()}>喫煙</label>
                      <input value={editing.smoking} onChange={e => setEditing({ ...editing, smoking: e.target.value })} placeholder="例：1日10本・禁煙5年" style={inp()} />
                    </div>
                    <div>
                      <label style={lbl()}>趣味・スポーツ</label>
                      <input value={editing.hobbies} onChange={e => setEditing({ ...editing, hobbies: e.target.value })} placeholder="例：ゴルフ・ガーデニング" style={inp()} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={lbl()}>来院のきっかけ</label>
                      <input value={editing.visitReason} onChange={e => setEditing({ ...editing, visitReason: e.target.value })} placeholder="例：Google検索・知人紹介…" style={inp()} />
                    </div>
                    <div>
                      <label style={lbl()}>紹介者名</label>
                      <input value={editing.referrer} onChange={e => setEditing({ ...editing, referrer: e.target.value })} placeholder="例：山田様ご紹介" style={inp()} />
                    </div>
                    <div>
                      <label style={lbl()}>他院経験</label>
                      <input value={editing.otherClinicExp} onChange={e => setEditing({ ...editing, otherClinicExp: e.target.value })} placeholder="例：整形外科3年・整体2院…" style={inp()} />
                    </div>
                  </div>
                  <div>
                    <label style={lbl()}>主訴・来院の経緯</label>
                    <textarea value={editing.chiefComplaint} onChange={e => setEditing({ ...editing, chiefComplaint: e.target.value })} placeholder="症状の詳細・経緯・他院での診断内容など…" style={{ ...inp(), minHeight: 80, resize: "vertical" }} />
                  </div>
                  <div>
                    <label style={lbl()}>当院への期待・希望</label>
                    <textarea value={editing.expectation} onChange={e => setEditing({ ...editing, expectation: e.target.value })} placeholder="改善したいこと・施術に期待すること…" style={{ ...inp(), minHeight: 60, resize: "vertical" }} />
                  </div>
                </div>
              )}

              {/* 症状・人体図タブ */}
              {activeTab === "symptoms" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: "calc(100vh - 200px)", overflowY: "auto", paddingRight: 8 }}>
                    {SYMPTOM_GROUPS.map(group => (
                      <div key={group.label}>
                        <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.6, marginBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 4 }}>{group.label}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {group.items.map(item => {
                            const s = editing.symptoms[item.key] || { checked: false, lr: "none" };
                            const lr = s.lr || "none";
                            return (
                              <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: s.checked ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${s.checked ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.06)"}` }}>
                                {item.lr ? (
                                  <>
                                    <span style={{ fontSize: 13, flex: 1 }}>{item.label}</span>
                                    {(["left","right"] as const).map(side => (
                                      <button key={side} onClick={() => toggleSymptom(item.key, side)}
                                        style={{
                                          height: 26, padding: "0 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
                                          border: `1px solid ${(lr === side || lr === "both") ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.15)"}`,
                                          background: (lr === side || lr === "both") ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.05)",
                                          color: (lr === side || lr === "both") ? "#f87171" : "rgba(255,255,255,0.5)",
                                        }}>{side === "left" ? "左" : "右"}</button>
                                    ))}
                                  </>
                                ) : (
                                  <>
                                    <button onClick={() => toggleSymptom(item.key, "none")}
                                      style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: "pointer",
                                        border: `1px solid ${s.checked ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.2)"}`,
                                        background: s.checked ? "rgba(239,68,68,0.3)" : "transparent",
                                        color: "#f87171", fontWeight: 900, fontSize: 12,
                                      }}>{s.checked ? "✓" : ""}</button>
                                    <span style={{ fontSize: 13, flex: 1 }}>{item.label}</span>
                                  </>
                                )}
                                {(item as any).memo && s.checked && (
                                  <input value={s.memo || ""} onChange={e => updateSymptomMemo(item.key, e.target.value)}
                                    placeholder="メモ" style={{ ...inp(), width: 140, fontSize: 12, padding: "4px 8px" }} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <div>
                      <label style={lbl()}>その他・自由入力</label>
                      <textarea value={editing.symptomFreeText} onChange={e => setEditing({ ...editing, symptomFreeText: e.target.value })}
                        placeholder="上記以外の症状や補足…" style={{ ...inp(), minHeight: 80, resize: "vertical" }} />
                    </div>
                  </div>

                  {/* 人体図 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, position: "sticky", top: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.7, textAlign: "center" }}>前面</div>
                    <div style={{ height: 300, background: "rgba(0,0,0,0.3)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", padding: 10 }}>
                      <BodySVG side="front" glowRegions={glowRegionsFront} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 900, opacity: 0.7, textAlign: "center" }}>背面</div>
                    <div style={{ height: 300, background: "rgba(0,0,0,0.3)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)", padding: 10 }}>
                      <BodySVG side="back" glowRegions={glowRegionsBack} />
                    </div>
                  </div>
                </div>
              )}

              {/* 施術記録タブ */}
              {activeTab === "notes" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={lbl()}>今日の施術メモを追加</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="施術内容・身体の状態・次回への申し送り…" style={{ ...inp(), flex: 1, minHeight: 80, resize: "vertical" }} />
                      <button onClick={addNote} style={{ height: 80, padding: "0 16px", borderRadius: 10, border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.15)", color: "#22c55e", cursor: "pointer", fontWeight: 900, fontSize: 13, whiteSpace: "nowrap" }}>追加</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "calc(100vh - 300px)", overflowY: "auto" }}>
                    {editing.sessionNotes.length === 0 && <div style={{ fontSize: 13, opacity: 0.45 }}>記録なし</div>}
                    {editing.sessionNotes.map(n => (
                      <div key={n.id} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER}` }}>
                        <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 6 }}>{n.date}</div>
                        <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{n.note}</div>
                        <button onClick={() => setEditing({ ...editing, sessionNotes: editing.sessionNotes.filter(x => x.id !== n.id) })}
                          style={{ marginTop: 8, fontSize: 11, padding: "2px 8px", borderRadius: 5, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "rgba(239,68,68,0.6)", cursor: "pointer" }}>削除</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ borderRadius: 18, padding: 40, background: "linear-gradient(160deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))", border: "1px solid rgba(255,255,255,0.09)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4, fontSize: 15 }}>
              ← クライアントを選択、または「＋新規」で作成
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
