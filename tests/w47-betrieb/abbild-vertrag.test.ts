import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const read = (path: string) => readFileSync(path, "utf8");
class ResetBuild {}
type Service = Record<string, unknown>;
type Compose = { services: Record<string, Service> };
function overlay(base: Compose, next: Compose): Compose {
  const services = Object.fromEntries(
    Object.entries(base.services).map(([name, value]) => [name, { ...value }]),
  );
  for (const [name, value] of Object.entries(next.services)) {
    const service = services[name] ?? {};
    for (const [key, item] of Object.entries(value)) {
      if (item instanceof ResetBuild) delete service[key];
      else service[key] = item;
    }
    services[name] = service;
  }
  return { services };
}
describe("W4.7 Abbild-Quellvertraege, kein Docker-/Hostlauf", () => {
  it("beide Dienste loeschen das geerbte build und binden dasselbe bereits gepruefte Abbild", () => {
    const base = parse(read("docker-compose.prod.yml")) as Compose;
    const next = parse(read("scripts/deploy/compose-abbild.yml"), {
      customTags: [{ tag: "!reset", resolve: () => new ResetBuild() }],
    }) as Compose;
    const effective = overlay(base, next);
    for (const name of ["app", "protokollpflege"]) {
      expect(base.services[name]?.build).toBeDefined();
      expect(effective.services[name]?.build).toBeUndefined();
      expect(effective.services[name]?.pull_policy).toBe("never");
      expect(String(effective.services[name]?.image)).toContain("${KLARWERK_ABBILD:?");
    }
    expect(effective.services.app?.image).toBe(effective.services.protokollpflege?.image);
    const oldStyle = {
      services: { app: { image: next.services.app?.image, pull_policy: "never" } },
    };
    expect(overlay(base, oldStyle).services.protokollpflege?.build).toBeDefined();
    expect(overlay(base, oldStyle).services.app?.build).toBeDefined();
    expect(effective.services.protokollpflege?.user).toBe(base.services.protokollpflege?.user);
    expect(effective.services.protokollpflege?.volumes).toEqual(
      base.services.protokollpflege?.volumes,
    );
  });
  it("Backup wird gezielt mit Ausfuehrungsrechten kopiert; PGDG liefert den vollstaendigen Client16", () => {
    const docker = read("Dockerfile");
    const ignores = read(".dockerignore").split("\n");
    expect(ignores).not.toContain("scripts");
    expect(ignores).toContain("!scripts/backup");
    expect(ignores).toContain("!scripts/backup/backup.sh");
    expect(ignores).toContain("scripts/backup/*");
    expect(docker).toContain(
      "COPY --chown=node:node --chmod=0755 scripts/backup/backup.sh scripts/backup/backup.sh",
    );
    expect(docker).toContain("postgresql-client-16");
    expect(docker).toContain("https://www.postgresql.org/media/keys/ACCC4CF8.asc");
    expect(docker).toContain("signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc");
    expect(docker).toContain("https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main");
    expect(docker).toContain("printf '%s\\n'");
    expect(docker).not.toMatch(/allow-unauthenticated|trusted=yes|--insecure/);
    const nodeUser = docker.slice(docker.lastIndexOf("USER node"));
    expect(nodeUser).toContain("test -x /app/scripts/backup/backup.sh");
    expect(nodeUser).toContain("bash -n /app/scripts/backup/backup.sh");
    expect(nodeUser).toContain("pg_dump --version");
    expect(nodeUser).toContain("pg_restore --version");
    expect(nodeUser).toContain("16[.]");
    expect(read("scripts/backup/backup.sh")).toContain("BACKUP_KEEP");
  });
  it("Node24 gilt fuer alle Node-Stufen, CI und Engines; sichtbare Version und Paketmetadaten sind exakt1045", () => {
    const stages = read("Dockerfile")
      .split("\n")
      .filter((line) => line.startsWith("FROM node:"));
    expect(stages).toHaveLength(3);
    expect(stages.every((line) => line.startsWith("FROM node:24-bookworm-slim"))).toBe(true);
    const versions = read(".github/workflows/ci.yml").match(/node-version: "([^"]+)"/g) ?? [];
    expect(versions.length).toBeGreaterThan(0);
    expect(versions.every((value) => value.includes('"24"'))).toBe(true);
    const root = JSON.parse(read("package.json"));
    const lock = JSON.parse(read("package-lock.json"));
    const web = JSON.parse(read("apps/web/package.json"));
    const appVersion = /APP_VERSION\s*=\s*"([^"]+)"/.exec(read("apps/web/src/version.ts"))?.[1];
    expect(appVersion).toBe("1.0.0-beta.1.1045");
    expect(root.version).toBe(appVersion);
    expect(lock.version).toBe(appVersion);
    expect(lock.packages[""].version).toBe(appVersion);
    expect(root.engines.node).toBe(">=24");
    expect(web.engines.node).toBe(">=24");
    expect(lock.packages["node_modules/fastify"].version).toBe("5.12.7");
    expect(lock.packages["node_modules/find-my-way"].version).toBe("9.10.0");
    expect(lock.packages["node_modules/nodemailer"].version).toBe("10.1.4");
    expect(lock.packages["node_modules/fast-uri"].version).toBe("3.1.9");
    const webLock = JSON.parse(read("apps/web/package-lock.json"));
    expect(webLock.packages["node_modules/react-router-dom"].version).toBe("6.30.6");
    expect(webLock.packages["node_modules/react-router"].version).toBe("6.30.6");
    expect(webLock.packages["node_modules/@remix-run/router"].version).toBe("1.23.4");
  });
});
