"use client";
import { useMemo } from "react";
import { useStore } from "../store/store";
import { useNow } from "@/hooks/useToday";
import { ACHIEVEMENTS, attributes, levelInfo, mainQuestInstance, profileOf, quests, regionStates, seasonOf } from "./engine";
import { challengesFor } from "./challenges";

/** Everything the game screens show, derived from the real data in the store. */
export function useGame() {
  const db = useStore((s) => s.db);
  const now = useNow();
  const today = now.date;
  return useMemo(() => {
    const ledger = Object.values(db.xpEvents ?? {});
    const xp = ledger.reduce((s, e) => s + e.amount, 0);
    const profile = profileOf(db);
    const unlocked = new Set(ledger.filter((e) => e.kind === "achievement").map((e) => e.refId));
    const decorations = ACHIEVEMENTS.filter((a) => unlocked.has(a.id) && a.decoration).map((a) => a.decoration!);
    return {
      db,
      today,
      now,
      profile,
      ledger,
      xp,
      level: levelInfo(xp),
      regions: regionStates(ledger),
      attributes: attributes(ledger),
      achievements: ACHIEVEMENTS.map((a) => ({ ...a, event: ledger.find((e) => e.id === `ach:${a.id}`) ?? null })),
      decorations,
      season: seasonOf(profile, today),
      quests: quests(db),
      challenges: challengesFor(db, today),
      mainQuest: mainQuestInstance(db, today),
    };
  }, [db, today, now]);
}
export type GameState = ReturnType<typeof useGame>;
