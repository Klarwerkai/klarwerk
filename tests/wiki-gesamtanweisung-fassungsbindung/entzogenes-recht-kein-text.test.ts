// ================================================================================================
// JOB 4233 · TEST 5 — DER NEUE TEXT GEHT AN DER RECHTENAHT NICHT VORBEI.
// ================================================================================================
//
// Die gefährlichste Stelle dieser Lieferung: ein Textträger, der neben der Trimmung aus
// `lesestand` (`gesamtanweisung-service.ts:331-336`) ausgeliefert wird, wäre ein Leck mit ganzen
// Sätzen statt mit einer Kennung. F3 (`tests/wiki-gesamtanweisung/f3-entzogenes-recht.test.ts`)
// prüft die Rechtenaht für Titel und Kennung; dieser Fall prüft sie für den RUMPF — und zwar an der
// SERIALISIERTEN Antwort, nicht am Objekt: ein Feld an irgendeiner Stelle fiele damit auf.
//
// GEGENPROBE: in `lesestand` den verborgenen Baustein mit seinem Rumpf mitliefern (statt ihn zu
// überspringen) → dieser Fall wird rot und nennt den geleakten Satz.
import { describe, expect, it } from "vitest";
import { bauDienst, eintrag, sichtbarAls } from "../wiki-gesamtanweisung/pruefstand";

const GEHEIMER_TITEL = "Notabschaltung Kessel 3";
const GEHEIME_KENNUNG = "ko-geheim";
const GEHEIMER_SATZ = "Erst Kessel 3 abschalten, dann die Leitung entlasten.";
const OFFENER_SATZ = "Erst absperren.";

const EINTRAEGE = [
  eintrag({ id: "ko-offen", title: "Anlage entlüften", version: 1 }, [
    { version: 1, bodyHtml: `<p>${OFFENER_SATZ}</p>` },
  ]),
  eintrag(
    {
      id: GEHEIME_KENNUNG,
      title: GEHEIMER_TITEL,
      version: 1,
      author: "clara",
      confidentiality: "vertraulich",
    },
    [{ version: 1, title: GEHEIMER_TITEL, bodyHtml: `<h2>Kessel</h2><p>${GEHEIMER_SATZ}</p>` }],
  ),
];

const CLARA = sichtbarAls({ id: "clara", darfPruefen: true });
const BERT = sichtbarAls({ id: "bert", darfPruefen: false });

async function anweisungMitGeschuetztemTeil() {
  const { dienst } = bauDienst(EINTRAEGE);
  const a = await dienst.anlegen({ titel: "Störungsbeseitigung" }, "clara");
  const eins = await dienst.bausteinAufnehmen(
    a.id,
    a.version,
    { koId: "ko-offen", koVersion: 1, nachweisHash: "h-offen" },
    CLARA,
  );
  const zwei = await dienst.bausteinAufnehmen(
    eins.id,
    eins.version,
    { koId: GEHEIME_KENNUNG, koVersion: 1, nachweisHash: "h-geheim" },
    CLARA,
  );
  return { dienst, anweisung: zwei };
}

describe("JOB 4233 · der Rumpf eines verborgenen Bausteins verlässt den Server nicht", () => {
  it("Bert sieht den geschützten Baustein gar nicht — und kein Fragment seines Textes", async () => {
    const { dienst, anweisung } = await anweisungMitGeschuetztemTeil();
    const stand = await dienst.lesen(anweisung.id, BERT);

    expect(stand.bausteine).toHaveLength(1);
    expect(stand.unvollstaendig).toBe(true);
    expect(stand.verborgeneBausteine).toBe(1);

    const draht = JSON.stringify(stand);
    expect(draht).not.toContain(GEHEIMER_SATZ);
    expect(draht).not.toContain("Kessel");
    expect(draht).not.toContain(GEHEIMER_TITEL);
    expect(draht).not.toContain(GEHEIME_KENNUNG);
    // Der zugängliche Baustein trägt seinen Text weiterhin — sonst prüfte dieser Fall nichts.
    expect(draht).toContain(OFFENER_SATZ);
  });

  it("Clara, die prüfen darf, bekommt beide Texte — die Naht trennt, sie sperrt nicht alles", async () => {
    const { dienst, anweisung } = await anweisungMitGeschuetztemTeil();
    const stand = await dienst.lesen(anweisung.id, CLARA);

    expect(stand.bausteine).toHaveLength(2);
    expect(stand.verborgeneBausteine).toBe(0);
    const draht = JSON.stringify(stand);
    expect(draht).toContain(OFFENER_SATZ);
    expect(draht).toContain(GEHEIMER_SATZ);
  });

  it("ohne übergebene Sichtbarkeitsentscheidung reist gar kein Text mit — fail-closed", async () => {
    const { dienst, anweisung } = await anweisungMitGeschuetztemTeil();
    const stand = await dienst.lesen(anweisung.id, undefined);

    expect(stand.bausteine).toHaveLength(0);
    expect(stand.verborgeneBausteine).toBe(2);
    const draht = JSON.stringify(stand);
    expect(draht).not.toContain(GEHEIMER_SATZ);
    expect(draht).not.toContain(OFFENER_SATZ);
  });
});
