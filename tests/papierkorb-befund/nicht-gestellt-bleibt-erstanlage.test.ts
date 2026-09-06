// ================================================================================================
// JOB 3116 · R2 — `nicht_gestellt` HEISST AB JETZT GENAU EINE SACHE: ES GIBT KEINEN BESTANDSTRAEGER.
// ================================================================================================
//
// Die Doppeldeutigkeit war der Fehler (R1). Sie ist nur dann wirklich aufgeloest, wenn die zweite
// Haelfte NICHT mitwandert: ein Anker, der weder aktiv im Bestand noch im Papierkorb liegt, ist eine
// ERSTANLAGE und bleibt Wort fuer Wort `nicht_gestellt`. Wuerde auch dieser Fall `wiederverwendet`
// heissen, stuende an einem Kandidaten, der ein NEUES Objekt anlegt, „vorhanden … wiederverwendet" —
// die Luege in die andere Richtung.
import { describe, expect, it } from "vitest";
import { ANKER_ITEM, TEXTGLEICHHEIT, dienst } from "./helfer";

describe("JOB 3116 · R2 — die Erstanlage wird nicht mitgenommen", () => {
  it("R2 · Anker weder aktiv noch im Papierkorb → unveraendert `nicht_gestellt`, ohne Kennung", async () => {
    const ctx = dienst();

    const [kandidat] = await ctx.library.createImportCandidates(
      [ANKER_ITEM],
      "importeur",
      TEXTGLEICHHEIT,
    );

    expect(await ctx.koService.list(), "Vorbedingung: der Bestand ist leer.").toHaveLength(0);
    expect(await ctx.koService.trashed(), "Vorbedingung: der Papierkorb ist leer.").toHaveLength(0);
    expect(
      kandidat?.dublettenbefund,
      "Keine Kennung, weil es keine gibt — `nicht_gestellt` ist hier die ehrliche Aussage.",
    ).toEqual({ ergebnis: "nicht_gestellt" });
  });

  it("R2b · und dieser Kandidat legt weiterhin ein NEUES Wissensobjekt an", async () => {
    const ctx = dienst();
    const [kandidat] = await ctx.library.createImportCandidates(
      [ANKER_ITEM],
      "importeur",
      TEXTGLEICHHEIT,
    );

    const beschieden = await ctx.library.reviewImportCandidate(
      kandidat?.id as string,
      "accept",
      "pruefer",
    );

    expect(beschieden.koId, "Die Erstanlage bleibt eine Anlage.").toEqual(expect.any(String));
    expect(ctx.create, "Und sie laeuft wirklich ueber `create`.").toHaveBeenCalledTimes(1);
  });

  it("R2c · ein Anker im PAPIERKORB bleibt `im_papierkorb` — die neue Aussage verdraengt sie nicht", async () => {
    const ctx = dienst();
    const [erster] = await ctx.library.createImportCandidates(
      [ANKER_ITEM],
      "importeur",
      TEXTGLEICHHEIT,
    );
    const getrashteId = (
      await ctx.library.reviewImportCandidate(erster?.id as string, "accept", "pedi")
    ).koId as string;
    await ctx.koService.delete(getrashteId, "pedi");

    const [kandidat] = await ctx.library.createImportCandidates(
      [{ ...ANKER_ITEM, sourceVersion: 2 }],
      "importeur",
      TEXTGLEICHHEIT,
    );

    expect(
      kandidat?.dublettenbefund,
      "Die beiden Aussagen sind verschieden und bleiben es: getrasht ist nicht wiederverwendet.",
    ).toEqual({
      ergebnis: "im_papierkorb",
      treffer: { art: "wissensobjekt", koId: getrashteId },
    });
    expect(kandidat?.duplicate, "Fail-closed wie seit JOB 3081.").toBe(true);
  });
});
