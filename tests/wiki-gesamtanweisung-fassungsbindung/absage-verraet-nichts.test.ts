// ================================================================================================
// JOB 4233 · TEST 2 — WER NICHTS SEHEN DARF, ERFÄHRT AUCH NICHT, OB ES DIE FASSUNG GIBT.
// ================================================================================================
//
// DIESER FALL IST DIE GEGENPROBE GEGEN DIE EIGENE LIEFERUNG. Die naheliegende Halbheit beim Bau der
// Existenzprüfung ist, sie VOR oder NEBEN die Sichtbarkeitsprüfung zu stellen: dann bekäme ein
// Fremder für „Fassung 999 eines vertraulichen Eintrags" eine andere Antwort als für „Fassung 1
// desselben Eintrags" — und aus diesem Unterschied liest er ab, welche Fassungen es gibt. Ein Leck
// ohne eine einzige geleakte Zeichenkette.
//
// DIE ZUSAGE, an der dieser Fall hängt, ist deshalb WORTGLEICHHEIT: die Absage an den Fremden ist
// für den vorhandenen Eintrag, für die nicht vorhandene Fassung und für den gar nicht existierenden
// Eintrag ein und dieselbe — Code UND Meldung. Sie enthält keine Kennung, keinen Titel, keine
// Fassungsliste und keine Zahl.
//
// GEGENPROBE: in `bausteinAufnehmen` die Existenzprüfung VOR die Sichtbarkeitsprüfung ziehen →
// dieser Fall wird rot, weil der Fremde plötzlich `NOT_FOUND` statt `FORBIDDEN` bekommt.
import { describe, expect, it } from "vitest";
import { bauDienst, eintrag, sichtbarAls } from "../wiki-gesamtanweisung/pruefstand";

const GEHEIMER_TITEL = "Notabschaltung Kessel 3";
const GEHEIME_KENNUNG = "ko-geheim";

const EINTRAEGE = [
  eintrag({ id: "ko-offen", title: "Anlage entlüften", version: 1 }, [
    { version: 1, bodyHtml: "<p>Erst absperren.</p>" },
  ]),
  eintrag(
    {
      id: GEHEIME_KENNUNG,
      title: GEHEIMER_TITEL,
      version: 2,
      author: "clara",
      confidentiality: "vertraulich",
    },
    [
      { version: 1, title: GEHEIMER_TITEL, bodyHtml: "<p>Kessel 3 abschalten.</p>" },
      { version: 2, title: GEHEIMER_TITEL, bodyHtml: "<p>Kessel 3 sofort abschalten.</p>" },
    ],
  ),
];

/** Clara darf prüfen — sie legt die Anweisung an und sieht alles. */
const CLARA = sichtbarAls({ id: "clara", darfPruefen: true });
/** Bert darf lesen, ist nicht Autor, darf nicht prüfen — für ihn existiert der Eintrag nicht. */
const BERT = sichtbarAls({ id: "bert", darfPruefen: false });

async function anweisungVon(urheber: string) {
  const { dienst, repo } = bauDienst(EINTRAEGE);
  const anweisung = await dienst.anlegen({ titel: "Störungsbeseitigung" }, urheber);
  return { dienst, repo, anweisung };
}

async function absage(
  koId: string,
  koVersion: number,
): Promise<{ code: unknown; message: string }> {
  const { dienst, anweisung } = await anweisungVon("bert");
  const fehler = await dienst
    .bausteinAufnehmen(
      anweisung.id,
      anweisung.version,
      { koId, koVersion, nachweisHash: null },
      BERT,
    )
    .then(() => null)
    .catch((e: unknown) => e);
  expect(fehler, `${koId}@${koVersion} wurde nicht abgelehnt`).toBeInstanceOf(Error);
  return { code: (fehler as { code?: unknown }).code, message: (fehler as Error).message };
}

describe("JOB 4233 · die Absage an einen Unberechtigten verrät nichts", () => {
  it("nicht vorhandene Fassung und vorhandene Fassung sind für den Fremden ununterscheidbar", async () => {
    const zurFassung999 = await absage(GEHEIME_KENNUNG, 999);
    const zurFassung1 = await absage(GEHEIME_KENNUNG, 1);
    const zumUnbekanntenEintrag = await absage("ko-gibt-es-nicht", 1);

    expect(zurFassung999.code).toBe("FORBIDDEN");
    expect(zurFassung999).toEqual(zurFassung1);
    expect(zurFassung999).toEqual(zumUnbekanntenEintrag);
  });

  it("die Meldung nennt weder Kennung noch Titel noch eine Zahl", async () => {
    const { message } = await absage(GEHEIME_KENNUNG, 999);
    expect(message).toBe("Diese Fassung kann nicht aufgenommen werden.");
    expect(message).not.toContain(GEHEIME_KENNUNG);
    expect(message).not.toContain(GEHEIMER_TITEL);
    // Keine Zahl — aus einer Fassungsliste liesse sich der geschützte Bestand ablesen.
    expect(message).not.toMatch(/\d/);
  });

  it("der Bestand bleibt bei jeder dieser Absagen unberührt", async () => {
    const { dienst, repo, anweisung } = await anweisungVon("bert");
    const abdruckVorher = repo.abdruck();
    const schreibvorgaengeVorher = repo.schreibvorgaenge;

    for (const [koId, koVersion] of [
      [GEHEIME_KENNUNG, 999],
      [GEHEIME_KENNUNG, 1],
      ["ko-gibt-es-nicht", 1],
    ] as const) {
      await expect(
        dienst.bausteinAufnehmen(
          anweisung.id,
          anweisung.version,
          { koId, koVersion, nachweisHash: null },
          BERT,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }

    expect(repo.abdruck()).toBe(abdruckVorher);
    expect(repo.schreibvorgaenge).toBe(schreibvorgaengeVorher);
  });

  it("KONTROLLFALL: Clara, die den Eintrag sehen darf, bekommt die ehrliche Auskunft", async () => {
    // Derselbe Aufruf, anderer Betrachter: erst wenn jemand den Eintrag ohnehin sehen darf, sagt
    // das Produkt, dass es diese FASSUNG nicht gibt. Ohne diesen Fall prüfte der obige nur, dass
    // alles gleich abgelehnt wird — auch eine Wand, die nie etwas sagt, wäre dann grün.
    const { dienst, anweisung } = await anweisungVon("clara");
    const fehler = await dienst
      .bausteinAufnehmen(
        anweisung.id,
        anweisung.version,
        { koId: GEHEIME_KENNUNG, koVersion: 999, nachweisHash: null },
        CLARA,
      )
      .then(() => null)
      .catch((e: unknown) => e);

    expect((fehler as { code?: unknown }).code).toBe("INVALID");
    expect((fehler as Error).message).toContain("Diese Fassung gibt es nicht.");
    expect((fehler as Error).message).toContain("Belegt: 1, 2.");
  });
});
