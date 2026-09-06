// ================================================================================================
// JOB 3116 · R3 — DAS SIGNAL WIRD UMBENANNT, DIE ENTSCHEIDUNG NICHT.
// ================================================================================================
//
// DAS ECHTE RISIKO DIESES AUFTRAGS (Pruefpunkt 6): wer den Anker-Zweig auf `wiederverwendet`
// umbenennt, ohne `kandidatErzeugtWissensobjekt` mitzuziehen, bricht den Confluence-/Jira-Re-Sync
// STILL — ein Wiederimport legte dann kein Update mehr an, sondern quittierte ohne Kennung. Das ist
// kein Anzeigefehler: der Bestand wuerde stehen bleiben, waehrend die Quelle weiterlaeuft.
//
// GEGENPROBE (Pflicht, gefahren und in der RUECKGABE woertlich belegt):
//   In `services/library-analytics/src/service.ts` `kandidatErzeugtWissensobjekt` auf
//     `return !candidate.duplicate
//        && candidate.dublettenbefund?.ergebnis !== "pruefung_nicht_moeglich"
//        && candidate.dublettenbefund?.ergebnis !== "wiederverwendet";`
//   stellen → R3 wird rot („expected null to be 'ko-…'"), R1/R2 bleiben gruen. Damit ist gemessen,
//   dass diese Datei wirklich die ENTSCHEIDUNG haelt und nicht nur das Wort.
import { describe, expect, it } from "vitest";
import {
  ANKER_ITEM,
  TEXTGLEICHHEIT,
  dienst,
  importiereUndNimmAn,
  traegerDesAnkers,
} from "./helfer";

describe("JOB 3116 · R3 — der `accept` auf `wiederverwendet` bleibt der Re-Sync", () => {
  it("R3 · accept → DIESELBE bestehende Kennung, kein zweites Objekt, der Inhalt ist revidiert", async () => {
    const ctx = dienst();
    const aktiveId = await importiereUndNimmAn(ctx, ANKER_ITEM);
    ctx.create.mockClear();
    ctx.revise.mockClear();

    const [kandidat] = await ctx.library.createImportCandidates(
      [{ ...ANKER_ITEM, sourceVersion: 2, statement: `${ANKER_ITEM.statement} (Fassung 2)` }],
      "importeur",
      TEXTGLEICHHEIT,
    );
    expect(
      kandidat?.dublettenbefund?.ergebnis,
      "Vorbedingung: dieser Kandidat traegt wirklich den neuen Ausgang.",
    ).toBe("wiederverwendet");

    const beschieden = await ctx.library.reviewImportCandidate(
      kandidat?.id as string,
      "accept",
      "pruefer",
    );

    expect(beschieden.status).toBe("angenommen");
    expect(
      beschieden.koId,
      "Der Re-Sync nennt die BESTEHENDE Kennung — genau das ist die Wiederverwendung.",
    ).toBe(aktiveId);
    expect(ctx.create, "Es wurde nichts ANGELEGT.").not.toHaveBeenCalled();
    expect(
      await traegerDesAnkers(ctx, "test", ANKER_ITEM.externalId as string),
      "GENAU EIN aktives Wissensobjekt traegt diesen Anker.",
    ).toEqual([aktiveId]);
    const aktiv = (await ctx.koService.list()).find((ko) => ko.id === aktiveId);
    expect(
      aktiv?.statement,
      "Und die hoehere Quellversion ist wirklich eingeflossen — sonst waere der Re-Sync ein leeres Wort.",
    ).toBe(`${ANKER_ITEM.statement} (Fassung 2)`);
  });

  it("R3b · derselbe Stand (No-op-Re-Sync) wird ebenfalls angenommen, ohne Anlage", async () => {
    const ctx = dienst();
    const aktiveId = await importiereUndNimmAn(ctx, ANKER_ITEM);
    ctx.create.mockClear();

    const [kandidat] = await ctx.library.createImportCandidates(
      [{ ...ANKER_ITEM, sourceVersion: 2 }],
      "importeur",
      TEXTGLEICHHEIT,
    );
    const beschieden = await ctx.library.reviewImportCandidate(
      kandidat?.id as string,
      "accept",
      "pruefer",
    );

    expect(beschieden.koId).toBe(aktiveId);
    expect(ctx.create).not.toHaveBeenCalled();
    expect(await ctx.koService.list(), "Ein Objekt, nicht zwei.").toHaveLength(1);
  });
});
