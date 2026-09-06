// ================================================================================================
// JOB 3116 · Q2c — DER GEMEINSAME AUFBAU DER DREI DIENST-FAELLE (R1/R2/R3).
// ================================================================================================
//
// Derselbe Aufbau wie in `tests/re-import-dubletten/papierkorb-anker.test.ts`: der ECHTE `KoService`
// auf `InMemoryKoRepo`, der ECHTE `LibraryService` mit `externalUpsert: true`. Kein handgebautes
// Doppel — gemessen wird eine Aussage ueber den WIRKLICHEN Bestand („liegt dieser Anker aktiv?"),
// und ein Doppel muesste genau die Antwort behaupten, die hier zur Debatte steht.
import { vi } from "vitest";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import type { DublettenPruefung, ImportItem } from "../../services/library-analytics";
import { InMemoryCandidateRepo, LibraryService } from "../../services/library-analytics";

/** Das Quellobjekt, das zweimal kommt — Anker (provider + externalId) und Inhalt. */
export const ANKER_ITEM: ImportItem = {
  title: "Wartungsplan Anlage 3",
  statement: "Den Filter der Anlage 3 jaehrlich wechseln",
  type: "best_practice",
  category: "Wartung",
  provider: "test",
  externalId: "q2c-anker-20260906",
  sourceVersion: 1,
};

/**
 * Eine EHRLICHE Textpruefung aus dem gereichten Vergleichsbestand. Sie ist im Anker-Strang nie
 * gefragt (die Textfrage wird dort per Entscheid nicht gestellt) — aber eine immer-`false`-Attrappe
 * wuerde R2 gruen faerben, ohne etwas zu messen.
 */
export const TEXTGLEICHHEIT: DublettenPruefung = (item, bestand) => {
  const treffer = bestand.find((ko) => ko.title === item.title && ko.statement === item.statement);
  return treffer ? { dublette: true, koId: treffer.id, aehnlichkeit: 1 } : { dublette: false };
};

export function dienst() {
  const repo = new InMemoryKoRepo();
  const koService = new KoService({ repo });
  const candidates = new InMemoryCandidateRepo();
  const library = new LibraryService({ koService, candidates, externalUpsert: true });
  // Die Zaehler liegen AUF dem echten Dienst: sie veraendern nichts und belegen, ob wirklich
  // ANGELEGT (create) oder wiederverwendet (revise) wurde — der Rueckgabewert allein saehe ein
  // still erzeugtes zweites Objekt nicht.
  const create = vi.spyOn(koService, "create");
  const revise = vi.spyOn(koService, "revise");
  return { repo, koService, candidates, library, create, revise };
}

export type Ctx = ReturnType<typeof dienst>;

/** Der Produktweg zum AKTIVEN Anker: einspielen und annehmen. Liefert die Kennung des Traegers. */
export async function importiereUndNimmAn(ctx: Ctx, item: ImportItem): Promise<string> {
  const [kandidat] = await ctx.library.createImportCandidates([item], "importeur", TEXTGLEICHHEIT);
  if (!kandidat) {
    throw new Error("Vorbedingung verletzt: kein Kandidat eingereiht.");
  }
  const beschieden = await ctx.library.reviewImportCandidate(kandidat.id, "accept", "pedi");
  if (!beschieden.koId) {
    throw new Error("Vorbedingung verletzt: der erste Accept hat kein Wissensobjekt erzeugt.");
  }
  return beschieden.koId;
}

/** Wie viele AKTIVE Wissensobjekte tragen diesen Herkunfts-Anker? */
export async function traegerDesAnkers(
  ctx: Ctx,
  provider: string,
  externalId: string,
): Promise<string[]> {
  const alle = await ctx.koService.list();
  return alle
    .filter((ko) =>
      (ko.sources ?? []).some((q) => q.provider === provider && q.externalId === externalId),
    )
    .map((ko) => ko.id);
}
