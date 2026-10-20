import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AssistenzProfilDienst,
  PgAssistenzProfilRepo,
} from "../../services/app/src/assistenz-profil";
import { createPool, migrate } from "../../services/app/src/db";
let c: StartedTestContainer;
let url = "";
const pools: ReturnType<typeof createPool>[] = [];
function neu() {
  const p = createPool(url);
  pools.push(p);
  return new AssistenzProfilDienst({ repo: new PgAssistenzProfilRepo(p) });
}
beforeAll(async () => {
  c = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klara_einfuehrung_test" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  url = `postgresql://postgres:test@${c.getHost()}:${c.getMappedPort(5432)}/klara_einfuehrung_test`;
  const p = createPool(url);
  pools.push(p);
  await migrate(p);
}, 180000);
afterAll(async () => {
  for (const p of pools) await p.end();
  await c?.stop();
});
describe("Klara16 · Fortsetzung im vorhandenen echten PostgreSQL-Profil", () => {
  it("erhält Fortschritt und Profilzone nach neuem Pool, normalen Profiländerungen und Nebenläufigkeit", async () => {
    const d = neu();
    const e = { schritt: 2, begleitung: "kurz", zeitzone: "Asia/Tokyo", abgeschlossen: false };
    const p = await d.aendere("anna", {
      fassung: 0,
      name: "Anna Fiktiv",
      avatar: "eule",
      einfuehrung: e,
    });
    expect((await neu().hole("anna"))?.einfuehrung).toEqual(e);
    expect(await neu().hole("bert")).toBe(null);
    const x = await neu().aendere("anna", { fassung: p.fassung, bewegung: "reduziert" });
    expect(x.einfuehrung).toEqual(e);
    const r = await Promise.allSettled([
      neu().aendere("anna", {
        fassung: x.fassung,
        einfuehrung: { ...e, schritt: 3, abgeschlossen: true },
      }),
      neu().aendere("anna", { fassung: x.fassung, einfuehrung: { ...e, schritt: 1 } }),
    ]);
    expect(r.filter((v) => v.status === "fulfilled")).toHaveLength(1);
    expect(r.filter((v) => v.status === "rejected")).toHaveLength(1);
    const wieder = await neu().hole("anna");
    expect(wieder?.name).toBe("Anna Fiktiv");
    expect(wieder?.bewegung).toBe("reduziert");
    expect(wieder?.einfuehrung?.zeitzone).toBe("Asia/Tokyo");
  });
});
