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
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", async () => (await import("./netz")).endpointsDoppel());
vi.mock("../../apps/web/src/api/auth", async () => (await import("./netz")).authDoppel());

import { QueryClient } from "../../apps/web/node_modules/@tanstack/react-query";
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

  // ----------------------------------------------------------------------------------------------
  // JOB 3883 · U4 UND U5 — DIE ZWEI HANDGRIFFE, DIE U3 BEWUSST NICHT TRIFFT
  // ----------------------------------------------------------------------------------------------
  //
  // `abbauen()` tut DREI Dinge, und der Kommentar darüber (`flaeche.tsx`, „Wirft eine der drei
  // Zeilen darüber …") sagte bis hierher über alle drei dasselbe. Gemessen war davon genau EINE:
  // U3 verstellt `removeChild` des BEHÄLTERS und trifft damit die `unmount`-Phase — React räumt den
  // Baum genau darüber ab. Bestellt hat die anderen zwei Codex zu JOB 3865
  // (`archiv/3865/runde-1/ben.md:21`, Prüfpunkt 6, wörtlich): „Fehler in `container.remove()` oder
  // `qc.clear()` … bleiben offen … Passende Folgetests sollten diese drei Wege gezielt werfen".
  //
  // DASS DIE LÜCKE WIRKLICH EINE WAR, ist gemessen und nicht behauptet (Gegenproben dieser Runde,
  // beide auf dem Stand VOR U4/U5 gefahren):
  //   · `container.remove(); qc.clear();` in ein `try { … } catch {}` gewickelt → `Tests 62 passed`
  //   · `qc.clear()` ersatzlos gestrichen                                      → `Tests 62 passed`
  // Die zwei Zeilen konnten also schweigend ihre Wirkung verlieren, ohne dass ein Fall es meldete.
  //
  // U4 UND U5 SIND NICHT „U3 MIT ANDEREM METHODENNAMEN": jeder der drei Würfe hinterlässt einen
  // ANDEREN Zustand, und genau den misst jeder Fall — siehe die Tabelle an `flaeche.tsx`.

  it("U4 · der Abbaufehler im `container.remove()` bleibt sichtbar, und der zweite Aufruf räumt ab", async () => {
    netz.fassungen = [fassung(1, { bodyHtml: MIT_RAUM }), fassung(2, { bodyHtml: OHNE_RAUM })];
    await flaecheMitFassungen();

    const b = behaelter();
    const echtesEntfernen = b.remove;
    const GRUND = "U4: der Behälter verweigert sein eigenes Entfernen";
    // Der Ausgangspunkt der Phasenmessung unten: JETZT steht ein Baum im Behälter. Ohne diese Zeile
    // wäre „der Behälter ist nach dem Wurf leer" auch an einem nie gefüllten Behälter wahr.
    expect(
      b.childElementCount,
      "vor dem Abbau steht gar kein Baum im Behälter — dann misst dieser Fall nicht, was er soll",
    ).toBeGreaterThan(0);

    let gefangen: unknown = null;
    try {
      // EIN Handgriff verstellt, und ausdrücklich ein ANDERER als in U3: nicht `removeChild` (darüber
      // räumt React den Baum IM `unmount` ab), sondern `remove` des Behälters selbst — genau die
      // Methode, die `abbauen()` NACH dem gelungenen `unmount` ruft.
      Object.defineProperty(b, "remove", {
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
      // `archiv/3848/runde-1/ben.md:32`). Die Zusicherung auf die Rücknahme steht ausserhalb: im
      // `finally` wäre sie eine Aussage über den Aufräumweg und verdeckte den eigentlichen Befund.
      Reflect.deleteProperty(b, "remove");
    }
    expect(b.remove, "die Verstellung wurde nicht zurückgenommen").toBe(echtesEntfernen);

    // (i) DER WURF KOMMT AN, mit dem gesetzten Grund — nichts verschluckt.
    expect(
      gefangen instanceof Error ? gefangen.message : "abbauen() lief ohne Fehler durch",
      "ein echter Abbaufehler wäre damit unsichtbar",
    ).toContain(GRUND);

    // (ii) UND ES IST WIRKLICH DIE ZWEITE PHASE, gemessen am hinterlassenen Zustand: das `unmount`
    // ist gelungen (der Behälter ist leer), gescheitert ist erst sein eigenes Entfernen — er hängt
    // noch im `body`. Genau das unterscheidet U4 von U3 und von U5.
    expect(
      b.childElementCount,
      `der Baum steht nach dem Wurf noch im Behälter (Kinder: ${b.childElementCount}) — dann scheiterte schon das unmount, und das misst U3`,
    ).toBe(0);
    expect(
      document.body.contains(b),
      "der Behälter hängt nach dem Wurf nicht mehr im `body` — dann hat container.remove() doch abgeräumt",
    ).toBe(true);
    expect(document.body.childElementCount, "der `body` trägt nicht mehr genau den Behälter").toBe(
      1,
    );

    // (iii) WAS DER ZWEITE, UNVERSTELLTE AUFRUF TUT — nackt gerufen, weil ein Wurf hier der echte
    // Befund wäre und die Ausgabe des Falls sein soll. GEMESSEN: er kommt durch. Der Behälter hängt
    // noch im Dokument, die `isConnected`-Sperre lässt ihn also durch; `root.unmount()` läuft ein
    // zweites Mal und ist folgenlos (React hat den Wurzelverweis beim ersten Mal schon gelöst), und
    // erst jetzt räumen `container.remove()` und `qc.clear()` wirklich ab.
    abbauen();
    expect(document.body.childElementCount, "nach dem echten Abbau blieb etwas im `body`").toBe(0);

    // (iv) Und die Vorrichtung ist durch den Wurf nicht stillgelegt: sie baut danach erneut auf.
    netz.fassungen = [fassung(1, { bodyHtml: MIT_RAUM }), fassung(2, { bodyHtml: OHNE_RAUM })];
    await flaecheMitFassungen();
    expect(
      abschnitt(),
      "die Vorrichtung baut nach einem Abbaufehler in container.remove() nicht mehr auf",
    ).not.toBeNull();
  });

  it("U5 · der Abbaufehler im `qc.clear()` bleibt sichtbar — und der zweite Aufruf nennt die falsche Ursache", async () => {
    netz.fassungen = [fassung(1, { bodyHtml: MIT_RAUM }), fassung(2, { bodyHtml: OHNE_RAUM })];
    await flaecheMitFassungen();

    const b = behaelter();
    const GRUND = "U5: der Zwischenspeicher verweigert das Leeren";
    // `qc` ist Modulzustand von `flaeche.tsx` und wird bewusst nicht herausgegeben. Verstellt wird
    // deshalb `clear` an `QueryClient.prototype` — dieselbe Klasse aus demselben Pfad, aus dem sich
    // `flaeche.tsx` seinen Client baut. Kein neuer Export, kein zweiter Weg an die Vorrichtung.
    const echtesLeeren = QueryClient.prototype.clear;
    let gefangen: unknown = null;
    const spion = vi.spyOn(QueryClient.prototype, "clear").mockImplementation(() => {
      throw new Error(GRUND);
    });
    try {
      try {
        abbauen();
      } catch (e) {
        gefangen = e;
      }
    } finally {
      // Wie in U3/U4 in `finally` (Lehre aus JOB 3848) — und hier besonders wichtig: eine liegen
      // gebliebene Verstellung an einem PROTOTYP träfe jeden folgenden Fall dieser Datei, nicht nur
      // diesen.
      spion.mockRestore();
    }
    expect(QueryClient.prototype.clear, "die Verstellung wurde nicht zurückgenommen").toBe(
      echtesLeeren,
    );

    // (i) DER WURF KOMMT AN, mit dem gesetzten Grund — nichts verschluckt.
    expect(
      gefangen instanceof Error ? gefangen.message : "abbauen() lief ohne Fehler durch",
      "ein echter Abbaufehler wäre damit unsichtbar",
    ).toContain(GRUND);

    // (ii) UND ES IST DIE DRITTE PHASE, gemessen am hinterlassenen Zustand: `unmount` UND
    // `container.remove()` sind gelungen — der Behälter ist fort, der `body` leer. Genau darin
    // unterscheidet sich U5 von U4, wo er noch hing.
    expect(
      document.body.contains(b),
      "der Behälter hängt nach dem Wurf noch im `body` — dann scheiterte schon container.remove(), und das misst U4",
    ).toBe(false);
    expect(document.body.childElementCount, "der `body` trägt nach dem Wurf noch etwas").toBe(0);

    // (iii) WAS DER ZWEITE, UNVERSTELLTE AUFRUF TUT — und hier ist der eigentliche Befund dieses
    // Falls: `montiert` steht noch auf „montiert" (richtig, der Abbau ist nicht durchgelaufen), der
    // Behälter hängt aber nicht mehr im Dokument. Der zweite Aufruf läuft damit in die
    // `isConnected`-Meldung von `flaeche.tsx` — und die nennt zwei Ursachen, von denen KEINE zutrifft
    // („abbauen() lief zweimal auf dieselbe Fläche, oder der Behälter wurde an flaeche.tsx vorbei
    // entfernt"). In Wahrheit hat `flaeche.tsx` selbst ihn entfernt und ist danach gestolpert.
    // Diese Runde schreibt den Befund fest; die Meldung wird hier NICHT umgeschrieben (Auftrag §10),
    // das gehört in eine eigene Zeile.
    let zweiter: unknown = null;
    try {
      abbauen();
    } catch (e) {
      zweiter = e;
    }
    const zweiteMeldung =
      zweiter instanceof Error ? zweiter.message : "abbauen() lief ohne Fehler durch";
    expect(zweiteMeldung, "der zweite Aufruf läuft nicht in die isConnected-Meldung").toContain(
      "aber der Behälter hängt nicht im Dokument (body-Kinder: 0, Behälter-Kinder: 0)",
    );
    expect(
      zweiteMeldung,
      "die Meldung nennt nicht mehr die zwei Ursachen, von denen hier keine zutrifft",
    ).toContain("abbauen() lief zweimal auf dieselbe Fläche, oder der Behälter wurde an");

    // (iv) Und die Vorrichtung ist nicht stillgelegt: sie baut danach erneut auf. Das ist zugleich
    // der Weg zurück in einen sauberen Zustand — `flaecheMitFassungen()` setzt `montiert` neu, und
    // der gemeinsame `afterEach` bekommt wieder eine Fläche, die es abzubauen gibt.
    netz.fassungen = [fassung(1, { bodyHtml: MIT_RAUM }), fassung(2, { bodyHtml: OHNE_RAUM })];
    await flaecheMitFassungen();
    expect(
      abschnitt(),
      "die Vorrichtung baut nach einem Abbaufehler in qc.clear() nicht mehr auf",
    ).not.toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
// JOB 3883 · U6 — AUS DER GRENZE IM DATEIKOPF WIRD EIN FALL
// ------------------------------------------------------------------------------------------------
//
// `flaeche.tsx` sagt über sich selbst: „`montiert` ist Modulzustand und gilt deshalb je Testdatei —
// ein Fall, der die Fläche in einem `beforeAll` aufbaute, wäre davon nicht gedeckt." Das war bis
// hierher eine Behauptung: die einzige `beforeAll`-Datei des Ordners
// (`tastatur-im-browser-chromium.test.tsx`) startet dort nur Chromium und baut keine Fläche auf.
// Die Lage war also unerreichbar UND unbewacht.
//
// DIESER BLOCK STELLT SIE HER und misst, was wirklich geschieht: der gemeinsame `afterEach` dieser
// Datei (oben, `abbauen()`) räumt die im `beforeAll` aufgebaute Fläche nach dem ERSTEN Fall ab und
// setzt `montiert` auf `false`. Jeder weitere Fall des Blocks läuft gegen einen leeren `body`, und
// sein `abbauen()` kehrt STILL zurück — die Vorrichtung sagt dazu kein Wort. Wer so aufbaut, misst
// ab dem zweiten Fall an einer Fläche, die nicht mehr da ist.
//
// WARUM `beforeAll` UND NICHT `beforeEach`: mit `beforeEach` verschwindet genau die Lage, um die es
// geht (jeder Fall bekäme seine eigene Fläche). Die Gegenprobe G6 dieser Runde stellt den Block auf
// `beforeEach` um und belegt, dass U6b damit rot wird.
//
// DER BLOCK STEHT GANZ AM ENDE DER DATEI, weil sein `beforeAll` erst beim Eintritt in diesen
// `describe` läuft: die Abschnitte A, B und U1–U5 davor bleiben unberührt — auch U1, das einen
// leeren `body` voraussetzt.
describe("JOB 3883 · U6 — die Fläche im `beforeAll`: der gemeinsame `afterEach` räumt sie nach dem ersten Fall ab", () => {
  beforeAll(async () => {
    netz.fassungen = [fassung(1, { bodyHtml: MIT_RAUM }), fassung(2, { bodyHtml: OHNE_RAUM })];
    await flaecheMitFassungen();
  });

  it("U6a · der erste Fall bekommt die im `beforeAll` aufgebaute Fläche", () => {
    expect(document.body.childElementCount, "die Fläche steht gar nicht im `body`").toBe(1);
    expect(
      abschnitt(),
      "der Abschnitt fehlt auf der im `beforeAll` aufgebauten Fläche",
    ).not.toBeNull();
  });

  it("U6b · der zweite Fall läuft gegen einen leeren `body` — und nichts sagt es ihm", () => {
    // GEMESSEN, nicht vorausgesetzt: der `afterEach` nach U6a hat abgeräumt. Für einen Fall, der
    // sich auf den `beforeAll` verlässt, ist das der stille Verlust — er misst hier an nichts mehr.
    expect(
      document.body.childElementCount,
      "der `afterEach` hat die im `beforeAll` aufgebaute Fläche NICHT abgeräumt — dann misst U6 die Lage nicht mehr",
    ).toBe(0);
    expect(abschnitt(), "der Abschnitt steht noch, obwohl der `body` leer ist").toBeNull();

    // Und `montiert` steht danach auf `false`: der eigene `abbauen()`-Aufruf kehrt STILL zurück,
    // ohne Wurf und ohne Hinweis. Genau das ist die Grenze, die `flaeche.tsx` über sich aussagt.
    abbauen();
    expect(
      [...document.body.children].map((e) => e.tagName),
      "`abbauen()` hat im leeren `body` etwas angefasst",
    ).toEqual([]);
  });
});
