// ================================================================================================
// JOB 4227 R3 · L11 (BEN R2, Korrekturpflicht 1) — EIN BESCHÄDIGTES PAAR DARF KEINE GÜLTIGE
// GENERATION VERDRÄNGEN.
// ================================================================================================
//
// DER BEFUND, gemessen von BEN am Stand der Runde 2:
//
//     Bestand: gültiges älteres Paar, jüngeres Paar mit falscher Prüfsumme, neue Sicherung;
//     BACKUP_KEEP=2. Ergebnis: gültiges älteres Paar gelöscht, beschädigtes Paar behalten.
//     Ausgabe trotz nur einer intakten Generation: „Aufbewahrung BACKUP_KEEP=2 — behalten: 2,
//     entfernt: 1", Exit 0.
//
// WARUM DAS DER SCHLIMMSTE DER BISHERIGEN FEHLER IST. Die anderen Befunde dieses Jobs betrafen
// Läufe, die einander ins Wort fielen — sichtbar, sobald man zwei Prozesse gleichzeitig startet.
// Dieser hier braucht keine Gleichzeitigkeit: ein einziger nächtlicher Cron-Lauf genügt. Er meldet
// Erfolg, er meldet die zugesagte Generationenzahl, und er nimmt dabei jede Nacht eine gute
// Sicherung weg und lässt eine kaputte stehen. Am Ende steht `BACKUP_KEEP=14` und **keine**
// wiederherstellbare Datei. Sichtbar wird das erst im Ernstfall, wenn `restore-drill.sh` mit
// Exit 11 abbricht — und dann ist die gute Sicherung, die es daneben gab, längst gelöscht.
//
// DIE REGEL, die hier gemessen wird: Ein Paar zählt erst als Generation, wenn es NACHGERECHNET
// wurde. Beschädigte Paare zählen nicht mit UND werden nicht gelöscht — beides gehört zusammen.
// Wer sie nicht zählt, aber löscht, nimmt dem Betreiber die Reste weg, aus denen vielleicht noch
// etwas zu holen ist.
import { describe, expect, it } from "vitest";
import { altInhalt, lauf, sha256, sidecarZeile } from "./lauf";

/** Der gültige ältere Stand — der, den BEN verloren hat. */
const ALT_GUT = "20260901T010000Z";
/** Der jüngere, beschädigte — der, der ihn verdrängt hat. */
const ALT_KAPUTT = "20260902T010000Z";

const GUT_DUMP = `klarwerk-${ALT_GUT}.dump`;
const KAPUTT_DUMP = `klarwerk-${ALT_KAPUTT}.dump`;

describe("L11a · BENs Fall, wörtlich: falscher Hash im jüngeren Altpaar", () => {
  /** Genau BENs Aufbau. Die neue Sicherung dieses Laufs ist die dritte. */
  function benslage() {
    return lauf({
      keep: "2",
      altstempel: [ALT_GUT],
      beschaedigt: [{ stempel: ALT_KAPUTT, art: "hash" }],
    });
  }

  it("der gültige ältere Stand bleibt — er wird NICHT für das kaputte Paar geopfert", () => {
    const r = benslage();
    expect(r.code, r.ausgabe).toBe(0);
    // Die Kernzeile: der Dump, den BEN verloren hat, liegt bytegleich da.
    expect(r.inhalt[GUT_DUMP], r.dateien.join(" ")).toBe(altInhalt(ALT_GUT));
    expect(r.inhalt[`${GUT_DUMP}.sha256`], r.dateien.join(" ")).toBe(
      sidecarZeile(altInhalt(ALT_GUT), GUT_DUMP),
    );
  });

  it("das beschädigte Paar wird auch nicht gelöscht — es bleibt unangetastet liegen", () => {
    const r = benslage();
    expect(r.dateien, r.dateien.join(" ")).toContain(KAPUTT_DUMP);
    expect(r.dateien, r.dateien.join(" ")).toContain(`${KAPUTT_DUMP}.sha256`);
    expect(r.inhalt[KAPUTT_DUMP], r.dateien.join(" ")).toBe(altInhalt(ALT_KAPUTT));
  });

  it("es zählt NICHT als Generation — und die Zahl in der Ausgabe sagt das", () => {
    // BENs Satz war „behalten: 2" bei EINER wiederherstellbaren Sicherung. Heile Generationen sind
    // hier: der gute Altstand und die neue Sicherung — also genau zwei, und das kaputte Paar
    // steht daneben statt mitgezählt.
    const r = benslage();
    expect(r.stdout, r.ausgabe).toContain("heile Sicherungen behalten: 2");
    expect(r.ausgabe).toContain("BESCHAEDIGT");
    expect(r.ausgabe).toContain("die Pruefsumme passt nicht zum Dump");
  });

  it("und der Betreiber erfährt es dort, wo er nachsieht: in der Ergebnisspur", () => {
    // stderr landet im Cron-Log, das niemand liest — genau dagegen ist `letzter-lauf.json` gebaut.
    const r = benslage();
    const e = r.ergebnis();
    // Der LAUF ist erfolgreich: seine eigene Sicherung liegt vollständig da. Der Befund gilt dem
    // BESTAND, und beides wird auseinandergehalten statt vermischt.
    expect(e.ergebnis).toBe("erfolg");
    expect(String(e.grund)).toContain("Befund am Bestand");
    expect(String(e.grund)).toContain("1 beschaedigte(s) Paar(e)");
  });

  it("alle drei Dateien liegen am Ende da — nichts ist verschwunden", () => {
    const r = benslage();
    expect(r.dumps.length, r.dateien.join(" ")).toBe(3);
  });
});

describe("L11b · dieselbe Regel für die anderen beiden Schadensarten", () => {
  // Die Prüfsumme kann auf drei Arten nicht zum Dump gehören, und alle drei kommen im Betrieb vor.
  const faelle = [
    { art: "form", was: "abgeschnittene Prüfsummendatei", grund: "nicht die zugesagte Form" },
    { art: "fremder-name", was: "Prüfsumme eines anderen Dumps", grund: "nennt" },
  ] as const;

  for (const fall of faelle) {
    it(`${fall.was}: der gültige Altstand bleibt, das kaputte Paar zählt nicht`, () => {
      const r = lauf({
        keep: "2",
        altstempel: [ALT_GUT],
        beschaedigt: [{ stempel: ALT_KAPUTT, art: fall.art }],
      });
      expect(r.code, r.ausgabe).toBe(0);
      expect(r.inhalt[GUT_DUMP], r.dateien.join(" ")).toBe(altInhalt(ALT_GUT));
      expect(r.dateien, r.dateien.join(" ")).toContain(KAPUTT_DUMP);
      expect(r.stdout, r.ausgabe).toContain("heile Sicherungen behalten: 2");
      expect(r.ausgabe, r.ausgabe).toContain(fall.grund);
    });
  }
});

describe("L11c · die Gegenprobe: heile Paare werden weiterhin ganz normal geräumt", () => {
  it("drei heile Altstände, BACKUP_KEEP=2 — der älteste geht, kein Befund wird gemeldet", () => {
    // Ohne diese Zeile wäre L11 ein Freibrief: eine Aufbewahrung, die aus lauter Vorsicht nie mehr
    // löscht, hält die Zusage `BACKUP_KEEP` genauso wenig ein wie eine, die zu viel löscht.
    const r = lauf({
      keep: "2",
      altstempel: ["20260901T010000Z", "20260902T010000Z", "20260903T010000Z"],
    });
    expect(r.code, r.ausgabe).toBe(0);
    expect(r.dumps.length, r.dateien.join(" ")).toBe(2);
    expect(r.dumps, r.dateien.join(" ")).not.toContain("klarwerk-20260901T010000Z.dump");
    expect(r.ausgabe).not.toContain("BESCHAEDIGT");
    expect(String(r.ergebnis().grund)).not.toContain("Befund am Bestand");
  });

  it("unterhalb der Grenze wird gar nicht erst nachgerechnet — und nichts gelöscht", () => {
    // Die Messgrenze der Kostenentscheidung, festgehalten statt nur behauptet: liegt die Zahl der
    // Kandidaten nicht über `KEEP`, kann nichts gelöscht werden, also wird auch kein Altdump
    // gelesen. Ein beschädigtes Paar bleibt dann unbemerkt — und unangetastet.
    const r = lauf({ keep: "5", beschaedigt: [{ stempel: ALT_KAPUTT, art: "hash" }] });
    expect(r.code, r.ausgabe).toBe(0);
    expect(r.dateien, r.dateien.join(" ")).toContain(KAPUTT_DUMP);
    expect(r.ausgabe).not.toContain("BESCHAEDIGT");
  });
});

// ================================================================================================
// JOB 4227 R4 · L12 (BEN R3, Korrekturpflicht 1) — WAS NICHT NACHGERECHNET WURDE, HEISST NICHT HEIL.
// ================================================================================================
//
// DER BEFUND, gemessen von BEN am Stand der Runde 3: ein beschädigtes Altpaar plus die neue
// Sicherung ergeben genau EIN wiederherstellbares Paar. Trotzdem stand da, bei `BACKUP_KEEP=2`
// und ebenso bei `BACKUP_KEEP=5`:
//
//     Aufbewahrung BACKUP_KEEP=2 — heile Sicherungen behalten: 2, nichts zu tun.
//
// Runde 3 hatte die Nachrechnung aus Kostengründen ausgelassen, wenn ohnehin nichts zu löschen ist
// — und die Aussage darüber stehen gelassen. Das ist dieselbe Sorte Fehler wie eine erfundene
// Sicherung, nur eine Ebene höher: eine erfundene EIGENSCHAFT von Sicherungen. Der Betreiber liest
// „heil" und hat es nicht.
//
// DIE REGEL, die hier gemessen wird: Jede Zahl trägt das Wort, das zu ihr gehört. „heile
// Sicherungen" nur nach der Rechnung; sonst „vorhandene Sicherungspaare — NICHT nachgerechnet".
describe("L12 · keine Heilheitsaussage ohne Rechnung", () => {
  /**
   * DIE UNABHÄNGIGE ZÄHLUNG (BENs Prüflücke 6, wörtlich: „tatsächliche Hashintegrität unabhängig
   * zählen und gegen jede behauptete Zahl heiler Generationen halten").
   *
   * Sie rechnet hier im Test nach — ohne das Skript zu fragen —, wie viele Paare im Zielverzeichnis
   * wirklich heil sind: Sidecar lesbar, Form `<64 Hex>  <eigener Name>`, Hash passt zum Dump.
   */
  function wirklichHeil(r: {
    readonly dumps: readonly string[];
    readonly inhalt: Readonly<Record<string, string>>;
  }): number {
    let zahl = 0;
    for (const dump of r.dumps) {
      const dumpInhalt = r.inhalt[dump];
      const seite = r.inhalt[`${dump}.sha256`];
      if (dumpInhalt === undefined || seite === undefined) continue;
      if (seite === `${sha256(dumpInhalt)}  ${dump}\n`) zahl += 1;
    }
    return zahl;
  }

  /**
   * Der Wächter: Behauptet die Ausgabe eine Zahl HEILER Sicherungen, muss sie der unabhängig
   * nachgerechneten entsprechen. Behauptet sie keine, darf im Text auch nirgends „heil" stehen.
   */
  function keineErfundeneHeilheit(r: {
    readonly ausgabe: string;
    readonly dumps: readonly string[];
    readonly inhalt: Readonly<Record<string, string>>;
  }) {
    const behauptet = /heile Sicherungen behalten: (\d+)/.exec(r.ausgabe);
    if (behauptet === null) {
      expect(r.ausgabe, r.ausgabe).not.toContain("heile Sicherungen");
      return;
    }
    expect(Number(behauptet[1]), `behauptet: ${behauptet[0]} · ${r.ausgabe}`).toBe(wirklichHeil(r));
  }

  // BENs beide Grenzfälle: zwei Paare, davon eines beschädigt — einmal genau an der Grenze
  // (`KEEP=2`, Kandidaten = KEEP) und einmal darunter (`KEEP=5`).
  for (const keep of ["2", "5"] as const) {
    it(`BACKUP_KEEP=${keep}: ein beschädigtes Altpaar wird NICHT als heile Generation gemeldet`, () => {
      const r = lauf({ keep, beschaedigt: [{ stempel: ALT_KAPUTT, art: "hash" }] });
      expect(r.code, r.ausgabe).toBe(0);
      // Zwei Paare liegen da, EINES davon ist wiederherstellbar — die neue Sicherung.
      expect(r.dumps.length, r.dateien.join(" ")).toBe(2);
      expect(wirklichHeil(r), r.dateien.join(" ")).toBe(1);
      // Und genau das sagt der Lauf: keine Zahl heiler Sicherungen, sondern das Eingeständnis.
      keineErfundeneHeilheit(r);
      expect(r.stdout, r.ausgabe).toContain("vorhandene Sicherungspaare: 2");
      expect(r.stdout, r.ausgabe).toContain("NICHT nachgerechnet");
      // Auch dort, wo der Betreiber wirklich nachsieht.
      expect(String(r.ergebnis().grund)).toContain("NICHT nachgerechnet");
    });
  }

  it("wo nachgerechnet WURDE, steht die Zahl heiler Sicherungen — und sie stimmt", () => {
    // Die Gegenprobe: ohne sie wäre die Regel mit einem pauschalen „sag nie heil" erfüllbar, und
    // der Betreiber erführe nie, dass sein Bestand geprüft ist.
    const r = lauf({
      keep: "2",
      altstempel: [ALT_GUT],
      beschaedigt: [{ stempel: ALT_KAPUTT, art: "hash" }],
    });
    expect(r.code, r.ausgabe).toBe(0);
    expect(r.stdout, r.ausgabe).toContain("heile Sicherungen behalten: 2");
    expect(r.stdout, r.ausgabe).not.toContain("NICHT nachgerechnet");
    keineErfundeneHeilheit(r);
  });

  it("der Wächter gilt für jede Lage dieser Datei, nicht nur für die beiden Grenzfälle", () => {
    // Dieselbe Prüfung über die übrigen Aufbauten — damit keine künftige Meldung sich an einem
    // ungeprüften Zweig vorbeischleicht.
    const lagen = [
      lauf({ keep: "1" }),
      lauf({ keep: "2", altstempel: [ALT_GUT] }),
      lauf({ keep: "2", altstempel: [ALT_GUT, "20260903T010000Z", "20260904T010000Z"] }),
      lauf({ keep: "3", beschaedigt: [{ stempel: ALT_KAPUTT, art: "form" }] }),
      lauf({ keep: "1", beschaedigt: [{ stempel: ALT_KAPUTT, art: "fremder-name" }] }),
    ];
    for (const r of lagen) {
      expect(r.code, r.ausgabe).toBe(0);
      keineErfundeneHeilheit(r);
    }
  });
});

describe("L11d · der Prüfstand kann den Schaden überhaupt sehen", () => {
  it("die beschädigte Prüfsummendatei ist wirklich beschädigt", () => {
    // Ohne diese Zeile wäre alles andere hier wertlos — so wie L10a im Nachbartest.
    const r = lauf({ keep: "5", beschaedigt: [{ stempel: ALT_KAPUTT, art: "hash" }] });
    const seite = r.inhalt[`${KAPUTT_DUMP}.sha256`];
    if (seite === undefined) throw new Error("Prüfsummendatei erwartet");
    expect(seite).toMatch(/^[0-9a-f]{64} {2}klarwerk-/);
    expect(seite).not.toBe(sidecarZeile(altInhalt(ALT_KAPUTT), KAPUTT_DUMP));
    expect(seite.slice(0, 64)).not.toBe(sha256(altInhalt(ALT_KAPUTT)));
  });
});
