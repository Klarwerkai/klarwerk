import { describe, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import {
  type JournalEntry,
  journaledRepos,
  replayJournal,
} from "../../services/app/src/dev-persist";

// ================================================================================================
// JOB 3066 · F6 — WAS DIE ENDLÖSCHUNG SCHLIESST, BLEIBT AUCH NACH EINEM DEV-NEUSTART ZU.
// ================================================================================================
//
// Die Desktop-App läuft ohne Postgres über das MUTATIONS-JOURNAL (services/app/src/dev-persist.ts):
// jede schreibende Repo-Methode wird per Proxy mitgeschrieben und beim Start in frische Repos
// zurückgespielt. Welche Methoden das sind, steht dort ausdrücklich in `MUTATING_METHODS` — „neue
// Mutationsmethoden müssen hier ergänzt werden" (dev-persist.ts:32-34); für die Befundspeicher
// sind es `insert`, `update` und `closeOpenForKo` (`conflictsRepo`/`overlapRepo` in
// `MUTATING_METHODS`).
//
// WOFÜR DIESER TEST DA IST. Der Aufräumweg der Endlöschung schliesst die Befunde eines gelöschten
// Beitrags MENGENBASIERT über `closeOpenForKo` (EINE Anweisung je Speicher, wie es der
// `PurgeTxCleanup`-Vertrag verlangt) — nicht mehr je Eintrag über `update`. Diese Methode ist eine
// eigene Mutationsfläche und steht deshalb ausdrücklich im Journal (s. den Block „JOB 3066 —
// `closeOpenForKo` IST EINE MUTATION" in `dev-persist.ts`). Fehlte der Eintrag, wäre nach dem
// nächsten Start des Desktop-Programms der Beitrag gelöscht (`koRepo.delete` IST journaliert),
// seine Dublettenwarnung aber wieder OFFEN — ein Befund über einem Beitrag, den es nicht mehr gibt.
//
// Der Test misst deshalb nicht die Liste, sondern die WIRKUNG nach dem Wiederaufbau. Er wird rot,
// sobald der Aufräumweg auf eine nicht journalierte Mutationsfläche wechselt.
describe("JOB 3066 · F6: der Abschluss der Befunde überlebt den Dev-Journal-Wiederaufbau", () => {
  it("nach Endlöschung und Replay sind Überschneidung und Konflikt weiterhin geschlossen", async () => {
    const zeilen: JournalEntry[] = [];
    const repos = journaledRepos(inMemoryRepos(), (entry) => zeilen.push(entry));
    const services = assembleServices(repos);
    buildApp(services); // die Aufräum-Haken leben in der Kompositionswurzel

    const a = await services.ko.create({
      title: "KO A",
      statement: "Pumpe entlüften alle 200h.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
    });
    const b = await services.ko.create({
      title: "KO B",
      statement: "Pumpe alle 200 Stunden entlüften.",
      type: "best_practice",
      category: "Wartung",
      author: "bob",
    });
    const overlap = await services.overlaps.createAuto(
      {
        koA: a.id,
        koB: b.id,
        relation: "identisch",
        aspects: [{ beschreibung: "gleiche Anweisung", zitatA: "entlüften", zitatB: "entlüften" }],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren",
      },
      { trigger: "manual", method: "deterministic", lexicalScore: 0.95 },
      "system",
    );
    const conflict = await services.conflicts.create(
      { koA: a.id, koB: b.id, type: "truth", description: "Widerspruch zur Frist" },
      "anna",
    );

    await services.ko.delete(a.id, "admin", { hard: true });

    // Der Neustart: frische Repos, nur das Journal als Wahrheit.
    const nachher = inMemoryRepos();
    await replayJournal(
      nachher,
      zeilen.map((entry, i) => ({ lineNumber: i + 1, entry })),
    );

    expect(await nachher.koRepo.findById(a.id)).toBeUndefined(); // der Beitrag ist wirklich weg …
    // … und seine Befunde sind es auch. Stünden sie wieder offen, hinge eine Warnung über einem
    // Beitrag, den es nicht mehr gibt.
    expect((await nachher.overlapRepo.findById(overlap.id))?.status).toBe("geschlossen");
    expect((await nachher.conflictsRepo.findById(conflict.id))?.status).toBe("geloest");
    expect((await nachher.conflictsRepo.findById(conflict.id))?.resolutionReason).toBe(
      "participant_deleted",
    );
  });
});
