import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";

const root = join(__dirname, "../..");
const prelude = String.raw`
import assert from "node:assert/strict";
import {existsSync,mkdirSync,mkdtempSync,renameSync,rmSync,unlinkSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,dirname} from "node:path";
const m=await import(process.argv[1]);
const p=await import(process.argv[2]);
const {releaseVertrag:contract}=await import(new URL("./release-vertrag.mjs",process.argv[1]));
const {assertWordAddinFassung}=await import(new URL("./word-addin-fassung.mjs",process.argv[1]));
const home=mkdtempSync(join(tmpdir(),"word-fassung-vertrag-"));
const asset="apps/web/public/word-addin/taskpane.js";
function put(work,path,text){mkdirSync(dirname(join(work,path)),{recursive:true});writeFileSync(join(work,path),text);}
function versions(work,values){
  const [server,manifest,query]=typeof values==="string"?[values,values,values]:values;
  put(work,"services/app/src/web-static.ts",'export const KLARA_TASKPANE_FASSUNG = "'+server+'";\n');
  put(work,"docs/word-addin/klara-manifest.xml",'<OfficeApp><Version>'+manifest+'</Version><SourceLocation DefaultValue="https://app.klarwerk.ai/word-addin/taskpane.html?v='+query+'" /></OfficeApp>\n');
}
function commit(work,message){m.git(work,"add",".");m.git(work,"commit","-qm",message);return m.git(work,"rev-parse","HEAD");}
function fixture(){
  const work=mkdtempSync(join(home,"repo-"));
  m.git(work,"init","-q");
  m.git(work,"config","--local","user.name","Fixture");m.git(work,"config","--local","user.email","fixture@klarwerk.invalid");
  versions(work,"1.0.0.9");put(work,asset,"// echte Ausgangsdatei\n");put(work,"outside.js","// außerhalb\n");
  return {work,base:commit(work,"Word-Fassungsfixture Basis")};
}
function check(f){assertWordAddinFassung(f.work,f.base,m.git(f.work,"rev-parse","HEAD"),m.git);}
const fehler=/Word-Add-in: Assetänderung erfordert eine konsistent erhöhte Fassung/;
`;

function probe(code: string) {
  const run = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `${prelude}\ntry {\n${code}\n} finally { rmSync(home,{recursive:true,force:true}); }`,
      pathToFileURL(join(root, "tools/release.mjs")).href,
      pathToFileURL(join(root, "tools/publish.mjs")).href,
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
      timeout: 60000,
    },
  );
  expect(run.error).toBeUndefined();
  expect(run.signal).toBeNull();
  expect(run.status, run.stderr || run.stdout).toBe(0);
}

it("stoppt echte Assetänderung ohne Fortschritt im Pflichtweg und vor Attest trotz behauptet leerem Diff", () => {
  probe(String.raw`
const f=fixture();put(f.work,asset,"// tatsächlich geändert\n");const head=commit(f.work,"Asset ohne Fassungsschritt");
assert(contract.causalTests.includes("tests/releaseweg/word-addin-fassung.test.ts"));
assert(m.selection([]).includes("tests/releaseweg/word-addin-fassung.test.ts"));
const output=join(home,"normal");
assert.throws(()=>m.runRelease(f.work,f.base,output),fehler);
assert(!existsSync(output),"vor dem Fassungswächter wurden Pflichtstufen gestartet");
const proof=join(home,"behaupteter-nachweis.json");
writeFileSync(proof,JSON.stringify({base:f.base,commit:head,changedPaths:[]}));
assert.throws(()=>p.checked(f.work,proof),fehler);
assert(!existsSync(join(home,"attestierung.txt")));
assert.equal(m.git(f.work,"rev-parse","HEAD"),head);
`);
});

it("weist numerisch gleiche, kleinere, unvollständige und inkonsistente Fassungen gegen die echte Basis ab", () => {
  probe(String.raw`
for(const values of [
  "1.0.0.9","1.0.0.8","1.0.0.09","1.0.10",
  ["1.0.0.10","1.0.0.9","1.0.0.10"],
  ["1.0.0.10","1.0.0.10","1.0.0.9"],
]){
  const f=fixture();put(f.work,asset,"// Änderung erfordert Fortschritt\n");versions(f.work,values);commit(f.work,"Ungültiger Fassungsfolger");
  assert.throws(()=>check(f),fehler);
}
`);
});

it("akzeptiert den konsistenten numerischen Fortschritt 9 auf 10 aus beiden echten Git-Ständen", () => {
  probe(String.raw`
const f=fixture();put(f.work,asset,"// neue Fassung\n");versions(f.work,"1.0.0.10");commit(f.work,"Konsistenter Fortschritt");
assert.doesNotThrow(()=>check(f));
assert.equal(m.git(f.work,"show",f.base+":services/app/src/web-static.ts"),'export const KLARA_TASKPANE_FASSUNG = "1.0.0.9";');
`);
});

it("lässt ein tatsächlich unberührtes Add-in ohne Fassungswechsel kompatibel", () => {
  probe(String.raw`
const f=fixture();put(f.work,asset,"// echte Ausgangsdatei\n");put(f.work,"unrelated.txt","Nur eine andere Fläche\n");commit(f.work,"Add-in unberührt");
assert.equal(m.git(f.work,"diff","--name-only",f.base,"HEAD","--","apps/web/public/word-addin/"),"");
assert.doesNotThrow(()=>check(f));
`);
});

it("erkennt Löschung sowie Umbenennung aus dem und in das Add-in und verlangt auch dort den Fortschritt", () => {
  probe(String.raw`
for(const mode of ["delete","rename-out","rename-in"]){
  const f=fixture();
  if(mode==="delete")unlinkSync(join(f.work,asset));
  if(mode==="rename-out")renameSync(join(f.work,asset),join(f.work,"renamed.js"));
  if(mode==="rename-in")renameSync(join(f.work,"outside.js"),join(f.work,"apps/web/public/word-addin/neu.js"));
  commit(f.work,"Assetpfad "+mode);
  assert.throws(()=>check(f),fehler);
  versions(f.work,"1.0.0.10");commit(f.work,"Fassung folgt dem Assetpfad");
  assert.doesNotThrow(()=>check(f));
}
`);
});
