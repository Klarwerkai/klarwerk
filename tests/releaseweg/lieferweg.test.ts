import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const root = join(__dirname, "../..");
const directory = mkdtempSync(join(tmpdir(), "release-vertrag-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));
const moduleUrl = pathToFileURL(join(root, "tools/release.mjs")).href;
const publishUrl = pathToFileURL(join(root, "tools/publish.mjs")).href;
const prelude = `
import assert from 'node:assert/strict';
const m = await import(process.argv[1]);
const {releaseVertrag:c} = await import(new URL('./release-vertrag.mjs', process.argv[1]));
const tests=m.selection(['tests/releaseweg/lieferweg.test.ts']);
const report={success:true,numTotalTests:tests.length,numPassedTests:tests.length,numFailedTests:0,numPendingTests:0,numTodoTests:0,testResults:tests.map(name=>({name:'/synthetic/'+name,status:'passed',assertionResults:[{status:'passed',failureMessages:[]}]}))};
const proof={version:c.version,contractHash:m.contractHash,commit:'a'.repeat(40),base:'b'.repeat(40),tree:'c'.repeat(40),root:'/synthetic',output:'/synthetic/out',changedPaths:['tests/releaseweg/lieferweg.test.ts'],tests,integrationTests:[],deferredTests:[],policyHash:m.policyHash,exceptions:[],sourceUnchanged:true,success:true,startedAt:new Date(0).toISOString(),endedAt:new Date(6000).toISOString(),testReport:report,stages:c.stages.map((s,i)=>({name:s.name,command:m.stageCommand(s,tests,'/synthetic/out'),startedAt:new Date(i*1000).toISOString(),endedAt:new Date(i*1000+100).toISOString(),exit:0,success:true,sourceUnchanged:true,logSha:'d'.repeat(64)}))};
`;
function node(code: string, url = moduleUrl, args: string[] = []) {
  return spawnSync(process.execPath, ["--input-type=module", "-e", code, url, ...args], {
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
    timeout: 20000,
  });
}

describe("Welle1: Pflichtausführung und Erfolg unterscheiden", () => {
  it("akzeptiert ausschließlich den vollständigen baumgebundenen Pflichtvertrag", () => {
    const run = node(`${prelude}m.assertProof(proof, proof.tree);`);
    expect(run.status, run.stderr).toBe(0);
  });
  it.each([
    "proof.stages.pop()",
    "proof.stages[2].exit=1",
    "proof.stages[2].success=false",
    "proof.stages[1].sourceUnchanged=false",
    "proof.sourceUnchanged=false",
    "proof.tree='e'.repeat(40)",
    "proof.endedAt=new Date(600001).toISOString()",
    "proof.tests=[]",
    "proof.changedPaths.push('tests/new.test.ts')",
    "proof.testReport.numPendingTests=1",
    "proof.testReport.testResults[0].assertionResults[0].status='skipped'",
    "proof.exceptions=[{fingerprint:'unknown',expires:'2000-01-01'}]",
  ])("weist den konkreten Gegenfall ab: %s", (change) => {
    const run = node(`${prelude}${change};assert.throws(()=>m.assertProof(proof,'c'.repeat(40)));`);
    expect(run.status, run.stderr).toBe(0);
  });
  it("ordnet berührte Integrationstests ehrlich dem verpflichtenden CI-PG-Weg zu", () => {
    const run = node(`${prelude}
const paths=['services/ask/src/service.integration.test.ts','tests/unit.test.ts'];
assert(!m.selection(paths).some(p=>p.endsWith('.integration.test.ts')));
assert.deepEqual(m.integrationSelection(paths),['services/ask/src/service.integration.test.ts']);
`);
    expect(run.status, run.stderr).toBe(0);
  });
  it("nur die ausdrücklich benannte lange Diagnose wird zugeordnet; unbekannte Tests bleiben Pflicht", () => {
    const run = node(`${prelude}
const mixed='tests/tor-inventar/lastgrenze-wrapper.test.ts';
assert(!m.selection([mixed]).includes(mixed));
const deferred=m.deferredSelection([mixed]);
assert.equal(deferred.length,1);assert.equal(deferred[0].owner,'Root');assert.equal(deferred[0].due,'2026-10-23T18:00:00Z');
assert(m.selection(['tests/unbekannt.test.ts']).includes('tests/unbekannt.test.ts'));
`);
    expect(run.status, run.stderr).toBe(0);
  });
  it("ordnet Browser nachgelagert und Nicht-Browsertests der Pflicht zu", () => {
    const browser = "tests/klara-besprechung/segment-browser.test.ts";
    const unit = "tests/klara-besprechung/segmentierung.test.ts";
    const jsdom = "tests/rechteentzug-gespraeche/ask-rueckmeldung-rechtewechsel.test.tsx";
    const unknown = "tests/unbekannt.test.ts";
    const run = node(
      `const m=await import(process.argv[1]);
const paths=${JSON.stringify([browser, unit, jsdom, unknown])};
console.log(JSON.stringify({pflicht:m.selection(paths),nachgelagert:m.deferredSelection(paths)}));`,
    );
    expect(run.status, run.stderr).toBe(0);
    const result = JSON.parse(run.stdout);
    expect(result.pflicht, "Browserdiagnose fälschlich Pflicht").not.toContain(browser);
    for (const path of [unit, jsdom, unknown]) expect(result.pflicht).toContain(path);
    expect(result.nachgelagert).toEqual([
      expect.objectContaining({
        path: browser,
        owner: "Root",
        withinHours: 24,
        diagnosis: "Volltor und Browserdiagnosen",
        importChain: [browser],
      }),
    ]);
  });
  it("gezielte PG-Auswahl bleibt dem CI-Weg zugeordnet und startet durch Import nichts", () => {
    const run = node(`
import assert from 'node:assert/strict';
const m=await import(new URL('./pg-auswahl.mjs',process.argv[1]));
assert.deepEqual(m.pgSelection(['services/a.integration.test.ts','tests/unit.test.ts']),['services/a.integration.test.ts']);
assert.deepEqual(m.pgSelection(['tests/unit.test.ts']),[]);
`);
    expect(run.status, run.stderr).toBe(0);
  });
  it("frischer CI-Checkout braucht keinen Commitautor; eine rote Stufe stoppt alle Nachfolger", () => {
    const work = join(directory, "fresh-ci");
    for (const path of ["bin", "tools", "node_modules/.bin"]) {
      mkdirSync(join(work, path), { recursive: true });
    }
    writeFileSync(
      join(work, "bin/git"),
      `#!/bin/bash
case "$1" in
status|diff) exit 0 ;;
rev-parse) if [ "$2" = "HEAD" ]; then printf '%040d' 1; else printf '%040d' 2; fi ;;
*) echo "Kein Commitautor eingerichtet" >&2; exit 128 ;;
esac
`,
      { mode: 0o755 },
    );
    writeFileSync(join(work, "tools/browserdeckel.sh"), '#!/bin/bash\nshift\nexec "$@"\n', {
      mode: 0o755,
    });
    writeFileSync(
      join(work, "node_modules/.bin/tsc"),
      "#!/bin/bash\necho synthetic-type-error\nexit 1\n",
      { mode: 0o755 },
    );
    const run = node(
      `
import assert from 'node:assert/strict';
const m=await import(process.argv[1]);
process.env.GITHUB_ACTIONS='true';
process.env.PATH=process.argv[2]+'/bin:'+process.env.PATH;
const proof=m.runRelease(process.argv[2],'b'.repeat(40),process.argv[2]+'/out');
assert.equal(proof.writer,'github-actions:Pflichtprüfung');
assert.equal(proof.success,false);
assert.equal(proof.stages.length,1);
assert.equal(proof.stages[0].exit,1);
assert.equal(proof.stages[0].name,'roottyp');
`,
      moduleUrl,
      [work],
    );
    expect(run.status, run.stderr).toBe(0);
  });
  it("CI: jüngster Lauf zählt, falscher Commit, skip und geplanter Erfolg sperren", () => {
    const run = node(
      `
import assert from 'node:assert/strict';
const m=await import(process.argv[1]);
const commit='a'.repeat(40);
const ok={id:1,name:'pflicht',head_sha:commit,app:{slug:'github-actions'},status:'completed',conclusion:'success'};
const pg={...ok,name:'integration'};
m.assertCi({check_runs:[ok,pg]},commit);
for(const patch of [{head_sha:'b'.repeat(40)},{status:'in_progress'},{conclusion:'skipped'},{app:{slug:'other'}}]) assert.throws(()=>m.assertCi({check_runs:[{...ok,...patch},pg]},commit));
assert.throws(()=>m.assertCi({check_runs:[ok,pg,{...ok,id:2,status:'in_progress'}]},commit));
`,
      publishUrl,
    );
    expect(run.status, run.stderr).toBe(0);
  });
  it("nur ein tatsächlich abgeschlossenes unabhängiges Urteil zum exakten Commit zählt", () => {
    const evidence = join(directory, "ben.txt");
    writeFileSync(
      evidence,
      "APP0: tatsächlicher synthetischer Prüferabschluss\nMetadatenregel: ein Child, identischer Baum, unveränderte Identitäten und echte Trailer.\n",
    );
    const run = node(
      `
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const m=await import(process.argv[1]);
const {hash}=await import(new URL('./release.mjs',process.argv[1]));
const r={allowAttestationChild:true,completed:true,exit:0,decision:'APP0',commit:'a',tree:'t',proofSha:'p',writer:'Codex',reviewer:'ben:independent',evidence:process.argv[2],evidenceSha:hash(readFileSync(process.argv[2]))};
m.assertReview(r,'a','t','p','Codex');
for(const patch of [{allowAttestationChild:false},{completed:false},{exit:1},{decision:'APP1'},{commit:'b'},{tree:'x'},{proofSha:'q'},{reviewer:'Codex'},{writer:'other'},{evidenceSha:'wrong'}]) assert.throws(()=>m.assertReview({...r,...patch},'a','t','p','Codex'));
`,
      publishUrl,
      [evidence],
    );
    expect(run.status, run.stderr).toBe(0);
  });
  it("nur ein legitimer baumgleicher Child mit echten Git-Trailern gilt", () => {
    const run = node(
      `
import assert from 'node:assert/strict';
const m=await import(process.argv[1]);
const expected={commit:'a'.repeat(40),tree:'b'.repeat(40),writer:'Codex <codex@openai.com>',proofSha:'c'.repeat(64),reviewSha:'d'.repeat(64)};
const trailers='Tor-Ergebnis: '+expected.proofSha+'\\nTor-Baum: '+expected.tree+'\\nReview-Ergebnis: '+expected.reviewSha;
const actual={parents:[expected.commit],tree:expected.tree,author:expected.writer,committer:expected.writer,message:'ship: geprüft\\n\\n'+trailers+'\\n'};
m.assertAttestation(actual,expected);
assert.throws(()=>m.assertAttestation({...actual,parents:[expected.commit,'e'.repeat(40)]},expected));
const body='ship: geprüft\\n\\nBodytext enthält '+trailers.replaceAll('\\n',' in prose ')+' als Zitat, keine Trailer.\\n';
assert(body.includes('Tor-Ergebnis: '+expected.proofSha));
assert.throws(()=>m.assertAttestation({...actual,message:body},expected));
assert.throws(()=>m.assertAttestation({...actual,message:actual.message+'Tor-Ergebnis: '+expected.proofSha+'\\n'},expected));
`,
      publishUrl,
    );
    expect(run.status, run.stderr).toBe(0);
  });
  it("lange rote Integration macht exaktes Pflichtgrün nicht falschrot", () => {
    const run = node(
      `
const m=await import(process.argv[1]);
m.assertCi({check_runs:[{id:1,name:'pflicht',head_sha:'a',app:{slug:'github-actions'},status:'completed',conclusion:'success'},{id:2,name:'integration',head_sha:'a',app:{slug:'github-actions'},status:'completed',conclusion:'failure'}]},'a');
`,
      publishUrl,
    );
    expect(run.status, run.stderr).toBe(0);
  });
  it("Status einer unklaren Absicht liest nur und startet keinen Versand", () => {
    const intent = join(directory, "intent.json");
    writeFileSync(intent, JSON.stringify({ state: "send-started", commit: "a".repeat(40) }));
    const run = node(
      `const m=await import(process.argv[1]);await m.publishMain('/does-not-exist',['status',process.argv[2]]);`,
      publishUrl,
      [intent],
    );
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain("send-started");
  });
});
