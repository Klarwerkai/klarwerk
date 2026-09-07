// ================================================================================================
// JOB 3216 · M3c — „HABEN WIR DAS SCHON?" FINDET DIE PASSAGE AUCH IM IMPORTIERTEN VOLLTEXT.
// ================================================================================================
//
// DER BEFUND (Codex 51999a48, 07.09.2026). Ein ganzes Word-Dokument wird importiert; sein Text
// steht im `bodyHtml` des Wissensobjekts, seine `statement` ist ein kurzes Feld. Fragt Pedi später
// aus Word mit einem ABSATZ aus diesem Dokument, prüft der Kerntextweg (Titel, Aussage,
// Bedingungen, Maßnahmen — K0-2) genau die Felder, in denen der Absatz NICHT steht. Ergebnis:
// „nichts gefunden", obwohl der Text im Haus liegt.
//
// WAS DIESE DATEI MISST: dass die Antwort jetzt zusätzlich einen QUELLENFUND trägt — einen eigenen
// Treffertyp mit Fundstelle, der ausdrücklich KEIN Dublettenurteil ist. Und dass der
// Dublettenvertrag K0-2 dabei unangetastet bleibt.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  KURZE_AUSSAGE,
  PASSAGE,
  type Pruefantwort,
  S1,
  anlegen,
  aufbau,
  langerBody,
  pruefe,
  validieren,
} from "./harness";

const FLAG = "KLARWERK_ADDON_API";
const SCHLUESSEL = "KLARWERK_ADDON_API_KEY";
const GEMERKT: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of [FLAG, SCHLUESSEL]) {
    GEMERKT[k] = process.env[k];
  }
  process.env[FLAG] = "1";
  process.env[SCHLUESSEL] = "m3c-schluessel-fuer-den-test";
});
afterEach(() => {
  for (const k of [FLAG, SCHLUESSEL]) {
    if (GEMERKT[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = GEMERKT[k];
    }
  }
});

function fund(antwort: Pruefantwort, id: string) {
  return antwort.sourceHits.find((h) => h.refId === id);
}

describe("M3c · Quellenfund im importierten Volltext", () => {
  it("A0 · der Suchbegriff ist der längere Satz — die Voraussetzung dieser Suite, gemessen", () => {
    // Ohne diese drei Zahlen sagen die Fälle unten nichts: der Ausschnittsweg greift erst über
    // 200 Zeichen, und `coverage: partial` ist nur unterscheidbar, wenn S1 echt kürzer ist als
    // die ganze Passage.
    expect(PASSAGE.length).toBeGreaterThan(200);
    expect(S1.length).toBeLessThanOrEqual(200);
    expect(S1.length).toBeGreaterThan(PASSAGE.length - S1.length);
  });

  it("A1 · Passage NUR im bodyHtml eines validierten Objekts → Quellenfund mit Fundstelle", async () => {
    const { app, autor, admin } = await aufbau();
    const id = await anlegen(app, autor, {
      title: "Betriebshandbuch Portionierer",
      statement: KURZE_AUSSAGE,
      bodyHtml: langerBody(PASSAGE),
      type: "best_practice",
      category: "Produktion",
      neededValidations: 1,
    });
    await validieren(app, admin, id);

    const antwort = await pruefe(app, autor, PASSAGE);
    const treffer = fund(antwort, id);
    expect(treffer, JSON.stringify(antwort.sourceHits)).toBeDefined();
    if (!treffer) {
      return;
    }
    expect(treffer.koTitle).toBe("Betriebshandbuch Portionierer");
    expect(treffer.pruefstand).toBe("validiert");
    expect(treffer.koStatus).toBe("validiert");
    expect(treffer.fundort.bibliothekPfad).toBe(`/wissen/${id}`);
    expect(treffer.fundort.kategorie).toBe("Produktion");
    // Die ganze gewählte Passage steht zusammenhängend im Suchtext → volle Deckung.
    expect(treffer.coverage).toBe("full");
    expect(treffer.gedeckteZeichen).toBe(PASSAGE.length);
    expect(treffer.passageZeichen).toBe(PASSAGE.length);
    // Die Fundstelle zeigt die Passage im Zusammenhang — mit Umgebung aus dem Fülltext davor.
    expect(treffer.fundstelle).toContain(S1);
    expect(treffer.fundstelle.length).toBeGreaterThan(PASSAGE.length);
    expect(antwort.quellenfund).toEqual({ gelaufen: true, grund: null, geprueft: 1 });
    expect(antwort.sourceHitsTruncated).toBe(false);
  });

  it("A2 · K0-2 bleibt: derselbe Aufruf liefert KEIN Dublettenurteil über den Volltext", async () => {
    const { app, autor, admin } = await aufbau();
    const id = await anlegen(app, autor, {
      title: "Betriebshandbuch Portionierer",
      statement: KURZE_AUSSAGE,
      bodyHtml: langerBody(PASSAGE),
      type: "best_practice",
      category: "Produktion",
      neededValidations: 1,
    });
    await validieren(app, admin, id);

    const antwort = await pruefe(app, autor, PASSAGE);
    // Der Quellenfund ist da …
    expect(antwort.sourceHits.map((h) => h.refId)).toContain(id);
    // … das Dublettenurteil AUSDRÜCKLICH nicht: der Kerntext dieses Objekts trägt die Passage
    // nicht, also ist es keine identische Wissensaussage. Genau diese Trennung ist der Auftrag.
    expect(antwort.duplicates).toEqual([]);
    expect(antwort.conflicts).toEqual([]);
  });

  it("A3 · nur der charakteristische Satz im Bestand → coverage 'partial' mit gedeckter Zeichenzahl", async () => {
    const { app, autor, admin } = await aufbau();
    const id = await anlegen(app, autor, {
      title: "Kurzfassung Profile",
      statement: KURZE_AUSSAGE,
      // Nur S1 — der zweite Satz der geprüften Passage fehlt.
      bodyHtml: langerBody(S1),
      type: "best_practice",
      category: "Produktion",
      neededValidations: 1,
    });
    await validieren(app, admin, id);

    const treffer = fund(await pruefe(app, autor, PASSAGE), id);
    expect(treffer).toBeDefined();
    if (!treffer) {
      return;
    }
    // Kein Beleg für das ganze Dokument: die Teildeckung wird benannt, nicht verschwiegen.
    expect(treffer.coverage).toBe("partial");
    expect(treffer.gedeckteZeichen).toBe(S1.length);
    expect(treffer.passageZeichen).toBe(PASSAGE.length);
    expect(treffer.gedeckteZeichen).toBeLessThan(treffer.passageZeichen);
  });

  it("A4 · EIN Suchvertrag: derselbe Begriff findet über die Bibliothek dasselbe Objekt", async () => {
    const { app, autor, admin } = await aufbau();
    const id = await anlegen(app, autor, {
      title: "Betriebshandbuch Portionierer",
      statement: KURZE_AUSSAGE,
      bodyHtml: langerBody(PASSAGE),
      type: "best_practice",
      category: "Produktion",
      neededValidations: 1,
    });
    await validieren(app, admin, id);

    const bibliothek = await app.inject({
      method: "GET",
      url: `/api/library/search?q=${encodeURIComponent(S1)}`,
      headers: autor,
    });
    expect(bibliothek.statusCode, bibliothek.body).toBe(200);
    const ausBibliothek = (bibliothek.json() as { id: string }[]).map((t) => t.id);
    const ausPruefung = (await pruefe(app, autor, PASSAGE)).sourceHits.map((h) => h.refId);
    expect(ausBibliothek).toContain(id);
    expect(ausPruefung).toContain(id);
    expect(ausPruefung).toEqual(ausBibliothek);
  });

  it("A5 · steht die Passage nirgends, ist die Liste leer UND der Lauf ausgewiesen", async () => {
    const { app, autor, admin } = await aufbau();
    const id = await anlegen(app, autor, {
      title: "Etwas ganz anderes",
      statement: "Die Spritzzone wird nach jeder Schicht nass gereinigt und danach getrocknet.",
      bodyHtml: langerBody("Hier steht nichts ueber Profile oder Portioniereinheiten."),
      type: "best_practice",
      category: "Produktion",
      neededValidations: 1,
    });
    await validieren(app, admin, id);

    const antwort = await pruefe(app, autor, PASSAGE);
    expect(antwort.sourceHits).toEqual([]);
    // Zustandsmodell §7: „nichts gefunden" darf eine Fläche nur sagen, wenn wirklich gesucht wurde.
    expect(antwort.quellenfund.gelaufen).toBe(true);
    expect(antwort.quellenfund.grund).toBeNull();
  });
});
