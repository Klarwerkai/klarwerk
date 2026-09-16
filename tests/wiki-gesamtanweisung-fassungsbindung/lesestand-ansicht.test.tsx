// @vitest-environment jsdom
// ================================================================================================
// JOB 4233 · TEST 6 — DER TEXT AUF DER FLÄCHE: SICHER GEZEICHNET, NACH DEN HAUSREGELN GEGLIEDERT.
// ================================================================================================
//
// Vier Zusagen, und jede ist einzeln prüfbar:
//
//   1. Der Rumpf wird über `SanitizedHtml` gezeichnet — dem EINEN Ort des Hauses mit
//      `dangerouslySetInnerHTML` (`apps/web/src/components/SanitizedHtml.tsx:17`). Ein `<script>`
//      im Rumpf erscheint weder ausgeführt noch als rohes Markup.
//   2. Die Gliederung entsteht aus den IMPORTIERTEN D44-Regeln (`d44LeisteZeigen`,
//      `d44SichtbareEintraege`) und nicht aus einem Nachbau: gezählt wird jede Überschrift,
//      GEZEIGT wird, was Text hat (`d44Struktur.ts:85-103`).
//   3. Unbekannter Rumpf ergibt einen SATZ, keinen leeren Kasten (Lieferung 6).
//   4. Die sieben Lagen aus Abschnitt 9 bleiben getrennt: bei „laden", „fehler" und „leer" steht
//      kein Text und keine Gliederung.
//
// GEZEICHNET WIRD IM ECHTEN BAUM (jsdom + `createRoot`) und nicht als Server-Markup: die Gliederung
// liest die WIRKLICH gerenderten Überschriften, so wie es die Lesefläche der Bibliothek seit JOB
// 4145 R3 tut (`BibliothekLesen.tsx:73-79`, „diese Regex liest HTML als TEXT, und genau daran sind
// Runde 1 und 2 gescheitert"). Ein Test gegen `renderToStaticMarkup` könnte diese Zusage gar nicht
// prüfen, weil dort kein Effekt läuft.
//
// GEGENPROBE: in `LesestandAnsicht.tsx` `SanitizedHtml` durch rohes `dangerouslySetInnerHTML`
// ersetzen → „kein Skript, kein rohes Markup" wird rot.
import { describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { AnweisungLesestand, BausteinLesestand } from "../../apps/web/src/api/types";
import { LesestandAnsicht } from "../../apps/web/src/components/gesamtanweisung/LesestandAnsicht";
import type { Anzeigelage } from "../../apps/web/src/components/gesamtanweisung/zustand";
import "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RUMPF =
  '<h2>Absperren</h2><p>Erst absperren.</p><h3>Hinweis</h3><p>Handschuhe tragen.</p><h2></h2><script>window.__geknackt = true;</script><img src="x" onerror="window.__geknackt = true">';

function baustein(over: Partial<BausteinLesestand> & { id: string }): BausteinLesestand {
  return {
    id: over.id,
    position: over.position ?? 0,
    koId: over.koId ?? "ko-a",
    koVersion: over.koVersion ?? 1,
    nachweisHash: over.nachweisHash ?? "h-1",
    voraussetzung: over.voraussetzung ?? null,
    herkunft: over.herkunft ?? {
      titel: "Anlage entlüften",
      autor: "anna",
      fassungAm: "2026-09-01T09:00:00.000Z",
      status: "offen",
    },
    aktuelleKoVersion: over.aktuelleKoVersion ?? 1,
    aktualisierungsvorschlag: over.aktualisierungsvorschlag ?? null,
    inhalt: over.inhalt ?? { tabellenUeberschriften: [], abbildungen: [], geltung: "Werk 1" },
    ...(over.rumpfHtml === undefined ? {} : { rumpfHtml: over.rumpfHtml }),
  };
}

function lesestand(bausteine: readonly BausteinLesestand[]): AnweisungLesestand {
  return {
    id: "a-1",
    titel: "Anfahren",
    zweck: "Sicheres Anfahren",
    geltungsbereich: "Werk 1",
    voraussetzungen: "Anlage steht still",
    stand: "entwurf",
    version: 4,
    urheber: "anna",
    erstelltAm: "2026-09-15T09:00:00.000Z",
    geaendertAm: "2026-09-15T10:00:00.000Z",
    bausteine: [...bausteine],
    unvollstaendig: false,
    verborgeneBausteine: 0,
    pruefanbindung: "nicht_angebunden",
  };
}

const STAND_LAGE: Anzeigelage = {
  art: "stand",
  frisch: true,
  auffrischungGescheitert: false,
  offline: false,
};

/** Zeichnet die Ansicht in einen echten Baum und gibt den Wurzelknoten zurück. */
async function zeichne(lage: Anzeigelage, stand?: AnweisungLesestand): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(LesestandAnsicht, { lage, stand, zeit: "2026-09-15T10:00:00.000Z" }));
  });
  return container;
}

describe("JOB 4233 · der Bausteintext auf der Fläche", () => {
  it("der Rumpf steht da — und kein Skript, kein rohes Markup, kein Ereignisattribut", async () => {
    const container = await zeichne(
      STAND_LAGE,
      lesestand([baustein({ id: "b-1", rumpfHtml: RUMPF })]),
    );

    expect(container.textContent).toContain("Erst absperren.");
    const markup = container.innerHTML;
    expect(markup).not.toContain("<script");
    expect(markup).not.toContain("onerror");
    expect(container.textContent).not.toContain("window.__geknackt");
    expect((globalThis as unknown as { __geknackt?: boolean }).__geknackt).toBeUndefined();
    // Der Text sitzt im eigens ausgewiesenen Bereich, nicht irgendwo im Kleingedruckten.
    const textbereich = container.querySelector('[data-testid="ga-lesestand-text"]');
    expect(textbereich?.textContent).toContain("Erst absperren.");
  });

  it("die Gliederung zeigt die Überschriften mit Text — die leere zählt mit, erscheint aber nicht", async () => {
    const container = await zeichne(
      STAND_LAGE,
      lesestand([baustein({ id: "b-1", rumpfHtml: RUMPF })]),
    );

    const leiste = container.querySelector('[data-testid="ga-lesestand-gliederung"]');
    expect(leiste, "die Gliederungsleiste fehlt").not.toBeNull();
    const eintraege = [...(leiste?.querySelectorAll("li") ?? [])].map((li) =>
      (li.textContent ?? "").trim(),
    );
    // `d44SichtbareEintraege`: gezeigt wird, was Text hat — die leere `<h2>` steht NICHT dabei.
    expect(eintraege).toEqual(["Absperren", "Hinweis"]);
  });

  it("ohne Überschrift steht keine Leiste — `d44LeisteZeigen` kennt keine Mindestzahl, aber die Null", async () => {
    const container = await zeichne(
      STAND_LAGE,
      lesestand([baustein({ id: "b-1", rumpfHtml: "<p>Nur ein Satz.</p>" })]),
    );
    expect(container.textContent).toContain("Nur ein Satz.");
    expect(container.querySelector('[data-testid="ga-lesestand-gliederung"]')).toBeNull();
  });

  it("EINE Überschrift genügt für die Leiste — keine Schwelle von drei", async () => {
    const container = await zeichne(
      STAND_LAGE,
      lesestand([baustein({ id: "b-1", rumpfHtml: "<h2>Allein</h2><p>Text.</p>" })]),
    );
    const leiste = container.querySelector('[data-testid="ga-lesestand-gliederung"]');
    expect(leiste?.textContent).toContain("Allein");
  });

  it("unbekannter Rumpf → ein SATZ, kein leerer Kasten, kein Ausweichen", async () => {
    const container = await zeichne(
      STAND_LAGE,
      lesestand([
        baustein({ id: "b-1", rumpfHtml: null }),
        baustein({ id: "b-2", position: 1, rumpfHtml: "" }),
        // Und der Fall ganz ohne Feld (ältere Antwort): ebenfalls unbekannt, nie „leer".
        baustein({ id: "b-3", position: 2 }),
      ]),
    );

    const saetze = (container.textContent ?? "").split(
      "Der Inhalt dieser Fassung ist nicht belegt.",
    );
    expect(saetze).toHaveLength(4);
    expect(container.querySelector('[data-testid="ga-lesestand-text"]')).toBeNull();
    expect(container.querySelector('[data-testid="ga-lesestand-gliederung"]')).toBeNull();
  });

  it("die Lagen bleiben getrennt: laden, Fehler und leer zeigen keinen Text", async () => {
    const geladen = await zeichne(
      { art: "laden" },
      lesestand([baustein({ id: "b-1", rumpfHtml: RUMPF })]),
    );
    expect(geladen.textContent).toContain("Lädt");
    expect(geladen.textContent).not.toContain("Erst absperren.");
    expect(geladen.querySelector('[data-testid="ga-lesestand-gliederung"]')).toBeNull();

    const fehler = await zeichne(
      { art: "fehler", offline: false },
      lesestand([baustein({ id: "b-1", rumpfHtml: RUMPF })]),
    );
    expect(fehler.textContent).toContain("konnte nicht geladen werden");
    expect(fehler.textContent).not.toContain("Erst absperren.");

    const leer = await zeichne({ art: "leer" }, lesestand([]));
    expect(leer.textContent).toContain("Diese Anweisung hat noch keine Bausteine.");
    expect(leer.querySelector('[data-testid="ga-lesestand-text"]')).toBeNull();
  });

  // ================================================================================================
  // RUNDE 2 · DIE DREI LAGEN MIT SICHTBAREM TEXT — BENs Prüflücke 6
  // ================================================================================================
  //
  // Wörtlich: „im neuen Bauteiltest fehlen die Cache-, Offline- und Rechtelagen mit tatsächlichem
  // Bausteintext … Diese Lagen jeweils mit sichtbarem Text und Standhinweis testen." Genau hier
  // liegt die teuerste Lehre dieses Projekts (03.09., JOB 3027/3025/3037): eine gescheiterte
  // Auffrischung räumt die Fläche leer, und der Mensch verliert den Stand, den er gerade gelesen
  // hat. Mit dem neuen Textträger wäre das nicht mehr eine fehlende Zahl, sondern ein
  // verschwundenes Dokument.

  it("CACHE mit laufender Auffrischung: der Text bleibt stehen und gilt NICHT als frisch", async () => {
    const container = await zeichne(
      { art: "stand", frisch: false, auffrischungGescheitert: false, offline: false },
      lesestand([baustein({ id: "b-1", rumpfHtml: RUMPF })]),
    );

    expect(container.querySelector('[data-testid="ga-lesestand-text"]')?.textContent).toContain(
      "Erst absperren.",
    );
    expect(container.querySelector('[data-testid="ga-lesestand-gliederung"]')).not.toBeNull();
    // Die Standzeile nennt den Zeitpunkt, auf den sich der Text bezieht — und dass aufgefrischt wird.
    expect(container.querySelector('[data-testid="ga-lesestand-zeit"]')?.textContent).toBe(
      "Stand von 2026-09-15T10:00:00.000Z · wird aufgefrischt",
    );
    expect(container.textContent).not.toContain("Auffrischung fehlgeschlagen");
  });

  it("CACHE mit GESCHEITERTER Auffrischung: der Text bleibt UND der Fehler steht daneben", async () => {
    const container = await zeichne(
      { art: "stand", frisch: false, auffrischungGescheitert: true, offline: false },
      lesestand([baustein({ id: "b-1", rumpfHtml: RUMPF })]),
    );

    // NICHTS wird leer geräumt: Text und Gliederung stehen weiter da.
    expect(container.querySelector('[data-testid="ga-lesestand-text"]')?.textContent).toContain(
      "Erst absperren.",
    );
    expect(container.querySelector('[data-testid="ga-lesestand-gliederung"]')).not.toBeNull();
    // Und der Fehler ist trotzdem sichtbar — der Stand wird nicht als aktuell ausgegeben.
    expect(container.querySelector('[data-testid="ga-lesestand-zeit"]')?.textContent).toBe(
      "Stand von 2026-09-15T10:00:00.000Z · Auffrischung fehlgeschlagen",
    );
    expect(container.querySelector('p[role="alert"]')?.textContent).toBe(
      "Die Anweisung konnte nicht geladen werden.",
    );
    expect(container.textContent).not.toContain("aktuell");
  });

  it("OFFLINE: derselbe Text, der Offline-Satz daneben, keine Behauptung über Frische", async () => {
    const container = await zeichne(
      { art: "stand", frisch: false, auffrischungGescheitert: false, offline: true },
      lesestand([baustein({ id: "b-1", rumpfHtml: RUMPF })]),
    );

    expect(container.querySelector('[data-testid="ga-lesestand-text"]')?.textContent).toContain(
      "Erst absperren.",
    );
    expect(container.querySelector('p[role="alert"]')?.textContent).toBe(
      "Keine Verbindung. Ihre Eingaben bleiben erhalten; gespeichert ist nichts.",
    );
    expect(container.querySelector('[data-testid="ga-lesestand-zeit"]')?.textContent).toContain(
      "Stand von",
    );
  });

  it("RECHTELAGE: der zugängliche Text steht da, der verborgene Baustein NICHT — nur seine Zahl", async () => {
    // Der Server hat den verborgenen Baustein bereits getrimmt (`lesestand`); die Fläche darf aus
    // der Zahl keinen Platzhalter machen und sagt nur, DASS etwas fehlt.
    const stand = lesestand([baustein({ id: "b-1", rumpfHtml: RUMPF })]);
    const container = await zeichne(STAND_LAGE, {
      ...stand,
      unvollstaendig: true,
      verborgeneBausteine: 2,
    });

    expect(container.querySelector('[data-testid="ga-lesestand-text"]')?.textContent).toContain(
      "Erst absperren.",
    );
    expect(
      container.querySelector('[data-testid="ga-lesestand-unvollstaendig"]')?.textContent,
    ).toBe("Teile dieser Anweisung sind für Sie nicht zugänglich. Nicht zugängliche Bausteine: 2");
    // Genau EIN Textbereich und EINE Gliederung — für den verborgenen entsteht keine leere Hülle.
    expect(container.querySelectorAll('[data-testid="ga-lesestand-text"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="ga-lesestand-baustein"]')).toHaveLength(1);
    expect(container.textContent).not.toContain("Der Inhalt dieser Fassung ist nicht belegt.");
  });

  it("der Text ist reine Anzeige — kein Editor, kein Feld, das ihn zurückschreiben könnte", async () => {
    const container = await zeichne(
      STAND_LAGE,
      lesestand([baustein({ id: "b-1", rumpfHtml: RUMPF })]),
    );
    const textbereich = container.querySelector('[data-testid="ga-lesestand-text"]');
    expect(textbereich?.querySelectorAll("input, textarea, [contenteditable]")).toHaveLength(0);
    expect(textbereich?.getAttribute("contenteditable")).toBeNull();
  });
});
