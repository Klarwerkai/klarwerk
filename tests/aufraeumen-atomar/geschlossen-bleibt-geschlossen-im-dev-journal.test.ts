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
// sind es `insert` und `update` (dev-persist.ts:61-63).
//
// WOFÜR DIESER TEST DA IST — er ist der Beleg zu einer BEGRENZUNG, nicht nur eine Zusicherung.
// Der Aufräumweg der Endlöschung schreibt bewusst je Eintrag über `update` und NICHT über eine
// mengenbasierte Schliessmethode, obwohl der `PurgeTxCleanup`-Vertrag genau die verlangte. Der
// Grund steht hier, messbar: eine solche Methode wäre eine NEUE Mutationsfläche und stünde nicht
// im Journal. Dann wäre nach dem nächsten Start des Desktop-Programms der Beitrag gelöscht
// (`koRepo.delete` IST journaliert), seine Dublettenwarnung aber wieder OFFEN — ein Befund über
// einem Beitrag, den es nicht mehr gibt. Also genau der Geist, gegen den dieser Auftrag angetreten
// ist, nur von der anderen Seite. `dev-persist.ts` ist kein Zielpfad von JOB 3066.
//
// Der Test misst deshalb nicht die Liste, sondern die WIRKUNG nach dem Wiederaufbau. Er wird rot,
// sobald der Aufräumweg auf eine nicht journalierte Mutationsfläche wechselt — und ist damit die
// Wache für die Scheibe, die den Eintrag nachholt und dann mengenbasiert schliessen darf.
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
