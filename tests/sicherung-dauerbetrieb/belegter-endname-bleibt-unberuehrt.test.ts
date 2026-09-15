// ================================================================================================
// JOB 4057 · L10 (BEN R5, Korrekturpflichten 1–2) — EIN GESCHEITERTER LAUF DARF DIE LETZTE GÜLTIGE
// SICHERUNG NICHT BESCHÄDIGEN. AUCH NICHT IHRE PRÜFSUMME.
// ================================================================================================
//
// DER BEFUND, gemessen von BEN am Stand der Runde 5 — wörtlich:
//
//     BEN BESTAND {"exit":8,"dumpUnveraendert":true,"sidecarUnveraendert":false,"hashPasst":false}
//
// Der Dump war unberührt, der SIDECAR nicht. Die Veröffentlichung schreibt Sidecar zuerst; bei
// gleichem Sekundenstempel landete die NEUE Prüfsumme auf der ALTEN Sicherung, und als danach das
// `mv` des neuen Dumps scheiterte, blieb die Kombination liegen: alter Dump, neue Prüfsumme.
// `restore-drill.sh` bricht dafür mit Exit 11 ab — die gültige Sicherung ist verloren, und nirgends
// stand „gelöscht". Runde 4 hatte nur das LÖSCHEN fremder Sidecars geschlossen, nicht das
// ÜBERSCHREIBEN.
//
// WARUM DER BESTANDSSCHUTZTEST DAS NICHT SAH (BENs zweite Korrekturpflicht): `lauf.ts` schrieb in
// jedem Lauf DIESELBEN Dumpbytes. Ein überschriebener Dump war von einem unberührten nicht zu
// unterscheiden, und die Sidecar-Prüfung verglich denselben Hash mit sich selbst. Seit dieser Runde
// trägt jeder Lauf seine eigene `DUMP_MARKE` — deshalb misst `altInhalt !== neuInhalt` hier zuerst,
// damit der Fall nicht still wieder blind wird.
//
// DIE REGEL, die hier gemessen wird: Ist der Endname belegt, weicht der Lauf auf den nächsten
// freien aus (`_02`, `_03`, …) und schreibt NIE in eine bestehende Dump- oder Prüfsummendatei. Das
// alte Paar bleibt bytegleich — nicht durch sorgfältige Reihenfolge, sondern weil es nicht
// angefasst wird. Ausweichen statt abbrechen, weil beide Sicherungen zählen: zwei Läufe in Folge
// treffen auf einem schnellen Rechner regelmässig dieselbe Sekunde (in dieser Runde gemessen), und
// ein Abbruch wäre dort ein verlorenes Backup.
import { describe, expect, it } from "vitest";
import { folge, sha256 } from "./lauf";

/** Die Sekunde, die beide Läufe teilen — der Kollisionsfall, festgenagelt statt abgewartet. */
const STEMPEL = "20260915T010203Z";
const ENDNAME = `klarwerk-${STEMPEL}.dump`;
/** Die NÄCHSTE Sekunde — für die Fälle, in denen der zweite Lauf gerade NICHT kollidieren soll.
 *  Auch das wird festgenagelt: zwei echte Läufe können auf einem schnellen Rechner dieselbe
 *  Sekunde treffen, und dann prüfte der Fall etwas anderes als er soll. */
const STEMPEL_SPAETER = "20260915T010204Z";

/**
 * Zwei Läufe in derselben Sekunde. Gibt den Bestand nach dem ersten und nach dem zweiten zurück —
 * und stellt sicher, dass die beiden Läufe überhaupt unterscheidbare Bytes erzeugen wollten.
 */
function zweiInDerselbenSekunde(zweiter: Record<string, unknown>) {
  const [erst, dann] = folge({ festerStempel: STEMPEL }, { festerStempel: STEMPEL, ...zweiter });
  if (erst === undefined || dann === undefined) throw new Error("zwei Läufe erwartet");
  expect(erst.code, erst.ausgabe).toBe(0);
  const altDump = erst.inhalt[ENDNAME];
  const altSidecar = erst.inhalt[`${ENDNAME}.sha256`];
  if (altDump === undefined || altSidecar === undefined) {
    throw new Error("vollständiges Paar nach dem ersten Lauf erwartet");
  }
  // Die Prüfsumme des ersten Laufs passt zu seinem Dump — sonst prüft unten nichts.
  expect(altSidecar).toBe(`${sha256(altDump)}  ${ENDNAME}\n`);
  return { erst, dann, altDump, altSidecar };
}

/** Das alte Paar ist vollständig, bytegleich, und die Prüfsumme passt weiterhin zum Dump. */
function altesPaarIstHeil(
  dann: { readonly inhalt: Readonly<Record<string, string>>; readonly ausgabe: string },
  altDump: string,
  altSidecar: string,
) {
  expect(dann.inhalt[ENDNAME], dann.ausgabe).toBe(altDump);
  expect(dann.inhalt[`${ENDNAME}.sha256`], dann.ausgabe).toBe(altSidecar);
  // Und der Hash wird NACHGERECHNET, nicht nur verglichen — das ist BENs `hashPasst`.
  expect(dann.inhalt[`${ENDNAME}.sha256`], dann.ausgabe).toBe(
    `${sha256(String(dann.inhalt[ENDNAME]))}  ${ENDNAME}\n`,
  );
}

describe("L10a · der Prüfstand kann den Schaden überhaupt sehen", () => {
  it("zwei Läufe erzeugen UNTERSCHIEDLICHE Dumpbytes", () => {
    // Ohne diese Zeile wäre alles andere in dieser Datei wertlos: bei gleichen Bytes ist ein
    // überschriebener Dump von einem unberührten nicht zu unterscheiden.
    const [erst, dann] = folge({ festerStempel: STEMPEL }, { festerStempel: STEMPEL_SPAETER });
    if (erst === undefined || dann === undefined) throw new Error("zwei Läufe erwartet");
    const a = erst.dumps[0];
    const b = dann.dumps.find((n) => n !== a);
    if (a === undefined || b === undefined) throw new Error("zwei verschiedene Dumps erwartet");
    expect(dann.inhalt[a]).not.toBe(dann.inhalt[b]);
  });
});

describe("L10b · belegter Endname, zweiter Lauf scheitert beim Veröffentlichen", () => {
  it("BENs Fall: das alte Paar bleibt bytegleich UND die Prüfsumme passt", () => {
    // Genau BENs Aufbau: gleiche Sekunde, andere Bytes, das zweite Veröffentlichungs-`mv` (der
    // Dump) scheitert. Am Stand der Runde 5 kam hier `sidecarUnveraendert: false, hashPasst: false`.
    const { dann, altDump, altSidecar } = zweiInDerselbenSekunde({
      mvFehltBei: ".dump.partial",
      mvFehlerExit: 8,
    });
    expect(dann.code, dann.ausgabe).not.toBe(0);
    altesPaarIstHeil(dann, altDump, altSidecar);
  });

  it("und es bleibt kein Arbeitsstand liegen", () => {
    const { dann } = zweiInDerselbenSekunde({ mvFehltBei: ".dump.partial", mvFehlerExit: 8 });
    expect(
      dann.dateien.filter((n) => n.endsWith(".partial")),
      dann.dateien.join(" "),
    ).toEqual([]);
  });
});

describe("L10c · belegter Endname, zweiter Lauf ohne jede Störung", () => {
  it("er weicht auf einen freien Namen aus und lässt das alte Paar heil", () => {
    // BEIDE Sicherungen zählen. Der zweite Lauf darf die erste nicht anfassen — aber er darf auch
    // nicht einfach ausfallen: zwei Läufe in Folge treffen auf einem schnellen Rechner regelmässig
    // dieselbe Sekunde (in dieser Runde gemessen), und ein Abbruch wäre dann ein verlorenes Backup.
    const { dann, altDump, altSidecar } = zweiInDerselbenSekunde({});
    expect(dann.code, dann.ausgabe).toBe(0);
    altesPaarIstHeil(dann, altDump, altSidecar);
    expect(dann.dumps, dann.dateien.join(" ")).toEqual([ENDNAME, `klarwerk-${STEMPEL}_02.dump`]);
  });

  it("die zweite Sicherung ist ein vollständiges, eigenes Paar", () => {
    const { dann } = zweiInDerselbenSekunde({});
    const zweiter = `klarwerk-${STEMPEL}_02.dump`;
    const inhalt = dann.inhalt[zweiter];
    if (inhalt === undefined) throw new Error("zweite Sicherung erwartet");
    expect(dann.inhalt[`${zweiter}.sha256`], dann.ausgabe).toBe(`${sha256(inhalt)}  ${zweiter}\n`);
    // Und sie trägt wirklich die NEUEN Bytes, ist also keine Kopie der alten.
    expect(inhalt).not.toBe(dann.inhalt[ENDNAME]);
  });

  it("er sagt, dass er ausgewichen ist — und warum", () => {
    const { dann } = zweiInDerselbenSekunde({});
    expect(dann.stderr, dann.ausgabe).toContain("ist fuer diese Sekunde schon vergeben");
    expect(dann.stderr, dann.ausgabe).toContain("NICHT angefasst");
    const e = dann.ergebnis();
    expect(e.ergebnis).toBe("erfolg");
    expect(e.datei).toBe(`klarwerk-${STEMPEL}_02.dump`);
  });

  it("der angekündigte Pfad ist schon der endgültige — der Insel-Aufrufer liest ihn", () => {
    // `scripts/insel/update-einspielen.sh` zieht den Pfad aus der Zeile „[backup] Dump nach: …"
    // und prüft danach Datei und Prüfsumme. Würde hier der Ausgangsname stehen und ein anderer
    // veröffentlicht, bräche der Wartungsweg mit „Dump oder Prüfsumme fehlen".
    const { dann } = zweiInDerselbenSekunde({});
    const zeile = dann.stdout.split("\n").find((z) => z.startsWith("[backup] Dump nach: "));
    if (zeile === undefined) throw new Error("Zeile 'Dump nach' erwartet");
    const pfad = zeile.slice("[backup] Dump nach: ".length);
    expect(pfad.endsWith(`klarwerk-${STEMPEL}_02.dump`), zeile).toBe(true);
  });
});

describe("L10e · ist auch kein Ausweichname frei, wird NICHTS angetastet (Exit 5)", () => {
  it("bei belegtem Grundnamen und _02 bis _99 bleibt der Bestand unberührt", () => {
    // Die Grenze der Ausweichregel, und sie ist ehrlich: lieber kein Backup als ein fremdes
    // überschreiben. 98 belegte Ausweichnamen plus der Grundname.
    const belegt = Array.from(
      { length: 98 },
      (_, i) => `${STEMPEL}_${String(i + 2).padStart(2, "0")}`,
    );
    const [erst, dann] = folge(
      { festerStempel: STEMPEL },
      { festerStempel: STEMPEL, ohneSidecar: belegt },
    );
    if (erst === undefined || dann === undefined) throw new Error("zwei Läufe erwartet");
    const altDump = erst.inhalt[ENDNAME];
    const altSidecar = erst.inhalt[`${ENDNAME}.sha256`];
    if (altDump === undefined || altSidecar === undefined) throw new Error("Paar erwartet");

    expect(dann.code, dann.ausgabe).toBe(5);
    altesPaarIstHeil(dann, altDump, altSidecar);
    const e = dann.ergebnis();
    expect(e.ergebnis).toBe("fehler");
    expect(e.exitcode).toBe(5);
    expect(e.datei).toBeNull();
    expect(String(e.grund)).toContain("keine freie Nummer dieser Sekunde mehr offen");
  });
});

describe("L10d · ein freier Endname wird ganz normal veröffentlicht", () => {
  it("zwei Läufe in VERSCHIEDENEN Sekunden ergeben zwei vollständige Paare", () => {
    // Die Gegenprobe zu L10c: die Regel darf nicht zum Dauerabbruch werden. Eine Sekunde später
    // trifft der zweite Lauf einen freien Namen und läuft durch.
    const [erst, dann] = folge({ festerStempel: STEMPEL }, { festerStempel: STEMPEL_SPAETER });
    if (erst === undefined || dann === undefined) throw new Error("zwei Läufe erwartet");
    expect(erst.code, erst.ausgabe).toBe(0);
    expect(dann.code, dann.ausgabe).toBe(0);
    expect(dann.dumps.length, dann.dateien.join(" ")).toBe(2);
    for (const name of dann.dumps) {
      expect(dann.inhalt[`${name}.sha256`], dann.dateien.join(" ")).toBe(
        `${sha256(String(dann.inhalt[name]))}  ${name}\n`,
      );
    }
  });
});
