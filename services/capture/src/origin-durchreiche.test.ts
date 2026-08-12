// ================================================================================================
// JOB 679 / D2 (K1.2, Weg A) — DIE HERKUNFT UEBERLEBT DIE PERSISTENZGRENZE.
// ================================================================================================
//
// DER BEFUND (BASIC in JOB 679 D1, Glied 3 der dortigen Belegkette): `toKoInput` zaehlt die Felder
// des Entwurfs EINZELN auf, und `origin` war nicht darunter. Ein ueber das Word-Add-in erfasster
// Entwurf verlor seine Herkunft genau in dem Moment, in dem aus ihm ein Wissensobjekt wurde. Der
// Chip in Bibliothek und KO-Detail haette danach nie ausloesen koennen — eine Faehigkeit, deren
// Wirkung lautlos ausbleibt.
//
// WARUM HIER DER GANZE RUNDLAUF STEHT UND NICHT NUR `toKoInput`: ein Test, der allein die Abbildung
// prueft, belegt, dass ein Feld GESETZT wird — nicht, dass es ANKOMMT. Genau diese Verwechslung ist
// die Fehlerklasse, die in diesem Register unter `G23` steht („der Waechter beweist die
// Entscheidung, nicht ihre Wirkung"). Gemessen werden deshalb drei Glieder in Folge:
// `toKoInput` → `ko.create` → `ko.get`. Faellt eines aus, wird dieser Test rot.
//
// KEIN NETZ, KEINE DATENBANK: beide Dienste laufen auf ihren In-Memory-Repos.
import { describe, expect, it } from "vitest";
// Ueber die OEFFENTLICHE index.ts des Zielmoduls und nicht ueber `…/src/service` bzw. `…/src/repo`:
// die Architekturregel `module-boundaries` (.dependency-cruiser.cjs) laesst Cross-Modul-Importe
// ausschliesslich ueber die index.ts zu. Ein tiefer Import waere hier bequemer gewesen und haette
// `npm run arch` um zwei Verstoesse verlaengert — gemessen, nicht vermutet.
import { InMemoryKoRepo, KoService } from "../../knowledge-object";
import { InMemoryDraftRepo } from "./repo";
import { CaptureService } from "./service";
import type { DraftPayload } from "./types";

// Die vier Pflichtfelder, ohne die `toKoInput` mit `INCOMPLETE` abbricht — hier nur Beiwerk.
const VOLLSTAENDIG: DraftPayload = {
  title: "Ventil X schliesst bei Ueberdruck",
  statement: "Bei Ueberdruck Ventil X manuell schliessen.",
  type: "best_practice",
  category: "Anlage 1",
};

/**
 * Eine Herkunft, die der Vertrag NICHT kennt — ohne den Typ zu beugen.
 *
 * `NonNullable` und nicht schlicht `DraftPayload["origin"]`: das Projekt fährt
 * `exactOptionalPropertyTypes`, dort ist ein optionales Feld NICHT dasselbe wie eines, das
 * `undefined` tragen darf. Der Rueckgabetyp muss deshalb das `undefined` ausschliessen, sonst
 * liesse sich das Ergebnis gar nicht erst in einen `DraftPayload` einsetzen.
 */
function fremdeHerkunft(wert: string): NonNullable<DraftPayload["origin"]> {
  return wert as unknown as NonNullable<DraftPayload["origin"]>;
}

/** Der echte Weg: Entwurf anlegen, einreichen, Wissensobjekt zurueckLESEN. */
async function rundlauf(payload: DraftPayload) {
  const capture = new CaptureService({ repo: new InMemoryDraftRepo() });
  const kos = new KoService({ repo: new InMemoryKoRepo() });
  const draft = await capture.createDraft(payload, "anna");
  const input = await capture.toKoInput(draft.id);
  const erzeugt = await kos.create(input);
  const geladen = await kos.get(erzeugt.id);
  return { draft, input, erzeugt, geladen };
}

describe("JOB 679 D2: die Herkunft reist vom Entwurf ins Wissensobjekt", () => {
  it("word_addin kommt am gelesenen Wissensobjekt an", async () => {
    const { draft, input, erzeugt, geladen } = await rundlauf({
      ...VOLLSTAENDIG,
      origin: "word_addin",
    });

    // Glied 1 — der Entwurf traegt sie (das galt schon vor diesem Auftrag).
    expect(draft.payload.origin).toBe("word_addin");
    // Glied 2 — die Abbildung an der Persistenzgrenze gibt sie weiter. HIER war der Bruch.
    expect(input.origin, "toKoInput verwirft die Herkunft — genau der Befund aus D1").toBe(
      "word_addin",
    );
    // Glied 3 — sie steht im erzeugten UND im zurueckgelesenen Objekt.
    expect(erzeugt.origin).toBe("word_addin");
    expect(geladen?.origin, "die Herkunft ueberlebt das Zurueckladen nicht").toBe("word_addin");
  });

  it("frontdoor bleibt frontdoor — keine Verwechslung mit Word", async () => {
    const { geladen } = await rundlauf({ ...VOLLSTAENDIG, origin: "frontdoor" });
    expect(geladen?.origin).toBe("frontdoor");
    expect(geladen?.origin).not.toBe("word_addin");
  });

  it("ohne Herkunft entsteht KEIN Schluessel — kein stiller Default", async () => {
    const { input, geladen } = await rundlauf(VOLLSTAENDIG);
    // Bewusst am Schluessel gemessen und nicht am Wert: ein `origin: undefined` waere bereits eine
    // Aussage ueber die Herkunft, und additiv heisst, dass Altbestand den Schluessel gar nicht hat.
    expect(Object.hasOwn(input, "origin")).toBe(false);
    expect(geladen?.origin).toBeUndefined();
  });

  it("eine unbekannte Herkunft erreicht das Wissensobjekt nie", async () => {
    // `normalizeOriginIn` (service.ts) verwirft sie bereits am Entwurf. Dieser Fall haelt fest,
    // dass die neue Durchreiche daran NICHTS lockert — sonst wanderte beliebiger Client-Text in
    // den geteilten Pool.
    const { draft, input, geladen } = await rundlauf({
      ...VOLLSTAENDIG,
      origin: fremdeHerkunft("aus-dem-nichts"),
    });
    expect(draft.payload.origin).toBeUndefined();
    expect(Object.hasOwn(input, "origin")).toBe(false);
    expect(geladen?.origin).toBeUndefined();
  });

  it("eine leere Herkunft wird nicht zu word_addin geschoent", async () => {
    const { geladen } = await rundlauf({ ...VOLLSTAENDIG, origin: fremdeHerkunft("") });
    expect(geladen?.origin).toBeUndefined();
  });
});
