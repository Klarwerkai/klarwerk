import { describe, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import type { OverlapEntry, OverlapRepo } from "../../services/conflicts";
import type { TxContext } from "../../services/db-tx";
import type { WithTx } from "../../services/knowledge-object";
import {
  type App,
  type Konto,
  type Services,
  befund,
  belege,
  koAnlegen,
  welt,
} from "../eigene-ruecknahme/welt";

// ================================================================================================
// Auftrag gesamt-dubletten-rueckzug (R-1540, R-1547) — ZURÜCKZIEHEN UND WIEDERHERSTELLEN.
// ================================================================================================
//
// R-1540: die Autorin zieht ihre eigene Seite zurück — der Dublettenbefund geht mit, die Gegenseite
// bleibt unangetastet. R-1547: dafür gibt es EINEN Aufräumweg, benannt und atomar, ohne Altpfad.
// Das Wiederherstellen läuft über denselben benannten Weg (`imRuecknahmeVorgang`) und stellt nach
// Pedis Entscheidung (entscheidung:43017d60) NUR den eigenen Beitrag wieder her: ein durch den
// Rückzug geschlossener Befund bleibt geschlossen (keine Wiederöffnung — später gesondert
// entschieden), die Gegenseite bleibt unangetastet.
//
// Alle Fälle laufen über die ECHTE Verdrahtung (buildServices → buildApp) und die echten Routen
// (DELETE /api/kos/:id, POST /api/kos/:id/restore). Die Transaktionsgrenze gegen echtes Postgres
// misst rueckzug-atomar.integration.test.ts.

async function wiederherstellen(app: App, admin: Konto, id: string) {
  const res = await app.inject({
    method: "POST",
    url: `/api/kos/${id}/restore`,
    headers: admin.headers,
  });
  expect(res.statusCode).toBe(200);
}

async function zurueckziehen(app: App, konto: Konto, id: string) {
  const res = await app.inject({ method: "DELETE", url: `/api/kos/${id}`, headers: konto.headers });
  expect(res.statusCode).toBe(204);
}

async function befundVon(services: Services, id: string): Promise<OverlapEntry | undefined> {
  return services.overlaps.get(id);
}

describe("R-1540: die eigene Seite zurückziehen — der Befund geht mit, die Gegenseite bleibt", () => {
  it("Rückzug über die Route: Befund `withdrawn_own` mit der Autorin, ein Beleg, Gegenseite unverändert", async () => {
    const { app, services, autorin } = await welt();
    const a = await koAnlegen(app, autorin, "Ventil V3 zuerst", "Bei Überdruck V3 schließen.");
    const b = await koAnlegen(app, autorin, "Pumpe entlüften", "Die Pumpe alle 200 h entlüften.");
    const eintrag = await befund(services, a, b);
    const gegenseiteVorher = await services.ko.get(b);

    await zurueckziehen(app, autorin, a);

    const zu = await befundVon(services, eintrag.id);
    expect(zu?.status).toBe("geschlossen");
    expect(zu?.resolution).toMatchObject({ reason: "withdrawn_own", by: autorin.id, note: null });
    expect(await belege(services, "overlap.withdrawn-own", eintrag.id)).toHaveLength(1);
    // Der Beleg des weichen Löschens nennt, was dabei geschlossen wurde.
    const papierkorb = (await services.audit.list({ action: "ko.deleted" })).filter(
      (e) => e.target === a,
    );
    expect(papierkorb).toHaveLength(1);
    expect(papierkorb[0]?.payload).toEqual({
      trash: true,
      ueberschneidungenGeschlossen: 1,
      konflikteGeschlossen: 0,
    });
    // Die Gegenseite: an keinem gespeicherten Feld angefasst, kein Beleg an ihr. Verglichen wird
    // das Objekt ohne `aiCheck` — dort leitet die Lesefassung `ueberholt` aus dem BESTAND ab, und der
    // hat sich durch den Rückzug geändert (eine Ableitung beim Lesen, kein Schreibvorgang an B).
    const ohneAbleitung = (ko: Awaited<ReturnType<Services["ko"]["get"]>>) => {
      const { aiCheck: _abgeleitet, ...rest } = ko ?? ({} as NonNullable<typeof ko>);
      return rest;
    };
    expect(ohneAbleitung(await services.ko.get(b))).toEqual(ohneAbleitung(gegenseiteVorher));
    expect((await services.ko.get(b))?.aiCheck?.finishedAt).toBe(
      gegenseiteVorher?.aiCheck?.finishedAt,
    );
    expect(
      (await services.audit.list({})).filter((e) => e.target === b).map((e) => e.action),
    ).toEqual(["ko.created"]);
  });

  it("löscht eine andere Person (Admin) den Beitrag, bleibt es der systemische Abschluss", async () => {
    const { app, services, autorin, admin } = await welt();
    const a = await koAnlegen(app, autorin, "Ventil V3 zuerst", "Bei Überdruck V3 schließen.");
    const b = await koAnlegen(app, autorin, "Pumpe entlüften", "Die Pumpe alle 200 h entlüften.");
    const eintrag = await befund(services, a, b);

    await zurueckziehen(app, admin, a);

    expect((await befundVon(services, eintrag.id))?.resolution).toMatchObject({
      reason: "participant_deleted",
      by: null,
    });
  });
});

/** Das gespeicherte Objekt ohne die beim Lesen abgeleiteten Felder (s. R-1540 oben). */
async function gespeichert(services: Services, id: string) {
  const ko = await services.ko.get(id);
  const { aiCheck: _abgeleitet, ...rest } = ko ?? ({} as NonNullable<typeof ko>);
  return rest;
}

describe("Wiederherstellen: nur der eigene Beitrag kommt zurück (Entscheidung 43017d60)", () => {
  it("der Beitrag ist zurück, der Befund bleibt mit Grund und Urheber zu, die Gegenseite unberührt", async () => {
    const { app, services, autorin, admin } = await welt();
    const a = await koAnlegen(app, autorin, "Ventil V3 zuerst", "Bei Überdruck V3 schließen.");
    const b = await koAnlegen(app, autorin, "Pumpe entlüften", "Die Pumpe alle 200 h entlüften.");
    const eintrag = await befund(services, a, b);
    const eigeneVorher = await gespeichert(services, a);
    await zurueckziehen(app, autorin, a);
    const zu = await befundVon(services, eintrag.id);
    const gegenseiteVorher = await gespeichert(services, b);

    await wiederherstellen(app, admin, a);

    // Der eigene Beitrag steht wieder im Bestand — ohne Papierkorb-Felder, sonst wie vorher.
    const zurueck = await services.ko.get(a);
    expect(zurueck).toBeDefined();
    expect(zurueck).not.toHaveProperty("deletedAt");
    expect(zurueck).not.toHaveProperty("deletedBy");
    // `rowVersion` ist der Schreibzähler des Speichers (zwei Schreibvorgänge: Rückzug, Rückkehr).
    const { rowVersion: _zaehlerNachher, ...eigeneNachher } = await gespeichert(services, a);
    const { rowVersion: _zaehlerVorher, ...eigeneVorherOhneZaehler } = eigeneVorher;
    expect(eigeneNachher).toEqual(eigeneVorherOhneZaehler);
    expect((await services.ko.trashed()).map((k) => k.id)).not.toContain(a);
    // Der Befund: zeichengleich der Stand nach dem Rückzug — keine Wiederöffnung.
    expect(await befundVon(services, eintrag.id)).toEqual(zu);
    expect(zu?.resolution).toMatchObject({ reason: "withdrawn_own", by: autorin.id });
    expect(
      (await services.overlaps.unresolved()).filter((e) => e.pairKey === eintrag.pairKey),
    ).toEqual([]);
    expect(await belege(services, "overlap.withdrawal-reverted", eintrag.id)).toHaveLength(0);
    // Genau ein Beleg der Wiederherstellung, ohne Aufräumumfang.
    const restored = (await services.audit.list({ action: "ko.restored" })).filter(
      (e) => e.target === a,
    );
    expect(restored).toHaveLength(1);
    expect(restored[0]?.actor).toBe(admin.id);
    expect(restored[0]?.payload ?? {}).toEqual({});
    // Die Gegenseite: kein gespeichertes Feld angefasst, kein Beleg an ihr.
    expect(await gespeichert(services, b)).toEqual(gegenseiteVorher);
    expect(
      (await services.audit.list({})).filter((e) => e.target === b).map((e) => e.action),
    ).toEqual(["ko.created"]);
  });

  // Nach der Rückkehr liegen beide Seiten wieder im Bestand: wer das Paar sehen darf, liest den
  // Befund über den gewöhnlichen, redigierten Lesepfad — geschlossen, mit Grund und Urheber.
  it("der Befund bleibt nach dem Wiederherstellen für Berechtigte lesbar (geschlossen, Grund, Urheber)", async () => {
    const { app, services, autorin, admin } = await welt();
    const a = await koAnlegen(app, autorin, "Ventil V3 zuerst", "Bei Überdruck V3 schließen.");
    const b = await koAnlegen(app, autorin, "Pumpe entlüften", "Die Pumpe alle 200 h entlüften.");
    const eintrag = await befund(services, a, b);
    await zurueckziehen(app, autorin, a);
    await wiederherstellen(app, admin, a);

    for (const konto of [autorin, admin]) {
      const res = await app.inject({
        method: "GET",
        url: `/api/duplicates/${eintrag.id}`,
        headers: konto.headers,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        id: eintrag.id,
        status: "geschlossen",
        resolution: { reason: "withdrawn_own", by: autorin.id, at: expect.any(String) },
      });
    }
  });

  it("beide Seiten zurückgezogen, beide wiederhergestellt — der Befund bleibt zu", async () => {
    const { app, services, autorin, admin } = await welt();
    const a = await koAnlegen(app, autorin, "Ventil V3 zuerst", "Bei Überdruck V3 schließen.");
    const b = await koAnlegen(app, autorin, "Pumpe entlüften", "Die Pumpe alle 200 h entlüften.");
    const eintrag = await befund(services, a, b);
    await zurueckziehen(app, autorin, a);
    await zurueckziehen(app, autorin, b);
    const zu = await befundVon(services, eintrag.id);

    await wiederherstellen(app, admin, a);
    await wiederherstellen(app, admin, b);

    expect(await befundVon(services, eintrag.id)).toEqual(zu);
    expect(await services.ko.get(a)).toBeDefined();
    expect(await services.ko.get(b)).toBeDefined();
    expect(await belege(services, "overlap.withdrawal-reverted", eintrag.id)).toHaveLength(0);
  });

  it("ein menschlich entschiedener Befund bleibt geschlossen — Rückzug und Wiederherstellen ändern ihn nicht", async () => {
    const { app, services, autorin, admin } = await welt();
    const a = await koAnlegen(app, autorin, "Ventil V3 zuerst", "Bei Überdruck V3 schließen.");
    const b = await koAnlegen(app, autorin, "Pumpe entlüften", "Die Pumpe alle 200 h entlüften.");
    const c = await koAnlegen(app, autorin, "Filter wechseln", "Den Filter monatlich wechseln.");
    const entschieden = await befund(services, a, c);
    await services.overlaps.dismiss(entschieden.id, admin.id, "kein Duplikat");
    const vorher = await befundVon(services, entschieden.id);
    const zurueckgezogen = await befund(services, a, b);

    await zurueckziehen(app, autorin, a);
    await wiederherstellen(app, admin, a);

    expect(await befundVon(services, entschieden.id)).toEqual(vorher);
    expect((await befundVon(services, zurueckgezogen.id))?.resolution?.reason).toBe(
      "withdrawn_own",
    );
  });

  it("ein systemisch geschlossener Befund (fremde Löschung) bleibt beim Wiederherstellen zu", async () => {
    const { app, services, autorin, admin } = await welt();
    const a = await koAnlegen(app, autorin, "Ventil V3 zuerst", "Bei Überdruck V3 schließen.");
    const b = await koAnlegen(app, autorin, "Pumpe entlüften", "Die Pumpe alle 200 h entlüften.");
    const eintrag = await befund(services, a, b);
    await zurueckziehen(app, admin, a); // nicht die Autorin → participant_deleted

    await wiederherstellen(app, admin, a);

    expect((await befundVon(services, eintrag.id))?.resolution?.reason).toBe("participant_deleted");
  });

  it("trägt das Paar inzwischen einen anderen offenen Befund, bleiben beide, wie sie sind", async () => {
    const { app, services, autorin, admin } = await welt();
    const a = await koAnlegen(app, autorin, "Ventil V3 zuerst", "Bei Überdruck V3 schließen.");
    const b = await koAnlegen(app, autorin, "Pumpe entlüften", "Die Pumpe alle 200 h entlüften.");
    const alt = await befund(services, a, b);
    await zurueckziehen(app, autorin, a);
    // Ein zweiter Befund desselben Paars, angelegt, während A im Papierkorb lag (direkter Insert).
    const neu = await befund(services, a, b);
    expect(neu.id).not.toBe(alt.id);

    await wiederherstellen(app, admin, a);

    expect((await befundVon(services, alt.id))?.status).toBe("geschlossen");
    expect((await befundVon(services, neu.id))?.status).toBe("offen");
  });

  it("zweites Wiederherstellen desselben Beitrags: 404, nichts wird doppelt geschrieben", async () => {
    const { app, services, autorin, admin } = await welt();
    const a = await koAnlegen(app, autorin, "Ventil V3 zuerst", "Bei Überdruck V3 schließen.");
    const b = await koAnlegen(app, autorin, "Pumpe entlüften", "Die Pumpe alle 200 h entlüften.");
    await befund(services, a, b);
    await zurueckziehen(app, autorin, a);
    await wiederherstellen(app, admin, a);

    const zweites = await app.inject({
      method: "POST",
      url: `/api/kos/${a}/restore`,
      headers: admin.headers,
    });
    expect(zweites.statusCode).toBe(404);
    expect(
      (await services.audit.list({ action: "ko.restored" })).filter((e) => e.target === a),
    ).toHaveLength(1);
  });
});

// ================================================================================================
// R-1547 — EIN Aufräumweg: alle Schreiber auf DEMSELBEN Kontext, im Körper der Transaktion.
// ================================================================================================
//
// Nachgestellte Transaktion (wie tests/aufraeumen-atomar/aufraeumen-faehrt-in-der-transaktion):
// sie beweist die Verdrahtung — dass Schliessen, das Schreiben des Beitrags und sein
// Beleg den EINEN Kontext bekommen und in EINEM Körper laufen. Die echte Commit-/Rollback-Grenze
// misst die Integrationsdatei gegen Postgres.
describe("R-1547: Rückzug und Wiederherstellen schreiben in EINER Transaktion", () => {
  function aufbau() {
    const repos = inMemoryRepos();
    const derKontext: TxContext = { brand: "TxContext" };
    let imKoerper = false;
    let koerper = 0;
    let messen = false;
    const rufe: { was: string; tx: TxContext | undefined; imKoerper: boolean }[] = [];

    const echtesKoUpdate = repos.koRepo.update.bind(repos.koRepo);
    repos.koRepo.update = (ko, tx) => {
      if (messen) {
        rufe.push({ was: "ko.update", tx, imKoerper });
      }
      return echtesKoUpdate(ko, tx);
    };
    const echteUeberschneidungen = repos.overlapRepo;
    const ueberschneidungen: OverlapRepo = {
      insert: (e) => echteUeberschneidungen.insert(e),
      insertIfVersionsCurrent: (e, c) => echteUeberschneidungen.insertIfVersionsCurrent(e, c),
      supersedeIfOpen: (id, p) => echteUeberschneidungen.supersedeIfOpen(id, p),
      findById: (id) => {
        if (messen) rufe.push({ was: "overlap.findById", tx: undefined, imKoerper });
        return echteUeberschneidungen.findById(id);
      },
      all: () => {
        if (messen) rufe.push({ was: "overlap.all", tx: undefined, imKoerper });
        return echteUeberschneidungen.all();
      },
      update: (e) => echteUeberschneidungen.update(e),
      closeOpenForKo: (koId, patch, tx) => {
        if (messen) rufe.push({ was: "closeOpenForKo", tx, imKoerper });
        return echteUeberschneidungen.closeOpenForKo(koId, patch, tx);
      },
    };
    repos.overlapRepo = ueberschneidungen;
    const echtesAppend = repos.auditRepo.append.bind(repos.auditRepo);
    repos.auditRepo.append = (entry, tx) => {
      if (messen) {
        rufe.push({ was: `audit:${entry.action}`, tx, imKoerper });
      }
      return echtesAppend(entry, tx);
    };
    const withTx: WithTx = async (fn) => {
      koerper++;
      imKoerper = true;
      try {
        return await fn(derKontext);
      } finally {
        imKoerper = false;
      }
    };
    const services = assembleServices(repos, { withTx });
    buildApp(services);
    return {
      services,
      rufe,
      derKontext,
      koerper: () => koerper,
      messen: (an: boolean) => {
        messen = an;
      },
    };
  }

  async function paar(services: ReturnType<typeof aufbau>["services"]) {
    const neu = (title: string) =>
      services.ko.create({
        title,
        statement: `${title}: die Pumpe alle 200 Stunden entlüften.`,
        type: "best_practice",
        category: "Wartung",
        author: "nora",
      });
    const a = await neu("A");
    const b = await neu("B");
    const eintrag = await services.overlaps.createAuto(
      {
        koA: a.id,
        koB: b.id,
        relation: "identisch",
        aspects: [{ beschreibung: "gleich", zitatA: "entlüften", zitatB: "entlüften" }],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren",
      },
      { trigger: "manual", method: "deterministic", lexicalScore: 0.95 },
      "system",
    );
    return { a, b, eintrag };
  }

  it("Rückzug: Schliessen, Papierkorb-Schreiben und Belege — ein Körper, ein Kontext, Aufräumen zuerst", async () => {
    const { services, rufe, derKontext, koerper, messen } = aufbau();
    const { a } = await paar(services);
    messen(true);
    const vorher = koerper();

    await services.ko.delete(a.id, "nora");

    expect(koerper() - vorher).toBe(1);
    expect(rufe.map((r) => r.was)).toEqual([
      "closeOpenForKo",
      "audit:overlap.withdrawn-own",
      "ko.update",
      "audit:ko.deleted",
    ]);
    for (const ruf of rufe) {
      expect(ruf.imKoerper, ruf.was).toBe(true);
      expect(ruf.tx, ruf.was).toBe(derKontext);
    }
  });

  it("Wiederherstellen: Zurückholen und Beleg — derselbe Weg, ein Körper, ein Kontext, kein Befund-Zugriff", async () => {
    const { services, rufe, derKontext, koerper, messen } = aufbau();
    const { a, eintrag } = await paar(services);
    await services.ko.delete(a.id, "nora");
    const zu = await services.overlaps.get(eintrag.id);
    messen(true);
    const vorher = koerper();

    await services.ko.restore(a.id, "admin");

    expect(koerper() - vorher).toBe(1);
    // Entscheidung 43017d60: das Wiederherstellen fasst den Überschneidungsspeicher nicht an —
    // weder lesend noch schreibend. Nur der eigene Beitrag und sein Beleg, in EINER Transaktion.
    expect(rufe.map((r) => r.was)).toEqual(["ko.update", "audit:ko.restored"]);
    for (const ruf of rufe) {
      expect(ruf.imKoerper, ruf.was).toBe(true);
      expect(ruf.tx, ruf.was).toBe(derKontext);
    }
    expect(await services.overlaps.get(eintrag.id)).toEqual(zu);
  });

  // Die Zustandsprüfung nach einem Ausfall (Beitrag bleibt im Papierkorb, Befund unverändert,
  // auch nach Journal-Replay) steht in atomar-ohne-datenbank.test.ts (echte Ablagen, Klammer der
  // Kompositionswurzel) und für PostgreSQL in rueckzug-atomar.integration.test.ts. Diese Welt hier
  // hat nur eine nachgestellte Klammer ohne Rollback und misst deshalb nur die Verdrahtung.
});
