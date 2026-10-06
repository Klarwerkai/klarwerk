// Aufnahme gesamt-auditprotokoll · Lauf 5, Nacharbeit 5 — die Bewertung übersteht MEHR als einen
// verlorenen Compare-and-Set.
//
// Befund (Prüflauf am Kandidaten e6038804, „BEN-R2-B1 · down + up, Quorum 1 gleichzeitig über zwei
// Instanzen"): die Rot-Stimme endete mit 400 `STALE_WRITE`, das Objekt stand „validiert" — die
// Stimme war verloren. `KoService.setValidationStateMitBeleg` las nach einem verlorenen
// Compare-and-Set nur EINMAL frisch. Schrieb neben der zweiten Instanz noch ein dritter Weg dieselbe
// Zeile (die KI-Prüfung der frischen Anlage), verlor auch der zweite Versuch.
//
// Hier wird das Verlieren ohne Datenbank geführt: die Transaktionsklammer ist nachgestellt, und
// `koRepo.update` meldet im Körper `STALE_WRITE`, so oft der Fall es verlangt — so, wie
// `PgKoRepo.update` es bei einer überholten rowVersion tut. Weil `update` vor jedem Beleg scheitert,
// hinterlässt ein verlorener Versuch nichts. Der PostgreSQL-Weg desselben Falls steht in
// `kette-und-beleg-atomar.integration.test.ts` (BEN-R2-B1).
import { describe, expect, it } from "vitest";
import { assembleServices, inMemoryRepos } from "../../services/app/src/build-app";
import type { TxContext } from "../../services/db-tx";
import { KoError, type WithTx } from "../../services/knowledge-object";

async function buehne() {
  const repos = inMemoryRepos();
  const kontext: TxContext = { brand: "TxContext" };
  const withTx: WithTx = (fn) => fn(kontext);
  const lage = { verlieren: 0, versuche: 0 };
  const echtesUpdate = repos.koRepo.update.bind(repos.koRepo);
  repos.koRepo.update = (ko, tx) => {
    if (tx && lage.verlieren > 0) {
      lage.versuche += 1;
      lage.verlieren -= 1;
      return Promise.reject(
        new KoError("STALE_WRITE", "Nebenläufige Änderung — bitte erneut lesen und anwenden."),
      );
    }
    return echtesUpdate(ko, tx);
  };
  const services = assembleServices(repos, { withTx });
  await services.validation.setDefaultNeededValidations(1, "nacharbeit-5");
  const ko = await services.ko.create({
    title: "Dichtungswechsel L4",
    statement: "Dichtung vor jedem Anlauf prüfen.",
    type: "best_practice",
    category: "Instandhaltung",
    confidentiality: "intern",
    author: "autorin",
  });
  return { services, ko, lage };
}

describe("Nacharbeit 5 · Bewertung nach verlorenem Compare-and-Set", () => {
  it("zweimal verloren (andere Instanz, dann KI-Prüfung) → die Stimme wirkt beim dritten Versuch, mit genau einem Beleg", async () => {
    const { services, ko, lage } = await buehne();
    lage.verlieren = 2;
    const ergebnis = await services.validation.rate(ko.id, "pruefer", "up");
    expect(lage.verlieren).toBe(0);
    expect(lage.versuche).toBe(2);
    expect(ergebnis.status).toBe("validiert");
    expect((await services.ko.get(ko.id))?.status).toBe("validiert");
    const belege = (await services.audit.list({ action: "ko.rated" })).filter(
      (e) => e.target === ko.id,
    );
    expect(belege).toHaveLength(1);
    expect(ergebnis.validationDecisionRef).toEqual({
      auditSeq: belege[0]?.seq,
      auditHash: belege[0]?.hash,
    });
  });

  it("dauerhaft verloren → nach fünf Versuchen kommt STALE_WRITE an, und es bleibt nichts", async () => {
    const { services, ko, lage } = await buehne();
    const auditVorher = (await services.audit.list()).length;
    lage.verlieren = 99;
    await expect(services.validation.rate(ko.id, "pruefer", "down")).rejects.toMatchObject({
      code: "STALE_WRITE",
    });
    expect(lage.versuche).toBe(5);
    lage.verlieren = 0;
    expect((await services.ko.get(ko.id))?.status).toBe("offen");
    expect((await services.audit.list()).length).toBe(auditVorher);
  });
});
