// ================================================================================================
// JOB 3784 · PRÜFLÜCKE (a) — DAS DEV-JOURNAL HÄLT, UND ZWAR GEMESSEN
// ================================================================================================
//
// Was hier kaputtgehen könnte: `buildDevPersistServices` legt einen Proxy um jedes Repo und
// journaliert Mutationen NACH NAMEN (`MUTATING_METHODS.users = ["insert","update","delete",
// "tryClaimBootstrapAdmin"]`, services/app/src/dev-persist.ts). Jede andere Methode wird
// unverändert durchgereicht. Wäre das Schreiben mit JOB 3784 in den Sperrrahmen GEWANDERT — hätte
// also `withAdminGuard` selbst geschrieben —, liefe es nicht mehr über eine journalierte Methode:
// nach einem Dev-Neustart wäre der Rollenwechsel spurlos weg, und niemand hätte es gemerkt.
//
// Er ist nicht gewandert: der Dienst ruft weiterhin `this.users.update(...)` bzw.
// `this.users.delete(...)`, nur eben innerhalb des Rahmens. Das ist ein Argument; hier steht der
// Lauf dazu — Journalzeilen zählen und danach in frische Repos zurückspielen.
import { describe, expect, it } from "vitest";
import { inMemoryRepos } from "../../services/app/src/build-app";
import {
  type JournalEntry,
  journaledRepos,
  replayJournal,
} from "../../services/app/src/dev-persist";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { AuthService } from "../../services/auth/src/service";
import { SPAETER, START, konto } from "./aufbau";

function dienst(repos: ReturnType<typeof inMemoryRepos>): AuthService {
  return new AuthService({
    users: repos.users,
    sessions: repos.sessions,
    audit: new AuditService({ repo: new InMemoryAuditRepo(), now: () => START }),
    now: () => START,
  });
}

describe("JOB 3784 · der Sperrrahmen schreibt weiterhin durch den Journal-Proxy", () => {
  it("Rollenwechsel, Befristung und Löschung landen als Zeilen im Journal und überleben den Neustart", async () => {
    const zeilen: JournalEntry[] = [];
    const repos = journaledRepos(inMemoryRepos(), (e) => zeilen.push(e));
    const service = dienst(repos);

    // Zwei unbefristete Admins, damit jeder EINZELNE Schritt zulässig ist.
    for (const eintrag of [konto("a"), konto("b"), konto("weg", { role: "experte" })]) {
      await repos.users.insert({ ...eintrag });
    }

    await service.changeRole("b", "controller", "a");
    await service.setAccessExpiry("b", SPAETER, "a");
    await service.deleteUser("weg", "a");

    const userZeilen = zeilen.filter((z) => z.repo === "users");
    expect(userZeilen.map((z) => z.method)).toEqual([
      "insert",
      "insert",
      "insert",
      "update",
      "update",
      "delete",
    ]);

    // Und die Zeilen tragen, was sie tragen müssen: der Neustart stellt denselben Stand her.
    const frisch = inMemoryRepos();
    await replayJournal(
      frisch,
      zeilen.map((entry, i) => ({ lineNumber: i + 1, entry })),
    );
    const nachNeustart = await frisch.users.list();
    expect(nachNeustart.map((u) => u.id).sort()).toEqual(["a", "b"]);
    expect(nachNeustart.find((u) => u.id === "b")).toMatchObject({
      role: "controller",
      accessExpiresAt: SPAETER,
    });
  });

  it("die JSON-Runde übersteht den mitgereichten Transaktionskontext (im Speicher: keiner)", () => {
    // Der Rahmen reicht `undefined` als Kontext; im Journal wird daraus `null`, und der Speicher
    // ignoriert ihn beim Zurückspielen. Ein Wert, der sich nicht serialisieren liesse, wäre hier
    // sofort sichtbar.
    const zeile: JournalEntry = { repo: "users", method: "update", args: [konto("a"), undefined] };
    expect(JSON.parse(JSON.stringify(zeile))).toEqual({
      repo: "users",
      method: "update",
      args: [konto("a"), null],
    });
  });
});
