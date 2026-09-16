// ================================================================================================
// JOB 4154 R3 · BESTAND UND PRÜFSTAND — BEIDES ODER NICHTS.
// ================================================================================================
//
// DER BEFUND, DER DIESE DATEI VERURSACHT HAT, kommt von BEN und ist gemessen, nicht vermutet:
// bis Runde 2 rief der Dienst ZWEI Ablageaufrufe hintereinander — erst `repo.schreiben`, dann
// `repo.standFesthalten`. Die Postgres-Ablage committet am Ende jedes Aufrufs. Scheiterte der
// zweite, blieb der Bestand geändert und die Historie unvollständig; BENs Gegenprobe zeigte:
// Titel „Nachher", Version 2, historische Versionen `[1]`.
//
// WARUM DAS SCHLIMMER IST, ALS ES KLINGT. Der ausgelassene Zwischenstand ist nicht
// rekonstruierbar. Die ganze Zusage dieses Auftrags hängt an der Historie — „Server bestätigt nur
// genau den vorgelegten unveränderten Prüfstand", und der Vergleich zweier Stände liest genau
// diese Tabelle. Ein Loch darin fällt beim Schreiben niemandem auf, sondern erst dem Menschen,
// der Monate später zwei Fassungen gegenüberstellen will — und dann ist es zu spät.
//
// ------------------------------------------------------------------------------------------------
// WAS DIESE DATEI PRÜFT UND WAS SIE AUSDRÜCKLICH NICHT PRÜFT
// ------------------------------------------------------------------------------------------------
// Sie prüft das VERHALTEN des Dienstes an einer Ablage, die scheitert: kein halber Schreibvorgang,
// kein Bestand ohne Prüfstand, und ein Wiederholversuch hinterlässt genau einen vollständigen
// Stand. Das läuft im Tor, bei jedem Lauf, ohne Datenbank.
//
// Sie beweist NICHT die Postgres-Transaktion selbst — ein Double kann das nicht, und BENs Auflage
// verlangt dafür ausdrücklich eine echte Datenbank. Dieser Beweis steht in
// `postgres-atomar.integration.test.ts` daneben: dort erzwingt ein Trigger den Fehler am
// Historien-INSERT und der Rollback wird an den echten Tabellen nachgelesen.
//
// Die beiden gehören zusammen: der eine hält die Zusage bei jedem Lauf, der andere belegt, dass
// die Ablage sie überhaupt geben kann.
//
// GEGENPROBE: In `GesamtanweisungDienst.schreiben` (`gesamtanweisung-service.ts`) den Prüfstand
// wieder als zweiten Aufruf nachreichen — also `repo.schreiben(neu, erwartet, …)` ohne Aufnahme
// und danach ein separates Festhalten. Dann wird „der Bestand bleibt unberührt" hier rot.
import { describe, expect, it } from "vitest";
import { bauDienst, eintrag, sichtbarAls } from "./pruefstand";

const WER = sichtbarAls({ id: "anna", darfPruefen: true });

const EINTRAEGE = [
  eintrag({ id: "ko-a", title: "Schritt A", version: 1 }, [{ version: 1, bodyHtml: "<p>A</p>" }]),
  eintrag({ id: "ko-b", title: "Schritt B", version: 1 }, [{ version: 1, bodyHtml: "<p>B</p>" }]),
];

async function anweisungMitZweiBausteinen() {
  const { dienst, repo } = bauDienst(EINTRAEGE);
  const a = await dienst.anlegen({ titel: "Wartung" }, "anna");
  const b1 = await dienst.bausteinAufnehmen(
    a.id,
    a.version,
    { koId: "ko-a", koVersion: 1, nachweisHash: "ha" },
    WER,
  );
  const b2 = await dienst.bausteinAufnehmen(
    a.id,
    b1.version,
    { koId: "ko-b", koVersion: 1, nachweisHash: "hb" },
    WER,
  );
  return { dienst, repo, anweisung: b2 };
}

describe("JOB 4154 R3 · Bestand und Prüfstand werden zusammen gespeichert", () => {
  it("im Normalfall trägt JEDE Version ihren Prüfstand — sonst prüfte alles darunter nichts", async () => {
    const { repo, anweisung } = await anweisungMitZweiBausteinen();
    const staende = await repo.staende(anweisung.id);
    // Anlegen (1) + zwei Aufnahmen (2, 3) — lückenlos, keine Version ohne Stand.
    expect(staende).toEqual([1, 2, 3]);
    expect(anweisung.version).toBe(3);
  });

  it("scheitert der Prüfstand, bleibt der BESTAND unberührt — kein halber Schreibvorgang", async () => {
    const { dienst, repo, anweisung } = await anweisungMitZweiBausteinen();
    const vorher = repo.abdruck();
    const staendeVorher = await repo.staende(anweisung.id);
    const schreibvorgaenge = repo.schreibvorgaenge;

    repo.pruefstandScheitertEinmal = true;
    await expect(
      dienst.reihenfolgeSetzen(
        anweisung.id,
        anweisung.version,
        anweisung.bausteine.map((b) => b.id).reverse(),
        WER,
      ),
    ).rejects.toThrow(/Prüfstand/);

    // DER NACHWEIS: vorher und nachher wirklich verglichen (Lehre JOB 4141 R1).
    expect(repo.abdruck()).toBe(vorher);
    expect(await repo.staende(anweisung.id)).toEqual(staendeVorher);
    expect(repo.schreibvorgaenge).toBe(schreibvorgaenge);
  });

  it("der Wiederholversuch danach hinterlässt GENAU EINEN vollständigen Stand", async () => {
    const { dienst, repo, anweisung } = await anweisungMitZweiBausteinen();
    const folge = anweisung.bausteine.map((b) => b.id).reverse();

    repo.pruefstandScheitertEinmal = true;
    await expect(
      dienst.reihenfolgeSetzen(anweisung.id, anweisung.version, folge, WER),
    ).rejects.toThrow(/Prüfstand/);

    // Der Riegel ist verbraucht; derselbe Griff noch einmal, auf DERSELBEN gelesenen Version —
    // das ist der Punkt: der gescheiterte Versuch hat die Version nicht verbraucht.
    const geordnet = await dienst.reihenfolgeSetzen(anweisung.id, anweisung.version, folge, WER);
    expect(geordnet.version).toBe(anweisung.version + 1);
    expect(await repo.staende(anweisung.id)).toEqual([1, 2, 3, 4]);

    const stand = await dienst.lesen(anweisung.id, WER);
    expect(stand.bausteine.map((b) => b.id)).toEqual(folge);
    // Und der festgehaltene Prüfstand gehört wirklich zu DIESER Fassung.
    const aufnahme = await repo.standLesen(anweisung.id, geordnet.version);
    expect(aufnahme?.bausteine.map((b) => b.id)).toEqual(folge);
  });

  it("dasselbe beim ANLEGEN — ohne ersten Prüfstand entsteht keine Anweisung", async () => {
    const { dienst, repo } = bauDienst(EINTRAEGE);
    repo.pruefstandScheitertEinmal = true;
    await expect(dienst.anlegen({ titel: "Wartung" }, "anna")).rejects.toThrow(/Prüfstand/);
    // Kein Kopf, keine halbe Anweisung — der Bestand ist leer geblieben.
    expect(repo.abdruck()).toBe("[]");
    expect(repo.schreibvorgaenge).toBe(0);
  });

  it("dasselbe beim ENTSCHEIDEN — nichts wird freigegeben ohne seinen Prüfstand", async () => {
    const { dienst, repo, anweisung } = await anweisungMitZweiBausteinen();
    const vorgelegt = await dienst.vorlegen(anweisung.id, anweisung.version, WER);
    const vorher = repo.abdruck();

    repo.pruefstandScheitertEinmal = true;
    await expect(
      dienst.entscheiden(vorgelegt.id, vorgelegt.version, "angenommen", WER),
    ).rejects.toThrow(/Prüfstand/);

    // Der Stand ist NICHT auf „entschieden" gewandert.
    expect(repo.abdruck()).toBe(vorher);
    expect((await dienst.lesen(vorgelegt.id, WER)).stand).toBe("vorgelegt");
  });

  it("der Dienst reicht den Prüfstand NICHT mehr nach — ein Aufruf, nicht zwei", async () => {
    // Der strukturelle Gegenhalt zum Verhalten oben: es gibt im Dienst keinen zweiten Ablageaufruf
    // mehr, den man vergessen oder in die falsche Reihenfolge bringen könnte. Käme er zurück,
    // wäre die Lücke wieder da — auch wenn die Fälle darüber zufällig grün blieben.
    const { readFileSync } = await import("node:fs");
    const quelle = readFileSync("services/knowledge-object/src/gesamtanweisung-service.ts", "utf8");
    const aufrufe = quelle.match(/this\.deps\.repo\.(schreiben|anlegen|standFesthalten)\(/g) ?? [];
    expect(aufrufe.sort()).toEqual(["this.deps.repo.anlegen(", "this.deps.repo.schreiben("]);
  });
});
