import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  CAPTURE_HELP_IDS,
  CAPTURE_HELP_TOPICS,
  captureHelp,
} from "../../apps/web/src/lib/captureHelp";

// SCRUM-407 (Pedi 03.07.): durchgängige, ausführliche ?-Hilfen im Erfassen-Weg.
// Getestet wird die zentrale Hilfe-Karte (Gegenstück zu SCRUM-406 im Prüfbereich):
// eindeutige Themen, aufgelöste DE+EN-Texte, AUSFÜHRLICHE Texte (kein Ein-Satz-Alibi).
describe("SCRUM-407: ?-Hilfen im Erfassen-Weg", () => {
  it("hat eindeutige Themen und ein stabiles Schlüssel-Schema (chelp.*)", () => {
    expect(new Set(CAPTURE_HELP_IDS).size).toBe(CAPTURE_HELP_IDS.length);
    expect(CAPTURE_HELP_TOPICS.length).toBe(CAPTURE_HELP_IDS.length);
    expect(CAPTURE_HELP_TOPICS.length).toBeGreaterThanOrEqual(22);
    const topic = captureHelp("modes");
    expect(topic.titleKey).toBe("chelp.modes.title");
    expect(topic.bodyKey).toBe("chelp.modes.body");
  });

  it("löst jeden Titel und Text in DE und EN auf — ausführlich, nicht als Alibi", async () => {
    for (const lng of ["de", "en"] as const) {
      await i18n.changeLanguage(lng);
      for (const topic of CAPTURE_HELP_TOPICS) {
        const title = i18n.t(topic.titleKey);
        const body = i18n.t(topic.bodyKey);
        expect(title, `${lng}:${topic.titleKey}`).not.toBe(topic.titleKey);
        expect(body, `${lng}:${topic.bodyKey}`).not.toBe(topic.bodyKey);
        expect(title.length, `${lng}:${topic.titleKey}`).toBeGreaterThan(3);
        // Ticket-Vorgabe „AUSFÜHRLICH": jede Hilfe erklärt Was/Wann/Danach — das geht
        // nicht unter 120 Zeichen. Schützt vor stillem Eindampfen der Texte.
        expect(body.length, `${lng}:${topic.bodyKey}`).toBeGreaterThan(120);
      }
    }
  });

  it("deckt die Kernstationen des Erfassen-Wegs ab (Modi → Erzählen → Wissensseite → Einreichen)", () => {
    const stations = [
      "modes",
      "tellRaw",
      "structureNow",
      "captureTitle",
      "saveDraftHelp",
      "submitReview",
      "readiness",
      "advancedDetails",
      "expertForm",
    ] as const;
    for (const id of stations) {
      expect(CAPTURE_HELP_IDS).toContain(id);
    }
  });
});

// ================================================================================================
// JOB 3029 (U1) — ZWEI THEMEN VERLASSEN DAS FRAGEZEICHEN UND STEHEN OFFEN AUF DER FLÄCHE.
// ================================================================================================
// `saveDraftHelp` und `submitReview` beantworten die Erstnutzer-Frage „warum zwei Knöpfe, und was
// passiert danach?". Sie BLEIBEN in dieser Karte — der Text ist derselbe, von Pedi abgenommen —,
// werden aber nicht mehr als Popover ausgegeben, sondern von `components/KnopfUnterschied` als
// sichtbarer Text an der Entscheidung. Es darf keinen zweiten Weg zu derselben Auskunft geben.
//
// HIER STEHT NUR DIE KARTEN-HÄLFTE: dass die Themen leben und dass die Verdrahtung EINE ist.
// Dass der Text auf der gerenderten Fläche wirklich zu SEHEN ist, misst
// `tests/erstnutzer-u1/knopf-unterschied.test.tsx` an der gemounteten Seite — ein Quelltextblick
// könnte das nicht belegen. Diese Datei bleibt Node-rein (kein JSX-Import), weil der
// Root-Typecheck sie liest (`tsconfig.json:19`).
describe("JOB 3029 · U1 — Entwurf und Einreichen erklären sich offen, nicht im Fragezeichen", () => {
  const U1_THEMEN = ["saveDraftHelp", "submitReview"] as const;
  const WURZEL = join(__dirname, "..", "..");
  const capture = readFileSync(join(WURZEL, "apps/web/src/pages/Capture.tsx"), "utf8");
  const block = readFileSync(join(WURZEL, "apps/web/src/components/KnopfUnterschied.tsx"), "utf8");

  it("die zwei Themen bleiben in der Karte — die Auskunft geht nicht verloren", () => {
    for (const id of U1_THEMEN) {
      expect(CAPTURE_HELP_IDS).toContain(id);
      expect(i18n.t(captureHelp(id).bodyKey).length).toBeGreaterThan(120);
    }
  });

  it("die Erfassen-Seite gibt sie NICHT mehr als Popover aus", () => {
    for (const id of U1_THEMEN) {
      expect(
        capture,
        `chelp("${id}") hängt wieder an einem HelpTip — dann führen zwei Wege zu derselben Auskunft`,
      ).not.toContain(`<HelpTip {...chelp("${id}")} />`);
    }
    // Gegenprobe im selben Fall: die übrigen Popover des Wegs sind unangetastet. Ohne sie wäre
    // dieser Fall auch dann grün, wenn jemand SÄMTLICHE HelpTips entfernt hätte.
    expect(capture).toContain('<HelpTip {...chelp("loadExample")} />');
    expect(capture).toContain('<HelpTip {...chelp("discardHelp")} />');
  });

  it("stattdessen trägt sie der sichtbare Block, und die Seite baut ihn ein", () => {
    for (const id of U1_THEMEN) {
      expect(block, `KnopfUnterschied nennt „${id}" nicht`).toContain(`"${id}"`);
    }
    expect(capture).toContain("<KnopfUnterschied />");
  });
});
