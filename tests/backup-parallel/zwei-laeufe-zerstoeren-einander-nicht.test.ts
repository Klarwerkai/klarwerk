// ================================================================================================
// JOB 4227 · P1 — ZWEI GLEICHZEITIGE SICHERUNGEN ZERSTÖREN EINANDER NICHT.
// ================================================================================================
//
// DER ZUSTAND VORHER, wörtlich aus dem eigenen Code (`backup.sh`, Runde 4057/7):
//
//     „Ein Restrisiko bleibt und wird nicht verschwiegen: zwischen dieser Pruefung und dem `mv`
//      liegt ein Augenblick, in dem ein dritter Lauf dazwischengehen koennte. `mv` allein kann das
//      nicht ausschliessen — dafuer braeuchte es eine Sperrdatei, und die waere eine
//      Verhaltensaenderung ausserhalb dieses Auftrags."
//
// Und der Prüfer hat denselben Punkt offen gelassen (`archiv/4057/runde-7/ben.md:30`):
// „Tatsächlich parallele Läufe bleiben ungemessen." Diese Datei misst sie.
//
// DER ROTE LAUF, gemessen mit wieder eingesetzter zweistufiger Prüfung (Cloud-Lauf
// `38a0e35b37ea4a94831ba8340a13c48f`): `Tests 7 failed | 7 passed (14)`. Wörtlich:
//
//     ×  P1c · zwei Läufe, zwei Sicherungen — oder ein ehrlicher Verlierer
//     ×  P1d · die beiden Dumps tragen VERSCHIEDENE Bytes
//        → AssertionError: expected +0 to be 2 // Object.is equality
//     ×  P2a · Abbruch ZWISCHEN Sidecar und Dump: der andere Lauf verliert nichts
//     ×  P2c · Abbruch NACH der Reservierung durch ein echtes Signal
//     ×  P3a/P3b/P3c · die Aufbewahrung unter Parallelbetrieb
//
// Und so sah der Schaden im Verzeichnis aus, ebenfalls wörtlich aus diesem Lauf:
//
//     [backup] Dump nach: …/ziel/klarwerk-20260916T044455Z.dump
//     /usr/bin/mv: cannot stat '…/ziel/klarwerk-20260916T044455Z.dump.partial': No such file …
//     [backup] ABBRUCH (Exit 1) an unerwarteter Stelle (Exit 1).
//
// BEIDE LÄUFE ZIELTEN AUF DENSELBEN ENDNAMEN — und damit auch auf denselben Arbeitsnamen
// (`STAGE="${OUT}.partial"`). Sie schrieben ihren `pg_dump` in DIESELBE Datei, lasen ihre Prüfsumme
// aus DERSELBEN Datei und veröffentlichten DIESELBE Datei. Wer zuerst umbenannte, nahm sie dem
// anderen weg; in einem anderen Lauf derselben Serie las der eine Prozess die Bytes des anderen und
// beglaubigte sie als seine (`P1d`: null unterscheidbare Dumps statt zwei). Von zwei angeforderten
// Sicherungen blieb eine — und welche Daten in ihr stehen, entschied das Rennen.
//
// WIE DER FALL AUFGEBAUT IST, steht im Kopf von `parallel-lauf.ts`: zwei ECHTE gleichzeitige
// Prozesse, feste Treffpunkte, und dahinter eine der Verschränkungen, die der alte Code zuliess
// (Sidecar A → Sidecar B → Dump B → Dump A).
import { describe, expect, it } from "vitest";
import {
  GRUNDNAME,
  type ParallelErgebnis,
  STEMPEL,
  altInhalt,
  dumpGehoertZuLauf,
  fremdInhalt,
  fremderArbeitsstandName,
  paarIstStimmig,
  parallelLauf,
  sha256,
} from "./parallel-lauf";

/** Zwei Prozesse brauchen zwei Treffpunkte und echte Prozessstarts — das dauert länger als 5 s. */
const FRIST = 90_000;

const INHALT_A = "PGDMP lauf a\n";
const INHALT_B = "PGDMP lauf b\n";

const ZWEI = [
  { rolle: "a", inhalt: INHALT_A },
  { rolle: "b", inhalt: INHALT_B },
] as const;

/**
 * Die Grundzusage, an jedem Fall dieser Datei geprüft: WAS EIN LAUF MELDET, STIMMT.
 *
 * Meldet er Erfolg, liegt unter dem Namen, den er angekündigt hat, SEIN Dump — nicht der eines
 * anderen —, die Prüfsumme daneben passt zu genau diesem Dump, und die Summe, die er auf stdout
 * nennt, ist dieselbe. Meldet er keinen Erfolg, behauptet er auch keine Datei.
 */
function jederErfolgIstWahr(ergebnis: ParallelErgebnis) {
  for (const lauf of ergebnis.laeufe) {
    if (lauf.code !== 0) {
      // Ein Verlierer darf keine Sicherung für sich reklamieren.
      expect(lauf.stdout, lauf.ausgabe).not.toContain("[backup] fertig —");
      continue;
    }
    const name = lauf.angekuendigterName;
    expect(name, `Lauf ${lauf.rolle} meldet Erfolg ohne Dateinamen: ${lauf.ausgabe}`).toBeDefined();
    if (name === undefined) continue;
    // Der Dump unter dem angekündigten Namen trägt die Bytes GENAU DIESES Laufs.
    expect(ergebnis.inhalt[name], `Lauf ${lauf.rolle}: ${ergebnis.dateien.join(" ")}`).toBe(
      lauf.inhalt,
    );
    // Und sein Sidecar ist der zu diesen Bytes nachgerechnete.
    expect(ergebnis.inhalt[`${name}.sha256`], `Lauf ${lauf.rolle}: ${lauf.ausgabe}`).toBe(
      `${sha256(lauf.inhalt)}  ${name}\n`,
    );
    // Die Summe auf stdout ist dieselbe — die Meldung zitiert nicht etwas anderes als die Datei.
    expect(lauf.gemeldeteSumme, lauf.ausgabe).toBe(sha256(lauf.inhalt));
    expect(dumpGehoertZuLauf(ergebnis, lauf)).toBe(true);
  }
}

/** Jedes `*.dump` im Verzeichnis hat seinen passenden, nachgerechneten Sidecar. */
function jedesPaarIstStimmig(ergebnis: ParallelErgebnis) {
  for (const dump of ergebnis.dumps) {
    expect(paarIstStimmig(ergebnis, dump), `${dump}: ${ergebnis.dateien.join(" ")}`).toBe(true);
  }
}

/**
 * Der Treffpunkt hat getragen — sonst misst der Fall etwas anderes, als er behauptet.
 *
 * DIESE ZEILE GEHÖRT IN JEDEN FALL DIESER DATEI. In Runde 2 sassen P4 und P5 je dreissig Sekunden
 * eine Wartefrist ab, weil ein Prüfstandsteil auf einen Prozess wartete, den es in diesem Aufbau
 * gar nicht gab. Die Fälle waren grün und massen trotzdem nicht, was sie sollten — genau die Sorte
 * stiller Fehler, gegen die dieses Paket gebaut ist.
 */
function treffpunktHatGetragen(ergebnis: ParallelErgebnis) {
  expect(ergebnis.fristabläufe, ergebnis.fristabläufe.join(" ")).toEqual([]);
}

describe("P1 · zwei gleichzeitige Läufe, gleiche Sekunde, verschiedene Daten", () => {
  it(
    "P1a · jeder gemeldete Erfolg hat seinen eigenen Dump",
    async () => {
      const ergebnis = await parallelLauf(ZWEI);
      treffpunktHatGetragen(ergebnis);
      jederErfolgIstWahr(ergebnis);
    },
    FRIST,
  );

  it(
    "P1b · jedes veröffentlichte Paar passt zu sich selbst",
    async () => {
      // Der Schaden des alten Standes in einer Zeile: Dump von A, Prüfsumme von B. Am Namen ist das
      // nicht zu sehen, `restore-drill.sh` bricht dafür mit Exit 11 ab.
      const ergebnis = await parallelLauf(ZWEI);
      treffpunktHatGetragen(ergebnis);
      jedesPaarIstStimmig(ergebnis);
    },
    FRIST,
  );

  it(
    "P1c · zwei Läufe, zwei Sicherungen — oder ein ehrlicher Verlierer",
    async () => {
      const ergebnis = await parallelLauf(ZWEI);
      treffpunktHatGetragen(ergebnis);
      const erfolge = ergebnis.laeufe.filter((l) => l.code === 0);
      // Zwei Erfolge heissen zwingend zwei verschiedene Namen; ein Erfolg heisst, dass der andere
      // Lauf ehrlich gescheitert ist. Was NICHT sein darf: zwei Erfolge unter EINEM Namen.
      const namen = new Set(erfolge.map((l) => l.angekuendigterName));
      expect(namen.size, ergebnis.laeufe.map((l) => l.ausgabe).join("\n")).toBe(erfolge.length);
      expect(ergebnis.dumps.length, ergebnis.dateien.join(" ")).toBe(erfolge.length);
      // Und in diesem Aufbau — beide Läufe gesund, beide Namen frei — sind es wirklich zwei.
      expect(erfolge.length, ergebnis.laeufe.map((l) => l.ausgabe).join("\n")).toBe(2);
      expect(ergebnis.dumps.length).toBe(2);
    },
    FRIST,
  );

  it(
    "P1d · die beiden Dumps tragen VERSCHIEDENE Bytes — sonst sähe der Prüfstand nichts",
    async () => {
      // Ohne diese Zeile wäre alles andere hier wertlos: bei gleichem Inhalt ist ein
      // überschriebener Dump von einem unberührten nicht zu unterscheiden.
      const ergebnis = await parallelLauf(ZWEI);
      const inhalte = ergebnis.dumps.map((n) => ergebnis.inhalt[n]);
      expect(new Set(inhalte).size, inhalte.join(" | ")).toBe(2);
      expect(inhalte.sort()).toEqual([INHALT_A, INHALT_B].sort());
    },
    FRIST,
  );

  it(
    "P1e · keine Reservierung bleibt liegen, kein Arbeitsstand bleibt liegen",
    async () => {
      const ergebnis = await parallelLauf(ZWEI);
      expect(ergebnis.reservierungen, ergebnis.dateien.join(" ")).toEqual([]);
      expect(
        ergebnis.dateien.filter((n) => n.endsWith(".partial")),
        ergebnis.dateien.join(" "),
      ).toEqual([]);
    },
    FRIST,
  );

  it(
    "P1f · der angekündigte Pfad ist schon der endgültige — der Insel-Aufrufer liest ihn",
    async () => {
      // `scripts/insel/update-einspielen.sh` zieht den Pfad aus „[backup] Dump nach: …" und prüft
      // danach Datei und Prüfsumme. Bekäme er unter Last einen Namen genannt und fände einen
      // anderen, bräche der Wartungsweg mit „Dump oder Prüfsumme fehlen".
      const ergebnis = await parallelLauf(ZWEI);
      for (const lauf of ergebnis.laeufe) {
        if (lauf.code !== 0) continue;
        expect(lauf.angekuendigt, lauf.ausgabe).toBeDefined();
        expect(ergebnis.dumps, ergebnis.dateien.join(" ")).toContain(lauf.angekuendigterName);
      }
    },
    FRIST,
  );
});

describe("P2 · Abbruchfälle im Parallelbetrieb — fremder Bestand bleibt heil", () => {
  it(
    "P2a · Abbruch ZWISCHEN Sidecar und Dump: der andere Lauf verliert nichts",
    async () => {
      // Lauf b scheitert genau am zweiten `mv` der Veröffentlichung — sein Sidecar liegt dann schon
      // unter seinem Endnamen, sein Dump nicht. Der Aufräumzweig darf genau diesen einen Sidecar
      // wegnehmen und nichts sonst.
      const ergebnis = await parallelLauf([
        { rolle: "a", inhalt: INHALT_A },
        { rolle: "b", inhalt: INHALT_B, mvFehltBei: ".dump.partial", mvFehlerExit: 8 },
      ]);
      const a = ergebnis.nach("a");
      const b = ergebnis.nach("b");
      expect(a.code, a.ausgabe).toBe(0);
      expect(b.code, b.ausgabe).toBe(8);
      // Der gesunde Lauf hat sein vollständiges, stimmiges Paar.
      jederErfolgIstWahr(ergebnis);
      jedesPaarIstStimmig(ergebnis);
      // Und der gescheiterte hat nichts hinterlassen: kein Sidecar ohne Dump, kein Arbeitsstand,
      // keine Reservierung.
      expect(ergebnis.dumps.length, ergebnis.dateien.join(" ")).toBe(1);
      expect(
        ergebnis.dateien.filter((n) => n.endsWith(".sha256")).length,
        ergebnis.dateien.join(" "),
      ).toBe(1);
      expect(ergebnis.reservierungen, ergebnis.dateien.join(" ")).toEqual([]);
    },
    FRIST,
  );

  it(
    "P2b · Abbruch VOR der Reservierung: der andere Lauf bekommt den Grundnamen",
    async () => {
      // Lauf b bricht ab, bevor überhaupt ein Name vergeben wird (keine DB-URL, Exit 1). Er darf
      // weder einen Namen verbrauchen noch etwas hinterlassen.
      const ergebnis = await parallelLauf([
        { rolle: "a", inhalt: INHALT_A },
        { rolle: "b", inhalt: INHALT_B, dbUrl: null },
      ]);
      const a = ergebnis.nach("a");
      const b = ergebnis.nach("b");
      expect(b.code, b.ausgabe).toBe(1);
      expect(a.code, a.ausgabe).toBe(0);
      expect(a.angekuendigterName, a.ausgabe).toBe(GRUNDNAME);
      jederErfolgIstWahr(ergebnis);
      expect(ergebnis.reservierungen, ergebnis.dateien.join(" ")).toEqual([]);
    },
    FRIST,
  );

  it(
    "P2c · Abbruch NACH der Reservierung durch ein echtes Signal: nichts Fremdes geht verloren",
    async () => {
      // Lauf b hält seine Reservierung und bekommt SIGTERM. Ohne eigene Signalbehandlung liefe die
      // EXIT-Falle gar nicht — Arbeitsstand und Reservierung blieben liegen.
      const ergebnis = await parallelLauf([
        { rolle: "a", inhalt: INHALT_A },
        { rolle: "b", inhalt: INHALT_B, abbruchSignal: "SIGTERM" },
      ]);
      const a = ergebnis.nach("a");
      const b = ergebnis.nach("b");
      expect(a.code, a.ausgabe).toBe(0);
      expect(
        b.code === 143 || b.signal === "SIGTERM",
        `${b.code} / ${b.signal}: ${b.ausgabe}`,
      ).toBe(true);
      jederErfolgIstWahr(ergebnis);
      jedesPaarIstStimmig(ergebnis);
      // Der abgebrochene Lauf hat NICHTS hinterlassen — auch seine eigene Reservierung nicht.
      expect(ergebnis.reservierungen, ergebnis.dateien.join(" ")).toEqual([]);
      expect(
        ergebnis.dateien.filter((n) => n.endsWith(".partial")),
        ergebnis.dateien.join(" "),
      ).toEqual([]);
      // Und er sagt, was ihn beendet hat — ein Signal ist kein fehlgeschlagenes Werkzeug.
      expect(b.stderr, b.ausgabe).toContain("Signal SIGTERM");
    },
    FRIST,
  );

  it(
    "P2d · ein Altbestand überlebt jeden dieser Abbrüche bytegleich",
    async () => {
      const ALT = "20260101T000000Z";
      const ergebnis = await parallelLauf(
        [
          { rolle: "a", inhalt: INHALT_A, abbruchSignal: "SIGINT" },
          { rolle: "b", inhalt: INHALT_B, mvFehltBei: ".dump.partial", mvFehlerExit: 8 },
        ],
        [{ stempel: ALT }],
      );
      // Beide Läufe scheitern — und trotzdem liegt der Altbestand unverändert da, mit passender
      // Prüfsumme. Das ist die Zusage aus §1: kein Lauf entfernt die gültige Sicherung eines anderen.
      expect(ergebnis.inhalt[`klarwerk-${ALT}.dump`], ergebnis.dateien.join(" ")).toBe(
        altInhalt(ALT),
      );
      expect(ergebnis.inhalt[`klarwerk-${ALT}.dump.sha256`], ergebnis.dateien.join(" ")).toBe(
        `${sha256(altInhalt(ALT))}  klarwerk-${ALT}.dump\n`,
      );
      expect(ergebnis.reservierungen, ergebnis.dateien.join(" ")).toEqual([]);
    },
    FRIST,
  );
});

describe("P3 · die Aufbewahrung unter Parallelbetrieb", () => {
  const ALT1 = "20260101T000000Z";
  const ALT2 = "20260102T000000Z";

  it(
    "P3a · BACKUP_KEEP=1: beide Läufe räumen gleichzeitig auf und löschen einander NICHT",
    async () => {
      // DER SCHADEN OHNE ZUSAGE (e)/(f): A darf seinen eigenen Stand nicht löschen, geht eine Zeile
      // weiter und nimmt den von B; B tut spiegelbildlich dasselbe. Zwei Erfolgsmeldungen, null
      // Sicherungen. Der Treffpunkt T3 hält beide gleichzeitig in der Aufbewahrung fest.
      const ergebnis = await parallelLauf(
        [
          { rolle: "a", inhalt: INHALT_A, keep: "1", treffpunktAufbewahrung: true },
          { rolle: "b", inhalt: INHALT_B, keep: "1", treffpunktAufbewahrung: true },
        ],
        [{ stempel: ALT1 }],
      );
      treffpunktHatGetragen(ergebnis);
      jederErfolgIstWahr(ergebnis);
      jedesPaarIstStimmig(ergebnis);
      // Beide neuen Sicherungen liegen da. Die alte ist weg — das ist die Aufbewahrung, die wirkt.
      expect(ergebnis.dumps.length, ergebnis.dateien.join(" ")).toBe(2);
      expect(ergebnis.dumps, ergebnis.dateien.join(" ")).not.toContain(`klarwerk-${ALT1}.dump`);
    },
    FRIST,
  );

  it(
    "P3b · BACKUP_KEEP=1: beide Schutzgründe werden genannt, nicht verschwiegen",
    async () => {
      // EHRLICHKEIT VOR OPTIK: es gab mehr zu entfernen, als entfernt wurde. Beide Gründe stehen in
      // der Ausgabe, und sie sind verschieden:
      //   · der Lauf mit dem GRUNDNAMEN sieht `_02` als JÜNGER an — Zusage (f);
      //   · der Lauf mit `_02` sieht zum Grundnamen eine RESERVIERUNG liegen — Zusage (e).
      // Zusammen schliessen sie den Fall „zwei Erfolge, keine Sicherung" auf beiden Seiten.
      const ergebnis = await parallelLauf(
        [
          { rolle: "a", inhalt: INHALT_A, keep: "1", treffpunktAufbewahrung: true },
          { rolle: "b", inhalt: INHALT_B, keep: "1", treffpunktAufbewahrung: true },
        ],
        [{ stempel: ALT1 }],
      );
      const alleAusgaben = ergebnis.laeufe.map((l) => l.ausgabe).join("\n");
      expect(alleAusgaben, alleAusgaben).toContain("wird NICHT entfernt — zu diesem Namen liegt");
      expect(alleAusgaben, alleAusgaben).toContain("ist JUENGER als die soeben veroeffentlichte");
      // Und der Erfolg bleibt ein Erfolg: die Sicherung liegt, nur das Aufräumen blieb offen. Das
      // steht so in der Ergebnisspur, die der Betreiber liest.
      expect(ergebnis.ergebnisRoh, String(ergebnis.ergebnisRoh)).toContain(
        "Aufbewahrung unvollstaendig",
      );
      expect(ergebnis.ergebnisRoh, String(ergebnis.ergebnisRoh)).toContain('"ergebnis": "erfolg"');
    },
    FRIST,
  );

  it(
    "P3c · BACKUP_KEEP=2: die zwei Altstände gehen, die zwei neuen bleiben",
    async () => {
      const ergebnis = await parallelLauf(
        [
          { rolle: "a", inhalt: INHALT_A, keep: "2", treffpunktAufbewahrung: true },
          { rolle: "b", inhalt: INHALT_B, keep: "2", treffpunktAufbewahrung: true },
        ],
        [{ stempel: ALT1 }, { stempel: ALT2 }],
      );
      treffpunktHatGetragen(ergebnis);
      jederErfolgIstWahr(ergebnis);
      jedesPaarIstStimmig(ergebnis);
      expect(ergebnis.dumps.length, ergebnis.dateien.join(" ")).toBe(2);
      for (const alt of [ALT1, ALT2]) {
        expect(ergebnis.dateien, ergebnis.dateien.join(" ")).not.toContain(`klarwerk-${alt}.dump`);
        expect(ergebnis.dateien, ergebnis.dateien.join(" ")).not.toContain(
          `klarwerk-${alt}.dump.sha256`,
        );
      }
    },
    FRIST,
  );

  it(
    "P3d · der `*.partial` eines dritten Laufs wird auch im Parallelbetrieb nie angefasst",
    async () => {
      // BENs Befund an der Runde-1-Fassung dieses Falls: er legte gar keinen fremden Arbeitsstand
      // an. „Keine `.partial` übrig" belegte damit nur, dass die beiden Läufe ihre eigenen
      // aufgeräumt hatten — über den Schutz FREMDER sagte er nichts. Jetzt liegt einer da, mit
      // Inhalt, und zwar unter genau dem Namen, den ein Lauf dieser Sekunde früher selbst
      // verwendet hätte.
      const fremd = { stempel: STEMPEL } as const;
      const ergebnis = await parallelLauf(
        [
          { rolle: "a", inhalt: INHALT_A, keep: "1", treffpunktAufbewahrung: true },
          { rolle: "b", inhalt: INHALT_B, keep: "1", treffpunktAufbewahrung: true },
        ],
        [{ stempel: ALT1 }],
        [fremd],
      );
      const name = fremderArbeitsstandName(fremd);
      expect(ergebnis.dateien, ergebnis.dateien.join(" ")).toContain(name);
      expect(ergebnis.inhalt[name], ergebnis.dateien.join(" ")).toBe(fremdInhalt(fremd));
      expect(ergebnis.inhalt[`${name}.sha256`], ergebnis.dateien.join(" ")).toBe(
        `${sha256(fremdInhalt(fremd))}  ${name}\n`,
      );
      // Der EIGENE Arbeitsstand beider Läufe ist weg — und er lag nie im Zielverzeichnis.
      expect(
        ergebnis.dateien.filter((n) => n.endsWith(".partial") && n !== name),
        ergebnis.dateien.join(" "),
      ).toEqual([]);
      expect(ergebnis.reservierungen, ergebnis.dateien.join(" ")).toEqual([]);
    },
    FRIST,
  );
});

describe("P4 · die Staffel — die Pause ZWISCHEN Bestandsfrage und Reservierung", () => {
  // ==============================================================================================
  // BENs gemessene Verschränkung (4227 R1, Korrekturpflicht 1), in einem Satz:
  //
  //     A sieht den Namen frei · B reserviert, veröffentlicht, gibt frei · A reserviert nun
  //     ebenfalls und überschreibt Bs fertiges Paar.
  //
  // Das ist KEINE Gleichzeitigkeit, sondern eine Reihenfolge — deshalb trägt hier keine Barriere,
  // sondern eine Staffel: A hält vor seinem reservierenden `mkdir` an, bis B ganz fertig ist.
  // Am Stand von Runde 1 war die Bestandsfrage zu diesem Zeitpunkt längst gestellt und mit „frei"
  // beantwortet; ab Runde 2 wird sie ERST hinter der Sperre gestellt.
  const A_WARTET = {
    rolle: "a",
    inhalt: INHALT_A,
    ohneBarrieren: true,
    staffelWartet: true,
  } as const;
  const B_LAEUFT_DURCH = { rolle: "b", inhalt: INHALT_B, ohneBarrieren: true } as const;

  it(
    "P4a · der nachrückende Lauf übernimmt den fertigen Namen NICHT",
    async () => {
      const ergebnis = await parallelLauf([A_WARTET, B_LAEUFT_DURCH]);
      treffpunktHatGetragen(ergebnis);
      const a = ergebnis.nach("a");
      const b = ergebnis.nach("b");
      expect(b.code, b.ausgabe).toBe(0);
      expect(a.code, a.ausgabe).toBe(0);
      // B war zuerst da und hat den Grundnamen. A muss ausgewichen sein.
      expect(b.angekuendigterName, b.ausgabe).toBe(GRUNDNAME);
      expect(a.angekuendigterName, a.ausgabe).not.toBe(GRUNDNAME);
      // Bs Paar ist bytegleich das, was B geschrieben hat — nicht das von A.
      expect(ergebnis.inhalt[GRUNDNAME], ergebnis.dateien.join(" ")).toBe(INHALT_B);
      expect(ergebnis.inhalt[`${GRUNDNAME}.sha256`], ergebnis.dateien.join(" ")).toBe(
        `${sha256(INHALT_B)}  ${GRUNDNAME}\n`,
      );
      jederErfolgIstWahr(ergebnis);
      jedesPaarIstStimmig(ergebnis);
      expect(ergebnis.dumps.length, ergebnis.dateien.join(" ")).toBe(2);
      expect(ergebnis.reservierungen, ergebnis.dateien.join(" ")).toEqual([]);
    },
    FRIST,
  );

  it(
    "P4b · und auch nicht, wenn der nachrückende Lauf beim Veröffentlichen scheitert",
    async () => {
      // Dieselbe Staffel, aber As Dump-`mv` verweigert. Am Stand von Runde 1 hatte A da schon Bs
      // Sidecar überschrieben; zurück blieb Bs Dump mit As Prüfsumme — für `restore-drill.sh`
      // Exit 11. Jetzt fasst A den fremden Namen gar nicht erst an.
      const ergebnis = await parallelLauf([
        { ...A_WARTET, mvFehltBei: ".dump.partial", mvFehlerExit: 8 },
        B_LAEUFT_DURCH,
      ]);
      treffpunktHatGetragen(ergebnis);
      const a = ergebnis.nach("a");
      const b = ergebnis.nach("b");
      expect(b.code, b.ausgabe).toBe(0);
      expect(a.code, a.ausgabe).toBe(8);
      expect(ergebnis.inhalt[GRUNDNAME], ergebnis.dateien.join(" ")).toBe(INHALT_B);
      expect(ergebnis.inhalt[`${GRUNDNAME}.sha256`], ergebnis.dateien.join(" ")).toBe(
        `${sha256(INHALT_B)}  ${GRUNDNAME}\n`,
      );
      // Der gescheiterte Lauf hinterlässt nichts: keinen Sidecar ohne Dump, keine Reservierung.
      expect(ergebnis.dumps.length, ergebnis.dateien.join(" ")).toBe(1);
      expect(
        ergebnis.dateien.filter((n) => n.endsWith(".sha256")).length,
        ergebnis.dateien.join(" "),
      ).toBe(1);
      expect(ergebnis.reservierungen, ergebnis.dateien.join(" ")).toEqual([]);
      jederErfolgIstWahr(ergebnis);
    },
    FRIST,
  );
});

describe("P6 · ein beschädigtes Altpaar verdrängt auch im Parallelbetrieb keine Generation", () => {
  // BENs Fall (R2, Korrekturpflicht 1), hier mit ZWEI gleichzeitigen Läufen: beide räumen auf,
  // beide sehen dasselbe beschädigte Paar. Sequenziell misst das
  // `tests/sicherung-dauerbetrieb/aufbewahrung-zaehlt-nur-heile-paare.test.ts`; hier geht es darum,
  // dass die Integritätsregel mit den Parallelregeln (e) und (f) zusammenspielt statt gegen sie.
  const ALT_GUT = "20260101T000000Z";
  const ALT_KAPUTT = "20260102T000000Z";

  it(
    "P6a · BACKUP_KEEP=3: der gültige Altstand bleibt, das kaputte Paar bleibt, nichts geht verloren",
    async () => {
      // DIE ZAHL IST GERECHNET, NICHT GERATEN. Am Ende liegen vier Paare: der gute Altstand, der
      // kaputte und die zwei neuen. DREI davon sind heile Generationen — genau `BACKUP_KEEP`, also
      // ist nichts zu entfernen. Ohne Zusage (g) zählte das kaputte Paar mit: vier Kandidaten bei
      // `KEEP=3`, und der ÄLTESTE flöge heraus — der gute Altstand. Das ist die Verdrängung.
      const ergebnis = await parallelLauf(
        [
          { rolle: "a", inhalt: INHALT_A, keep: "3", treffpunktAufbewahrung: true },
          { rolle: "b", inhalt: INHALT_B, keep: "3", treffpunktAufbewahrung: true },
        ],
        [{ stempel: ALT_GUT }, { stempel: ALT_KAPUTT, schaden: "hash" }],
      );
      treffpunktHatGetragen(ergebnis);
      jederErfolgIstWahr(ergebnis);
      // Vier Dumps: der gute Altstand, der kaputte, und die zwei neuen. KEINER ist weg.
      expect(ergebnis.dumps.length, ergebnis.dateien.join(" ")).toBe(4);
      expect(ergebnis.inhalt[`klarwerk-${ALT_GUT}.dump`], ergebnis.dateien.join(" ")).toBe(
        altInhalt(ALT_GUT),
      );
      expect(ergebnis.inhalt[`klarwerk-${ALT_GUT}.dump.sha256`], ergebnis.dateien.join(" ")).toBe(
        `${sha256(altInhalt(ALT_GUT))}  klarwerk-${ALT_GUT}.dump\n`,
      );
      expect(ergebnis.dateien, ergebnis.dateien.join(" ")).toContain(`klarwerk-${ALT_KAPUTT}.dump`);
      // Und beide Läufe haben den Befund gemeldet, statt ihn zu verschlucken.
      const alleAusgaben = ergebnis.laeufe.map((l) => l.ausgabe).join("\n");
      expect(alleAusgaben, alleAusgaben).toContain("BESCHAEDIGT");
      expect(ergebnis.ergebnisRoh, String(ergebnis.ergebnisRoh)).toContain("Befund am Bestand");
    },
    FRIST,
  );
});

describe("P5 · fremde Arbeitsstände überleben — auch den eigenen Fehlschlag", () => {
  // BENs dritte Gegenprobe: eine fremde `.partial` unter genau dem Arbeitsnamen dieser Sekunde.
  // Am Stand von Runde 1 schrieb `pg_dump --file "$STAGE"` hinein und die Abschlussfalle löschte
  // sie danach — beides ohne jeden Eigentumsnachweis. Ein Lauf genügt für diesen Fall; er braucht
  // keine Gleichzeitigkeit, sondern nur einen vorhersagbaren Namen.
  const FREMD = { stempel: STEMPEL } as const;
  const EINER = [{ rolle: "a", inhalt: INHALT_A, ohneBarrieren: true }] as const;

  function fremderBestandIstHeil(ergebnis: ParallelErgebnis) {
    treffpunktHatGetragen(ergebnis);
    const name = fremderArbeitsstandName(FREMD);
    expect(ergebnis.dateien, ergebnis.dateien.join(" ")).toContain(name);
    expect(ergebnis.inhalt[name], ergebnis.dateien.join(" ")).toBe(fremdInhalt(FREMD));
    expect(ergebnis.inhalt[`${name}.sha256`], ergebnis.dateien.join(" ")).toBe(
      `${sha256(fremdInhalt(FREMD))}  ${name}\n`,
    );
  }

  it(
    "P5a · nach einem ERFOLGREICHEN Lauf ist die fremde `.partial` bytegleich dieselbe",
    async () => {
      const ergebnis = await parallelLauf(EINER, [], [FREMD]);
      expect(ergebnis.nach("a").code, ergebnis.nach("a").ausgabe).toBe(0);
      fremderBestandIstHeil(ergebnis);
      jederErfolgIstWahr(ergebnis);
      expect(ergebnis.reservierungen, ergebnis.dateien.join(" ")).toEqual([]);
    },
    FRIST,
  );

  it(
    "P5b · und nach einem FRÜHEN Werkzeugfehler ebenso",
    async () => {
      // `pg_dump` scheitert — genau der Weg, auf dem BEN den Verlust gemessen hat: der Lauf
      // veröffentlicht nichts und räumt auf, und beim Aufräumen nahm er die fremde Datei mit.
      const ergebnis = await parallelLauf([{ ...EINER[0], dumpFehler: true }], [], [FREMD]);
      expect(ergebnis.nach("a").code, ergebnis.nach("a").ausgabe).toBe(2);
      fremderBestandIstHeil(ergebnis);
      expect(ergebnis.dumps, ergebnis.dateien.join(" ")).toEqual([]);
      expect(ergebnis.reservierungen, ergebnis.dateien.join(" ")).toEqual([]);
    },
    FRIST,
  );

  it(
    "P5c · und auch dann, wenn der Lauf durch ein Signal abbricht",
    async () => {
      const ergebnis = await parallelLauf([{ ...EINER[0], abbruchSignal: "SIGTERM" }], [], [FREMD]);
      const a = ergebnis.nach("a");
      expect(a.code === 143 || a.signal === "SIGTERM", `${a.code} / ${a.signal}`).toBe(true);
      fremderBestandIstHeil(ergebnis);
      expect(ergebnis.reservierungen, ergebnis.dateien.join(" ")).toEqual([]);
    },
    FRIST,
  );
});
