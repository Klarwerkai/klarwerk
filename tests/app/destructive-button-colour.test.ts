import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// AUFTRAG-mega14 Block F (SCRUM-412) — die Warnfarbe klebt am ZERSTÖRENDEN Knopf.
//
// Vorgeschichte, die zu diesem Test geführt hat: der Code-Befund („die Farbe klebt überall
// korrekt") wurde durch LESEN von Klassennamen gewonnen, der Live-Test hat auf den BILDSCHIRM
// gesehen und das Gegenteil festgestellt. Der Live-Test hatte recht.
//
// Nachgemessen im echten Browser (Chromium, gebautes Bündel, getComputedStyle):
//   Weggeh-Wächter  „Verwerfen und wechseln"  rgb(104,112,120)  = IDENTISCH mit „Hier bleiben"
//   Bibliothek      „Ja, löschen"             rgb(27,30,33)     = neutrale Textfarbe
//   Wissensobjekt   „Ja, löschen"             rgb(27,30,33)     = neutrale Textfarbe
//   Erfassen        „Ja, verwerfen" (Entwurf) rgb(27,30,33)     = neutrale Textfarbe
//   Studio          „Verwerfen"               rgb(27,30,33)     = neutrale Textfarbe
//   Studio-FRAGE (neutral!)                   rgb(154,106,18)   = Warnfarbe am falschen Element
//   Mobile          „Ja, verwerfen" (Entwurf) rgb(158,53,46)    = richtig (dieser eine war korrekt)
//   Admin           „Ja, endgültig entfernen" rgb(158,53,46)    = richtig
//   Erfassen        „Ja, verwerfen" (Erzähl.) rgb(158,53,46)    = richtig
//
// Der Widerspruch löst sich damit auf: `Mobile.tsx` trägt die Warnfarbe — aber an seinem
// ENTWURF-Verwerfen-Dialog. Das „Weggehen" von Mobil (und von Erfassen) läuft über den GEMEINSAMEN
// Weggeh-Wächter, und der war farblos. Wer nur `Mobile.tsx` liest, sieht Rot und schließt falsch.
//
// Warum es durchrutschen konnte: es gab KEINEN Test. Dieser hier ist die Absicherung — auf der
// Ebene, auf der die Farbe entschieden wird (die Knopf-Variante), damit ein Zurückrutschen auf
// „outline"/„ghost" auffällt.

const WEB_SRC = join(__dirname, "../../apps/web/src");
const read = (p: string): string => readFileSync(join(WEB_SRC, p), "utf8");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// Der Knopf-Text (i18n-Schlüssel) → die Datei, in der der zerstörende Knopf steht.
// Alle sieben Bestätigungsstellen; „Weggehen" bedient Erfassen UND Mobil.
const ZERSTOEREND: { ort: string; datei: string; labelKey: string }[] = [
  {
    ort: "Weggeh-Wächter (Erfassen + Mobil)",
    datei: "app/NavGuardContext.tsx",
    labelKey: "nav.guard.discard",
  },
  // JOB 3063 (H4): Bibliothek und Wissensobjekt-Detail sind EINE Fläche geworden — und damit ist
  // auch aus zwei Löschbestätigungen EINE geworden (am gelesenen Eintrag). Zwei Einträge hier
  // wären ab jetzt zwei Namen für dieselbe Stelle.
  {
    ort: "Wissensobjekt löschen (Lesefläche der Bibliothek)",
    datei: "components/bibliothek/BibliothekLesen.tsx",
    labelKey: "ko.deleteYes",
  },
  {
    ort: "Erfassen — Entwurf verwerfen",
    datei: "pages/Capture.tsx",
    labelKey: "CAPTURE_WIZARD_TEXT.discardYes",
  },
  {
    ort: "Studio — Änderungen verwerfen",
    datei: "components/KnowledgeInputStudio.tsx",
    labelKey: "studio.confirmDiscard.discard",
  },
];

// Findet den <Button …>-Block, der das gegebene Label rendert, und liefert seine Variante.
function variantenVorLabel(src: string, labelKey: string): string[] {
  const code = stripComments(src);
  const treffer: string[] = [];
  // Zwei Schreibweisen im Bestand: t("ko.deleteYes") und t(CAPTURE_WIZARD_TEXT.discardYes).
  const needle = labelKey.includes('"') ? labelKey : `t("${labelKey}")`;
  const nadeln = [needle, `t(${labelKey})`];
  let from = 0;
  for (;;) {
    const treffer_at = nadeln
      .map((n) => code.indexOf(n, from))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    const at = treffer_at[0];
    if (at === undefined) {
      break;
    }
    from = at + 1;
    // Rückwärts bis zum öffnenden Knopf. Der Bestand kennt BEIDE Formen: die <Button>-Komponente
    // (Variante entscheidet) und einen rohen <button> mit Klassen (dann entscheiden die Klassen).
    // Die erste Fassung dieses Tests kannte nur <Button und lief bei einem rohen <button> auf einen
    // fremden, weiter oben stehenden Knopf — ein falscher Treffer, den der Lauf sofort gezeigt hat.
    const alsKomponente = code.lastIndexOf("<Button", at);
    const alsRoh = code.lastIndexOf("<button", at);
    const start = Math.max(alsKomponente, alsRoh);
    if (start < 0) {
      continue;
    }
    const block = code.slice(start, at);
    if (alsRoh > alsKomponente) {
      // Roher Knopf: Warnfarbe = die Trust-Crit-Marken direkt in den Klassen.
      treffer.push(/text-trust-crit-text|bg-trust-crit-bg/.test(block) ? "danger" : "roh-neutral");
      continue;
    }
    const m = block.match(/variant=["{]"?(\w+)/);
    treffer.push(m?.[1] ?? "outline");
  }
  return treffer;
}

describe("SCRUM-412: die Warnfarbe klebt am zerstörenden Knopf", () => {
  it("die Knopf-Variante `danger` existiert und trägt die Trust-Warnmarken", () => {
    const ui = read("components/ui.tsx");
    expect(ui).toContain('danger: "bg-trust-crit-bg text-trust-crit-text');
    // Keine zweite Warn-Sprache: dieselben Marken, die Mobile schon richtig benutzt.
    expect(ui).toMatch(/variant\?:.*"danger"/);
  });

  it("JEDER zerstörende Bestätigungsknopf ist `danger` — keine Ausnahme", () => {
    const falsch: string[] = [];
    for (const { ort, datei, labelKey } of ZERSTOEREND) {
      const varianten = variantenVorLabel(read(datei), labelKey);
      expect(varianten.length, `${ort}: Knopf nicht gefunden (Label ${labelKey})`).toBeGreaterThan(
        0,
      );
      for (const v of varianten) {
        if (v !== "danger") {
          falsch.push(`${ort} (${datei}) → variant="${v}"`);
        }
      }
    }
    expect(falsch, `zerstörende Knöpfe ohne Warnfarbe:\n${falsch.join("\n")}`).toEqual([]);
  });

  it("die NEUTRALEN Knöpfe daneben tragen KEINE Warnfarbe", () => {
    // Der Gegenrand: eine Warnfarbe an „Behalten"/„Hier bleiben" wäre derselbe Fehler rückwärts.
    const neutrale: { datei: string; labelKey: string }[] = [
      { datei: "app/NavGuardContext.tsx", labelKey: "nav.guard.stay" },
      { datei: "components/bibliothek/BibliothekLesen.tsx", labelKey: "ko.deleteKeep" },
      { datei: "components/KnowledgeInputStudio.tsx", labelKey: "studio.confirmDiscard.keep" },
      { datei: "pages/Capture.tsx", labelKey: "CAPTURE_WIZARD_TEXT.discardKeep" },
    ];
    for (const { datei, labelKey } of neutrale) {
      for (const v of variantenVorLabel(read(datei), labelKey)) {
        expect(v, `${datei} · ${labelKey} trägt Warnfarbe`).not.toBe("danger");
      }
    }
  });

  it("die neutrale FRAGE des Studios trägt keine Ampelfarbe mehr", () => {
    // Sie trug rgb(154,106,18) — Warnfarbe am falschen Element, während der Knopf daneben
    // farblos war. Die Fußzeilen-Fassung derselben Komponente machte es seit jeher richtig.
    const src = stripComments(read("components/KnowledgeInputStudio.tsx"));
    const stellen = [
      ...src.matchAll(
        /<span[^>]*className="([^"]*)"[^>]*>\s*\{t\("studio\.confirmDiscard\.q"\)\}/g,
      ),
    ];
    expect(stellen.length).toBeGreaterThanOrEqual(1);
    for (const s of stellen) {
      expect(s[1], "Frage trägt Ampelfarbe").not.toContain("trust-warn");
      expect(s[1], "Frage trägt Ampelfarbe").not.toContain("trust-crit");
    }
  });

  it("die beiden bereits richtigen Stellen bleiben richtig (Mobile, Admin)", () => {
    // Diese zwei waren nie kaputt — sie dürfen es durch die Umstellung nicht werden.
    expect(stripComments(read("pages/Mobile.tsx"))).toContain(
      "bg-trust-crit-bg text-trust-crit-text",
    );
    // JOB 3065 H6: Die zerstörenden Knöpfe des Admin (Demodaten entfernen, Papierkorb endgültig
    // leeren, Werksreset, Konto löschen) stehen jetzt in den Detailkarten. Geprüft wird deshalb
    // JEDE Einstellungsseite — die Warnfarbe darf bei keiner von ihnen verloren gehen.
    for (const datei of [
      "pages/AdminDatenDetails.tsx",
      "pages/AdminKontenDetails.tsx",
      "pages/AdminKiDetails.tsx",
    ]) {
      expect(stripComments(read(datei)), datei).toContain("text-trust-crit-text");
    }
  });
});
