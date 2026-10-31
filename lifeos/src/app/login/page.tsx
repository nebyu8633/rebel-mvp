"use client";
import { useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { supabaseEnabled } from "@/lib/supabase/config";
import { Button, Card, Field, Input, Segmented } from "@/components/ui";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  if (!supabaseEnabled)
    return (
      <div className="mx-auto mt-24 max-w-sm px-4 text-center">
        <h1 className="mb-2 text-xl font-bold">אין צורך בהתחברות</h1>
        <p className="mb-4 text-sm text-stone-500">האפליקציה רצה במצב מקומי (ללא Supabase). הנתונים נשמרים בדפדפן הזה.</p>
        <Link href="/" className="text-accent-700">
          להיום שלי
        </Link>
      </div>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setMsg({ kind: "error", text: "כתובת אימייל לא תקינה" });
    if (password.length < 8) return setMsg({ kind: "error", text: "סיסמה של 8 תווים לפחות" });
    const sb = getBrowserSupabase()!;
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return setMsg({ kind: "error", text: error.message === "Invalid login credentials" ? "אימייל או סיסמה שגויים" : error.message });
        window.location.href = "/";
      } else {
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
        if (error) return setMsg({ kind: "error", text: error.message });
        if (data.session) window.location.href = "/";
        else setMsg({ kind: "info", text: "נשלח אימייל לאימות. אחרי האימות אפשר להתחבר." });
      }
    } catch {
      setMsg({ kind: "error", text: "אין חיבור לשרת ההתחברות" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-sm px-4">
      <h1 className="mb-6 text-center text-3xl font-bold">
        Life<span className="text-accent-600">OS</span>
      </h1>
      <Card>
        <Segmented
          className="mb-4 w-full"
          value={mode}
          onChange={setMode}
          options={[
            { value: "signin", label: "התחברות" },
            { value: "signup", label: "הרשמה" },
          ]}
        />
        <form onSubmit={submit} className="space-y-3">
          <Field label="אימייל">
            <Input type="email" autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="סיסמה">
            <Input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {msg && (
            <p role="alert" className={msg.kind === "error" ? "text-sm text-rose-600" : "text-sm text-accent-700"}>
              {msg.text}
            </p>
          )}
          <Button type="submit" variant="primary" className="w-full" disabled={busy}>
            {mode === "signin" ? "כניסה" : "יצירת חשבון"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
