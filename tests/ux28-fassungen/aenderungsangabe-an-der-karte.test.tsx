// @vitest-environment jsdom
// ================================================================================================
// JOB 3475 · UX-28 · RUNDE 2 — DIE ÄNDERUNGSANGABE, GEMESSEN AN DER KARTE STATT AN DER ABLEITUNG.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT (BEN, Runde 1, Korrekturpflicht 1): der Modultest über `versionDiffs`
// belegt die ABLEITUNG. Was ein Mensch LIEST, steht aber auf der Karte — und BEN hat genau dort
// gemessen, dass sie „Keine Änderung in den Hauptfeldern." zeigte, obwohl sich der sichtbare
// Berichtstext geändert hatte. Diese Datei schließt die Kette an der Fläche: dieselben zwei
// Fassungen, gemountet, und die Zeile, die der Leser wirklich vor sich hat.
//
// DIE ZWEI FASSUNGEN sind BENs Gegenfall: „nicht freigeben" gegen „nichtfreigeben" — sichtbarer
// Leerraum zwischen zwei Inline-Elementen, sonst nichts. Kein Zeichen der Kernaussage ändert sich.
//
// DER GEGENFALL STEHT GLEICHRANGIG DANEBEN (B): zwei wirklich gleiche Fassungen müssen weiterhin
// „Keine Änderung" sagen. Ohne ihn machte ein „immer geändert" diese Datei grün.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", async () => (await import("./netz")).endpointsDoppel());
vi.mock("../../apps/web/src/api/auth", async () => (await import("./netz")).authDoppel());

import { abbauen, abschnitt, fassungsKnopf, flaecheMitFassungen, i18n, text } from "./flaeche";
import { fassung, netz } from "./netz";

/** Der Bericht mit sichtbarem Leerraum zwischen zwei Inline-Elementen: „nicht freigeben". */
const MIT_RAUM = "<p>Freigabe: <strong>nicht</strong> <em>freigeben</em></p>";
/** Derselbe Bericht ohne diesen Leerraum: „nichtfreigeben". */
const OHNE_RAUM = "<p>Freigabe: <strong>nicht</strong><em>freigeben</em></p>";

/** Die Karte einer Fassung — das `<li>`, in dem ihr Knopf steht. */
function karte(version: number): HTMLElement {
  const li = fassungsKnopf(version).closest("li");
  if (!li) {
    throw new Error(`Die Fassung v${version} steht in keiner Karte`);
  }
  return li;
}

afterEach(() => {
  abbauen();
});

describe("JOB 3475 · A — eine sichtbare Berichtsänderung heißt nicht „keine Änderung“", () => {
  it("die Karte nennt den ausführlichen Inhalt als geändertes Feld", async () => {
    netz.fassungen = [fassung(1, { bodyHtml: MIT_RAUM }), fassung(2, { bodyHtml: OHNE_RAUM })];
    await flaecheMitFassungen();

    const gelesen = text(karte(2));
    expect(
      gelesen,
      "die Karte behauptet weiterhin „Keine Änderung in den Hauptfeldern“ — genau BENs Befund",
    ).not.toContain(i18n.t("ko.snapshotNoChanges"));
    expect(gelesen, "die Karte nennt das geänderte Feld nicht").toContain(
      i18n.t("ko.snapshotField.bodyHtml"),
    );
  });

  it("die Ausgangsfassung sagt weiterhin, dass sie keinen Vorgänger hat", async () => {
    netz.fassungen = [fassung(1, { bodyHtml: MIT_RAUM }), fassung(2, { bodyHtml: OHNE_RAUM })];
    await flaecheMitFassungen();

    expect(text(karte(1))).toContain(i18n.t("ko.snapshotInitial"));
    expect(text(karte(1)), "die Ausgangsfassung erfindet einen Vorgänger-Diff").not.toContain(
      i18n.t("ko.snapshotField.bodyHtml"),
    );
  });
});

describe("JOB 3475 · B — der Gegenfall: gleich bleibt gleich, auch auf der Karte", () => {
  it("zwei wirklich gleiche Fassungen zeigen „Keine Änderung in den Hauptfeldern“", async () => {
    netz.fassungen = [fassung(1, { bodyHtml: MIT_RAUM }), fassung(2, { bodyHtml: MIT_RAUM })];
    await flaecheMitFassungen();

    const gelesen = text(karte(2));
    expect(gelesen, "jede Fassung gilt als geändert — dann sagt die Angabe nichts mehr").toContain(
      i18n.t("ko.snapshotNoChanges"),
    );
    expect(gelesen).not.toContain(i18n.t("ko.snapshotField.bodyHtml"));
  });

  it("eine reine Einrückung im Bericht ist ebenfalls keine Änderung", async () => {
    netz.fassungen = [
      fassung(1, { bodyHtml: "<p>Erster Absatz.</p><p>Zweiter Absatz.</p>" }),
      fassung(2, { bodyHtml: "<p>Erster Absatz.</p>\n  <p>Zweiter Absatz.</p>" }),
    ];
    await flaecheMitFassungen();

    expect(text(karte(2)), "aus einer Einrückung wurde eine Inhaltsänderung").toContain(
      i18n.t("ko.snapshotNoChanges"),
    );
  });
});

// ------------------------------------------------------------------------------------------------
// JOB 3865 · U — DIE DREI LAGEN DES ABBAUS, EINZELN FESTGENAGELT
// ------------------------------------------------------------------------------------------------
//
// WARUM SIE IN DIESER DATEI STEHEN und nicht in einer neuen: die drei anderen gemounteten Dateien
// des Ordners bauen in ihrem `beforeEach` auf — dort gäbe es die Lage „nie aufgebaut" gar nicht.
// Diese Datei baut im Fallrumpf auf, also ist sie die einzige, in der U1 überhaupt messbar ist.
// Sie benutzen dieselbe `flaecheMitFassungen()`/`abbauen()`-Vorrichtung wie jeder andere Fall des
// Ordners; es entsteht kein zweiter Aufbau und kein paralleler Abbauweg.

/**
 * Der Behälter der Fläche — über den Abschnitt gefunden, weil `flaeche.tsx` ihn bewusst nicht
 * herausgibt: er ist das `<div>`, das die Vorrichtung direkt unter `<body>` hängt.
 */
function behaelter(): HTMLElement {
  const b = abschnitt()?.closest("body > div");
  if (!(b instanceof HTMLElement)) {
    throw new Error(
      `der Behälter der Fläche steht nicht als <div> unter <body> (body-Kinder: ${document.body.childElementCount})`,
    );
  }
  return b;
}

describe("JOB 3865 · U — der gemeinsame Abbau entscheidet am Zustand", () => {
  it("U1 · nie aufgebaut: `abbauen()` ist folgenlos, der `body` bleibt leer", () => {
    expect(
      document.body.childElementCount,
      "der `body` trägt schon vor dem Fall etwas — dann misst U1 nicht, was es soll",
    ).toBe(0);

    // Nackt, ohne `expect(...).not.toThrow()`: ein Wurf wäre hier der echte Befund und soll die
    // Ausgabe des Falls sein, nicht in eine Zusicherung eingewickelt werden.
    abbauen();

    expect(
      [...document.body.children].map((e) => e.tagName),
      "`abbauen()` ohne Aufbau hat etwas am `body` angefasst",
    ).toEqual([]);
  });

  it("U2 · zweimal abgebaut: der zweite Aufruf wirft nicht und fasst nichts an", async () => {
    netz.fassungen = [fassung(1, { bodyHtml: MIT_RAUM }), fassung(2, { bodyHtml: OHNE_RAUM })];
    await flaecheMitFassungen();
    expect(document.body.childElementCount, "die Fläche steht gar nicht im `body`").toBe(1);

    abbauen();
    expect(document.body.childElementCount, "der erste Abbau hat nicht geräumt").toBe(0);

    abbauen();

    expect(
      [...document.body.children].map((e) => e.tagName),
      "der zweite Abbau hat etwas am `body` angefasst",
    ).toEqual([]);
  });

  it("U3 · ein echter Abbaufehler bleibt sichtbar — er wird nicht verschluckt", async () => {
    netz.fassungen = [fassung(1, { bodyHtml: MIT_RAUM }), fassung(2, { bodyHtml: OHNE_RAUM })];
    await flaecheMitFassungen();

    const b = behaelter();
    const echtesEntfernen = b.removeChild;
    const GRUND = "U3: der Behälter verweigert das Entfernen seiner Kinder";
    let gefangen: unknown = null;
    try {
      // EIN Handgriff verstellt: React räumt den Baum beim `unmount` genau über diese Methode des
      // Behälters ab (`removeChildFromContainer`). Kein Produktbauteil ist dabei berührt.
      Object.defineProperty(b, "removeChild", {
        configurable: true,
        value: () => {
          throw new Error(GRUND);
        },
      });
      try {
        abbauen();
      } catch (e) {
        gefangen = e;
      }
    } finally {
      // In `finally`, damit auch eine fallende Zusicherung zuverlässig aufräumt (Lehre aus JOB 3848,
      // `archiv/3848/runde-1/ben.md:32`).
      Reflect.deleteProperty(b, "removeChild");
    }
    expect(b.removeChild, "die Verstellung wurde nicht zurückgenommen").toBe(echtesEntfernen);

    expect(
      gefangen instanceof Error ? gefangen.message : "abbauen() lief ohne Fehler durch",
      "ein echter Abbaufehler wäre damit unsichtbar",
    ).toContain(GRUND);

    // Und die Vorrichtung ist durch den Wurf nicht stillgelegt: derselbe Aufruf räumt jetzt wirklich
    // ab, und danach baut sie erneut auf.
    abbauen();
    expect(document.body.childElementCount, "nach dem echten Abbau blieb etwas im `body`").toBe(0);

    netz.fassungen = [fassung(1, { bodyHtml: MIT_RAUM }), fassung(2, { bodyHtml: OHNE_RAUM })];
    await flaecheMitFassungen();
    expect(
      abschnitt(),
      "die Vorrichtung baut nach einem Abbaufehler nicht mehr auf",
    ).not.toBeNull();
  });
});
