import { expect, it, vi } from "vitest";
import { type Flaeche, fn, starteFlaeche } from "./k1-messung";

it("haelt gleichzeitige Flaechen isoliert und schliesst erst nach der letzten Rueckgabe", async () => {
  const flaechen: Flaeche[] = [];
  try {
    const starts = await Promise.allSettled(
      [true, false].map((mitWissen) =>
        starteFlaeche({ mitWissen }).then((flaeche) => {
          flaechen.push(flaeche);
          return flaeche;
        }),
      ),
    );
    expect(starts.map((start) => start.status)).toEqual(["fulfilled", "fulfilled"]);
    const erste = (starts[0] as PromiseFulfilledResult<Flaeche>).value;
    const zweite = (starts[1] as PromiseFulfilledResult<Flaeche>).value;
    const browser = erste.seite.context().browser()!;
    expect(browser).not.toBeNull();
    expect(zweite.seite.context().browser()).toBe(browser);
    expect(zweite.seite.context()).not.toBe(erste.seite.context());
    expect(browser.contexts()).toHaveLength(2);
    await erste.seite.evaluate(fn("() => localStorage.setItem('lebensdauer', 'erste')"));
    expect(await zweite.seite.evaluate(fn("() => localStorage.getItem('lebensdauer')"))).toBeNull();
    const statusLesen = fn("async (id) => (await fetch('/api/kos/' + id)).status");
    expect(await erste.seite.evaluate(statusLesen, erste.koId)).toBe(200);
    expect(await zweite.seite.evaluate(statusLesen, erste.koId)).toBe(404);
    await Promise.all([erste.schliessen(), erste.schliessen()]);
    expect(browser.isConnected()).toBe(true);
    expect(browser.contexts()).toHaveLength(1);
    expect(await zweite.seite.evaluate(fn("() => !!document.getElementById('ask-btn')"))).toBe(true);
    await zweite.schliessen();
    expect(browser.isConnected()).toBe(false);
  } finally {
    await Promise.all(flaechen.map((flaeche) => flaeche.schliessen()));
  }
});

it("raeumt einen fehlgeschlagenen Bereitschaftsstart auf und startet danach erneut", async () => {
  const flaechen: Flaeche[] = [];
  let fehlstart: Promise<unknown> | undefined;
  try {
    const erste = await starteFlaeche({ mitWissen: false });
    flaechen.push(erste);
    const browser = erste.seite.context().browser()!;
    fehlstart = starteFlaeche({
      mitWissen: false,
      bereitWenn: "() => false",
      bereitTimeoutMs: 1_500,
    }).then(
      (flaeche) => {
        flaechen.push(flaeche);
        return null;
      },
      (fehler: unknown) => fehler,
    );
    await vi.waitFor(() => expect(browser.contexts()).toHaveLength(2), { timeout: 3_000 });
    await erste.schliessen();
    const fehler = await fehlstart;
    expect(fehler).toBeInstanceOf(Error);
    expect(String(fehler)).toMatch(/Timeout 1500ms exceeded/);
    expect(browser.isConnected()).toBe(false);
    const danach = await starteFlaeche({ mitWissen: false });
    flaechen.push(danach);
    expect(danach.seite.context().browser()!.isConnected()).toBe(true);
    expect(await danach.seite.evaluate(fn("() => !!document.getElementById('ask-btn')"))).toBe(true);
    await danach.schliessen();
    expect(danach.seite.context().browser()!.isConnected()).toBe(false);
  } finally {
    await fehlstart;
    await Promise.all(flaechen.map((flaeche) => flaeche.schliessen()));
  }
});
