import { appendFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inMemoryRepos } from "../../services/app/src/build-app";
import {
  type JournalEntry,
  MUTATING_METHODS,
  buildDevPersistServices,
  journaledRepos,
  readJournal,
} from "../../services/app/src/dev-persist";

// SCRUM-387: Dev-Persistenz der Desktop-App — Mutations-Journal über die öffentlichen
// Repo-Interfaces (kein Modul-Eingriff), Replay beim Start. Netz- und DOM-frei.
function tmpJournal(): string {
  return join(mkdtempSync(join(tmpdir(), "kw-devpersist-")), "state.jsonl");
}

const ADMIN = { name: "Pedi", email: "pedi@example.com", password: "geheim-123" };

describe("SCRUM-387: dev-persist", () => {
  it("readJournal: fehlende Datei → leer; korrupte Schlusszeile verwirft nur den Rest", () => {
    const file = tmpJournal();
    expect(readJournal(file)).toEqual([]);
    const a: JournalEntry = { repo: "drafts", method: "insert", args: [{ id: "d1" }] };
    const b: JournalEntry = { repo: "drafts", method: "delete", args: ["d1"] };
    appendFileSync(file, `${JSON.stringify(a)}\n${JSON.stringify(b)}\n{"repo":"dra`, "utf8");
    // Crash-Simulation: die halb geschriebene letzte Zeile fällt weg, alles Gültige bleibt.
    expect(readJournal(file)).toEqual([a, b]);
  });

  it("MUTATING_METHODS deckt exakt die Repos der Komposition ab (nichts vergessen)", () => {
    const repoKeys = Object.keys(inMemoryRepos()).sort();
    expect(Object.keys(MUTATING_METHODS).sort()).toEqual(repoKeys);
    // Jede gelistete Mutationsmethode existiert wirklich am In-Memory-Repo.
    const repos = inMemoryRepos() as unknown as Record<string, Record<string, unknown>>;
    for (const [name, methods] of Object.entries(MUTATING_METHODS)) {
      for (const method of methods) {
        expect(typeof repos[name]?.[method], `${name}.${method}`).toBe("function");
      }
    }
  });

  it("journalisiert Mutationen (nach Erfolg), aber keine Lesezugriffe", async () => {
    const entries: JournalEntry[] = [];
    const repos = journaledRepos(inMemoryRepos(), (e) => entries.push(e));
    const draft = {
      id: "d1",
      payload: { title: "T", statement: "S" },
      originalAuthor: "pedi",
      lastEditor: "pedi",
      createdAt: "2026-07-02T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z",
    };
    await repos.drafts.insert(draft as never);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ repo: "drafts", method: "insert" });
    // Lesen ändert nichts am Journal — und liefert den geschriebenen Stand.
    expect((await repos.drafts.list()).map((d) => d.id)).toEqual(["d1"]);
    expect(await repos.drafts.findById("d1")).toBeDefined();
    expect(entries).toHaveLength(1);
    await repos.drafts.delete("d1");
    expect(entries).toHaveLength(2);
  });

  it("Erfolgstest des Briefs: Neustart ohne Ersteinrichtung, Daten bleiben erhalten", async () => {
    const file = tmpJournal();

    // 1. Start: Ersteinrichtung → Admin anlegen → Entwurf speichern.
    const s1 = await buildDevPersistServices(file);
    expect(await s1.auth.needsSetup()).toBe(true);
    await s1.auth.register(ADMIN);
    expect(await s1.auth.needsSetup()).toBe(false);
    await s1.capture.createDraft({ title: "Riemenwechsel L4", statement: "Nach Schicht" }, "Pedi");

    // 2. „App-Neustart": komplett frische Komposition aus derselben Journal-Datei.
    const s2 = await buildDevPersistServices(file);
    expect(await s2.auth.needsSetup()).toBe(false); // KEIN Ersteinrichtungs-Screen mehr.
    const login = await s2.auth.login({ email: ADMIN.email, password: ADMIN.password });
    expect(login.user.role).toBe("admin");
    const drafts = await s2.capture.listDrafts();
    expect(drafts.map((d) => d.payload.title)).toEqual(["Riemenwechsel L4"]);

    // 3. Sicherheit: das Journal enthält NIE das Klartext-Passwort (nur Salt+Hash).
    expect(readFileSync(file, "utf8")).not.toContain(ADMIN.password);
  });

  it("auch die im 2. Lauf erzeugten Sessions/Mutationen landen im Journal (3. Lauf sieht sie)", async () => {
    const file = tmpJournal();
    const s1 = await buildDevPersistServices(file);
    await s1.auth.register(ADMIN);
    const s2 = await buildDevPersistServices(file);
    const { token } = await s2.auth.login({ email: ADMIN.email, password: ADMIN.password });
    const s3 = await buildDevPersistServices(file);
    // Die in Lauf 2 erzeugte Session überlebt den Neustart → kein erneuter Login nötig.
    const me = await s3.auth.authenticate(token);
    expect(me?.email).toBe(ADMIN.email);
  });
});
