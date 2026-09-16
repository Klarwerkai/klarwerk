// ================================================================================================
// JOB 4154 · F3 — ENTZOGENE RECHTE ERLAUBEN KEINE SCHEINBAR VOLLSTÄNDIGE ANWEISUNG.
// ================================================================================================
//
// Startvertrag, dritter entscheidender Fall:
//   „Entzogene Rechte auf wesentliche Teile erlauben keine scheinbar vollstaendige Anweisung."
// Und Abnahmefall 4 aus `VERTRAG-QUELLEN-VERSION-PRUEFSTAND.md`:
//   „Entzogener Zugriff: weder Faden, Zitat, Benachrichtigung noch KI-Eingabe verraten geschützten
//    Inhalt."
//
// ZWEI DINGE MÜSSEN GLEICHZEITIG GELTEN, und beide werden hier geprüft:
//   1. Der geschützte Baustein erscheint NICHT — auch nicht als Platzhalter mit Titel oder Kennung.
//      Ein „gesperrter Eintrag: Notabschaltung Kessel 3" wäre das Leck, das der Vertrag verbietet.
//   2. Die Anweisung gibt sich trotzdem NICHT als vollständig aus: `unvollstaendig` ist wahr und
//      die Zahl der verborgenen Bausteine steht da. Ohne diesen Satz läse jemand eine Anweisung,
//      der die Hälfte fehlt, und hielte sie für das Ganze.
//
// ------------------------------------------------------------------------------------------------
// DIE LEHRE AUS JOB 4141 R1 — WARUM HIER DER BESTAND VERGLICHEN WIRD UND NICHT NUR DER STATUS
// ------------------------------------------------------------------------------------------------
// Codex, wörtlich: „Ein `bestand`-Feld zählt erst als Nachweis, wenn seine Vorher-/Nachher-Werte
// tatsächlich verglichen werden." Ein 403 allein beweist nichts: eine Route kann ablehnen UND
// vorher geschrieben haben. Der Fall „der Bestand bleibt unberührt" nimmt deshalb einen
// vollständigen Abdruck VOR und NACH dem abgelehnten Versuch und vergleicht ihn.
//
// GEGENPROBEN (beide ausgeführt und zurückgenommen):
//   a) In `lesestand` den verborgenen Baustein als Platzhalter mit `herkunft.titel` mitliefern →
//      „verrät weder Titel noch Kennung" wird rot.
//   b) In `GesamtanweisungDienst.reihenfolgeSetzen` die Reihenfolge VOR der Rechteprüfung
//      schreiben (also `this.schreiben(...)` vor `geladen(..., true)`) → „der Bestand bleibt
//      unberührt" wird rot, und zwar NAMENTLICH: der Abdruck unterscheidet sich.
import { describe, expect, it } from "vitest";
import { bauDienst, eintrag, sichtbarAls } from "./pruefstand";

const GEHEIMER_TITEL = "Notabschaltung Kessel 3";
const GEHEIME_KENNUNG = "ko-geheim";

const EINTRAEGE = [
  eintrag({ id: "ko-offen", title: "Anlage entlüften", version: 1 }, [{ version: 1 }]),
  eintrag(
    {
      id: GEHEIME_KENNUNG,
      title: GEHEIMER_TITEL,
      version: 1,
      author: "clara",
      confidentiality: "vertraulich",
    },
    [{ version: 1, title: GEHEIMER_TITEL }],
  ),
];

/** Clara darf prüfen und sieht deshalb alles — sie baut die Anweisung auf. */
const CLARA = sichtbarAls({ id: "clara", darfPruefen: true });
/** Bert darf lesen, ist nicht Autor und darf nicht prüfen — ihm fehlt der geschützte Baustein. */
const BERT = sichtbarAls({ id: "bert", darfPruefen: false });

async function anweisungMitGeschuetztemTeil() {
  const { dienst, repo } = bauDienst(EINTRAEGE);
  const a = await dienst.anlegen({ titel: "Störungsbeseitigung" }, "clara");
  const b1 = await dienst.bausteinAufnehmen(
    a.id,
    a.version,
    { koId: "ko-offen", koVersion: 1, nachweisHash: "h-offen" },
    CLARA,
  );
  const b2 = await dienst.bausteinAufnehmen(
    a.id,
    b1.version,
    { koId: GEHEIME_KENNUNG, koVersion: 1, nachweisHash: "h-geheim" },
    CLARA,
  );
  return { dienst, repo, anweisung: b2 };
}

describe("F3 · entzogenes Recht an einem wesentlichen Baustein", () => {
  it("Clara sieht beide Bausteine — sonst prüfte der Fall unten nichts", async () => {
    const { dienst, anweisung } = await anweisungMitGeschuetztemTeil();
    const stand = await dienst.lesen(anweisung.id, CLARA);
    expect(stand.bausteine).toHaveLength(2);
    expect(stand.unvollstaendig).toBe(false);
    expect(stand.verborgeneBausteine).toBe(0);
  });

  it("Bert bekommt eine ausdrücklich UNVOLLSTÄNDIGE Anweisung", async () => {
    const { dienst, anweisung } = await anweisungMitGeschuetztemTeil();
    const stand = await dienst.lesen(anweisung.id, BERT);

    expect(stand.bausteine).toHaveLength(1);
    expect(stand.unvollstaendig).toBe(true);
    expect(stand.verborgeneBausteine).toBe(1);
  });

  it("die Antwort verrät weder Titel noch Kennung des geschützten Eintrags", async () => {
    const { dienst, anweisung } = await anweisungMitGeschuetztemTeil();
    const stand = await dienst.lesen(anweisung.id, BERT);
    // Am DRAHT gemessen, nicht Feld für Feld: ein Platzhalter an irgendeiner Stelle fiele hier auf.
    const draht = JSON.stringify(stand);
    expect(draht).not.toContain(GEHEIMER_TITEL);
    expect(draht).not.toContain(GEHEIME_KENNUNG);
    expect(draht).toContain("ko-offen");
  });

  it("Bert darf die Anweisung NICHT umordnen — und der Bestand bleibt dabei unberührt", async () => {
    const { dienst, repo, anweisung } = await anweisungMitGeschuetztemTeil();
    const ids = anweisung.bausteine.map((b) => b.id);
    const vorher = repo.abdruck();
    const schreibvorgaengeVorher = repo.schreibvorgaenge;

    await expect(
      dienst.reihenfolgeSetzen(anweisung.id, anweisung.version, [...ids].reverse(), BERT),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // DER EIGENTLICHE NACHWEIS (JOB 4141 R1): vorher und nachher wirklich vergleichen.
    expect(repo.abdruck()).toBe(vorher);
    expect(repo.schreibvorgaenge).toBe(schreibvorgaengeVorher);
  });

  it("die Ablehnung nennt selbst keinen Titel und keine Kennung", async () => {
    const { dienst, anweisung } = await anweisungMitGeschuetztemTeil();
    const fehler = await dienst
      .vorlegen(anweisung.id, anweisung.version, BERT)
      .then(() => null)
      .catch((e: unknown) => e);

    // Der Code wird direkt gelesen — genau so, wie ihn `sendError` und die Route lesen.
    expect(fehler).toBeInstanceOf(Error);
    expect((fehler as { code?: unknown }).code).toBe("FORBIDDEN");
    const meldung = (fehler as Error).message;
    expect(meldung).not.toContain(GEHEIMER_TITEL);
    expect(meldung).not.toContain(GEHEIME_KENNUNG);
    // Und auch keine Zahl, aus der sich der geschützte Bestand errechnen liesse.
    expect(meldung).not.toMatch(/\d/);
  });

  it("auch der Vergleich wird verweigert, statt eine getrimmte Gegenüberstellung zu zeigen", async () => {
    // Ein Vergleich über die sichtbare Teilmenge sagte „unverändert", wo der Leser die geänderte
    // Hälfte nur nicht sehen durfte. Das ist die gefährlichste Unwahrheit dieses Auftrags.
    const { dienst, anweisung } = await anweisungMitGeschuetztemTeil();
    await expect(
      dienst.vergleichen(anweisung.id, 1, anweisung.version, BERT),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("ohne übergebene Entscheidung ist NICHTS sichtbar — fail-closed", async () => {
    const { dienst, anweisung } = await anweisungMitGeschuetztemTeil();
    const stand = await dienst.lesen(anweisung.id, undefined);
    expect(stand.bausteine).toHaveLength(0);
    expect(stand.unvollstaendig).toBe(true);
    expect(stand.verborgeneBausteine).toBe(2);
  });
});
