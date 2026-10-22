import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, it } from "vitest";

const root = join(__dirname, "../..");
const work = mkdtempSync(join(tmpdir(), "p3-adapter-"));
afterAll(() => rmSync(work, { recursive: true, force: true }));
it("P3-Adapter: status ist POST-unfähig, auch wartend/unklar; ein persistenter Versand", () => {
  const program = `
import importlib.util,json,sys
from pathlib import Path
spec=importlib.util.spec_from_file_location('adapter',sys.argv[1])
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
p=Path(sys.argv[2])/'intent.json'
p.write_text(json.dumps({'commit':'a'*40,'transportDir':str(p)+'.p3'}))
class Fake:
 methods=[]
 ignore_halt=False
 @staticmethod
 def http_curl(method,*args):
  Fake.methods.append(method)
  return 200,'[]'
 class Veroeffentlichung:
  def __init__(self,folder,repo,http,halt):self.http,self.halt=http,halt
  def lesen(self,key):return {'zustand':'wartet'}
  def schritt(self,key):
   self.http('GET','synthetic')
   if Fake.ignore_halt or not self.halt():self.http('POST','synthetic')
  def beleg(self,key):return {'zustand':'unklar','beleg':None}
a.step(Fake,'status','synthetic',p)
assert Fake.methods==['GET']
a.step(Fake,'publish','synthetic',p)
a.step(Fake,'publish','synthetic',p)
a.step(Fake,'status','synthetic',p)
assert Fake.methods.count('POST')==1
assert Path(str(p)+'.versand').read_text()=='a'*40
Fake.ignore_halt=True
try:a.step(Fake,'status','synthetic',p)
except RuntimeError:pass
else:raise AssertionError('Status durfte POST auslösen')
assert Fake.methods.count('POST')==1
print('GET-only; saved intent; exactly one POST')
`;
  const result = spawnSync(
    "python3",
    ["-B", "-c", program, join(root, "tools/publish-transport.py"), work],
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
  expect(result.stdout).toContain("exactly one POST");
});
