// ================================================================================================
// produkt:20261010:aenderungsfolgen-sichtbar — STAND, ANLASS UND WIEDERHOLUNG AM DIENST.
// ================================================================================================
//
// Echte `KoService`-, `LifecycleService`- und `AuditService`-Instanzen auf Speicherablagen; die
// Routen und die Sichtbarkeit misst `folgepruefung-route.test.ts`, das echte PostgreSQL (Sperren,
// Transaktion, Parallelität) `folgepruefung-stand.integration.test.ts`.
//
//   K5  Die Bestätigung gilt genau dem gesehenen Stand: eine zweite Änderung zwischen Anzeige und
//       Bestätigung lässt die offene Prüfung stehen — auch, wenn sie genau zwischen Vorprüfung und
//       Löschen eintrifft; eine Wiederholung legt keine zweite Fassung an.
//   K7  Ein wiederholtes identisches Signal legt keinen neuen Anlass, keinen neuen Stand und keinen
//       zweiten Prüfprotokolleintrag (also keine zweite Glockenmeldung) an.
//   K1  Der Anlass nennt Anlage, Änderungsbeleg, auslösenden Eintrag und die Fassungen.
//   K4  `offeneFaelle` schreibt nichts; die Selbstheilung bleibt der Arbeitsbereichsweg und ist
//       kein fachlicher Abschluss (kein `ko.revalidated`).
//   K5/Abgrenzung  „Stimmt weiterhin" (Frische-Signal) räumt keine offene Folgeprüfung.
import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import {
  FolgepruefungStandError,
  InMemoryLifecycleRepo,
  type LifecycleRepo,
  LifecycleService,
  REVALIDIERUNG_ANGEFORDERT,
} from "../../services/lifecycle";

async function welt(repo: LifecycleRepo = new InMemoryLifecycleRepo()) {
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const koRepo = new InMemoryKoRepo();
  const ko = new KoService({ repo: koRepo, audit });
  let jetzt = Date.parse("2026-10-10T08:00:00.000Z");
  const lifecycle = new LifecycleService({
    koService: ko,
    repo,
    audit,
    uhr: () => {
      jetzt += 60_000;
      return jetzt;
    },
  });
  const anlegen = (title: string, author = "anna") =>
    ko.create({
      title,
      statement: `${title} — fiktive Aussage.`,
      type: "best_practice",
      category: "Dosierung",
      author,
    });
  const a = await anlegen("Dosierpumpe DP-4 entlüften");
  const b = await anlegen("Dosiermenge DP-4 einstellen");
  const c = await anlegen("Förderband im Versand spannen");
  await lifecycle.couple("Dosierstation DP-4", a.id);
  await lifecycle.couple("Dosierstation DP-4", b.id);
  await lifecycle.couple("Förderband F-1", c.id);
  // Der Prüfweg selbst ist nicht Gegenstand dieser Datei (Muster: tests/wissen-frische/zustellung).
  const validieren = async (id: string): Promise<void> => {
    const gespeichert = await koRepo.findById(id);
    if (!gespeichert) {
      throw new Error("Aufbau: das angelegte Objekt fehlt in der Ablage.");
    }
    await koRepo.update({ ...gespeichert, status: "validiert", trust: 90 });
  };
  return { audit, ko, lifecycle, repo, validieren, a, b, c };
}

async function fall(lifecycle: LifecycleService, koId: string) {
  const [f] = await lifecycle.offeneFaelle([koId]);
  return f;
}

describe("K1 · der Anlass belegt, warum ein Eintrag betroffen ist", () => {
  it("Anlagenänderung: Anlage, Änderungsbeleg, Fassung beim Eingang; der unbeteiligte bleibt frei", async () => {
    const w = await welt();
    const markiert = await w.lifecycle.meldeAnlagenaenderung(
      "Dosierstation DP-4",
      "carla",
      "Rev. B",
    );
    expect(markiert.map((m) => m.koId).sort()).toEqual([w.a.id, w.b.id].sort());
    expect(markiert.every((m) => m.neu && m.stand === 1)).toBe(true);

    const f = await fall(w.lifecycle, w.a.id);
    expect(f?.stand).toBe(1);
    expect(f?.seit).toBeTruthy();
    expect(f?.anlaesse).toHaveLength(1);
    expect(f?.anlaesse[0]).toMatchObject({
      grund: "anlage",
      assetRef: "Dosierstation DP-4",
      aenderung: "Rev. B",
      von: "carla",
      koVersion: 1,
    });
    expect(await fall(w.lifecycle, w.c.id), "der unbeteiligte Eintrag").toBeUndefined();
  });

  it("Nachbarauslöser: auslösender Eintrag samt Fassung und die gemeinsame Anlage je Betroffenem", async () => {
    const w = await welt();
    await w.lifecycle.meldeNachbaraenderung(w.a.id, "dora");
    const f = await fall(w.lifecycle, w.b.id);
    expect(f?.anlaesse[0]).toMatchObject({
      grund: "nachbar",
      assetRef: "Dosierstation DP-4",
      ausgeloestVon: w.a.id,
      ausgeloestVonVersion: 1,
      koVersion: 1,
    });
  });

  it("der Prüfprotokolleintrag behält seine Form — nur ein Änderungsbeleg kommt hinzu", async () => {
    const w = await welt();
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. B");
    const belege = await w.audit.list({ action: REVALIDIERUNG_ANGEFORDERT });
    expect(belege.map((b) => b.payload)).toEqual([
      { grund: "anlage", assetRef: "Dosierstation DP-4", aenderung: "Rev. B" },
      { grund: "anlage", assetRef: "Dosierstation DP-4", aenderung: "Rev. B" },
    ]);
  });
});

describe("K7 · wiederholte identische Signale sind idempotent", () => {
  it("dieselbe Änderung zweimal gemeldet: kein neuer Stand, kein neuer Anlass, kein zweiter Beleg", async () => {
    const w = await welt();
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. B");
    const zweite = await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "emil", "Rev. B");
    expect(zweite.map((m) => [m.stand, m.neu])).toEqual([
      [1, false],
      [1, false],
    ]);
    expect((await fall(w.lifecycle, w.a.id))?.anlaesse).toHaveLength(1);
    expect(await w.audit.list({ action: REVALIDIERUNG_ANGEFORDERT })).toHaveLength(2);
  });

  it("auch die wiederholte Anforderung aus der Bibliothek legt nichts doppelt an", async () => {
    const w = await welt();
    await w.lifecycle.requestRevalidation(w.c.id, "emil");
    await w.lifecycle.requestRevalidation(w.c.id, "frieda");
    const f = await fall(w.lifecycle, w.c.id);
    expect(f?.stand).toBe(1);
    expect(f?.anlaesse).toHaveLength(1);
    expect(await w.audit.list({ action: REVALIDIERUNG_ANGEFORDERT })).toHaveLength(1);
  });

  it("GEGENPROBE: eine WEITERE Änderung (anderer Beleg) erhöht den Stand und hängt einen Anlass an", async () => {
    const w = await welt();
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. B");
    const weitere = await w.lifecycle.meldeAnlagenaenderung(
      "Dosierstation DP-4",
      "carla",
      "Rev. C",
    );
    expect(weitere.every((m) => m.neu && m.stand === 2)).toBe(true);
    const f = await fall(w.lifecycle, w.a.id);
    expect(f?.anlaesse.map((x) => x.aenderung)).toEqual(["Rev. B", "Rev. C"]);
    expect(await w.audit.list({ action: REVALIDIERUNG_ANGEFORDERT })).toHaveLength(4);
  });
});

describe("K5 · die Bestätigung gilt genau dem gesehenen Stand", () => {
  it("passender Stand: neue Fassung, Fall geräumt, Beleg nennt den bestätigten Stand", async () => {
    const w = await welt();
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. B");
    const bestaetigt = await w.lifecycle.confirmStillValid(w.a.id, "anna", 1);
    expect(bestaetigt.version).toBe(2);
    expect(await fall(w.lifecycle, w.a.id)).toBeUndefined();
    const reval = await w.audit.list({ action: "ko.revalidated", target: w.a.id });
    expect(reval.map((e) => e.payload)).toEqual([
      { pendingCleared: true, geprueftStand: 1, version: 2 },
    ]);
    // Der Nachbar an derselben Anlage bleibt offen — jede Bestätigung gilt ihrem Eintrag.
    expect((await fall(w.lifecycle, w.b.id))?.stand).toBe(1);
  });

  it("zweite Änderung zwischen Anzeige und Bestätigung: 409-Fehler, keine Fassung, Fall bleibt offen", async () => {
    const w = await welt();
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. B");
    const angezeigt = (await fall(w.lifecycle, w.a.id))?.stand;
    expect(angezeigt).toBe(1);
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. C");

    const versuch = w.lifecycle.confirmStillValid(w.a.id, "anna", angezeigt);
    await expect(versuch).rejects.toBeInstanceOf(FolgepruefungStandError);
    await expect(w.lifecycle.confirmStillValid(w.a.id, "anna", 1)).rejects.toMatchObject({
      code: "STAND_VERALTET",
      aktuellerStand: 2,
    });
    expect((await w.ko.get(w.a.id))?.version).toBe(1);
    expect((await fall(w.lifecycle, w.a.id))?.stand).toBe(2);
    expect(await w.audit.list({ action: "ko.revalidated" })).toEqual([]);

    // Nach Prüfung des NEUEN Stands gelingt der Abschluss.
    expect((await w.lifecycle.confirmStillValid(w.a.id, "anna", 2)).version).toBe(2);
    expect(await fall(w.lifecycle, w.a.id)).toBeUndefined();
  });

  it("die Änderung trifft GENAU zwischen Vorprüfung und Löschen ein: das bedingte Löschen hält", async () => {
    // Die Vorprüfung sieht Stand 1; unmittelbar vor dem Löschen geht Rev. C ein. Gemessen am
    // ECHTEN Speicher — die Attrappe schiebt nur die Meldung in den Augenblick davor.
    const inner = new InMemoryLifecycleRepo();
    const melder: { vorher: (() => Promise<void>) | undefined } = { vorher: undefined };
    const repo = new Proxy(inner, {
      get(ziel, name, empfaenger) {
        if (name === "clearPending") {
          return async (...args: Parameters<InMemoryLifecycleRepo["clearPending"]>) => {
            const meldung = melder.vorher;
            melder.vorher = undefined;
            await meldung?.();
            return ziel.clearPending(...args);
          };
        }
        const wert = Reflect.get(ziel, name, empfaenger);
        return typeof wert === "function" ? wert.bind(ziel) : wert;
      },
    });
    const w = await welt(repo);
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. B");
    melder.vorher = async () => {
      await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. C");
    };
    await expect(w.lifecycle.confirmStillValid(w.a.id, "anna", 1)).rejects.toMatchObject({
      code: "STAND_VERALTET",
    });
    expect((await w.ko.get(w.a.id))?.version).toBe(1);
    const f = await fall(w.lifecycle, w.a.id);
    expect(f?.stand).toBe(2);
    expect(f?.anlaesse.map((x) => x.aenderung)).toEqual(["Rev. B", "Rev. C"]);
    expect(await w.audit.list({ action: "ko.revalidated" })).toEqual([]);
  });

  it("Wiederholung derselben Bestätigung (zweiter Klick, zweite Person): keine zweite Fassung", async () => {
    const w = await welt();
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. B");
    const [erste, zweite] = await Promise.allSettled([
      w.lifecycle.confirmStillValid(w.a.id, "anna", 1),
      w.lifecycle.confirmStillValid(w.a.id, "bert", 1),
    ]);
    const erfolge = [erste, zweite].filter((r) => r.status === "fulfilled");
    expect(erfolge, "genau eine Bestätigung gelingt").toHaveLength(1);
    expect((await w.ko.get(w.a.id))?.version).toBe(2);
    expect(await w.audit.list({ action: "ko.revalidated" })).toHaveLength(1);
    await expect(w.lifecycle.confirmStillValid(w.a.id, "anna", 1)).rejects.toMatchObject({
      code: "STAND_VERALTET",
      aktuellerStand: null,
    });
    expect((await w.ko.get(w.a.id))?.version).toBe(2);
  });

  it("Ausfall nach dem Löschen (ohne Transaktion): der Fall kommt MIT Stand und Anlässen zurück", async () => {
    const inner = new InMemoryLifecycleRepo();
    const scharf = { an: false };
    const repo = new Proxy(inner, {
      get(ziel, name, empfaenger) {
        if (name === "clearPending") {
          return async (...args: Parameters<InMemoryLifecycleRepo["clearPending"]>) => {
            const geloescht = await ziel.clearPending(...args);
            if (scharf.an) {
              throw new Error("CLEAR_REPLY_LOST");
            }
            return geloescht;
          };
        }
        const wert = Reflect.get(ziel, name, empfaenger);
        return typeof wert === "function" ? wert.bind(ziel) : wert;
      },
    });
    const w = await welt(repo);
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. B");
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. C");
    scharf.an = true;
    await expect(w.lifecycle.confirmStillValid(w.a.id, "anna", 2)).rejects.toThrow(
      "CLEAR_REPLY_LOST",
    );
    const f = await fall(w.lifecycle, w.a.id);
    expect(f?.stand).toBe(2);
    expect(f?.anlaesse.map((x) => x.aenderung)).toEqual(["Rev. B", "Rev. C"]);
    expect((await w.ko.get(w.a.id))?.version).toBe(1);
  });

  // Nacharbeit 4 (Ben, K5): die frühere Erwartung „ohne Stand bestätigt den aktuellen Inhalt" war
  // genau der Fehler — eine zwischenzeitliche Änderung wurde ungeprüft gelöscht.
  it("ohne Stand wird KEINE offene Folgeprüfung abgeschlossen — 409, Fall und Fassung bleiben", async () => {
    const w = await welt();
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. B");
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. C");
    await expect(w.lifecycle.confirmStillValid(w.a.id, "anna")).rejects.toMatchObject({
      code: "STAND_VERALTET",
      aktuellerStand: 2,
    });
    expect((await w.ko.get(w.a.id))?.version).toBe(1);
    expect((await fall(w.lifecycle, w.a.id))?.stand).toBe(2);
    expect(await w.audit.list({ action: "ko.revalidated" })).toEqual([]);
  });

  it("GEGENPROBE: ohne offenen Fall bleibt die reine Gültigkeitsbestätigung ohne Stand möglich", async () => {
    const w = await welt();
    expect((await w.lifecycle.confirmStillValid(w.c.id, "anna")).version).toBe(2);
    const reval = await w.audit.list({ action: "ko.revalidated", target: w.c.id });
    expect(reval.map((e) => e.payload)).toEqual([{ pendingCleared: false, version: 2 }]);
  });

  // Nacharbeit 6 (Ben): der Stand allein genügt nicht — die angezeigte Inhaltsfassung gehört dazu.
  it("Inhalt zwischen Anzeige und Bestätigung überarbeitet: KO_STALE, keine Fassung, Fall bleibt", async () => {
    const w = await welt();
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. B");
    const gezeigteFassung = (await w.ko.get(w.a.id))?.version ?? 0;
    await w.ko.revise(
      w.a.id,
      { statement: "Nach Rev. B: Pumpe zweimal entlüften (fiktiv)." },
      "anna",
    );
    await expect(
      w.lifecycle.confirmStillValid(w.a.id, "anna", 1, gezeigteFassung),
    ).rejects.toMatchObject({ code: "KO_STALE" });
    expect((await fall(w.lifecycle, w.a.id))?.stand).toBe(1);
    expect((await w.ko.get(w.a.id))?.version).toBe(gezeigteFassung + 1);
    expect(await w.audit.list({ action: "ko.revalidated" })).toEqual([]);
    // Mit der NEUEN, angesehenen Fassung gelingt der Abschluss.
    await w.lifecycle.confirmStillValid(w.a.id, "anna", 1, gezeigteFassung + 1);
    expect(await fall(w.lifecycle, w.a.id)).toBeUndefined();
  });

  it("B angezeigt → B abgeschlossen → C eröffnet → verspätetes B bestätigt: C bleibt offen", async () => {
    const w = await welt();
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. B");
    const angezeigtB = (await fall(w.lifecycle, w.a.id))?.stand;
    expect(angezeigtB).toBe(1);
    // Eine erste Person schließt B ab.
    await w.lifecycle.confirmStillValid(w.a.id, "anna", angezeigtB);
    // C wird gemeldet: der neue Fall beginnt NICHT wieder bei Stand 1.
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. C");
    const c = await fall(w.lifecycle, w.a.id);
    expect(c?.stand).toBe(2);
    // Eine zweite Person hatte B noch offen und bestätigt verspätet.
    await expect(w.lifecycle.confirmStillValid(w.a.id, "bert", angezeigtB)).rejects.toMatchObject({
      code: "STAND_VERALTET",
      aktuellerStand: 2,
    });
    const nachher = await fall(w.lifecycle, w.a.id);
    expect(nachher?.stand).toBe(2);
    expect(nachher?.anlaesse.map((x) => x.aenderung)).toEqual(["Rev. C"]);
    expect((await w.ko.get(w.a.id))?.version).toBe(2);
  });
});

describe("K7 · Wiederholung über den Abschluss hinaus", () => {
  it("B nach Abschluss erneut gemeldet: kein Fall, kein Beleg, keine Glocke; C eröffnet neu", async () => {
    const w = await welt();
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. B");
    await w.lifecycle.confirmStillValid(w.a.id, "anna", 1);
    await w.lifecycle.confirmStillValid(w.b.id, "anna", 1);
    const belegeVorher = (await w.audit.list({ action: REVALIDIERUNG_ANGEFORDERT })).length;

    const wiederholt = await w.lifecycle.meldeAnlagenaenderung(
      "Dosierstation DP-4",
      "emil",
      "Rev. B",
    );
    expect(wiederholt.every((m) => !m.neu)).toBe(true);
    expect(await w.lifecycle.offeneFaelle()).toEqual([]);
    // Kein neuer Prüfprotokolleintrag — damit auch keine neue Glockenmeldung
    // (`frische-meldungen.ts` stellt nur aus diesem Beleg zu).
    expect(await w.audit.list({ action: REVALIDIERUNG_ANGEFORDERT })).toHaveLength(belegeVorher);

    const neu = await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. C");
    expect(neu.every((m) => m.neu && m.stand === 2)).toBe(true);
    expect((await fall(w.lifecycle, w.a.id))?.anlaesse.map((x) => x.aenderung)).toEqual(["Rev. C"]);
  });

  it("ohne Änderungsbeleg hat ein Signal keine Identität über den Abschluss hinaus: es eröffnet neu", async () => {
    const w = await welt();
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla");
    await w.lifecycle.confirmStillValid(w.a.id, "anna", 1);
    const wieder = await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla");
    expect(wieder.find((m) => m.koId === w.a.id)).toMatchObject({ neu: true, stand: 2 });
  });
});

describe("K1 · die kanonische KO-Anlagenzuordnung entscheidet", () => {
  it("ein nur kanonisch zugeordneter Eintrag ist betroffen — ohne couple", async () => {
    const w = await welt();
    const kanonisch = await w.ko.create({
      title: "Dosierventil DP-4 tauschen",
      statement: "Dosierventil DP-4 tauschen — fiktive Aussage.",
      type: "best_practice",
      category: "Dosierung",
      author: "anna",
      asset: "Dosierstation DP-4",
    });
    const markiert = await w.lifecycle.meldeAnlagenaenderung(
      "Dosierstation DP-4",
      "carla",
      "Rev. B",
    );
    expect(markiert.map((m) => m.koId)).toContain(kanonisch.id);
  });

  it("umgehängt und entkoppelt: die Änderung der alten Anlage trifft sie nicht mehr", async () => {
    const w = await welt();
    await w.ko.revise(w.a.id, { assets: ["Dosierstation DP-5"] }, "anna");
    await w.ko.revise(w.b.id, { assets: [] }, "anna");
    const markiert = await w.lifecycle.meldeAnlagenaenderung(
      "Dosierstation DP-4",
      "carla",
      "Rev. B",
    );
    expect(markiert.map((m) => m.koId)).toEqual([]);
    const neu = await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-5", "carla", "Rev. A");
    expect(neu.map((m) => m.koId)).toEqual([w.a.id]);
  });

  it("couple schreibt die kanonische Zuordnung des Objekts (belegt) und liest sie zurück", async () => {
    const w = await welt();
    const gelesen = await w.ko.get(w.a.id);
    expect(gelesen?.asset).toBe("Dosierstation DP-4");
    expect(await w.lifecycle.couplingsForKo(w.a.id)).toEqual(["Dosierstation DP-4"]);
    await w.lifecycle.couple("Dosierstation DP-4", w.a.id, "anna");
    expect(await w.audit.list({ action: "ko.asset-assigned", target: w.a.id })).toHaveLength(1);
  });
});

describe("K4 / Abgrenzung · Lesen schreibt nichts, Frische ist keine Fachprüfung", () => {
  it("offeneFaelle schreibt nichts — auch nicht für einen verwaisten Merker", async () => {
    const w = await welt();
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. B");
    await w.ko.delete(w.b.id, "anna");
    const vorher = (await w.audit.list({})).length;
    const faelle = await w.lifecycle.offeneFaelle();
    expect(faelle.map((f) => f.koId).sort()).toEqual([w.a.id, w.b.id].sort());
    expect(await w.lifecycle.offeneFaelle()).toEqual(faelle);
    expect((await w.audit.list({})).length).toBe(vorher);
  });

  it("die Selbstheilung (SCRUM-420) räumt den verwaisten Merker, ohne einen Abschluss zu behaupten", async () => {
    const w = await welt();
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. B");
    await w.ko.delete(w.b.id, "anna");
    expect(await w.lifecycle.pendingRevalidation()).toEqual([w.a.id]);
    expect(await fall(w.lifecycle, w.b.id)).toBeUndefined();
    expect(await w.audit.list({ action: "ko.revalidated" })).toEqual([]);
  });

  it("„Stimmt weiterhin“ an einem betroffenen Eintrag räumt die offene Folgeprüfung NICHT", async () => {
    const w = await welt();
    await w.validieren(w.a.id);
    await w.lifecycle.meldeAnlagenaenderung("Dosierstation DP-4", "carla", "Rev. B");
    const stand = (await fall(w.lifecycle, w.a.id))?.stand;
    await w.ko.bestaetigeFrische(w.a.id, "anna");
    expect((await fall(w.lifecycle, w.a.id))?.stand).toBe(stand);
    expect(await w.audit.list({ action: "ko.revalidated" })).toEqual([]);
  });
});
