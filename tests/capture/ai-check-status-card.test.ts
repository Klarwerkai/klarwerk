// WP-SHIP9-S1 (Pedis B3): Der Einreichen-Status auf /erfassen darf nicht lügen. Die Karte zeigt
// „Prüfung läuft …" NUR solange der ECHTE Job-Status offen ist (aiCheck pending); der Wechsel
// kommt ausschließlich vom tatsächlichen Ergebnis (done/failed), und ein Fehlschlag heißt ehrlich
// fehlgeschlagen mit Ursache (F1-Vertrag, dieselben Keys wie das AiCheckBadge der Validierung).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  AI_CHECK_CARD_TEXT,
  AI_CHECK_POLL_MS,
  aiCheckCardState,
  aiCheckPollAgain,
} from "../../apps/web/src/lib/aiCheckStatusCard";

const PENDING = { status: "pending" as const, requestedAt: "2026-07-23T07:00:00.000Z" };

describe("WP-SHIP9-S1 B3: aiCheckCardState (pure)", () => {
  it("Einreichen (pending) → Status „läuft“ — solange KEIN Ergebnis vorliegt", () => {
    expect(aiCheckCardState(PENDING)).toEqual({ kind: "running" });
    expect(aiCheckPollAgain(PENDING)).toBe(true);
  });

  it("Ergebnis-Event (done) → Status wechselt NUR durch das tatsächliche Ergebnis", () => {
    const done = { ...PENDING, status: "done" as const, finishedAt: "2026-07-23T07:02:00.000Z" };
    expect(aiCheckCardState(done)).toEqual({ kind: "done" });
    expect(aiCheckPollAgain(done)).toBe(false);
  });

  it("Fehlerfall → ehrliche Meldung mit Ursache (F1-Keys des AiCheckBadge)", () => {
    for (const [reason, key] of [
      ["no-model", "val.aiCheck.reason.no-model"],
      ["timeout", "val.aiCheck.reason.timeout"],
      ["model-timeout", "val.aiCheck.reason.model-timeout"],
      ["queue-overflow", "val.aiCheck.reason.queue-overflow"],
      ["model-error", "val.aiCheck.reason.model-error"],
      [undefined, "val.aiCheck.reason.model-error"], // unbekannt/fehlend → Sammel-Ursache
    ] as const) {
      const failed = {
        ...PENDING,
        status: "failed" as const,
        ...(reason !== undefined ? { fallbackReason: reason } : {}),
      };
      expect(aiCheckCardState(failed), String(reason)).toEqual({
        kind: "failed",
        reasonKey: key,
      });
      expect(aiCheckPollAgain(failed)).toBe(false);
    }
  });

  it("ohne Prüf-Vermerk (Altbestand/kein Worker) wird NICHTS behauptet — kein stilles Grün", () => {
    expect(aiCheckCardState(undefined)).toEqual({ kind: "none" });
    expect(aiCheckCardState(null)).toEqual({ kind: "none" });
    expect(aiCheckPollAgain(null)).toBe(false);
  });

  it("Poll-Intervall ist eine bewusste Konstante (sparsam, aber lebendig)", () => {
    expect(AI_CHECK_POLL_MS).toBe(3000);
  });
});

describe("WP-SHIP9-S1 B3: Karten-Texte lösen in DE, EN und NL auf", () => {
  it("running/done/failed sind in allen drei Sprachen echte Texte (keine rohen Keys)", async () => {
    for (const lng of ["de", "en", "nl"] as const) {
      await i18n.changeLanguage(lng);
      for (const key of Object.values(AI_CHECK_CARD_TEXT)) {
        expect(i18n.t(key, { reason: "X" }), `${lng}:${key}`).not.toContain(key);
        expect(i18n.t(key, { reason: "X" }).length, `${lng}:${key}`).toBeGreaterThan(5);
      }
      // Der Fehlertext trägt die interpolierte Ursache wirklich sichtbar.
      expect(i18n.t(AI_CHECK_CARD_TEXT.failed, { reason: "URSACHE." }), lng).toContain("URSACHE.");
    }
    await i18n.changeLanguage("de");
  });

  it("DE-Wortlaut: läuft … / abgeschlossen / fehlgeschlagen (ehrlich, kein „freigegeben“)", async () => {
    await i18n.changeLanguage("de");
    expect(i18n.t(AI_CHECK_CARD_TEXT.running)).toBe(
      "KI-Prüfung läuft … Das Ergebnis erscheint hier, sobald sie abgeschlossen ist.",
    );
    expect(i18n.t(AI_CHECK_CARD_TEXT.done)).toBe(
      "KI-Prüfung abgeschlossen — Details in der Validierung.",
    );
    expect(i18n.t(AI_CHECK_CARD_TEXT.failed, { reason: "X" })).toContain(
      "KI-Prüfung fehlgeschlagen",
    );
  });
});

describe("WP-SHIP9-S1 B3: Capture-Karte nutzt den ECHTEN Status (Source-Pins)", () => {
  const source = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"), "utf8");

  it("seedet aus der Submit-Antwort und pollt den echten KO-Status bis zum Ergebnis", () => {
    expect(source).toContain("setSavedAiCheck(ko.aiCheck ?? null)");
    expect(source).toContain("aiCheckPollAgain(savedAiCheck)");
    expect(source).toContain("endpoints.ko.get(savedKoId)");
    expect(source).toContain("AI_CHECK_POLL_MS");
  });

  it("rendert die drei ehrlichen Zustände und hat den statischen Hintergrund-Satz ersetzt", () => {
    expect(source).toContain("aiCheckCardState(savedAiCheck)");
    expect(source).toContain("AI_CHECK_CARD_TEXT.running");
    expect(source).toContain("AI_CHECK_CARD_TEXT.done");
    expect(source).toContain("AI_CHECK_CARD_TEXT.failed");
    // Der frühere statische „läuft im Hintergrund"-Satz (behauptete Prüfung ohne Nachlesen) ist raus.
    expect(source).not.toContain("capture.aiCheckBackground");
  });
});
