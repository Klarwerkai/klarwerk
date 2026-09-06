// ================================================================================================
// JOB 3116 · R1 — DIE AKTIVE ANKER-LAGE IST EINE AUSKUNFT MIT KENNUNG, KEIN SCHWEIGEN.
// ================================================================================================
//
// DER BEFUND (Codex R-0192, Ergaenzung 05.09.2026): liegt der Herkunfts-Anker eines Wiederimports
// AKTIV im Bestand, sagte der Kandidat bis hierher `nicht_gestellt` — dasselbe Wort wie fuer die
// Erstanlage. Zwei verschiedene Sachverhalte unter einem Namen: „der Inhalt fliesst in ein
// BESTEHENDES Objekt zurueck" und „es gibt gar keinen Bestandstraeger". Kein Client konnte sie
// trennen, und die Flaeche schrieb darum spaeter „KO erzeugt", wo nichts erzeugt wurde.
//
// AB HIER heisst die erste Lage `wiederverwendet` und traegt die Kennung des aktiven Traegers —
// dieselbe Trefferform `{ art: "wissensobjekt", koId }`, die `im_papierkorb` seit JOB 3081 fuehrt.
//
// VOR DER AENDERUNG ROT: `dublettenbefund` war `{ ergebnis: "nicht_gestellt" }`, ohne jede Kennung.
import { describe, expect, it } from "vitest";
import { ANKER_ITEM, TEXTGLEICHHEIT, dienst, importiereUndNimmAn } from "./helfer";

describe("JOB 3116 · R1 — der aktive Anker sagt, WORAUF der Wiederimport trifft", () => {
  it("R1 · Wiederimport gegen einen AKTIVEN Anker → `wiederverwendet` mit der Kennung genau dieses Objekts", async () => {
    const ctx = dienst();
    const aktiveId = await importiereUndNimmAn(ctx, ANKER_ITEM);

    const [kandidat] = await ctx.library.createImportCandidates(
      [{ ...ANKER_ITEM, sourceVersion: 2, statement: `${ANKER_ITEM.statement} (Fassung 2)` }],
      "importeur",
      TEXTGLEICHHEIT,
    );

    expect(
      kandidat?.dublettenbefund,
      "Der Reviewer erfaehrt VOR seiner Entscheidung, dass der Inhalt in ein BESTEHENDES Objekt zurueckfliesst — und in welches.",
    ).toEqual({
      ergebnis: "wiederverwendet",
      treffer: { art: "wissensobjekt", koId: aktiveId },
    });
    expect(
      kandidat?.duplicate,
      "Ein Re-Sync ist keine Dublette — das war und bleibt die Entscheidung von SCRUM-510 R2b.",
    ).toBe(false);
  });

  // Der VORRANG DES LEBENDEN, jetzt an der neuen Aussage gemessen: derselbe Anker aktiv UND im
  // Papierkorb → die AKTIVE Kennung steht da, nicht die getrashte. Die Reihenfolge der Zweige in
  // `service.ts` ist damit nicht nur kommentiert, sondern gemessen.
  it("R1b · derselbe Anker aktiv UND im Papierkorb → genannt wird die AKTIVE Kennung", async () => {
    const ctx = dienst();
    // Der aktive Traeger entsteht auf dem Produktweg …
    const aktiveId = await importiereUndNimmAn(ctx, ANKER_ITEM);
    // … und daneben liegt ein zweites Objekt mit DEMSELBEN Anker im Papierkorb. Es wird unmittelbar
    // am Dienst angelegt: ueber den Import ginge es nicht, weil der Anker dann schon getroffen
    // waere — die Doppellage selbst ist hier die Vorbedingung, nicht der Weg dorthin.
    const getrasht = await ctx.koService.create({
      title: "Alte Fassung derselben Sache",
      statement: ANKER_ITEM.statement,
      type: "best_practice",
      category: "Wartung",
      author: "pedi",
      sources: [
        {
          id: "quelle-getrashter-zwilling",
          label: "Alte Fassung",
          url: null,
          excerpt: null,
          kind: "external",
          peerValidated: false,
          provider: ANKER_ITEM.provider ?? null,
          externalId: ANKER_ITEM.externalId as string,
          sourceVersion: 1,
          author: "pedi",
          at: new Date(0).toISOString(),
        },
      ],
    });
    await ctx.koService.delete(getrasht.id, "pedi");
    expect(aktiveId).not.toBe(getrasht.id);

    const [kandidat] = await ctx.library.createImportCandidates(
      [{ ...ANKER_ITEM, sourceVersion: 3 }],
      "importeur",
      TEXTGLEICHHEIT,
    );

    expect(
      kandidat?.dublettenbefund,
      "Aktiv schlaegt Papierkorb — unveraendert. Genannt wird der Traeger, in den der Inhalt wirklich zurueckfliesst.",
    ).toEqual({
      ergebnis: "wiederverwendet",
      treffer: { art: "wissensobjekt", koId: aktiveId },
    });
  });

  // Der ERSTE Traeger gewinnt — dieselbe Determinismus-Regel wie bei der Papierkorb-Karte
  // (`service.ts`, `papierkorbAnker`). Ohne diesen Fall haenge die genannte Kennung an der
  // Reihenfolge, in der der Bestand gelesen wird, und zwei Laeufe naennten verschiedene Objekte.
  it("R1c · zwei aktive Traeger desselben Ankers → genannt wird deterministisch der ERSTE", async () => {
    const ctx = dienst();
    const ersteId = await importiereUndNimmAn(ctx, ANKER_ITEM);
    // Ein zweiter aktiver Traeger desselben Ankers, unmittelbar am Dienst angelegt (der
    // Produktweg wuerde den ersten revidieren — hier braucht es die Doppellage selbst).
    const zweite = await ctx.koService.create({
      title: "Zweiter Traeger desselben Ankers",
      statement: ANKER_ITEM.statement,
      type: "best_practice",
      category: "Wartung",
      author: "pedi",
      sources: [
        {
          id: "quelle-zweiter-traeger",
          label: "Zweiter Traeger",
          url: null,
          excerpt: null,
          kind: "external",
          peerValidated: false,
          provider: ANKER_ITEM.provider ?? null,
          externalId: ANKER_ITEM.externalId as string,
          sourceVersion: 1,
          author: "pedi",
          at: new Date(0).toISOString(),
        },
      ],
    });
    expect(zweite.id).not.toBe(ersteId);

    const laeufe = [];
    for (let i = 0; i < 3; i += 1) {
      const [kandidat] = await ctx.library.createImportCandidates(
        [{ ...ANKER_ITEM, sourceVersion: 2 + i }],
        "importeur",
        TEXTGLEICHHEIT,
      );
      laeufe.push(kandidat?.dublettenbefund);
    }

    expect(
      laeufe,
      "Drei Laeufe, dieselbe Kennung — die Auskunft haengt nicht an der Lesereihenfolge.",
    ).toEqual([
      { ergebnis: "wiederverwendet", treffer: { art: "wissensobjekt", koId: ersteId } },
      { ergebnis: "wiederverwendet", treffer: { art: "wissensobjekt", koId: ersteId } },
      { ergebnis: "wiederverwendet", treffer: { art: "wissensobjekt", koId: ersteId } },
    ]);
  });
});
