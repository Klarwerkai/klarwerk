// WP-SHIP9-B3FIX (Pedis Live-Befund 23.07.): Frisch Eingereichtes darf auf der Validierungs-LISTE
// nicht sofort als aktiv/„in Validierung" erscheinen, solange die Hintergrund-KI-Prüfung (aiCheck)
// noch läuft. pending → Eintrag ausgegraut, Prüf-Aktionen gesperrt, ehrlicher Hinweis „läuft …";
// done/kein Prüf-Job → normal aktiv; failed → NICHT gesperrt (AiCheckBadge/F1 kennzeichnet es).
// Die Liste pollt, solange mindestens ein Eintrag pending ist, und stoppt danach.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import {
  VALIDATION_AI_LOCK_NOTE_KEY,
  VALIDATION_AI_LOCK_NOTE_KEY_AI,
  boardHasPendingAiCheck,
  validationAiGate,
} from "../../apps/web/src/lib/validationAiGate";

const PENDING = { status: "pending" as const, requestedAt: "2026-07-23T07:00:00.000Z" };
const DONE = { ...PENDING, status: "done" as const, finishedAt: "2026-07-23T07:02:00.000Z" };

// Minimales KO — nur das aiCheck-Feld ist für das Gate relevant.
const ko = (aiCheck?: KnowledgeObject["aiCheck"]): KnowledgeObject =>
  ({ id: "k", aiCheck }) as unknown as KnowledgeObject;

describe("WP-SHIP9-B3FIX: validationAiGate (pure) — pending sperrt, alles andere gibt frei", () => {
  it("pending → gesperrt (ausgegraut) mit ehrlichem Sperr-Hinweis-Key", () => {
    expect(validationAiGate(PENDING)).toEqual({
      locked: true,
      noteKey: VALIDATION_AI_LOCK_NOTE_KEY,
    });
  });

  // PAKET 1.4 (D-AISTATE, Pedi 23.07.): ehrlicher Name je Modellzustand — die Sperr-LOGIK bleibt gleich.
  it("pending OHNE Modell nutzt den no-KI-Text; pending MIT Modell den mit-KI-Text", () => {
    expect(validationAiGate(PENDING, false)).toEqual({
      locked: true,
      noteKey: VALIDATION_AI_LOCK_NOTE_KEY,
    });
    expect(validationAiGate(PENDING, true)).toEqual({
      locked: true,
      noteKey: VALIDATION_AI_LOCK_NOTE_KEY_AI,
    });
    // done bleibt ungesperrt, unabhängig vom Modellzustand.
    expect(validationAiGate(DONE, true)).toEqual({ locked: false });
  });

  it("done → NICHT gesperrt (Eintrag wird normal aktiv)", () => {
    expect(validationAiGate(DONE)).toEqual({ locked: false });
  });

  it("failed → NICHT gesperrt (bleibt sichtbar; AiCheckBadge/F1 kennzeichnet den Fehlschlag)", () => {
    for (const reason of ["no-model", "timeout", "model-error", undefined] as const) {
      const failed = {
        ...PENDING,
        status: "failed" as const,
        ...(reason !== undefined ? { fallbackReason: reason } : {}),
      };
      expect(validationAiGate(failed), String(reason)).toEqual({ locked: false });
    }
  });

  it("kein Prüf-Job (Altbestand/kein Worker) → NICHT gesperrt, kein Schein-Sperren", () => {
    expect(validationAiGate(undefined)).toEqual({ locked: false });
    expect(validationAiGate(null)).toEqual({ locked: false });
  });
});

describe("WP-SHIP9-B3FIX: boardHasPendingAiCheck (pure) — steuert das Listen-Polling", () => {
  it("mindestens ein Eintrag pending → true (weiter pollen)", () => {
    expect(boardHasPendingAiCheck([ko(DONE), ko(PENDING), ko(undefined)])).toBe(true);
  });

  it("kein Eintrag mehr pending → false (Polling stoppt)", () => {
    expect(boardHasPendingAiCheck([ko(DONE), ko(undefined)])).toBe(false);
  });

  it("Übergang pending → done: sobald der letzte pending-Eintrag fertig ist, endet das Polling", () => {
    expect(boardHasPendingAiCheck([ko(PENDING)])).toBe(true);
    expect(boardHasPendingAiCheck([ko(DONE)])).toBe(false);
  });

  it("leere/fehlende Liste → false (nichts zu pollen)", () => {
    expect(boardHasPendingAiCheck([])).toBe(false);
    expect(boardHasPendingAiCheck(undefined)).toBe(false);
    expect(boardHasPendingAiCheck(null)).toBe(false);
  });
});

describe("WP-SHIP9-B3FIX: Sperr-Hinweis löst in DE, EN und NL auf", () => {
  it("val.aiCheck.locked ist in allen drei Sprachen echter Text (kein roher Key)", async () => {
    for (const lng of ["de", "en", "nl"] as const) {
      await i18n.changeLanguage(lng);
      const text = i18n.t(VALIDATION_AI_LOCK_NOTE_KEY);
      expect(text, `${lng}:locked`).not.toContain(VALIDATION_AI_LOCK_NOTE_KEY);
      expect(text.length, `${lng}:locked`).toBeGreaterThan(5);
    }
    await i18n.changeLanguage("de");
  });

  it("DE-Wortlaut nennt ehrlich läuft und die gesperrten Aktionen", async () => {
    await i18n.changeLanguage("de");
    const text = i18n.t(VALIDATION_AI_LOCK_NOTE_KEY);
    expect(text).toContain("läuft");
    expect(text).toContain("gesperrt");
  });
});

describe("WP-SHIP9-B3FIX: die Validierungs-LISTE nutzt Gate + Polling (Source-Pins)", () => {
  const source = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Validation.tsx"), "utf8");

  it("graut pending-Einträge aus und sperrt die Prüf-Aktionen", () => {
    // PAKET 1.4: die Liste reicht den Modellzustand ein (ehrlicher Name), Sperr-Logik unverändert.
    expect(source).toContain("validationAiGate(k.aiCheck, aiModelActive)");
    // Ausgrauen der Karte + Sperrhinweis.
    expect(source).toContain('gate.locked ? "opacity-60"');
    expect(source).toContain("t(gate.noteKey)");
    // Freigeben/Rückfrage/Ablehnen sowie Zuweisen/„als wahr" sind im pending-Zustand gesperrt.
    expect(source).toContain("gate.locked ||");
    expect(source).toContain("disabled={gate.locked}");
    expect(source).toContain("gate.locked || assign.isPending");
  });

  it("pollt das Board, solange mind. ein Eintrag pending ist, und invalidiert bei done/failed", () => {
    expect(source).toContain("boardHasPendingAiCheck(query.data)");
    expect(source).toContain("AI_CHECK_POLL_MS");
    expect(source).toContain('invalidateQueries({ queryKey: ["validation", "board"] })');
  });
});
