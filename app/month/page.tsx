"use client";

import React, { useMemo, useState } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

type Reservation = {
  id: string;
  date: string; // "YYYY-MM-DD"
  title: string;
};

type DraggableProps = {
  id: string;
  children: React.ReactNode;
};

function Draggable({ id, children }: DraggableProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    cursor: "grab",
    touchAction: "none",
    userSelect: "none",
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

type DroppableProps = {
  id: string;
  children: React.ReactNode;
};

function Droppable({ id, children }: DroppableProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        border: "1px solid rgba(255,255,255,0.2)",
        padding: 12,
        borderRadius: 12,
        minHeight: 100,
        background: isOver ? "rgba(255,255,255,0.1)" : "transparent",
      }}
    >
      {children}
    </div>
  );
}

export default function CalendarPage() {
  const [reservations, setReservations] = useState<Reservation[]>([
    { id: "1", date: "2026-02-28", title: "インターナショナル 新規" },
  ]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const newDate = String(over.id);

    setReservations((prev) =>
      prev.map((r) => (r.id === String(active.id) ? { ...r, date: newDate } : r))
    );
  }

  const days = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const dd = String(i + 1).padStart(2, "0");
        return `2026-02-${dd}`;
      }),
    []
  );

  return (
    <div
      style={{
        background: "#0b1220",
        minHeight: "100vh",
        padding: 40,
        color: "white",
      }}
    >
      <h1 style={{ marginBottom: 30 }}>ドラッグテスト</h1>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 12,
          }}
        >
          {days.map((date) => (
            <Droppable key={date} id={date}>
              <div style={{ fontSize: 14, marginBottom: 8 }}>
                {date.slice(-2)}
              </div>

              {reservations
                .filter((r) => r.date === date)
                .map((r) => (
                  <Draggable key={r.id} id={r.id}>
                    <div
                      style={{
                        background: "#3b82f6",
                        padding: "6px 10px",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    >
                      {r.title}
                    </div>
                  </Draggable>
                ))}
            </Droppable>
          ))}
        </div>
      </DndContext>
    </div>
  );
}