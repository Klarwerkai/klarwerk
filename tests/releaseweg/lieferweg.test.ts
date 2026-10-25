import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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

describe("gezielte PG-Dateien: getrennte serielle Prozessbudgets", () => {
  const pgUrl = pathToFileURL(join(root, "tools/pg-auswahl.mjs")).href;

  function vorrichtung(
    name: string,
    files: string[],
    fehlend = "",
    roteDateien: string[] = [],
    inkonsistent = "",
  ) {
    const work = join(realpathSync(directory), name);
    mkdirSync(join(work, "services/db-tx/src"), { recursive: true });
    copyFileSync(
      join(root, "services/db-tx/src/pg-test-guard.ts"),
      join(work, "services/db-tx/src/pg-test-guard.ts"),
    );
    for (const path of ["bin", "tools", "tests", "node_modules/.bin"]) {
      mkdirSync(join(work, path), { recursive: true });
    }
    for (const file of files)
      writeFileSync(join(work, file), "// synthetische Integrationsdatei\n");
    writeFileSync(
      join(work, "bin/git"),
      `#!${process.execPath}
const args=process.argv.slice(2);
if(args[0]==='diff')process.stdout.write(${JSON.stringify(files.join("\n"))});
else if(args[0]==='rev-parse')process.stdout.write((args[1]==='HEAD'?'a':'c').repeat(40));
else process.exitCode=1;
`,
      { mode: 0o755 },
    );
    writeFileSync(join(work, "tools/browserdeckel.sh"), '#!/bin/bash\nshift\nexec "$@"\n', {
      mode: 0o755,
    });
    writeFileSync(
      join(work, "node_modules/.bin/vitest"),
      String.raw`#!${process.execPath}
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const args=process.argv.slice(2);
assert.equal(process.env.HOME,${JSON.stringify(process.env.HOME)});
for(const [key,value]of Object.entries({KLARWERK_SKIP_KEYCHAIN:'1',EXTERNAL_SEARCH:'off',NODE_ENV:'test',KLARWERK_DEV_PERSIST:'0',KLARWERK_PG_PFLICHT:'1'}))assert.equal(process.env[key],value);
for(const flag of ['--allowOnly=false','--passWithNoTests=false','--pool=forks','--poolOptions.forks.minForks=1','--poolOptions.forks.maxForks=1','--minWorkers=1','--maxWorkers=1','--no-file-parallelism','--testTimeout=60000'])assert(args.includes(flag));
const files=args.filter(arg=>arg.endsWith('.integration.test.ts'));
assert.equal(files.length,1,'genau eine vollständige Datei je Prozess');
const file=files[0];
const index=${JSON.stringify(files)}.indexOf(file);
assert(index>=0);
const events=path.join(process.cwd(),'kindereignisse.jsonl');
fs.appendFileSync(events,JSON.stringify({event:'start',file,pid:process.pid})+'\n');
console.log('synthetischer Rohlog '+file);
const count=index+2;
const report={success:true,numTotalTestSuites:1,numPassedTestSuites:1,numFailedTestSuites:0,numPendingTestSuites:0,numTotalTests:count,numPassedTests:count,numFailedTests:0,numPendingTests:0,numTodoTests:0,testResults:[{name:path.join(process.cwd(),file),status:'passed',assertionResults:Array.from({length:count},(_,i)=>({title:file+' '+i,status:'passed',failureMessages:[]}))}]};
if(${JSON.stringify(roteDateien)}.includes(file)){
  report.success=false;report.numPassedTestSuites=0;report.numFailedTestSuites=1;
  report.numPassedTests=count-1;report.numFailedTests=1;report.testResults[0].status='failed';
  Object.assign(report.testResults[0].assertionResults[0],{status:'failed',failureMessages:['synthetischer fachlicher Rotbefund '+file]});
}
if(file===${JSON.stringify(inkonsistent)})report.numTotalTests++;
const raw=args.find(arg=>arg.startsWith('--outputFile=')).slice('--outputFile='.length);
if(file!==${JSON.stringify(fehlend)})fs.writeFileSync(raw,JSON.stringify(report),{flag:'wx'});
fs.appendFileSync(events,JSON.stringify({event:'end',file,pid:process.pid})+'\n');
process.exitCode=report.success?0:1;
`,
      { mode: 0o755 },
    );
    return work;
  }

  const programm = String.raw`
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const m=await import(process.argv[1]);
const {assertTests,hash}=await import(new URL('./release.mjs',process.argv[1]));
const work=process.argv[2],out=join(work,'out');
process.env.PATH=join(work,'bin')+':'+process.env.PATH;
process.env.KLARWERK_PG_PFLICHT='1';
const result=m.runPgSelection(work,'b'.repeat(40),out);
const saved=JSON.parse(readFileSync(join(out,'pg-auswahl.json'),'utf8'));
assert.deepEqual(saved,result);
const events=readFileSync(join(work,'kindereignisse.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
`;

  const cliProgramm = String.raw`
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,existsSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const {hash}=await import(new URL('./release.mjs',process.argv[1]));
const work=process.argv[2],out=join(work,'out'),cliPath=join(work,'tools/pg-auswahl.mjs');
symlinkSync(fileURLToPath(process.argv[1]),cliPath);
symlinkSync(fileURLToPath(new URL('./release.mjs',process.argv[1])),join(work,'tools/release.mjs'));
const cli=spawnSync(process.execPath,['--preserve-symlinks-main',cliPath,'b'.repeat(40),out],{
  cwd:work,env:{...process.env,PATH:join(work,'bin')+':'+process.env.PATH,KLARWERK_PG_PFLICHT:'1'},encoding:'utf8',timeout:20000,
});
assert.equal(cli.error,undefined);assert.equal(cli.signal,null);assert.equal(cli.status,1,cli.stderr);
const result=JSON.parse(cli.stdout),saved=JSON.parse(readFileSync(join(out,'pg-auswahl.json'),'utf8'));
assert.deepEqual(saved,result);assert.equal(result.success,false);
const events=readFileSync(join(work,'kindereignisse.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
`;

  it("setzt nach gemessenem Rot seriell fort und hält Gesamtbericht und CLI rot", () => {
    const files = ["tests/a.integration.test.ts", "tests/b.integration.test.ts"];
    const work = vorrichtung("pg-serie-fachlich-rot", files, "", files.slice(0, 1));
    const run = node(
      `${cliProgramm}
assert.deepEqual(events.map(e=>e.event+':'+e.file),${JSON.stringify(files)}.flatMap(file=>['start:'+file,'end:'+file]),'zweite unabhängige PG-Datei wurde nicht gestartet');
assert.equal(result.runs.length,2);assert.equal(new Set(events.map(e=>e.pid)).size,2);
assert.equal(result.exit,1);assert(result.error.includes(${JSON.stringify(files[0])}));
assert.deepEqual(result.runs.map(r=>r.exit),[1,0]);assert.deepEqual(result.runs.map(r=>r.success),[false,true]);
const parts=result.runs.map((r,i)=>{
  assert(r.actualWaitCompleted&&r.signal===null&&r.processError===null);
  assert.equal(r.pid,events[2*i].pid);assert.equal(r.pid,events[2*i+1].pid);
  assert.deepEqual(JSON.parse(readFileSync(join(out,'dateien',String(i+1).padStart(4,'0'),'run.json'))),r);
  const raw=readFileSync(r.rawPath),log=readFileSync(r.logPath);assert.equal(hash(raw),r.rawSha256);assert.equal(hash(log),r.logSha256);assert(log.toString().includes(r.file));
  return JSON.parse(raw);
});
assert(Date.parse(result.runs[0].endedAt)<=Date.parse(result.runs[1].startedAt));
const raw=readFileSync(join(out,'pg.vitest.json'));assert.equal(hash(raw),result.rawSha256);const combined=JSON.parse(raw);
assert.equal(combined.success,false);assert.deepEqual(combined.testResults,parts.flatMap(r=>r.testResults));
assert.equal(combined.numTotalTests,5);assert.equal(combined.numPassedTests,4);assert.equal(combined.numFailedTests,1);
assert.equal(combined.numTotalTestSuites,2);assert.equal(combined.numFailedTestSuites,1);assert.equal(combined.numPassedTestSuites,1);
assert.equal(combined.numPendingTests,0);assert.equal(combined.numTodoTests,0);
assert.deepEqual(combined.testResults[0].assertionResults[0].failureMessages,['synthetischer fachlicher Rotbefund '+result.files[0]]);
assert.equal(hash(readFileSync(join(out,'pg.log'))),result.logSha256);
`,
      pgUrl,
      [work],
    );
    expect(run.status, run.stderr).toBe(0);
  });

  it("stoppt nach inkonsistentem roten Rohbericht weiterhin vor der dritten Datei", () => {
    const files = [
      "tests/a.integration.test.ts",
      "tests/b.integration.test.ts",
      "tests/c.integration.test.ts",
    ];
    const work = vorrichtung("pg-serie-rot-inkonsistent", files, "", files.slice(0, 2), files[1]);
    const run = node(
      `${cliProgramm}
assert(result.error);assert.equal(result.runs.length,2);
assert.deepEqual(events.map(e=>e.event+':'+e.file),${JSON.stringify(files.slice(0, 2))}.flatMap(file=>['start:'+file,'end:'+file]));
assert(!events.some(e=>e.file===${JSON.stringify(files[2])}));assert(!existsSync(join(out,'pg.vitest.json')));
for(const [i,r]of result.runs.entries()){
  assert(r.actualWaitCompleted&&r.exit===1&&r.signal===null&&r.processError===null);assert.equal(r.pid,events[2*i].pid);assert.equal(r.pid,events[2*i+1].pid);
  assert.equal(hash(readFileSync(r.rawPath)),r.rawSha256);assert.equal(hash(readFileSync(r.logPath)),r.logSha256);
  assert.deepEqual(JSON.parse(readFileSync(join(out,'dateien',String(i+1).padStart(4,'0'),'run.json'))),r);
}
const first=JSON.parse(readFileSync(result.runs[0].rawPath)),second=JSON.parse(readFileSync(result.runs[1].rawPath));
assert.equal(first.numTotalTests,first.testResults[0].assertionResults.length);
assert.equal(second.numTotalTests,second.testResults[0].assertionResults.length+1);assert(result.runs[1].error);
`,
      pgUrl,
      [work],
    );
    expect(run.status, run.stderr).toBe(0);
  });

  it("wartet zwei getrennte Dateiprozesse ab und vereinigt ihre vollständigen Rohresultate", () => {
    const files = ["tests/a.integration.test.ts", "tests/b.integration.test.ts"];
    const work = vorrichtung("pg-serie-gruen", files);
    const run = node(
      `${programm}
assert.equal(result.success,true,JSON.stringify(result));assert.deepEqual(result.files,${JSON.stringify(files)});
assert.deepEqual(events.map(e=>e.event+':'+e.file),result.files.flatMap(file=>['start:'+file,'end:'+file]));
assert.equal(new Set(events.map(e=>e.pid)).size,2);
assert.equal(result.runs.length,2);assert(result.runs.every(r=>r.success&&r.actualWaitCompleted&&r.exit===0&&r.signal===null&&r.processError===null));
assert.equal(new Set(result.runs.map(r=>r.rawPath)).size,2);assert.equal(new Set(result.runs.map(r=>r.logPath)).size,2);
const parts=result.runs.map(r=>{const raw=readFileSync(r.rawPath);assert.equal(hash(raw),r.rawSha256);assert(readFileSync(r.logPath,'utf8').includes(r.file));return JSON.parse(raw);});
const combinedRaw=readFileSync(join(out,'pg.vitest.json'));assert.equal(hash(combinedRaw),result.rawSha256);
const combined=JSON.parse(combinedRaw);assertTests(combined,result.files,work);
assert.deepEqual(combined.testResults,parts.flatMap(r=>r.testResults));
assert.equal(combined.numTotalTests,5);assert.equal(combined.numPassedTests,5);assert.equal(combined.numTotalTestSuites,2);
assert.throws(()=>assertTests({...combined,testResults:combined.testResults.slice(0,1)},result.files,work));
`,
      pgUrl,
      [work],
    );
    expect(run.status, run.stderr).toBe(0);
  });

  it("stoppt nach unvollständigem zweiten Teil rot und bewahrt den ersten Rohbeleg", () => {
    const files = [
      "tests/a.integration.test.ts",
      "tests/b.integration.test.ts",
      "tests/c.integration.test.ts",
    ];
    const work = vorrichtung("pg-serie-unvollstaendig", files, files[1]);
    const run = node(
      `${programm}
assert.equal(result.success,false);assert(result.error);assert.equal(result.runs.length,2);
assert.deepEqual(events.map(e=>e.event+':'+e.file),${JSON.stringify(files.slice(0, 2))}.flatMap(file=>['start:'+file,'end:'+file]));
const first=result.runs[0],second=result.runs[1];assert.equal(first.success,true);assert.equal(second.success,false);
assert.equal(second.exit,0);assert.equal(second.signal,null);assert.equal(second.processError,null);assert.equal(second.actualWaitCompleted,true);
const raw=readFileSync(first.rawPath);assert.equal(hash(raw),first.rawSha256);assertTests(JSON.parse(raw),[first.file],work);
assert(readFileSync(first.logPath,'utf8').includes(first.file));assert(existsSync(second.logPath));assert(!existsSync(second.rawPath));
assert(!existsSync(join(out,'pg.vitest.json')));assert(!events.some(e=>e.file==='tests/c.integration.test.ts'));
`,
      pgUrl,
      [work],
    );
    expect(run.status, run.stderr).toBe(0);
  });
});

describe("FE003: belegter Bau und Browser haben getrennte Prozessbudgets", () => {
  const pgUrl = pathToFileURL(join(root, "tools/pg-auswahl.mjs")).href;
  const browserFile = "tests/fe003-tutorial-fragen/browser-breiten.integration.test.ts";
  const previewFile = "tests/fe003-tutorial-fragen/vorschau-weg.integration.test.ts";
  const laterFile = "tests/z.integration.test.ts";

  function phaseFixture(name: string, files: string[], mode = "ok") {
    const work = join(realpathSync(directory), name);
    mkdirSync(join(work, "services/db-tx/src"), { recursive: true });
    copyFileSync(
      join(root, "services/db-tx/src/pg-test-guard.ts"),
      join(work, "services/db-tx/src/pg-test-guard.ts"),
    );
    for (const path of ["tools", "tests/fe003-tutorial-fragen", "node_modules/.bin"]) {
      mkdirSync(join(work, path), { recursive: true });
    }
    copyFileSync(join(root, "tools/pg-auswahl.mjs"), join(work, "tools/pg-auswahl.mjs"));
    copyFileSync(
      join(root, "tests/fe003-tutorial-fragen/kandidat.ts"),
      join(work, "tests/fe003-tutorial-fragen/kandidat.ts"),
    );
    symlinkSync(join(root, "tools/release.mjs"), join(work, "tools/release.mjs"));
    writeFileSync(join(work, "package.json"), '{"type":"module","version":"1.0.0-test"}\n');
    writeFileSync(
      join(work, ".gitignore"),
      "out/\nnode_modules/\napps/web/dist/\nevents.jsonl\ncalls.jsonl\n",
    );
    writeFileSync(join(work, "fassung-beleg.json"), '{"kontrollierterInput":true}\n');
    // Kontrollierte CLI statt Produktbau; kein globales Lock unter dem Normal6-Testdeckel.
    writeFileSync(join(work, "tools/browserdeckel.sh"), '#!/bin/bash\nshift\nexec "$@"\n', {
      mode: 0o755,
    });
    writeFileSync(
      join(work, "tools/build"),
      String.raw`#!${process.execPath}
import assert from 'node:assert/strict';
import {appendFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
const mode=${JSON.stringify(mode)},root=process.cwd();
if(mode==='fallback-manifest'){
  assert.equal(process.env.KLARWERK_FASSUNG_MANIFEST,join(root,'fassung-beleg.json'));
  assert.equal(process.env.UNGEWOLLTER_PROVIDER_MARKER,undefined);
}
for(const [key,value]of Object.entries({KLARWERK_SKIP_KEYCHAIN:'1',EXTERNAL_SEARCH:'off',NODE_ENV:'test',KLARWERK_DEV_PERSIST:'0'}))assert.equal(process.env[key],value);
assert.equal(process.env.HOME,${JSON.stringify(process.env.HOME)});
const event=(event)=>appendFileSync(join(root,'events.jsonl'),JSON.stringify({event,phase:'build',pid:process.pid})+'\n');
event('start');console.log('kontrollierter Bauprozess');
if(mode==='build-timeout')await new Promise(resolve=>setTimeout(resolve,2000));
if(mode==='build-red'){event('end');process.exit(7);}
mkdirSync(join(root,'apps/web/dist/assets'),{recursive:true});
writeFileSync(join(root,'apps/web/dist/assets/app.js'),'export const gebaut=true;\n');
if(mode!=='missing-index')writeFileSync(join(root,'apps/web/dist/index.html'),'<div id="root"></div><script type="module" src="/assets/app.js"></script>');
if(mode==='dirty')appendFileSync(join(root,${JSON.stringify(files.at(0) ?? "")}), '// nicht festgehalten\n');
if(mode==='wrong-head')execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@klarwerk.test','-c','commit.gpgsign=false','commit','--allow-empty','-qm','anderer Stand'],{cwd:root,env:process.env});
event('end');
`,
      { mode: 0o755 },
    );
    writeFileSync(
      join(work, "worker.mjs"),
      String.raw`#!${process.execPath}
import assert from 'node:assert/strict';
import {appendFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const args=process.argv.slice(2),file=args[1],mode=${JSON.stringify(mode)};
for(const [key,value]of Object.entries({KLARWERK_SKIP_KEYCHAIN:'1',EXTERNAL_SEARCH:'off',NODE_ENV:'test',KLARWERK_DEV_PERSIST:'0',KLARWERK_PG_PFLICHT:'1'}))assert.equal(process.env[key],value);
assert.equal(process.env.HOME,${JSON.stringify(process.env.HOME)});
for(const flag of ['--pool=forks','--minWorkers=1','--maxWorkers=1','--poolOptions.forks.minForks=1','--poolOptions.forks.maxForks=1','--no-file-parallelism','--testTimeout=60000'])assert(args.includes(flag));
const event=(event)=>appendFileSync(join(process.cwd(),'events.jsonl'),JSON.stringify({event,phase:'test',file,pid:process.pid})+'\n');
event('start');let failed=false;
if(file.startsWith('tests/fe003-tutorial-fragen/')&&mode!=='no-consumer'){
  const {baueKandidat}=await import('./tests/fe003-tutorial-fragen/kandidat.ts');
  try{baueKandidat();}catch(error){failed=true;console.error(error.message);}
}
if(mode==='fachlich-rot'&&file===${JSON.stringify(files.at(0) ?? "")})failed=true;
const count=2;
const report={success:!failed,numTotalTestSuites:1,numPassedTestSuites:failed?0:1,numFailedTestSuites:failed?1:0,numPendingTestSuites:0,numTotalTests:count,numPassedTests:failed?1:2,numFailedTests:failed?1:0,numPendingTests:0,numTodoTests:0,testResults:[{name:join(process.cwd(),file),status:failed?'failed':'passed',assertionResults:Array.from({length:count},(_,i)=>({title:'kontrollierte CLI '+i,status:failed&&i===0?'failed':'passed',failureMessages:failed&&i===0?['tatsaechlicher kontrollierter Gegenfall']:[]}))}]};
const raw=args.find(arg=>arg.startsWith('--outputFile=')).slice('--outputFile='.length);
if(mode!=='browser-fatal')writeFileSync(raw,JSON.stringify(report),{flag:'wx'});
event('end');process.exitCode=failed?1:0;
`,
      { mode: 0o755 },
    );
    symlinkSync(join(work, "worker.mjs"), join(work, "node_modules/.bin/vitest"));
    writeFileSync(
      join(work, "hook.mjs"),
      String.raw`
import cp from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {appendFileSync,readFileSync,unlinkSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const original=cp.spawnSync,mode=${JSON.stringify(mode)};
cp.spawnSync=function(command,args,options){
  if(command!=='bash')return original(command,args,options);
  const phase=args[2]==='tools/build'?'build':'test',startedAt=Date.now();
  if(phase==='test'){
    const env=options.env,p=env.FE003_BAU_BELEG;
    if(p){
      if(mode==='missing-proof')unlinkSync(p);
      if(mode==='changed-proof')appendFileSync(p,' ');
      if(mode==='partial-env')delete env.FE003_BAU_SHA256;
      if(mode==='changed-surface')writeFileSync(join(process.cwd(),'apps/web/dist/assets/app.js'),'anders');
      if(['wrong-proof-head','foreign-proof','unawaited-proof'].includes(mode)){
        const proof=JSON.parse(readFileSync(p));
        if(mode==='wrong-proof-head')proof.stand.commit='d'.repeat(40);
        if(mode==='foreign-proof')proof.stand.wurzel='/fremder/checkout';
        if(mode==='unawaited-proof')proof.bau.actualWaitCompleted=false;
        const text=JSON.stringify(proof);writeFileSync(p,text);
        env.FE003_BAU_SHA256=createHash('sha256').update(text).digest('hex');
      }
    }
  }
  // Nur die echte Wartefrist des kontrollierten Timeout-Kindes wird fuer die Gegenprobe gekuerzt.
  const actual=mode==='build-timeout'&&phase==='build'?{...options,timeout:50}:options;
  const run=original(command,args,actual);
  appendFileSync(join(process.cwd(),'calls.jsonl'),JSON.stringify({phase,args,requestedTimeout:options.timeout,startedAt,endedAt:Date.now(),pid:run.pid,exit:run.status,signal:run.signal,error:run.error?.code??null})+'\n');
  return run;
};
syncBuiltinESMExports();
`,
    );
    const env = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      KLARWERK_SKIP_KEYCHAIN: "1",
      EXTERNAL_SEARCH: "off",
      NODE_ENV: "test",
      KLARWERK_DEV_PERSIST: "0",
    };
    function git(...args: string[]) {
      const run = spawnSync("git", args, { cwd: work, env, encoding: "utf8", timeout: 20000 });
      expect(run.status, run.stderr).toBe(0);
      return run.stdout.trim();
    }
    git("init", "-q");
    git("add", ".");
    const commit = (message: string) =>
      git(
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@klarwerk.test",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "-qm",
        message,
      );
    commit("kontrollierte CLI");
    const base = git("rev-parse", "HEAD");
    for (const file of files) {
      mkdirSync(join(work, file, ".."), { recursive: true });
      writeFileSync(join(work, file), "// nur eine kontrollierte Auswahlmarke\n");
    }
    git("add", ".");
    commit("ausgewaehlte Dateien");
    return { work, base };
  }

  const phaseCli = String.raw`
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const work=process.argv[2],base=process.argv[3],out=join(work,'out');
const cli=spawnSync(process.execPath,['--import',join(work,'hook.mjs'),join(work,'tools/pg-auswahl.mjs'),base,out],{cwd:work,env:{...process.env,KLARWERK_PG_PFLICHT:'1'},encoding:'utf8',timeout:20000});
assert.equal(cli.error,undefined);assert.equal(cli.signal,null);
const result=JSON.parse(cli.stdout),saved=JSON.parse(readFileSync(join(out,'pg-auswahl.json')));
assert.deepEqual(saved,result);
const lines=(name)=>existsSync(join(work,name))?readFileSync(join(work,name),'utf8').trim().split('\n').map(JSON.parse):[];
const events=lines('events.jsonl'),calls=lines('calls.jsonl');
for(const call of calls){assert.equal(call.requestedTimeout,240000);assert(call.endedAt>=call.startedAt);assert(call.pid>0);assert.deepEqual(call.args.slice(0,2),['tools/browserdeckel.sh','smoke']);}
`;

  const pgUrlCliSetup = String.raw`
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const probeWork=process.argv[2],expectedUrl=JSON.parse(process.argv[4]),offeredUrl=JSON.parse(process.argv[5]);
const forbidden=['KLARWERK_PG_TEST_ALLOW_DESTRUCTIVE','UNGEWOLLTER_PROVIDER_MARKER','DATABASE_URL','PGHOST','KLARWERK_FASSUNG_MANIFEST'];
const absent=keys=>keys.map(key=>'assert(!Object.hasOwn(process.env,'+JSON.stringify(key)+'));').join('\n');
const urlCheck=expectedUrl===null?absent(['KLARWERK_PG_TEST_URL']):'assert.equal(process.env.KLARWERK_PG_TEST_URL,'+JSON.stringify(expectedUrl)+');';
for(const [file,anchor,checks]of [
  ['worker.mjs','const args=',urlCheck+'\n'+absent(forbidden)+"\nconsole.log(JSON.stringify({pgUrl:process.env.KLARWERK_PG_TEST_URL??null}));\n"],
  ['tools/build','const mode=',absent([...forbidden,'KLARWERK_PG_TEST_URL','KLARWERK_PG_PFLICHT'])+"\nconsole.log('Bau ohne PG-Umgebung');\n"],
]){
  const path=join(probeWork,file),source=readFileSync(path,'utf8');
  assert.equal(source.split(anchor).length,2);writeFileSync(path,source.replace(anchor,checks+anchor));
}
const gitOptions={cwd:probeWork,env:process.env,timeout:20000};
execFileSync('git',['add','worker.mjs','tools/build'],gitOptions);
execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@klarwerk.test','-c','commit.gpgsign=false','commit','-qm','URL-Pruefung im kontrollierten Kind'],gitOptions);
if(offeredUrl===null)delete process.env.KLARWERK_PG_TEST_URL;
else process.env.KLARWERK_PG_TEST_URL=offeredUrl;
for(const key of forbidden)process.env[key]=key==='KLARWERK_PG_TEST_ALLOW_DESTRUCTIVE'?'1':'fiktiver-nicht-weiterzureichender-Marker';
`;

  it("gibt freigegebene Test-URLs samt Query und Socket exakt nur an die Testkinder", () => {
    const urls = [
      "postgresql://klarwerk_ci:fiktiv-ci-postgres@localhost:5432/klarwerk_ci_test?application_name=pgurl%20ci&sslmode=disable",
      "postgres://klarwerk_ci@/klarwerk_%74est?host=%2Ftmp%2Fpg-fiktiv&application_name=pgurl%20socket",
    ];
    for (const [index, url] of urls.entries()) {
      const { work, base } = phaseFixture(`pg-url-freigegeben-${index}`, [browserFile, laterFile]);
      const run = node(
        `${pgUrlCliSetup}${phaseCli}
assert.equal(cli.status,0,cli.stderr);assert.equal(result.success,true,JSON.stringify(result));
assert.deepEqual(calls.map(c=>c.phase),['build','test','test']);
assert(result.preparation.success&&result.preparation.actualWaitCompleted);
assert(readFileSync(result.preparation.logPath,'utf8').includes('Bau ohne PG-Umgebung'));
assert.equal(result.runs.length,2);
for(const part of result.runs){assert(part.success&&part.actualWaitCompleted);assert(readFileSync(part.logPath,'utf8').includes(JSON.stringify({pgUrl:expectedUrl})));}
`,
        pgUrl,
        [work, base, JSON.stringify(url), JSON.stringify(url)],
      );
      expect(run.status, run.stderr).toBe(0);
    }
  });

  it("laesst ohne angebotenes URLfeld die kontrollierten Kinder feldlos", () => {
    const { work, base } = phaseFixture("pg-url-fehlend", [browserFile, laterFile]);
    const run = node(
      `${pgUrlCliSetup}${phaseCli}
assert.equal(cli.status,0,cli.stderr);assert.equal(result.success,true,JSON.stringify(result));
assert.deepEqual(calls.map(c=>c.phase),['build','test','test']);
assert(readFileSync(result.preparation.logPath,'utf8').includes('Bau ohne PG-Umgebung'));
assert.equal(result.runs.length,2);
for(const part of result.runs){assert(part.success&&part.actualWaitCompleted);assert(readFileSync(part.logPath,'utf8').includes('{"pgUrl":null}'));}
`,
      pgUrl,
      [work, base, "null", "null"],
    );
    expect(run.status, run.stderr).toBe(0);
  });

  it("weist angebotene unfreigegebene URLs trotz DestructiveOverride vor jedem Kind ab", () => {
    const urls = ["postgresql://klarwerk_ci@localhost/klarwerk_live", "keine-pg-url", ""];
    for (const [index, url] of urls.entries()) {
      const { work, base } = phaseFixture(`pg-url-abgelehnt-${index}`, [browserFile, laterFile]);
      const run = node(
        `${pgUrlCliSetup}${phaseCli}
assert.equal(cli.status,1,cli.stderr);assert.equal(result.success,false);
assert(result.error.includes('angebotene KLARWERK_PG_TEST_URL nicht als Testdatenbank freigegeben'));
assert.equal(result.preparation,undefined);assert.deepEqual(result.runs,[]);
assert.deepEqual(calls,[]);assert.deepEqual(events,[]);
assert(!existsSync(join(out,'fe003-bau')));assert(!existsSync(join(out,'pg.vitest.json')));
`,
        pgUrl,
        [work, base, "null", JSON.stringify(url)],
      );
      expect(run.status, run.stderr).toBe(0);
    }
  });

  it("baut einmal fuer zwei FE003-Dateien und wartet jede eigene 240s-Phase ab", () => {
    const files = [browserFile, previewFile, laterFile];
    const { work, base } = phaseFixture("fe003-phasen-gruen", files);
    const run = node(
      `${phaseCli}
assert.equal(cli.status,0,cli.stderr);assert.equal(result.success,true,JSON.stringify(result));
assert.deepEqual(calls.map(c=>c.phase),['build','test','test','test']);
assert.equal(new Set(calls.map(c=>c.pid)).size,4);
for(let i=1;i<calls.length;i++)assert(calls[i-1].endedAt<=calls[i].startedAt);
assert.deepEqual(events.filter(e=>e.phase==='build').map(e=>e.event),['start','end']);
assert.equal(result.runs.length,3);assert(result.runs.every(r=>r.success&&r.actualWaitCompleted));
const prep=result.preparation;assert(prep.success&&prep.actualWaitCompleted&&prep.exit===0);
assert.equal(prep.pid,calls[0].pid);assert.equal(prep.capMs,240000);
assert.deepEqual(JSON.parse(readFileSync(join(out,'fe003-bau/run.json'))),prep);
assert(prep.proofSha256);assert(prep.logSha256);assert(existsSync(prep.proofPath));
for(const part of result.runs.slice(0,2))assert(readFileSync(part.logPath,'utf8').includes('build-beleg-bestaetigt'));
assert(Date.parse(prep.endedAt)<=Date.parse(result.runs[0].startedAt));
`,
      pgUrl,
      [work, base],
    );
    expect(run.status, run.stderr).toBe(0);
  });

  it("startet ohne ausgewaehlte FE003-Datei keine Bauvorbereitung", () => {
    const { work, base } = phaseFixture("fe003-nicht-ausgewaehlt", [laterFile]);
    const run = node(
      `${phaseCli}
assert.equal(cli.status,0,cli.stderr);assert.equal(result.success,true);
assert.equal(result.preparation,undefined);assert.deepEqual(calls.map(c=>c.phase),['test']);
assert(!events.some(e=>e.phase==='build'));assert(!existsSync(join(out,'fe003-bau')));
`,
      pgUrl,
      [work, base],
    );
    expect(run.status, run.stderr).toBe(0);
  });

  it("eigenstaendiger Bau behaelt den Fassungsinput ohne freie Providerumgebung", () => {
    const { work, base } = phaseFixture("fe003-eigenstaendig", [browserFile], "fallback-manifest");
    const run = node(
      String.raw`
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const work=process.argv[2];
const cli=spawnSync(process.execPath,['--input-type=module','-e',"const m=await import('./tests/fe003-tutorial-fragen/kandidat.ts');m.baueKandidat();"],{cwd:work,env:{...process.env,KLARWERK_FASSUNG_MANIFEST:join(work,'fassung-beleg.json'),UNGEWOLLTER_PROVIDER_MARKER:'nicht-weiterreichen'},encoding:'utf8',timeout:20000});
assert.equal(cli.error,undefined);assert.equal(cli.signal,null);assert.equal(cli.status,0,cli.stderr);
assert(cli.stderr.includes('build-start'));assert(cli.stderr.includes('build-ende'));
assert(!cli.stderr.includes('build-beleg-bestaetigt'));
assert.deepEqual(readFileSync(join(work,'events.jsonl'),'utf8').trim().split('\n').map(JSON.parse).map(e=>e.event),['start','end']);
`,
      pgUrl,
      [work, base],
    );
    expect(run.status, run.stderr).toBe(0);
  });

  it.each(["build-red", "build-timeout", "missing-index", "dirty", "wrong-head"])(
    "Bauvorbereitung %s macht rot und startet keinen Testprozess",
    (mode) => {
      const { work, base } = phaseFixture(`fe003-${mode}`, [browserFile, laterFile], mode);
      const run = node(
        `${phaseCli}
assert.equal(cli.status,1,cli.stderr);assert.equal(result.success,false);assert(result.error);
assert.equal(result.runs.length,0);assert.equal(result.preparation.success,false);
assert.equal(result.preparation.actualWaitCompleted,true);assert.equal(calls.length,1);
assert.equal(calls[0].phase,'build');assert(!events.some(e=>e.phase==='test'));
assert(!existsSync(join(out,'pg.vitest.json')));
if(${JSON.stringify(mode)}==='build-timeout')assert.equal(calls[0].error,'ETIMEDOUT');
if(${JSON.stringify(mode)}==='build-red')assert.equal(calls[0].exit,7);
`,
        pgUrl,
        [work, base],
      );
      expect(run.status, run.stderr).toBe(0);
    },
  );

  it.each([
    "missing-proof",
    "changed-proof",
    "partial-env",
    "changed-surface",
    "wrong-proof-head",
    "foreign-proof",
    "unawaited-proof",
    "no-consumer",
  ])("weist %s trotz erfolgreichem Bau ab und stoppt die Folgedatei", (mode) => {
    const { work, base } = phaseFixture(`fe003-${mode}`, [browserFile, laterFile], mode);
    const run = node(
      `${phaseCli}
assert.equal(cli.status,1,cli.stderr);assert.equal(result.success,false);assert(result.error);
assert.equal(result.preparation.success,true);assert.equal(result.preparation.exit,0);
assert.equal(result.runs.length,1);assert.equal(result.runs[0].success,false);
assert.deepEqual(calls.map(c=>c.phase),['build','test']);
assert(!events.some(e=>e.file===${JSON.stringify(laterFile)}));assert(!existsSync(join(out,'pg.vitest.json')));
`,
      pgUrl,
      [work, base],
    );
    expect(run.status, run.stderr).toBe(0);
  });

  it("fachliches Rot laeuft nach belegtem Bau weiter; fehlendes Raw bleibt fatal", () => {
    for (const mode of ["fachlich-rot", "browser-fatal"]) {
      const { work, base } = phaseFixture(`fe003-${mode}`, [browserFile, laterFile], mode);
      const run = node(
        `${phaseCli}
assert.equal(cli.status,1,cli.stderr);assert.equal(result.success,false);
assert.equal(result.preparation.success,true);
if(${JSON.stringify(mode)}==='fachlich-rot'){
  assert.equal(result.runs.length,2);assert.deepEqual(result.runs.map(r=>r.exit),[1,0]);
  assert.equal(JSON.parse(readFileSync(join(out,'pg.vitest.json'))).numFailedTests,1);
}else{
  assert.equal(result.runs.length,1);assert(!existsSync(join(out,'pg.vitest.json')));
  assert(!events.some(e=>e.file===${JSON.stringify(laterFile)}));
}
`,
        pgUrl,
        [work, base],
      );
      expect(run.status, run.stderr).toBe(0);
    }
  });
});
