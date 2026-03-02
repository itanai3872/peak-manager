"use client";

import { loadAll, saveAll } from "../lib/reservations";

export default function MigratePage() {
  function migrate() {
    const data = loadAll();
    saveAll(data);
    alert("マイグレーション完了");
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>データ移行</h1>
      <button onClick={migrate}>実行</button>
    </div>
  );
}