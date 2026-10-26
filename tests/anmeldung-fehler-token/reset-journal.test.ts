import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDevPersistServices, readJournalLines } from "../../services/app/src/dev-persist";

describe("W4.3 Resetwiderruf überlebt das vorhandene Dev-Journal", () => {
  it.each(["token", "password", "admin"] as const)(
    "%s: frühere Links bleiben nach echter Wiederöffnung ungültig",
    async (weg) => {
      const directory = mkdtempSync(join(tmpdir(), "w43-reset-journal-"));
      try {
        const file = join(directory, "state.jsonl");
        const first = await buildDevPersistServices(file);
        const a = await first.auth.register({
          name: "A",
          email: "a@example.test",
          password: "synthetisch-alt-123",
        });
        const b = await first.auth.register({
          name: "B",
          email: "b@example.test",
          password: "synthetisch-alt-123",
        });
        const old = await first.auth.requestPasswordReset(a.email);
        const current = await first.auth.requestPasswordReset(a.email);
        const other = await first.auth.requestPasswordReset(b.email);
        if (!old || !current || !other) throw new Error("Fixture fehlt");
        if (weg === "token")
          await first.auth.resetPasswordWithToken(current.token, "synthetisch-neu-123");
        if (weg === "password")
          await first.auth.changePassword(a.id, "synthetisch-alt-123", "synthetisch-neu-123");
        if (weg === "admin") await first.auth.resetPassword(a.id, "synthetisch-neu-123", a.id);
        expect(readJournalLines(file).map((line) => line.entry)).toContainEqual({
          repo: "resetTokens",
          method: "deleteByUser",
          args: [a.id],
        });
        const reopened = await buildDevPersistServices(file);
        for (const token of [old.token, current.token]) {
          await expect(
            reopened.auth.resetPasswordWithToken(token, "angreifer-neu-123"),
          ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
        }
        expect(
          (await reopened.auth.login({ email: a.email, password: "synthetisch-neu-123" })).user.id,
        ).toBe(a.id);
        await expect(
          reopened.auth.resetPasswordWithToken(other.token, "anderes-neu-123"),
        ).resolves.toBeUndefined();
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
});
