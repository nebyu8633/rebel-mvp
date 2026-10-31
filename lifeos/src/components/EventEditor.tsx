"use client";
import { useState } from "react";
import { CalendarEvent } from "@/lib/types";
import { useStore } from "@/lib/store/store";
import { nowIso, uid } from "@/lib/actions";
import { Button, Field, Input, Modal, Select, Textarea, Toggle, confirmDialog } from "./ui";
import { RecurrenceEditor, defaultRule } from "./RecurrenceEditor";

export function blankEvent(date: string): CalendarEvent {
  const n = nowIso();
  return { id: uid(), title: "", date, startTime: null, endTime: null, location: "", notes: "", recurrence: null, reminderMinutes: null, createdAt: n, updatedAt: n };
}

export function EventEditor({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const put = useStore((s) => s.put);
  const remove = useStore((s) => s.remove);
  const exists = useStore((s) => !!s.db.events[event.id]);
  const [f, setF] = useState<CalendarEvent>(event);
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<CalendarEvent>) => setF((x) => ({ ...x, ...p }));

  async function save() {
    const r = CalendarEvent.safeParse({ ...f, title: f.title.trim(), date: f.recurrence?.startDate ?? f.date });
    if (!r.success) return setErr(r.error.issues[0]?.message ?? "שגיאה");
    if (r.data.startTime && r.data.endTime && r.data.endTime <= r.data.startTime) return setErr("שעת הסיום חייבת להיות אחרי שעת ההתחלה");
    if (await put("events", { ...r.data, updatedAt: nowIso() })) onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={exists ? "עריכת אירוע" : "אירוע חדש"}
      footer={
        <>
          {exists && (
            <Button
              variant="ghost"
              className="me-auto text-rose-600"
              onClick={async () => {
                if (await confirmDialog({ title: "למחוק את האירוע?", message: f.recurrence ? "כל המופעים של האירוע יימחקו." : undefined, danger: true, confirmLabel: "מחיקה" })) {
                  if (await remove("events", f.id)) onClose();
                }
              }}
            >
              מחיקה
            </Button>
          )}
          <Button onClick={onClose}>ביטול</Button>
          <Button variant="primary" onClick={save}>
            שמירה
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="שם האירוע" error={err}>
          <Input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="למשל: פגישה, שיעור נהיגה" />
        </Field>
        {!f.recurrence && (
          <Field label="תאריך">
            <Input type="date" value={f.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="התחלה">
            <Input type="time" value={f.startTime ?? ""} onChange={(e) => set({ startTime: e.target.value || null })} />
          </Field>
          <Field label="סיום">
            <Input type="time" value={f.endTime ?? ""} onChange={(e) => set({ endTime: e.target.value || null })} />
          </Field>
        </div>
        <Field label="תזכורת" hint={!f.startTime ? "דורש שעת התחלה" : undefined}>
          <Select disabled={!f.startTime} value={f.reminderMinutes ?? ""} onChange={(e) => set({ reminderMinutes: e.target.value === "" ? null : Number(e.target.value) })}>
            <option value="">ללא</option>
            <option value="0">בזמן ההתחלה</option>
            <option value="15">15 דק׳ לפני</option>
            <option value="30">30 דק׳ לפני</option>
            <option value="60">שעה לפני</option>
          </Select>
        </Field>
        <Toggle checked={!!f.recurrence} onChange={(v) => set({ recurrence: v ? defaultRule(f.date) : null })} label="אירוע חוזר" />
        {f.recurrence && <RecurrenceEditor value={f.recurrence} onChange={(r) => set({ recurrence: r })} />}
        <Field label="מיקום">
          <Input value={f.location} onChange={(e) => set({ location: e.target.value })} />
        </Field>
        <Field label="הערות">
          <Textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
