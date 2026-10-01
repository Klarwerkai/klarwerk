import { describe, expect, it } from "vitest";
import { inMemoryRepos } from "../../services/app/src/build-app";
import type { OverlapEntry } from "../../services/conflicts";
import type { TxContext } from "../../services/db-tx";
import type { WithTx } from "../../services/knowledge-object";
import { type App, type Konto, type Services, koAnlegen, welt } from "../eigene-ruecknahme/welt";

// ================================================================================================
// Auftrag gesamt-dubletten-rueckzug — DIE IN LAUF 1 REPRODUZIERTEN WIEDERHERSTELLUNGSFEHLER.
// ================================================================================================
//
// Ben hat in Lauf 1 (Runden 1–3) und Lauf 2 Abläufe gemessen, in denen das Wiederherstellen einen
// durch Rückzug geschlossenen Befund falsch behandelte — jeweils, weil es ihn WIEDER ÖFFNEN wollte:
//
//   L1-R1-1  Gegenseite wird während der Wiederherstellung zurückgezogen → Befund ging über einer
//            Seite im Papierkorb auf; der Admin las 404 statt des Nachweises.
//   L1-R1-2  zwei Wiederherstellungen überlappen → uneinheitlicher Zustand je Reihenfolge.
//   L1-R3-1  zwei Rückzüge beginnen am offenen Befund → die zweite Seite fehlte in der Menge, das
//            Wiederherstellen der ersten öffnete über der zweiten.
//   L1-R3-2  Altbefund (vor der Menge geschlossen) → Wiederherstellen öffnete über einer fehlenden
//            Gegenseite.
//   L1-R3-3  Gegenseite direkt endgelöscht → Wiederherstellen öffnete über einer gelöschten Seite.
//   L2       Altbefund, dann Rückzug der Gegenseite, deren Wiederherstellung → Befund ging auf,
//            der Admin las 404.
//
// Pedis Entscheidung (entscheidung:43017d60) beseitigt die gemeinsame Ursache: das Wiederherstellen
// stellt NUR den eigenen Beitrag wieder her, ein durch Rückzug geschlossener Befund wird NICHT wieder
// geöffnet (die Wiederöffnung ist abgegrenzt und wird später gesondert entschieden). Jeder Ablauf
// steht hier als Regression mit dem neuen Soll: der eigene Beitrag ist fehlerfrei zurück, der
// Befund bleibt zeichengleich geschlossen (Grund, Urheber, Zeit), die Gegenseite unangetastet,
// und der Nachweis bleibt für Berechtigte lesbar. Die Klammer `withTx` hält Vorgänge AN DER GRENZE
// ihrer Transaktion an; die Befunde sind VERSIONSGEBUNDEN (der Lesepfad, an dem Ben 404 gemessen
// hat). Echte Nebenläufigkeit unter Zeilensperren: rueckzug-atomar.integration.test.ts (Postgres).

/** Eine Transaktionsklammer, die einzelne Vorgänge vor ihrem Körper anhält. */
function haltbareKlammer() {
  const kontext: TxContext = { brand: "TxContext" };
  const wartende: Promise<void>[] = [];
  const withTx: WithTx = async (fn) => {
    const sperre = wartende.shift();
    if (sperre) {
      await sperre;
    }
    return fn(kontext);
  };
  /** Die NÄCHSTE Transaktion wartet, bis `freigeben()` gerufen wird. */
  function naechsteAnhalten(): () => void {
    let freigeben: () => void = () => undefined;
    wartende.push(
      new Promise<void>((fertig) => {
        freigeben = fertig;
      }),
    );
    return () => freigeben();
  }
  return { withTx, naechsteAnhalten };
}

const takt = () => new Promise((r) => setTimeout(r, 20));

/** Ein Haltepunkt direkt VOR dem nächsten `closeOpenForKo` (mitten im Rückzug, im Körper). */
function ablagenMitSchliessHalt() {
  const repos = inMemoryRepos();
  const wartende: Promise<void>[] = [];
  const echt = repos.overlapRepo.closeOpenForKo.bind(repos.overlapRepo);
  repos.overlapRepo.closeOpenForKo = async (koId, patch, tx) => {
    const sperre = wartende.shift();
    if (sperre) {
      await sperre;
    }
    return echt(koId, patch, tx);
  };
  function naechstesSchliessenAnhalten(): () => void {
    let freigeben: () => void = () => undefined;
    wartende.push(
      new Promise<void>((fertig) => {
        freigeben = fertig;
      }),
    );
    return () => freigeben();
  }
  return { repos, naechstesSchliessenAnhalten };
}

async function lage() {
  const klammer = haltbareKlammer();
  const ablagen = ablagenMitSchliessHalt();
  const w = await welt({ withTx: klammer.withTx, repos: ablagen.repos });
  const a = await koAnlegen(w.app, w.autorin, "Ventil V3 zuerst", "Bei Überdruck V3 schließen.");
  const b = await koAnlegen(w.app, w.autorin, "Pumpe entlüften", "Die Pumpe alle 200 h entlüften.");
  const versionA = (await w.services.ko.get(a))?.version;
  const versionB = (await w.services.ko.get(b))?.version;
  const eintrag = await w.services.overlaps.createAuto(
    {
      koA: a,
      koB: b,
      relation: "identisch",
      aspects: [{ beschreibung: "gleiche Anweisung", zitatA: "entlüften", zitatB: "entlüften" }],
      eigenanteilA: "",
      eigenanteilB: "",
      recommendation: "zusammenfuehren",
      ...(versionA !== undefined ? { koAVersion: versionA } : {}),
      ...(versionB !== undefined ? { koBVersion: versionB } : {}),
    },
    { trigger: "manual", method: "deterministic", lexicalScore: 0.95 },
    "system",
  );
  expect(eintrag.koAVersion).toBe(1);
  expect(eintrag.koBVersion).toBe(1);
  return { ...w, klammer, ablagen, a, b, eintrag };
}

async function roh(services: Services, id: string): Promise<OverlapEntry | undefined> {
  return (await services.overlaps.get(id)) ?? undefined;
}

/** Der Nachweis über den HTTP-Lesepfad — Status und, bei 200, Grund/Urheber/Zeit. */
async function nachweis(app: App, konto: Konto, id: string) {
  const res = await app.inject({ url: `/api/duplicates/${id}`, headers: konto.headers });
  return {
    status: res.statusCode,
    resolution: res.statusCode === 200 ? res.json().resolution : undefined,
  };
}

/** Die gemeinsame Zusage: keine Wiederöffnung, kein Umkehrbeleg, der Befund unverändert. */
async function bleibtZu(services: Services, eintragId: string, zu: OverlapEntry | undefined) {
  expect(zu?.status).toBe("geschlossen");
  expect(await roh(services, eintragId)).toEqual(zu);
  expect((await services.overlaps.unresolved()).some((e) => e.id === eintragId)).toBe(false);
  const umkehr = (await services.audit.list({})).filter(
    (e) => e.action === "overlap.withdrawal-reverted",
  );
  expect(umkehr).toEqual([]);
}

/** Aktionen an einem Objekt, ausser Anlage und KI-Prüfung (die laufen beim Anlegen). */
async function vorgaengeAn(services: Services, id: string): Promise<string[]> {
  return (await services.audit.list({}))
    .filter((e) => e.target === id)
    .map((e) => e.action)
    .filter((a) => a === "ko.deleted" || a === "ko.restored");
}

describe("L1-R1-1: die Gegenseite wird zurückgezogen, während die Wiederherstellung läuft", () => {
  it("A ist zurück, B bleibt im Papierkorb, der Befund bleibt zu, der Admin liest den Nachweis", async () => {
    const { app, services, admin, autorin, klammer, a, b, eintrag } = await lage();
    await services.ko.delete(a, autorin.id);
    const zu = await roh(services, eintrag.id);

    // Die Wiederherstellung von A beginnt und hält an der Transaktionsgrenze.
    const freigeben = klammer.naechsteAnhalten();
    const wiederherstellungA = services.ko.restore(a, admin.id);
    await takt();
    // Dazwischen zieht die Autorin B zurück — vollständig, bis zum Commit.
    await services.ko.delete(b, autorin.id);
    freigeben();
    await wiederherstellungA;

    expect(await services.ko.get(a)).toBeDefined();
    expect(await services.ko.get(b)).toBeUndefined();
    expect((await services.ko.trashed()).map((k) => k.id)).toEqual([b]);
    await bleibtZu(services, eintrag.id, zu);
    expect(zu?.resolution).toMatchObject({ reason: "withdrawn_own", by: autorin.id });
    // Die Wiederherstellung von A hat B nicht angefasst: B trägt genau seinen eigenen Rückzug.
    expect(await vorgaengeAn(services, b)).toEqual(["ko.deleted"]);

    // Der versionsgebundene HTTP-Lesepfad: der Abschlussnachweis bleibt für den Admin lesbar.
    expect(await nachweis(app, admin, eintrag.id)).toEqual({
      status: 200,
      resolution: { reason: "withdrawn_own", by: autorin.id, at: zu?.resolution?.at },
    });

    // Und wenn auch B zurückkommt, bleibt er zu (keine Wiederöffnung).
    await services.ko.restore(b, admin.id);
    await bleibtZu(services, eintrag.id, zu);
  });
});

describe("L1-R1-2: zwei Wiederherstellungen überlappen", () => {
  for (const reihenfolge of ["A zuerst frei", "B zuerst frei"] as const) {
    it(`beide Seiten zurück, Befund bleibt zu — ${reihenfolge}`, async () => {
      const { app, services, admin, autorin, klammer, a, b, eintrag } = await lage();
      await services.ko.delete(a, autorin.id);
      await services.ko.delete(b, autorin.id);
      const zu = await roh(services, eintrag.id);

      // Beide Wiederherstellungen beginnen, bevor eine von ihnen schreibt.
      const freigebenA = klammer.naechsteAnhalten();
      const freigebenB = klammer.naechsteAnhalten();
      const wiederherstellungA = services.ko.restore(a, admin.id);
      const wiederherstellungB = services.ko.restore(b, admin.id);
      await takt();
      if (reihenfolge === "A zuerst frei") {
        freigebenA();
        freigebenB();
      } else {
        freigebenB();
        freigebenA();
      }
      await Promise.all([wiederherstellungA, wiederherstellungB]);

      expect(await services.ko.get(a)).toBeDefined();
      expect(await services.ko.get(b)).toBeDefined();
      expect(await services.ko.trashed()).toEqual([]);
      await bleibtZu(services, eintrag.id, zu);
      expect(await vorgaengeAn(services, a)).toEqual(["ko.deleted", "ko.restored"]);
      expect(await vorgaengeAn(services, b)).toEqual(["ko.deleted", "ko.restored"]);
      // Beide Seiten im Bestand: der Befund ist über den gewöhnlichen Lesepfad lesbar, geschlossen.
      const res = await app.inject({
        url: `/api/duplicates/${eintrag.id}`,
        headers: admin.headers,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ id: eintrag.id, status: "geschlossen" });
    });
  }
});

describe("L1-R3-1: zwei Rückzüge beginnen, solange der Befund noch offen ist", () => {
  it("genau ein Abschluss; jede Wiederherstellung holt nur ihren Beitrag, der Befund bleibt zu", async () => {
    const { app, services, admin, autorin, ablagen, a, b, eintrag } = await lage();

    // B beginnt und hält vor seinem Schliessen.
    const freigeben = ablagen.naechstesSchliessenAnhalten();
    const rueckzugB = services.ko.delete(b, autorin.id);
    await takt();
    // A läuft vollständig durch und schliesst den Befund.
    await services.ko.delete(a, autorin.id);
    const zu = await roh(services, eintrag.id);
    // B geht weiter: sein Schliessen überspringt die schon geschlossene Zeile.
    freigeben();
    await rueckzugB;
    expect(await roh(services, eintrag.id)).toEqual(zu);
    const abschluesse = (await services.audit.list({ action: "overlap.withdrawn-own" })).filter(
      (e) => e.target === eintrag.id,
    );
    expect(abschluesse).toHaveLength(1);

    await services.ko.restore(a, admin.id);
    await bleibtZu(services, eintrag.id, zu);
    expect(await services.ko.get(b)).toBeUndefined();
    expect((await nachweis(app, admin, eintrag.id)).resolution).toMatchObject({
      reason: "withdrawn_own",
      by: autorin.id,
    });

    await services.ko.restore(b, admin.id);
    await bleibtZu(services, eintrag.id, zu);
  });
});

/** Altbestand: A (und ggf. B) im Papierkorb, Befund `withdrawn_own` — hergestellt am Speicher. */
async function altbestand(
  ablagen: ReturnType<typeof ablagenMitSchliessHalt>,
  ids: string[],
  autorinId: string,
  eintragId: string,
) {
  const { koRepo, overlapRepo } = ablagen.repos;
  for (const id of ids) {
    const ko = await koRepo.findById(id);
    if (!ko) {
      throw new Error("KO fehlt");
    }
    await koRepo.update({ ...ko, deletedAt: new Date().toISOString(), deletedBy: autorinId });
  }
  const offen = await overlapRepo.findById(eintragId);
  if (!offen) {
    throw new Error("Befund fehlt");
  }
  const zu: OverlapEntry = {
    ...offen,
    status: "geschlossen",
    resolution: { reason: "withdrawn_own", by: autorinId, note: null, at: offen.createdAt },
    closedAt: offen.createdAt,
  };
  await overlapRepo.update(zu);
  return zu;
}

describe("L1-R3-2: Altbefund (vor dieser Lieferung mit `withdrawn_own` geschlossen)", () => {
  it("beide Seiten im Papierkorb, A kommt zurück ⇒ nur A zurück, der Befund bleibt zu", async () => {
    const { app, services, admin, autorin, ablagen, a, b, eintrag } = await lage();
    const zu = await altbestand(ablagen, [a, b], autorin.id, eintrag.id);

    await services.ko.restore(a, admin.id);

    expect(await services.ko.get(a)).toBeDefined();
    expect((await services.ko.trashed()).map((k) => k.id)).toEqual([b]);
    await bleibtZu(services, eintrag.id, zu);
    expect((await nachweis(app, admin, eintrag.id)).status).toBe(200);
  });

  it("nur A im Papierkorb ⇒ A kommt zurück, der Befund bleibt zu", async () => {
    const { services, admin, autorin, ablagen, a, eintrag } = await lage();
    const zu = await altbestand(ablagen, [a], autorin.id, eintrag.id);

    await services.ko.restore(a, admin.id);

    expect(await services.ko.get(a)).toBeDefined();
    await bleibtZu(services, eintrag.id, zu);
  });
});

describe("L2: Altbefund, dann Rückzug der Gegenseite", () => {
  it("A im Altbestand · B zurückziehen · B wiederherstellen ⇒ A bleibt im Papierkorb, Befund zu, Admin liest 200", async () => {
    const { app, services, admin, autorin, ablagen, a, b, eintrag } = await lage();
    const zu = await altbestand(ablagen, [a], autorin.id, eintrag.id);
    const vorher = await app.inject({
      url: `/api/duplicates/${eintrag.id}`,
      headers: admin.headers,
    });
    expect(vorher.statusCode).toBe(200);

    await services.ko.delete(b, autorin.id);
    // Der Rückzug von B findet keinen offenen Befund: er bleibt der Abschluss von A.
    expect(await roh(services, eintrag.id)).toEqual(zu);

    await services.ko.restore(b, admin.id);

    expect(await services.ko.get(a)).toBeUndefined();
    expect((await services.ko.get(b))?.id).toBe(b);
    await bleibtZu(services, eintrag.id, zu);
    const nachher = await app.inject({
      url: `/api/duplicates/${eintrag.id}`,
      headers: admin.headers,
    });
    expect(nachher.statusCode).toBe(200);
    expect(nachher.body).toBe(vorher.body);

    await services.ko.restore(a, admin.id);
    await bleibtZu(services, eintrag.id, zu);
  });

  it("dasselbe, aber A wird zwischendurch endgelöscht ⇒ B zurück, Befund bleibt zu", async () => {
    const { services, admin, autorin, ablagen, a, b, eintrag } = await lage();
    const zu = await altbestand(ablagen, [a], autorin.id, eintrag.id);

    await services.ko.delete(b, autorin.id);
    await services.ko.purgeTrashed(a, admin.id);
    expect((await services.ko.trashed()).map((k) => k.id)).not.toContain(a);
    await services.ko.restore(b, admin.id);

    expect((await services.ko.get(b))?.id).toBe(b);
    await bleibtZu(services, eintrag.id, zu);
  });
});

describe("L1-R3-3: die Gegenseite wird direkt endgelöscht", () => {
  it("A zurückgezogen, B hart gelöscht, A wiederhergestellt ⇒ Befund zu, die Abschliessende liest weiter 200", async () => {
    const { app, services, admin, autorin, a, b, eintrag } = await lage();
    await services.ko.delete(a, autorin.id);
    const zu = await roh(services, eintrag.id);
    const vorher = await app.inject({
      url: `/api/duplicates/${eintrag.id}`,
      headers: autorin.headers,
    });
    expect(vorher.statusCode).toBe(200);

    await services.ko.delete(b, admin.id, { hard: true });
    expect(await services.ko.get(b)).toBeUndefined();
    expect((await services.ko.trashed()).map((k) => k.id)).not.toContain(b);

    await services.ko.restore(a, admin.id);

    expect(await services.ko.get(a)).toBeDefined();
    await bleibtZu(services, eintrag.id, zu);
    const nachher = await app.inject({
      url: `/api/duplicates/${eintrag.id}`,
      headers: autorin.headers,
    });
    expect(nachher.statusCode).toBe(200);
    expect(nachher.body).toBe(vorher.body);
  });
});
