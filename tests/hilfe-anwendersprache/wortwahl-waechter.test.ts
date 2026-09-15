// ================================================================================================
// JOB 4067 · HILFE-ANWENDERSPRACHE — DER WORTWAHL-WÄCHTER ÜBER DIE ZWEI LETZTEN PILOTKARTEN.
// ================================================================================================
//
// DER BEFUND (Bedienbefund 14.09. 18:16, `EINGANG-20260914-HILFE-VERSTAENDLICHKEIT-CODEX-a5016636.md:3-5`):
// „die echte Hilfe zeigt „Stage-1, ehrlich“, „Review/Entscheidung“, „Peers“, „Pilot-Befund
// einordnen“ und eine interne UX-Prüferansprache“. JOB 4022 hat davon die Einstiegsführung
// umgestellt (`pilot.access.*`, `pilot.check.*`) und den Rest ehrlich als offen ausgewiesen
// (`archiv/4022/runde-1/RUECKGABE.md:51-52`). Dieser Wächter deckt genau diesen Rest ab: die beiden
// verbliebenen Kartengruppen `pilot.obs.*` (Hilfeseite) und `pilot.next.*` (Admin → Daten).
//
// WARUM NICHT DIE GANZE HILFESEITE. JOB 4022 hat einen Wächter „kein interner Begriff auf der
// ganzen Hilfeseite" ausdrücklich NICHT gebaut und begründet, warum: die 21 Hilfekapitel
// (`lib/helpTopics.ts`) sind nicht umgestellt, ein solcher Wächter wäre ab der ersten Zeile rot und
// würde das Tor für ALLE Bahnen sperren. Diese Datei prüft deshalb genau die Schlüsselgruppen, die
// dieser Auftrag liefert — und zusätzlich EINEN Begriff über den ganzen Bestand (W2), weil für ihn
// gemessen ist, dass er nirgendwo sonst mehr in einem angezeigten Text steht.
//
// DIE SCHLÜSSELNAMEN BLEIBEN. `pilot.obs.*` und `pilot.next.*` heissen weiter so; umgestellt sind
// allein ihre WERTE. Ein Schlüsselname ist kein angezeigter Text — und ein Umbenennen wäre eine
// Änderung an `lib/pilotObservationGuide.ts`/`lib/pilotNextSteps.ts`, die der Auftrag §10 ausschliesst.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { PILOT_NEXT_STEPS } from "../../apps/web/src/lib/pilotNextSteps";
import { PILOT_OBSERVATIONS } from "../../apps/web/src/lib/pilotObservationGuide";
import { alleSprachbestaende } from "../support/i18nBestand";

const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

type Verbot = { muster: RegExp; grund: string };

// ------------------------------------------------------------------------------------------------
// DIE VERBOTSLISTE — JE SPRACHE, JEDER EINTRAG MIT SEINER HERKUNFT.
// ------------------------------------------------------------------------------------------------
// Herkunft ist entweder der BEDIENBEFUND 18:16 (dort namentlich beanstandet) oder die WORTWAHL DER
// OBERFLÄCHE (die Fläche nennt dieselbe Sache anders — die Navigationsnamen sind die Quelle,
// `i18n.ts` „nav.*", und `help.openRoute` heisst „Bereich öffnen"/„Open area"/„Onderdeel openen").
//
// WARUM TEILS MIT WORTGRENZE: „UX" steht gross und ohne Nachbarn; „trust"/„peers"/„flow" sind
// dagegen kurze Zeichenfolgen, die in längeren Wörtern vorkommen können. Ein Verbot, das an einem
// unschuldigen Wort anschlägt, macht den Wächter unbrauchbar, kein Verbot macht ihn wertlos.
const GEMEINSAM: Verbot[] = [
  { muster: /pilot/i, grund: "Bedienbefund 18:16: „Pilot-Befund einordnen“ / „Pilot-Checkliste“" },
  { muster: /stage[-\s]?1/i, grund: "Bedienbefund 18:16: „Stage-1, ehrlich“" },
  { muster: /\bpeers?\b/i, grund: "Bedienbefund 18:16: „Peers“" },
  { muster: /\breviews?\b/i, grund: "Bedienbefund 18:16: „Review/Entscheidung“" },
  { muster: /UX/, grund: "Bedienbefund 18:16: „interne UX-Prüferansprache“" },
  { muster: /workflow/i, grund: "Wortwahl: die Oberfläche kennt keinen „Workflow“" },
  { muster: /\bflows?\b/i, grund: "Wortwahl: die Ziele heissen „Bereich“, nicht „Flow“" },
  {
    muster: /KO-Detail/i,
    grund: "Wortwahl: keine Fläche dieses Namens; die Fläche heisst Bibliothek",
  },
  { muster: /\btrust\b/i, grund: "Wortwahl: die Oberfläche sagt „Vertrauen“/„betrouwbaar“" },
];

const VERBOTEN: Record<Sprache, Verbot[]> = {
  de: [
    ...GEMEINSAM,
    { muster: /\bfl(uss|üsse)\b/i, grund: "Wortwahl: „Bereich öffnen“ (`help.openRoute` de)" },
    { muster: /reibung/i, grund: "Bedienbefund 18:16: Prüfersprache („beobachtete Reibung“)" },
  ],
  en: [
    ...GEMEINSAM,
    { muster: /friction/i, grund: "Bedienbefund 18:16: Prüfersprache („observed friction“)" },
  ],
  nl: [
    ...GEMEINSAM,
    { muster: /wrijving/i, grund: "Bedienbefund 18:16: Prüfersprache („waargenomen wrijving“)" },
  ],
};

/** Genau die Schlüssel, die dieser Auftrag liefert — aus den Datenquellen, nicht von Hand. */
const GEPRUEFTE_SCHLUESSEL: readonly string[] = [
  "pilot.obs.title",
  "pilot.obs.subtitle",
  "pilot.obs.mapLabel",
  "pilot.obs.openFlow",
  ...PILOT_OBSERVATIONS.flatMap((o) => [o.labelKey, o.mapKey]),
  "pilot.next.title",
  "pilot.next.hint",
  ...PILOT_NEXT_STEPS.map((s) => s.labelKey),
];

function wert(sprache: Sprache, schluessel: string): string {
  return String(i18n.getResource(sprache, "translation", schluessel) ?? "");
}

describe("JOB 4067 · die zwei letzten Pilotkarten sprechen Anwendersprache", () => {
  it("W0: jeder geprüfte Schlüssel ist in allen drei Sprachen belegt", () => {
    // Ohne diesen Fall wäre W1 auch über einem leeren Bestand grün — geprüft würde dann nichts.
    for (const sprache of SPRACHEN) {
      for (const schluessel of GEPRUEFTE_SCHLUESSEL) {
        expect(
          wert(sprache, schluessel).length,
          `${schluessel} fehlt in ${sprache}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("W1: kein verbotener Begriff in den Werten von `pilot.obs.*` und `pilot.next.*`", () => {
    const funde: string[] = [];
    for (const sprache of SPRACHEN) {
      for (const schluessel of GEPRUEFTE_SCHLUESSEL) {
        const text = wert(sprache, schluessel);
        for (const verbot of VERBOTEN[sprache]) {
          const treffer = text.match(verbot.muster);
          if (treffer) {
            funde.push(`${sprache} · ${schluessel} · „${treffer[0]}“ — ${verbot.grund}`);
          }
        }
      }
    }
    expect(funde, "interne Begriffe stehen noch im angezeigten Text").toEqual([]);
  });

  it("W2: „Stage-1“ steht in KEINEM angezeigten Text mehr — über den ganzen Sprachbestand", () => {
    // Die Reichweite ist gemessen, nicht geschätzt: „Stage-1“ stand am Basisstand f59d503 in genau
    // sechs Werten (`pilot.next.hint` und `pilot.next.start`, je de/en/nl). Alle übrigen Fundstellen
    // im Quelltext sind KOMMENTARE (u. a. `lib/demoPilotPath.ts`, `lib/pilotChecklist.ts`,
    // `lib/pilotNextSteps.ts:2`, `pages/Help.tsx:115`) und damit kein angezeigter Text. Deshalb ist
    // dieser Wächter hart auf 0 gestellt und nicht auf die zwei Schlüsselgruppen begrenzt.
    //
    // Gemessen wird der BESTAND VON i18next, nicht die Datei: er enthält auch die ausgelagerten
    // Blöcke (`lib/lesevariante.ts`), die ein Textschnitt über `i18n.ts` übersehen würde.
    const bestaende = alleSprachbestaende();
    const funde: string[] = [];
    for (const sprache of SPRACHEN) {
      for (const [schluessel, text] of Object.entries(bestaende[sprache] ?? {})) {
        if (typeof text === "string" && /stage[-\s]?1/i.test(text)) {
          funde.push(`${sprache} · ${schluessel}`);
        }
      }
    }
    expect(funde, "„Stage-1“ steht noch in angezeigtem Text").toEqual([]);
  });

  it("W3: der Link nennt die Zielkarte bei ihrem heutigen Namen", () => {
    // DER FEHLER, DEN DIESER FALL VERHINDERT: `pilot.next.checklist` hiess „Pilot-Checkliste
    // öffnen“ und zeigte auf `/hilfe` — die Karte dort heisst seit JOB 4022 aber
    // `pilot.access.title`. Der Link nannte ein Ziel, das es unter diesem Namen nicht gibt.
    // Geprüft wird die BINDUNG an die Namensquelle, nicht ein fester Satz: wer die Karte morgen
    // erneut umbenennt, wird hier rot, statt den Link wieder stehen zu lassen.
    for (const sprache of SPRACHEN) {
      const name = wert(sprache, "pilot.access.title");
      expect(name.length, `pilot.access.title fehlt in ${sprache}`).toBeGreaterThan(0);
      expect(
        wert(sprache, "pilot.next.checklist"),
        `der Link (${sprache}) nennt die Karte nicht bei ihrem Namen „${name}“`,
      ).toContain(name);
    }
  });

  it("W4: die Zusagen der Beobachtungskarte stehen unverändert da", () => {
    // Ehrlichkeit vor Optik: die Karte nimmt nichts entgegen und speichert nichts
    // (`lib/pilotObservationGuide.ts:1-5`). Die Umstellung der Sprache darf diese drei Sätze nicht
    // verlieren — sie sind der Grund, warum die Karte überhaupt so dastehen darf.
    const untertitel = wert("de", "pilot.obs.subtitle");
    expect(untertitel, "Zusage 1: nichts wird gespeichert").toMatch(/nichts wird gespeichert/i);
    expect(untertitel, "Zusage 2: kein Vorgang wird ausgelöst").toMatch(
      /kein vorgang wird ausgelöst/i,
    );
    expect(untertitel, "Zusage 3: Bedienhinweise gehören nicht ins Produkt").toMatch(
      /gehören nicht ins produkt/i,
    );
    // Der Eintrag OHNE Produktlink bleibt ehrlich leer statt einer erfundenen Handlung
    // (Auftrag Lieferung 2; `pilotObservationGuide.ts:45` `to: null`).
    expect(PILOT_OBSERVATIONS.find((o) => o.id === "uxnote")?.to).toBeNull();
    expect(wert("de", "pilot.obs.uxnote.map")).toMatch(/nicht im produkt gespeichert/i);
    expect(wert("en", "pilot.obs.uxnote.map")).toMatch(/not stored in the product/i);
    expect(wert("nl", "pilot.obs.uxnote.map")).toMatch(/niet in het product opgeslagen/i);
  });

  it("W5: der Demodaten-Hinweis bleibt ehrlich — Beispiele, kein produktiver Beweis", () => {
    expect(wert("de", "pilot.next.hint")).toMatch(/beispiele/i);
    expect(wert("de", "pilot.next.hint")).toMatch(/kein produktiver beweis/i);
    expect(wert("en", "pilot.next.hint")).toMatch(/examples/i);
    expect(wert("en", "pilot.next.hint")).toMatch(/not production proof/i);
    expect(wert("nl", "pilot.next.hint")).toMatch(/voorbeelden/i);
    expect(wert("nl", "pilot.next.hint")).toMatch(/geen productief bewijs/i);
  });
});
