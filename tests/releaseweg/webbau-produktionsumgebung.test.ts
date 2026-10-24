import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { expect, it } from "vitest";

it("gibt nur dem Vite-Kind des ganzen Webbaus production statt test", () => {
  const work = realpathSync(mkdtempSync(join(tmpdir(), "webbau-synthetisch-")));
  const controls = {
    KLARWERK_SKIP_KEYCHAIN: "1",
    EXTERNAL_SEARCH: "off",
    NODE_ENV: "test",
    KLARWERK_DEV_PERSIST: "0",
  };
  const expected = { ...controls, HOME: process.env.HOME };
  try {
    expect(process.env.NODE_ENV).toBe("test");
    for (const path of ["tools", "bin", "apps/web"])
      mkdirSync(join(work, path), { recursive: true });
    copyFileSync(resolve(__dirname, "../../tools/build"), join(work, "tools/build"));
    // Ausschließlich synthetische CLI-Stellvertreter: protokollieren und sofort beenden.
    const stub = String.raw`#!${process.execPath}
const fs=require('node:fs'),path=require('node:path');
const args=process.argv.slice(2),name=path.basename(process.argv[1]);
const fassung=args[0]==='--synthetisch-fassung-vorab';
const step={command:fassung?'fassung-vorab':name,args:fassung?args.slice(1):args,cwd:process.cwd(),pid:process.pid,env:Object.fromEntries(['KLARWERK_SKIP_KEYCHAIN','EXTERNAL_SEARCH','NODE_ENV','KLARWERK_DEV_PERSIST','HOME'].map(k=>[k,process.env[k]]))};
const log=path.join(__dirname,'../ereignisse.jsonl');
for(const event of ['start','end'])fs.appendFileSync(log,JSON.stringify({...step,event})+'\n');
`;
    for (const command of ["npm", "npx", "node"])
      writeFileSync(join(work, "bin", command), stub, { mode: 0o755 });
    writeFileSync(
      join(work, "tools/fassung-vorab.sh"),
      '#!/usr/bin/env bash\nexec node --synthetisch-fassung-vorab "$@"\n',
    );
    const run = spawnSync("bash", [join(work, "tools/build")], {
      cwd: work,
      env: {
        PATH: join(work, "bin") + delimiter + (process.env.PATH ?? ""),
        HOME: process.env.HOME,
        TMPDIR: process.env.TMPDIR,
        LANG: process.env.LANG,
        ...controls,
      },
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(run.error).toBeUndefined();
    expect(run.signal).toBeNull();
    expect(run.status, run.stderr).toBe(0);
    const events = readFileSync(join(work, "ereignisse.jsonl"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const steps = events.filter((event) => event.event === "start");
    expect(steps.map((step) => [step.command, step.args])).toEqual([
      ["fassung-vorab", []],
      ["npm", ["run", "--silent", "build"]],
      ["npx", ["tsc", "--noEmit", "-p", "tsconfig.tests-smoke.json"]],
      ["node", ["tools/typpruefung-umfang.mjs"]],
      ["npx", ["vite", "build"]],
    ]);
    expect(events).toEqual(steps.flatMap((step) => [step, { ...step, event: "end" }]));
    expect(new Set(steps.map((step) => step.pid)).size).toBe(5);
    for (const step of steps.slice(0, 4)) {
      expect(step.cwd).toBe(work);
      expect(step.env).toEqual(expected);
    }
    const vite = steps.at(-1);
    expect(vite.cwd).toBe(join(work, "apps/web"));
    expect(process.env.NODE_ENV).toBe("test");
    expect(vite.env, "Vite-Kindprozess muss production erhalten").toEqual({
      ...expected,
      NODE_ENV: "production",
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
