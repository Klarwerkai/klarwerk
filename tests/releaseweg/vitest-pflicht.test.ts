import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const root = join(__dirname, "../..");
mkdirSync(join(root, ".local/run"), { recursive: true });
const directory = mkdtempSync(join(root, ".local/run/welle1-fixtures-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));
let serial = 0;
function environment() {
  const names = ["PATH", "HOME", "TMPDIR", "LANG", "USER", "LOGNAME", "SHELL"];
  return {
    ...Object.fromEntries(names.filter((n) => process.env[n]).map((n) => [n, process.env[n]])),
    KLARWERK_SKIP_KEYCHAIN: "1",
    EXTERNAL_SEARCH: "off",
    NODE_ENV: "test",
    KLARWERK_DEV_PERSIST: "0",
  };
}
function fixture(config: string, body: string, args: string[] = []) {
  const work = join(directory, `f${++serial}`);
  mkdirSync(work);
  const url = join(root, config);
  writeFileSync(join(work, "probe.ts"), `import {it,expect} from 'vitest';\n${body}`);
  writeFileSync(
    join(work, "vitest.config.ts"),
    `
import base from ${JSON.stringify(url)};
delete process.env.KLARWERK_SKIP_KEYCHAIN;
export default {root:${JSON.stringify(work)},test:{...base.test,include:['probe.ts'],setupFiles:[${JSON.stringify(join(root, "tests/setup-env.ts"))}],runner:${JSON.stringify(join(root, "tests/pg-laufbeleg/laut-runner.ts"))},testTimeout:5000}};
`,
  );
  // Echte Vitest-Unterprozesse, ausschließlich synthetische Fälle; keine DB-/Browserimporte.
  return spawnSync(
    process.execPath,
    [
      join(root, "node_modules/vitest/vitest.mjs"),
      "run",
      "--config",
      join(work, "vitest.config.ts"),
      "--pool=forks",
      "--minWorkers=1",
      "--maxWorkers=1",
      "--poolOptions.forks.minForks=1",
      "--poolOptions.forks.maxForks=1",
      "--no-file-parallelism",
      ...args,
    ],
    {
      cwd: root,
      env: { ...environment(), KLARWERK_PG_PFLICHT: "1" },
      encoding: "utf8",
      timeout: 20000,
    },
  );
}

describe("Welle1: Pflichtmodus ist unabhängig vom gewählten Reporter", () => {
  it("beforeAll-Originalfehler bleibt mit eigenem Reporter ohne zweiten PG-Pflichtfehler rot", () => {
    const run = fixture(
      "vitest.integration.config.ts",
      "import {beforeAll} from 'vitest';beforeAll(()=>{throw new Error('PG-ORIGINAL-BEFOREALL');});it('synthetisch',()=>{});",
      ["--reporter=dot"],
    );
    const ausgabe = `${run.stdout}\n${run.stderr}`;
    expect(run.error, ausgabe).toBeUndefined();
    expect(run.signal, ausgabe).toBeNull();
    expect(run.status, ausgabe).not.toBeNull();
    expect(run.status, ausgabe).not.toBe(0);
    expect(ausgabe).toContain("PG-ORIGINAL-BEFOREALL");
    expect(ausgabe).not.toContain("PG-Pflicht verletzt");
  });
  it("Assertion-Originalfehler bleibt mit eigenem Reporter ohne zweiten PG-Pflichtfehler rot", () => {
    const run = fixture(
      "vitest.integration.config.ts",
      "it('synthetisch',()=>expect('PG-ORIGINAL-ASSERTION-IST').toBe('PG-ORIGINAL-ASSERTION-SOLL'));",
      ["--reporter=dot"],
    );
    const ausgabe = `${run.stdout}\n${run.stderr}`;
    expect(run.error, ausgabe).toBeUndefined();
    expect(run.signal, ausgabe).toBeNull();
    expect(run.status, ausgabe).not.toBeNull();
    expect(run.status, ausgabe).not.toBe(0);
    expect(ausgabe).toContain("PG-ORIGINAL-ASSERTION-IST");
    expect(ausgabe).toContain("PG-ORIGINAL-ASSERTION-SOLL");
    expect(ausgabe).not.toContain("PG-Pflicht verletzt");
  });
  it.each(["vitest.config.ts", "vitest.browser.config.ts", "vitest.integration.config.ts"])(
    "%s: synthetische Positivprobe bleibt erfolgreich",
    (config) => {
      const run = fixture(config, "it('ausgeführt',()=>expect(1).toBe(1));", ["--reporter=dot"]);
      expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
    },
  );
  it("direktes Vitest setzt den Keychain-Schutz vor dem Import der Testdatei", () => {
    const run = fixture(
      "vitest.config.ts",
      "expect(process.env.KLARWERK_SKIP_KEYCHAIN).toBe('1');it('synthetisch',()=>{});",
      ["--reporter=dot"],
    );
    expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
  });
  it.each([
    "it.skip('statisch',()=>{});",
    "it('zur Laufzeit',ctx=>ctx.skip());",
    "it.todo('später');",
    "",
  ])("übersprungene/todo/keine Fälle werden mit eigenem Reporter rot: %s", (body) => {
    const run = fixture("vitest.integration.config.ts", body, ["--reporter=dot"]);
    expect(run.status, `${run.stdout}\n${run.stderr}`).not.toBe(0);
  });
  it.each(["vitest.config.ts", "vitest.browser.config.ts", "vitest.integration.config.ts"])(
    "%s verbietet .only im tatsächlich geladenen Vertrag",
    (config) => {
      const run = fixture(config, "it.only('unzulässig',()=>{});", ["--reporter=dot"]);
      expect(run.status, `${run.stdout}\n${run.stderr}`).not.toBe(0);
      expect(`${run.stdout}\n${run.stderr}`).toContain("only");
    },
  );
  it("tools/test: eine leere Teilgruppe erlaubt, insgesamt0 auch mit eigenem Reporter rot", () => {
    const work = join(directory, "wrapper");
    mkdirSync(join(work, "tools"), { recursive: true });
    mkdirSync(join(work, "bin"));
    copyFileSync(join(root, "tools/test"), join(work, "tools/test"));
    copyFileSync(join(root, "tools/test-zahl.mjs"), join(work, "tools/test-zahl.mjs"));
    // Nur die synthetische Hülle: kein zweiter globaler Deckel innerhalb des äußeren Prüflaufs.
    writeFileSync(join(work, "tools/browserdeckel.sh"), '#!/bin/bash\nshift\nexec "$@"\n', {
      mode: 0o755,
    });
    const quote = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;
    writeFileSync(
      join(work, "bin/npx"),
      `#!/bin/bash\nshift\nexec ${quote(process.execPath)} ${quote(join(root, "node_modules/vitest/vitest.mjs"))} "$@"\n`,
      { mode: 0o755 },
    );
    for (const [file, selected] of [
      ["vitest.config.ts", "r.test.ts"],
      ["vitest.browser.config.ts", "b.test.ts"],
    ]) {
      writeFileSync(
        join(work, file as string),
        `export default {test:{include:[${JSON.stringify(selected)}],allowOnly:false}};`,
      );
    }
    writeFileSync(join(work, "r.test.ts"), "import {it} from 'vitest';it('synthetisch',()=>{});");
    const invoke = (filter: string) =>
      spawnSync("bash", [join(work, "tools/test"), filter, "--reporter=dot"], {
        cwd: work,
        env: {
          ...environment(),
          PATH: `${join(work, "bin")}:${process.env.PATH}`,
          KLARWERK_TEST_FORKS: "1",
        },
        encoding: "utf8",
        timeout: 30000,
      });
    const positive = invoke("r.test.ts");
    expect(positive.status, `${positive.stdout}\n${positive.stderr}`).toBe(0);
    const empty = invoke("missing.test.ts");
    expect(empty.status, `${empty.stdout}\n${empty.stderr}`).not.toBe(0);
    expect(`${empty.stdout}\n${empty.stderr}`).toContain("test rot");
  });
});
