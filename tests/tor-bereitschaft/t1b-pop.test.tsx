// @vitest-environment jsdom
import ts from "typescript";
import { expect, it, vi } from "vitest";
import { t1bQuelle } from "./t1b-original";

const DATEI = "tests/app/navguard-pop-mounted.test.tsx";

async function probe(defekt?: "falscher Eintrag" | "kein Ereignis"): Promise<void> {
  const originalGo = window.history.go.bind(window.history);
  const ausstehend: Promise<void>[] = [];
  let aufrufe = 0;
  const spy = vi.spyOn(window.history, "go").mockImplementation((delta = 0) => {
    aufrufe++;
    if (defekt === "kein Ereignis") return;
    ausstehend.push(
      new Promise((resolve) => {
        setTimeout(() => {
          originalGo(defekt === "falscher Eintrag" && delta > 0 ? 1 : delta);
          resolve();
        }, 200);
      }),
    );
  });
  // Nachweis bindet die tatsächliche Zusage 1+2, auch wenn ihr Helfer ersetzt wird.
  const quelle = t1bQuelle(DATEI, ["nextTick", "wartePop"], "Zusage 1 + 2:");
  const run = new Function(
    "expect",
    "window",
    "setTimeout",
    "clearTimeout",
    ts.transpile(`return (async () => { ${quelle} })();`, { target: ts.ScriptTarget.ES2022 }),
  );
  const start = Date.now();
  let fehler: unknown;
  try {
    await run(
      expect,
      window,
      (fn: () => void, ms: number) => setTimeout(fn, Math.min(ms, 700)),
      clearTimeout,
    );
  } catch (e) {
    fehler = e;
  } finally {
    await Promise.all(ausstehend);
    spy.mockRestore();
  }
  console.log(
    `Zusage 1+2 · ${defekt ?? "verzögert"} · ${Date.now() - start}ms · erster Fehler: ${String(fehler).split("\n")[0]} · letzter Zustand: ${JSON.stringify({ path: window.location.pathname, state: window.history.state, aufrufe })}`,
  );
  if (!defekt) {
    if (fehler) throw fehler;
    expect(aufrufe).toBe(2);
  } else {
    expect(fehler, "echter History-Fehler wurde grün").toBeDefined();
    expect(String(fehler)).toMatch(
      defekt === "kein Ereignis" ? /popstate.*kam nicht/ : /deeply equal/,
    );
  }
}

it("Zusage 1+2 besteht mit gezielt verspäteten echten popstate-Ereignissen", async () => {
  await probe();
});
it("Zusage 1+2: falscher Eintrag bleibt rot", async () => {
  await probe("falscher Eintrag");
});
it("Zusage 1+2: dauerhaft fehlendes Ereignis bleibt rot", async () => {
  await probe("kein Ereignis");
});
