import { expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import {
  type JournalEntry,
  journaledRepos,
  replayJournal,
} from "../../services/app/src/dev-persist";
import {
  DeduplizierenderKantenBestand,
  InMemoryKantenRepo,
  TRASH_RETENTION_DAYS,
} from "../../services/knowledge-object";
import { kante } from "../wissensgraph-integration/bestandsvertrag";
import { baueBuehne, kopfFuer, neuesKo } from "../wissensgraph-integration/buehne";

// Kein Runtimeimport und kein Getter von Testcontainers/Dockerode ist für diese Speicherfälle nötig.
vi.mock("testcontainers", () => {
  throw new Error("NOPULL_INIT1STOP");
});
vi.mock("dockerode", () => {
  throw new Error("NOPULL_INIT1STOP");
});

it("KO15: Auth-Purge bereinigt beide Richtungen; Trash/Restore erhält sie", async () => {
  const b = await baueBuehne();
  try {
    const ids = await Promise.all(
      ["A", "B", "C", "D"].map((titel) => neuesKo(b, titel, { confidentiality: "intern" })),
    );
    const [a, ziel, c, d] = ids as [string, string, string, string];
    const setzen = async (quelle: string, gegen: string, schluessel: string) => {
      const antwort = await b.app.inject({
        method: "POST",
        url: `/api/kos/${quelle}/beziehungen`,
        headers: kopfFuer(b, "controller"),
        payload: {
          zielId: gegen,
          art: "ergaenzt",
          richtung: "gerichtet",
          beitragSchluessel: schluessel,
          gesehen: { quelleVersion: 1, zielVersion: 1 },
        },
      });
      expect([200, 201], antwort.body).toContain(antwort.statusCode);
      return antwort.json().id as string;
    };
    const eingang = await setzen(a, ziel, "eingang");
    expect(await setzen(a, ziel, "eingang-zweiter-beitrag")).toBe(eingang);
    await setzen(ziel, c, "ausgang");
    const fremdId = await setzen(c, d, "fremd");
    const vorher = await b.kanten.fuerKos(ids);
    expect(vorher).toHaveLength(3);
    const fremd = await b.kanten.hole(fremdId);
    const trash = () =>
      b.app.inject({
        method: "DELETE",
        url: `/api/kos/${ziel}`,
        headers: kopfFuer(b, "admin"),
      });
    expect((await trash()).statusCode).toBe(204);
    expect(await b.kanten.fuerKos(ids)).toEqual(vorher);
    await b.services.ko.restore(ziel, b.konto.admin.id);
    expect(await b.kanten.fuerKos(ids)).toEqual(vorher);
    expect((await trash()).statusCode).toBe(204);

    const verboten = await b.app.inject({
      method: "DELETE",
      url: `/api/kos/trash/${ziel}`,
      headers: kopfFuer(b, "controller"),
    });
    expect(verboten.statusCode).toBe(403);
    expect(await b.kanten.fuerKos(ids)).toEqual(vorher);
    const geloescht = await b.app.inject({
      method: "DELETE",
      url: `/api/kos/trash/${ziel}`,
      headers: kopfFuer(b, "admin"),
    });
    expect(geloescht.statusCode, geloescht.body).toBe(204);
    expect(await b.services.ko.get(ziel)).toBeUndefined();
    expect(await b.kanten.fuerKo(ziel)).toEqual([]);
    expect(await b.kanten.fuerKos(ids)).toEqual([fremd]);
    for (const schluessel of ["eingang", "eingang-zweiter-beitrag", "ausgang"]) {
      expect(await b.kanten.holeNachBeitrag(schluessel)).toBeUndefined();
    }
    expect(await b.kanten.holeNachBeitrag("fremd")).toEqual(fremd);
  } finally {
    await b.schliesse();
  }
});

it.each([
  ["Prüfbestand", () => new InMemoryKantenRepo()],
  ["Produktbestand", () => new DeduplizierenderKantenBestand()],
] as const)("KO15: %s entfernt auch Widerrufe samt Schlüsseln", async (_, fabrik) => {
  const repo = fabrik();
  for (const [id, quelleId, zielId, status] of [
    ["rein", "a", "weg", "aktiv"],
    ["raus", "weg", "b", "aktiv"],
    ["widerrufen", "weg", "c", "widerrufen"],
    ["fremd", "b", "c", "aktiv"],
  ] as const) {
    await repo.setzeMitBindung(kante({ id, quelleId, zielId, status, richtung: "gerichtet" }), id);
  }
  const fremd = await repo.hole("fremd");
  expect(await repo.entferneFuerKo("weg")).toBe(3);
  expect(await repo.fuerKo("weg")).toEqual([]);
  for (const id of ["rein", "raus", "widerrufen"]) {
    expect(await repo.hole(id)).toBeUndefined();
    expect(await repo.holeNachBeitrag(id)).toBeUndefined();
  }
  expect(await repo.holeNachBeitrag("fremd")).toEqual(fremd);
  expect(await repo.entferneFuerKo("weg")).toBe(0);
  const neu = await repo.setzeMitBindung(
    kante({ id: "neu", quelleId: "neu-a", zielId: "neu-b" }),
    "rein",
  );
  expect(neu.ergebnis).toBe("angelegt");
  expect((await repo.holeNachBeitrag("rein"))?.id).toBe("neu");
});

async function welt() {
  const repos = inMemoryRepos();
  const services = assembleServices(repos);
  const app = buildApp(services);
  const mk = (title: string) =>
    services.ko.create({
      title,
      statement: title,
      type: "best_practice",
      category: "KO15",
      author: "autor",
      confidentiality: "intern",
    });
  const a = await mk("A");
  const b = await mk("B");
  const gesetzt = (
    await services.kanten.setzeMitBindung(
      kante({ id: "beziehung", quelleId: a.id, zielId: b.id, richtung: "gerichtet" }),
      "beitrag",
    )
  ).kante;
  return { repos, services, app, a, b, gesetzt };
}

it.each(["hard", "trash-expired"] as const)(
  "KO15: der bestehende zentrale Weg %s bereinigt denselben Kantenbestand",
  async (weg) => {
    const w = await welt();
    try {
      if (weg === "hard") {
        await w.services.ko.delete(w.b.id, "admin", { hard: true });
      } else {
        await w.services.ko.delete(w.b.id, "admin");
        const stand = await w.repos.koRepo.findById(w.b.id);
        if (!stand) throw new Error("Papierkorbeintrag fehlt");
        await w.repos.koRepo.update({
          ...stand,
          deletedAt: new Date(Date.now() - (TRASH_RETENTION_DAYS + 1) * 86_400_000).toISOString(),
        });
        expect(await w.services.ko.runTrashSweep()).toBe(1);
      }
      expect(await w.repos.koRepo.findById(w.b.id)).toBeUndefined();
      expect(await w.services.kanten.hole("beziehung")).toBeUndefined();
      expect(await w.services.kanten.holeNachBeitrag("beitrag")).toBeUndefined();
      const belege = await w.repos.auditRepo.all();
      const beleg = belege.find((e) => e.action === "ko.purged" && e.target === w.b.id);
      expect(beleg?.payload).toMatchObject({
        reason: weg,
        kuratierteKantenEntfernt: 1,
      });
    } finally {
      await w.app.close();
    }
  },
);

it("KO15: Bereinigungsfehler wird weitergereicht und erhält KO und Beziehungen", async () => {
  const w = await welt();
  try {
    await w.services.ko.delete(w.b.id, "admin");
    const vorher = await w.repos.koRepo.findById(w.b.id);
    vi.spyOn(w.services.kanten, "entferneFuerKo").mockRejectedValueOnce(
      new Error("Kantenablage ausgefallen"),
    );
    await expect(w.services.ko.purgeTrashed(w.b.id, "admin")).rejects.toThrow(
      "Kantenablage ausgefallen",
    );
    expect(await w.repos.koRepo.findById(w.b.id)).toEqual(vorher);
    expect(await w.services.kanten.holeNachBeitrag("beitrag")).toEqual(w.gesetzt);
    expect((await w.repos.auditRepo.all()).filter((e) => e.action === "ko.purged")).toEqual([]);
  } finally {
    vi.restoreAllMocks();
    await w.app.close();
  }
});

it("KO15: Restore vor dem Purge-CAS erhält Kanten und Beitragbindungen", async () => {
  const w = await welt();
  let los: () => void = () => undefined;
  let angekommen: () => void = () => undefined;
  const tor = new Promise<void>((resolve) => {
    los = resolve;
  });
  const halt = new Promise<void>((resolve) => {
    angekommen = resolve;
  });
  try {
    await w.services.ko.delete(w.b.id, "admin");
    w.services.ko.setPurgeCleanup(async () => {
      angekommen();
      await tor;
    });
    const purge = w.services.ko.purgeTrashed(w.b.id, "admin");
    await halt;
    await w.services.ko.restore(w.b.id, "admin");
    los();
    await expect(purge).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await w.repos.koRepo.findById(w.b.id))?.deletedAt).toBeNull();
    expect(await w.services.kanten.holeNachBeitrag("beitrag")).toEqual(w.gesetzt);
    expect((await w.repos.auditRepo.all()).filter((e) => e.action === "ko.purged")).toEqual([]);
  } finally {
    los();
    await w.app.close();
  }
});

it("KO15: Dev-Journal-Replay erhält das unabhängige Paar und entfernt Endpunkt samt Bindungen", async () => {
  const zeilen: JournalEntry[] = [];
  const services = assembleServices(
    journaledRepos(inMemoryRepos(), (entry) =>
      zeilen.push(JSON.parse(JSON.stringify(entry)) as JournalEntry),
    ),
  );
  const app = buildApp(services);
  try {
    const ids: string[] = [];
    for (const title of ["Weg", "Nachbar", "Unabhängig A", "Unabhängig B"]) {
      ids.push(
        (
          await services.ko.create({
            title,
            statement: title,
            type: "best_practice",
            category: "KO15",
            author: "autor",
            confidentiality: "intern",
          })
        ).id,
      );
    }
    await services.kanten.setzeMitBindung(
      kante({ id: "weg-kante", quelleId: ids[0]!, zielId: ids[1]! }),
      "weg-beitrag",
    );
    await services.kanten.setzeMitBindung(
      kante({ id: "bleibt-kante", quelleId: ids[2]!, zielId: ids[3]! }),
      "bleibt-beitrag",
    );
    await services.ko.delete(ids[0]!, "admin", { hard: true });
    expect(zeilen.some((e) => e.repo === "kantenRepo" && e.method === "entferneFuerKo")).toBe(true);
    const neu = inMemoryRepos();
    await replayJournal(
      neu,
      zeilen.map((entry, i) => ({ entry, lineNumber: i + 1 })),
    );
    expect(await neu.koRepo.findById(ids[0]!)).toBeUndefined();
    expect(await neu.kantenRepo.fuerKo(ids[0]!)).toEqual([]);
    expect(await neu.kantenRepo.holeNachBeitrag("weg-beitrag")).toBeUndefined();
    expect(await neu.kantenRepo.holeNachBeitrag("bleibt-beitrag")).toEqual(
      await services.kanten.holeNachBeitrag("bleibt-beitrag"),
    );
  } finally {
    await app.close();
  }
});

it("KO15: Speicher-Fallback meldet Auditfehler ohne eine Transaktionszusage zu erfinden", async () => {
  const w = await welt();
  try {
    await w.services.ko.delete(w.b.id, "admin");
    const vorher = await w.repos.koRepo.findById(w.b.id);
    const echt = w.services.audit.record.bind(w.services.audit);
    const ausfall = vi.spyOn(w.services.audit, "record").mockImplementation(async (input, tx) => {
      if (input.action === "ko.purged") throw new Error("KO15 Speicher-Auditfehler");
      return echt(input, tx);
    });
    await expect(w.services.ko.purgeTrashed(w.b.id, "admin")).rejects.toThrow(
      "KO15 Speicher-Auditfehler",
    );
    // Der bisherige Purge ohne withTx bleibt sequentiell: Cleanup ist vollzogen, KO nicht gelöscht.
    expect(await w.repos.koRepo.findById(w.b.id)).toEqual(vorher);
    expect(await w.services.kanten.holeNachBeitrag("beitrag")).toBeUndefined();
    expect((await w.repos.auditRepo.all()).filter((e) => e.action === "ko.purged")).toEqual([]);
    ausfall.mockRestore();
    await w.services.ko.purgeTrashed(w.b.id, "admin");
    expect(await w.repos.koRepo.findById(w.b.id)).toBeUndefined();
  } finally {
    vi.restoreAllMocks();
    await w.app.close();
  }
});
