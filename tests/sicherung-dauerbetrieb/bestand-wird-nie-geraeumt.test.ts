// ================================================================================================
// JOB 4057 · L8 (BEN R3, Korrekturpflichten 1–2) — EIN GESCHEITERTER LAUF RÄUMT KEINEN FREMDEN
// BESTAND WEG. AUCH DANN NICHT, WENN DER ENDNAME DERSELBE IST.
// ================================================================================================
//
// DER BEFUND, gemessen von BEN am Stand der Runde 3: Der Aufräumzweig des Sicherheitsnetzes löschte
// `${OUT}.sha256`, sobald `VEROEFFENTLICHT=nein` war. Diese Bedingung sagt aber nur, dass DIESER
// Lauf nichts veröffentlicht hat — sie sagt NICHT, dass die Datei unter dem Endnamen diesem Lauf
// gehört. `klarwerk-<STAMP>` ist auf die SEKUNDE genau: ein Erfolgslauf und ein direkt folgender,
// gescheiterter Lauf in derselben Sekunde treffen denselben Namen. Ergebnis der Messung: der
// Sidecar der BESTEHENDEN, gültigen Sicherung war weg, ihr Dump lag ohne Prüfsumme da.
//
// WARUM DAS SCHWERER WIEGT ALS DER REST, DEN ES WEGNEHMEN SOLLTE: Ein `*.dump` ohne Sidecar ist
// nach dem Vertrag aus `RESTORE.md` kein regulär entstandenes Backup. Der Drill verweigert
// `pg_restore` dafür (Exit 10/11). Der Betreiber sieht eine Datei im Verzeichnis und hat trotzdem
// keine einspielbare Sicherung mehr — und es war ein Aufräumzweig, der sie zerstört hat.
//
// DIE REGEL, die hier gemessen wird: geräumt wird ausschliesslich, was dieser Lauf SELBST angelegt
// hat. Lag unter dem Endnamen schon etwas, ist es fremder Bestand und wird nicht angefasst — mit
// oder ohne `BACKUP_KEEP`.
import { describe, expect, it } from "vitest";
import { folge, lauf } from "./lauf";

/** Der feste Sekundenstempel: beide Läufe eines Falls treffen damit denselben Endnamen. */
const STEMPEL = "20260915T010203Z";
const ENDNAME = `klarwerk-${STEMPEL}.dump`;

describe("L8a · zwei Läufe in derselben Sekunde: der Fehlschlag lässt das bestehende Paar unberührt", () => {
  // Genau die beiden Fälle des Prüfers, mit seinen Exitcodes: `pg_dump` scheitert (2), der Dump ist
  // für `pg_restore` nicht lesbar (4). Beide brechen VOR der Veröffentlichung ab.
  const faelle = [
    { was: "pg_dump scheitert", modus: "dump-fehler", code: 2 },
    { was: "der Dump ist nicht lesbar", modus: "unlesbar", code: 4 },
  ] as const;

  for (const fall of faelle) {
    it(`${fall.was} (Exit ${fall.code}): Dump UND Sidecar bleiben bytegleich`, () => {
      const [erst, dann] = folge(
        { festerStempel: STEMPEL },
        { festerStempel: STEMPEL, modus: fall.modus },
      );
      if (erst === undefined || dann === undefined) throw new Error("zwei Läufe erwartet");
      // Der erste Lauf muss wirklich ein vollständiges Paar hinterlassen haben.
      expect(erst.code, erst.ausgabe).toBe(0);
      expect(erst.dumps, erst.dateien.join(" ")).toEqual([ENDNAME]);
      const dumpVorher = erst.inhalt[ENDNAME];
      const sidecarVorher = erst.inhalt[`${ENDNAME}.sha256`];
      if (dumpVorher === undefined || sidecarVorher === undefined) {
        throw new Error("vollständiges Paar nach dem ersten Lauf erwartet");
      }

      expect(dann.code, dann.ausgabe).toBe(fall.code);
      // DIE KERNAUSSAGE, beide Hälften: nicht nur der Dumpname, sondern BEIDE INHALTE.
      expect(dann.inhalt[ENDNAME], dann.dateien.join(" ")).toBe(dumpVorher);
      expect(dann.inhalt[`${ENDNAME}.sha256`], dann.dateien.join(" ")).toBe(sidecarVorher);
    });
  }

  it("auch ohne BACKUP_KEEP — der Bestandsvertrag hängt nicht an der Aufbewahrungsregel", () => {
    // In beiden Läufen ist BACKUP_KEEP NICHT gesetzt (`keep` fehlt). Es wird trotzdem nichts
    // entfernt: der Schaden aus Runde 3 entstand im Sicherheitsnetz, nicht in der Aufbewahrung.
    const [erst, dann] = folge(
      { festerStempel: STEMPEL },
      { festerStempel: STEMPEL, modus: "dump-fehler" },
    );
    if (erst === undefined || dann === undefined) throw new Error("zwei Läufe erwartet");
    expect(dann.dateien, dann.ausgabe).toEqual(erst.dateien);
  });

  it("der gescheiterte Lauf hinterlegt trotzdem seine Fehlerspur", () => {
    // Gegenprobe zur Zeile darüber: „nichts angefasst" darf nicht heissen „gar nichts getan".
    const [, dann] = folge(
      { festerStempel: STEMPEL },
      { festerStempel: STEMPEL, modus: "dump-fehler" },
    );
    if (dann === undefined) throw new Error("zwei Läufe erwartet");
    const e = dann.ergebnis();
    expect(e.ergebnis).toBe("fehler");
    expect(e.exitcode).toBe(2);
    expect(e.datei).toBeNull();
  });
});

describe("L8b · scheitert das ZWEITE mv der Veröffentlichung, bleibt kein Sidecar ohne Dump liegen", () => {
  // Der Fall, für den der Aufräumzweig überhaupt gebaut wurde: Sidecar liegt schon unter seinem
  // Endnamen, der Dump nicht. `mv` verweigert genau den Dump-Schritt (erstes Argument endet auf
  // `.dump.partial`); Sidecar-Schritt und Ergebnisspur laufen durch das echte `mv`.
  it("im leeren Verzeichnis: weder .dump noch .sha256 noch .partial bleiben zurück", () => {
    const r = lauf({ mvFehltBei: ".dump.partial", mvFehlerExit: 8 });
    expect(r.code, r.ausgabe).toBe(8);
    expect(r.dumps, r.dateien.join(" ")).toEqual([]);
    expect(
      r.dateien.filter((n) => n.endsWith(".sha256") || n.endsWith(".partial")),
      r.dateien.join(" "),
    ).toEqual([]);
    // Der Lauf sagt auch, was los war — die Ergebnisspur überlebt, weil ihr `mv` durchgeht.
    const e = r.ergebnis();
    expect(e.ergebnis).toBe("fehler");
    expect(e.exitcode).toBe(8);
  });

  it("aber bei belegtem Endnamen wird der fremde Sidecar NICHT mitgerissen", () => {
    // Die schärfste Zeile dieser Runde: derselbe Bruchpunkt, nur liegt der Endname schon. Dann ist
    // der Sidecar dort NICHT der eigene, und das Sicherheitsnetz hat die Finger davon zu lassen.
    const [erst, dann] = folge(
      { festerStempel: STEMPEL },
      { festerStempel: STEMPEL, mvFehltBei: ".dump.partial", mvFehlerExit: 8 },
    );
    if (erst === undefined || dann === undefined) throw new Error("zwei Läufe erwartet");
    expect(erst.code, erst.ausgabe).toBe(0);
    const sidecarVorher = erst.inhalt[`${ENDNAME}.sha256`];
    if (sidecarVorher === undefined) throw new Error("Sidecar nach dem ersten Lauf erwartet");

    // Seit BEN R5 weicht dieser Lauf auf `klarwerk-<STEMPEL>_02.dump` aus; sein Sidecar-`mv`
    // gelingt dort, das Dump-`mv` scheitert, und der eigene verwaiste Sidecar kommt weg. Der
    // FREMDE Bestand wird dabei nicht einmal berührt. Den Ausweichweg selbst misst
    // `belegter-endname-bleibt-unberuehrt`.
    expect(dann.code, dann.ausgabe).toBe(8);
    // Der Dump des ersten Laufs liegt unverändert da …
    expect(dann.inhalt[ENDNAME], dann.dateien.join(" ")).toBe(erst.inhalt[ENDNAME]);
    // … und sein Sidecar ebenfalls, bytegleich. Ein Dump ohne Prüfsumme wäre nach RESTORE.md kein
    // einspielbares Backup mehr — genau der Schaden aus Runde 3.
    expect(dann.dateien, dann.ausgabe).toContain(`${ENDNAME}.sha256`);
    expect(dann.inhalt[`${ENDNAME}.sha256`], dann.ausgabe).toBe(sidecarVorher);
  });

  it("und das Skript sagt es, statt still fremden Bestand zu überschreiben", () => {
    const [, dann] = folge(
      { festerStempel: STEMPEL },
      { festerStempel: STEMPEL, mvFehltBei: ".dump.partial", mvFehlerExit: 8 },
    );
    if (dann === undefined) throw new Error("zwei Läufe erwartet");
    expect(dann.stderr, dann.ausgabe).toContain("ist fuer diese Sekunde schon vergeben");
    expect(dann.stderr, dann.ausgabe).toContain("NICHT angefasst");
  });
});
