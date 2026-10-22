import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";
import { pruefeText } from "../../tools/geheimnis-scan";

const root = join(__dirname, "../..");
it("befristete Einzelfunde erlauben keine unbekannten, geänderten, doppelten oder abgelaufenen Diagnosen", () => {
  const program = `
import assert from 'node:assert/strict';
const m=await import(process.argv[1]);
const now=Date.parse('2026-10-22T21:00:00Z');
const known=m.policy.entries[0];
const f={stage:known.stage,path:known.path,rule:known.rule,fingerprint:known.fingerprint};
assert(m.assessFindings([f],m.policy,now).accepted);
for(const change of [{path:'new.ts'},{rule:'unknown'},{fingerprint:'0'.repeat(64)}]) assert(!m.assessFindings([{...f,...change}],m.policy,now).accepted);
assert(!m.assessFindings([f,f],m.policy,now).accepted);
assert(!m.assessFindings([f],m.policy,Date.parse(m.EXCEPTION_DEADLINE)+1).accepted);
for(const change of [{owner:'unknown'},{reason:''},{expires:'2026-10-24T18:00:00Z'}]) assert(!m.assessFindings([f],{version:1,entries:[{...known,...change}]},now).accepted);
const raw={summary:{error:1,violations:[{type:'dependency',from:'new.ts',to:'other.ts',rule:{severity:'error',name:'new-boundary'}}]}};
assert(!m.assessStage('architecture',0,JSON.stringify(raw),'/synthetic',now).accepted);
assert.throws(()=>m.assessStage('lint',1,'no complete report','/synthetic',now));
assert.throws(()=>m.findingsFor('lint',{summary:{errors:1,diagnosticsNotPrinted:1},diagnostics:[]},'/synthetic'));
`;
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      program,
      pathToFileURL(join(root, "tools/release-ausnahmen.mjs")).href,
    ],
    {
      cwd: root,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        KLARWERK_SKIP_KEYCHAIN: "1",
        EXTERNAL_SEARCH: "off",
        NODE_ENV: "test",
        KLARWERK_DEV_PERSIST: "0",
      },
      encoding: "utf8",
      timeout: 10000,
    },
  );
  expect(result.status, result.stderr).toBe(0);
});

it("die ausdrückliche Attrappenmarke gilt eng; ein unbekannter Folgewert bleibt rot", () => {
  const source = readFileSync(
    join(root, "tests/ki-modus-wahrheit/zugang-herkunft.test.ts"),
    "utf8",
  );
  expect(pruefeText("tests/ki-modus-wahrheit/zugang-herkunft.test.ts", source)).toEqual([]);
  const prefix = ["sk", "ant", ""].join("-");
  const unknown = `${source}\nconst unknown = "${prefix}${"A".repeat(32)}";\n`;
  expect(
    pruefeText("new-fixture.ts", unknown).some((f) => f.regel === "anthropic-schluessel"),
  ).toBe(true);
  expect(
    pruefeText("new-fixture.ts", `const key="${prefix}${"A".repeat(32)}"; // unrelated comment\n`),
  ).not.toEqual([]);
});
