import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @vitest-environment jsdom
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import React, { act, createElement, useState } from "../../apps/web/node_modules/react";
import { type Root, createRoot } from "../../apps/web/node_modules/react-dom/client";
import { api } from "../../apps/web/src/api/client";
import { AuthProvider, useSession } from "../../apps/web/src/app/AuthContext";
import {
  type NeuerVorgang,
  type OfflineQueueApi,
  useOfflineQueue,
} from "../../apps/web/src/app/useOfflineQueue";
import {
  arbeitsstandLesen,
  arbeitsstandSchreiben,
  bestaetigeNeueAntwort,
  merkeAntwortRechtewechsel,
} from "../../apps/web/src/lib/fragenArbeitsstand";
import { bestaetigeLokalesKonto } from "../../apps/web/src/lib/lokaleSitzung";
import {
  OFFLINE_PHOTO_PREFIX,
  readOfflineQueue,
  writeOfflineQueue,
} from "../../apps/web/src/lib/offlineQueueStorage";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const mounted: { root: Root; qc: QueryClient }[] = [];
const ports: Record<string, { queue: OfflineQueueApi; auth: ReturnType<typeof useSession> }> = {};
let account = "konto-a";
let posts: unknown[] = [];
let online = false;
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const user = () => ({
  id: account,
  role: "experte",
  email: `${account}@example.test`,
  displayName: "A",
});
async function settle(ok: () => boolean) {
  for (let i = 0; i < 100 && !ok(); i++)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  expect(ok()).toBe(true);
}
function locks() {
  let tail = Promise.resolve();
  return {
    request: (_name: string, job: () => unknown) => {
      const result = tail.then(job);
      tail = result.then(
        () => {},
        () => {},
      );
      return result;
    },
  };
}
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  account = "konto-a";
  posts = [];
  online = false;
  bestaetigeLokalesKonto(account, Date.now() + 1);
  onlineManager.setOnline(true);
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
  Object.defineProperty(navigator, "locks", { configurable: true, value: locks() });
  vi.stubGlobal("fetch", async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/status")) return json({ needsSetup: false });
    if (url.endsWith("/auth/me")) return json(user());
    if (url.endsWith("/auth/logout")) return new Response(null, { status: 204 });
    if (url.endsWith("/drafts")) {
      posts.push(JSON.parse(String(init?.body)));
      return json({ id: "gespeichert" }, 201);
    }
    return json([]);
  });
});
afterEach(async () => {
  for (const m of mounted.splice(0).reverse()) {
    await act(async () => m.root.unmount());
    m.qc.clear();
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});
function port(name: string) {
  const value = ports[name];
  if (!value) throw new Error(`Echter Hookport fehlt: ${name}`);
  return value;
}
function Probe({ name }: { name: string }): null {
  ports[name] = { queue: useOfflineQueue(), auth: useSession() };
  return null;
}
async function mount(name: string, form = false) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const el = document.createElement("div");
  document.body.appendChild(el);
  const root = createRoot(el);
  mounted.push({ root, qc });
  await act(async () =>
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          form ? createElement(FormProbe) : createElement(Probe, { name }),
        ),
      ),
    ),
  );
  await settle(() =>
    form ? Boolean(qc.getQueryData(["auth", "me"])) : ports[name]?.auth.user?.id === account,
  );
  await act(async () => {
    await new Promise((r) => setTimeout(r, 5));
  });
  return { qc, el };
}
const op = (title: string, bodyHtml = "<p>Eigene Eingabe</p>"): NeuerVorgang => ({
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
  kind: "draft.create",
  draftId: null,
  title,
  payload: { title, bodyHtml },
});
const photo = `data:image/jpeg;base64,${"A".repeat(600)}`;
const html = `<figure><img src="${photo}"><figcaption>Fotoquelle</figcaption></figure>`;
function FormProbe() {
  const queue = useOfflineQueue();
  const [value, setValue] = useState("Eigene Beobachtung");
  return (
    <>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} />
      <button
        type="button"
        onClick={async () => {
          if (await queue.enqueue(op(value, html))) setValue("");
        }}
      >
        Speichern
      </button>
      <p role="alert">{queue.persistError}</p>
    </>
  );
}

describe("W4.6 dauerhafte Offlineannahme und Sitzungsende", () => {
  it("wörtliche Fotoreferenz-Nutztexte in Titel und Rumpf bleiben unverändert lesbar", async () => {
    await mount("literal");
    const title = "kw-offline-photo:beispiel";
    const body = `<p>kw-offline-photo:beispiel</p><img src="kw-offline-photo:beispiel">${html}`;
    await act(async () => {
      expect(await port("literal").queue.enqueue(op(title, body))).toBe(true);
    });
    expect(readOfflineQueue<{ title: string; payload: { bodyHtml: string } }>()[0]).toMatchObject({
      title,
      payload: { bodyHtml: body },
    });
    await mount("literal-reload");
    expect(port("literal-reload").queue.queue[0]?.payload.bodyHtml).toBe(body);
  });
  it("Fotos liegen getrennt dauerhaft vor, überstehen Wiederaufnahme und globale Quote meldet echte Nichtannahme", async () => {
    await mount("a");
    let ok = false;
    await act(async () => {
      ok = await port("a").queue.enqueue(op("Foto", html));
    });
    expect(ok).toBe(true);
    const metadata = localStorage.getItem("kw.offlineQueue.v1") ?? "";
    expect(metadata).not.toContain("data:image");
    expect(
      Object.keys(localStorage).filter((k) => k.startsWith(OFFLINE_PHOTO_PREFIX)),
    ).toHaveLength(1);
    await mount("b");
    expect(port("b").queue.queue[0]?.payload.bodyHtml).toBe(html);
    const original = Storage.prototype.setItem;
    const used = () =>
      Object.keys(localStorage).reduce(
        (n, k) => n + k.length + (localStorage.getItem(k)?.length ?? 0),
        0,
      );
    const cap = used() + 100;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (k, v) {
      const total = used() - (localStorage.getItem(k)?.length ?? 0) + String(v).length;
      if (total > cap) throw new DOMException("Globales Kontingent voll", "QuotaExceededError");
      original.call(this, k, v);
    });
    await act(async () => {
      ok = await port("b").queue.enqueue(
        op("Zu viel", html.replace("A".repeat(600), "B".repeat(1600))),
      );
    });
    expect(ok).toBe(false);
    expect(port("b").queue.persistError).toContain("Kontingent");
    expect(readOfflineQueue<{ title: string }>().map((o) => o.title)).toEqual(["Foto"]);
    expect(port("a").queue.queue).toHaveLength(1);
    expect(port("b").queue.queue).toHaveLength(1);
    expect(
      Object.keys(localStorage).filter((k) => k.startsWith(OFFLINE_PHOTO_PREFIX)),
    ).toHaveLength(1);
  });
  it("ein wartendes Formular leert seinen Text bei fehlgeschlagener dauerhafter Annahme nicht", async () => {
    const { el } = await mount("form", true);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Speicher voll", "QuotaExceededError");
    });
    await act(async () => {
      el.querySelector("button")?.click();
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(el.querySelector("textarea")?.value).toBe("Eigene Beobachtung");
    expect(el.textContent).toContain("Speicher voll");
    expect(localStorage.getItem("kw.offlineQueue.v1")).toBeNull();
  });
  it("zwei Hookinstanzen verlieren parallele Enqueues/Änderungen nicht und senden nach echter Bestätigung jeden Vorgang einmal", async () => {
    const a = await mount("a");
    const b = await mount("b");
    await act(async () => {
      expect(
        await Promise.all([
          port("a").queue.enqueue(op("X", html)),
          port("b").queue.enqueue(op("Y")),
        ]),
      ).toEqual([true, true]);
    });
    expect(port("a").queue.queue).toHaveLength(2);
    expect(port("b").queue.queue).toHaveLength(2);
    const x = port("a").queue.queue.find((o) => o.title === "X");
    if (!x) throw new Error("X fehlt");
    await act(async () => {
      expect(
        await Promise.all([
          port("b").queue.enqueue(op("Z")),
          port("a").queue.replace(x.id, { title: "X-neu", bodyHtml: html }, "X-neu"),
        ]),
      ).toEqual([true, true]);
    });
    expect(
      readOfflineQueue<{ title: string }>()
        .map((o) => o.title)
        .sort(),
    ).toEqual(["X-neu", "Y", "Z"]);
    online = true;
    await new Promise((r) => setTimeout(r, 5));
    await act(async () => {
      await Promise.all([
        a.qc.invalidateQueries({ queryKey: ["auth", "me"] }),
        b.qc.invalidateQueries({ queryKey: ["auth", "me"] }),
      ]);
    });
    await act(async () => {
      await Promise.all([port("a").queue.syncNow(), port("b").queue.syncNow()]);
    });
    expect(posts).toHaveLength(3);
    expect(readOfflineQueue()).toEqual([]);
    expect(port("a").queue.queue).toHaveLength(0);
    expect(port("b").queue.queue).toHaveLength(0);
    expect(
      Object.keys(localStorage).filter((k) => k.startsWith(OFFLINE_PHOTO_PREFIX)),
    ).toHaveLength(0);
  });
  it("unter einem fremden oder noch nicht bestätigten Konto bleibt eigener Offlineinhalt unsendbar", async () => {
    const a = await mount("a");
    await act(async () => {
      await port("a").queue.enqueue(op("Nur A"));
    });
    account = "konto-b";
    online = true;
    await act(async () => {
      a.qc.setQueryData(["auth", "me"], user());
    });
    await settle(() => port("a").auth.user?.id === "konto-b");
    await act(async () => {
      await port("a").queue.syncNow();
    });
    expect(posts).toHaveLength(0);
    expect(readOfflineQueue<{ title: string }>()[0]?.title).toBe("Nur A");
    expect(port("a").queue.queue).toHaveLength(0);
  });
  it("Abmelden entfernt eigene Fotos/Entwürfe/Fragen; alte Effekte und eine späte Antwort können sie nicht wieder persistieren", async () => {
    await mount("a");
    await act(async () => {
      await port("a").queue.enqueue(op("GEHEIMER-ENTWURF", html));
    });
    const stand = { entwurf: "GEHEIME-FRAGE", antwort: null, startadressen: [] };
    arbeitsstandSchreiben(localStorage, "konto-a", stand);
    let finish: (r: Response) => void = () => {};
    vi.stubGlobal("fetch", (input: unknown) => {
      if (String(input).endsWith("/auth/logout"))
        return Promise.resolve(new Response(null, { status: 204 }));
      if (!String(input).endsWith("/kos"))
        return Promise.resolve(json({ error: "INVALID_CREDENTIALS" }, 401));
      return new Promise<Response>((r) => {
        finish = r;
      }); // deliberately ignores abort, modelling a late result
    });
    const late = api.get("/kos").catch((e) => e); // listener and epoch fence are both real
    await act(async () => {
      await port("a").auth.signOut();
    });
    await settle(() => port("a").auth.user === null);
    finish(json({ secret: "SPAETE-ANTWORT" }));
    expect((await late).status).toBe(401);
    arbeitsstandSchreiben(localStorage, "konto-a", stand); // stale unmount/effect
    expect(arbeitsstandLesen(localStorage, "konto-a")).toBeNull();
    expect(localStorage.getItem("kw.offlineQueue.v1")).toBeNull();
    expect(
      Object.keys(localStorage).filter((k) => k.startsWith(OFFLINE_PHOTO_PREFIX)),
    ).toHaveLength(0);
    expect(Object.values(localStorage).join("")).not.toContain("GEHEIM");
  });
  it("strikte fehlgeschlagene Abmeldung erhält die bewusste Schuld und eigene Arbeit", async () => {
    await mount("strict");
    await act(async () => {
      expect(await port("strict").queue.enqueue(op("BEWUSST-ERHALTEN", html))).toBe(true);
    });
    vi.stubGlobal("fetch", async () =>
      json({ error: "UNAVAILABLE", message: "synthetisch offline" }, 503),
    );
    let failure: unknown;
    await act(async () => {
      try {
        await port("strict").auth.signOut({ strict: true });
      } catch (e) {
        failure = e;
      }
    });
    expect(failure).toBeDefined();
    await settle(() => port("strict").auth.signOutFailed);
    expect(readOfflineQueue<{ title: string }>()[0]?.title).toBe("BEWUSST-ERHALTEN");
    expect(
      Object.keys(localStorage).filter((k) => k.startsWith(OFFLINE_PHOTO_PREFIX)),
    ).toHaveLength(1);
  });
  it("volles Kontingent verhindert weder Sperre noch Löschung bei Abmeldung; fremde Fotos bleiben erhalten", async () => {
    await mount("quota");
    await act(async () => {
      expect(await port("quota").queue.enqueue(op("GEHEIM-QUOTA", html))).toBe(true);
    });
    arbeitsstandSchreiben(localStorage, "konto-a", {
      entwurf: "GEHEIM-FRAGE",
      antwort: null,
      startadressen: [],
    });
    const native = Storage.prototype.setItem;
    const cap = Object.values(localStorage).join("").length;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (k, v) {
      const total =
        Object.values(localStorage).join("").length -
        (localStorage.getItem(k)?.length ?? 0) +
        String(v).length;
      if (total > cap) throw new DOMException("Kontingent voll", "QuotaExceededError");
      native.call(this, k, v);
    });
    await act(async () => {
      await port("quota").auth.signOut();
    });
    await settle(() => port("quota").auth.user === null);
    expect(Object.values(localStorage).join("")).not.toContain("GEHEIM");
    expect(
      Object.keys(localStorage).filter((k) => k.startsWith(OFFLINE_PHOTO_PREFIX)),
    ).toHaveLength(0);
  });
  it("Abmelden löscht ausschließlich eigene Fotozuordnungen; das nachfolgende Konto sieht nur seine eigenen", async () => {
    await mount("owner");
    await act(async () => {
      expect(await port("owner").queue.enqueue(op("NUR-A", html))).toBe(true);
    });
    const foreign = {
      ...op("NUR-B", html.replace("A".repeat(600), "B".repeat(600))),
      eigentuemer: "konto-b",
      status: "queued",
      error: null,
    };
    writeOfflineQueue([...readOfflineQueue(), foreign]);
    await act(async () => {
      await port("owner").auth.signOut();
    });
    expect(readOfflineQueue<{ title: string; payload: { bodyHtml: string } }>()).toMatchObject([
      { title: "NUR-B", payload: { bodyHtml: foreign.payload.bodyHtml } },
    ]);
    expect(
      Object.keys(localStorage).filter((k) => k.startsWith(OFFLINE_PHOTO_PREFIX)),
    ).toHaveLength(1);
    account = "konto-b";
    await mount("next");
    expect(port("next").queue.queue.map((o) => o.title)).toEqual(["NUR-B"]);
  });
  it("bei Schreibfehlern nach Rechteentzug verschwindet alter Antwortklartext, eigene Eingabe bleibt im bereinigten Arbeitsstand", () => {
    const konto = "quota-rechte";
    bestaetigeNeueAntwort(konto);
    arbeitsstandSchreiben(localStorage, konto, {
      entwurf: "MEINE-EIGENE-FRAGE",
      startadressen: [],
      antwort: {
        frage: "Altfrage",
        result: {
          answered: true,
          answer: "GEHEIMER-KOPIERTER-ANTWORTTEXT",
          sources: [],
          citedSources: [],
          steps: [],
        },
        receipt: "r",
        verschlossen: [],
        gapId: null,
        angezeigtAm: new Date().toISOString(),
      },
    } as never);
    expect(Object.values(localStorage).join("")).toContain("GEHEIMER-KOPIERTER-ANTWORTTEXT");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Kontingent voll", "QuotaExceededError");
    });
    merkeAntwortRechtewechsel(localStorage, konto);
    expect(Object.values(localStorage).join("")).not.toContain("GEHEIMER-KOPIERTER-ANTWORTTEXT");
    expect(arbeitsstandLesen(localStorage, konto)).toMatchObject({
      entwurf: "MEINE-EIGENE-FRAGE",
      antwort: null,
    });
  });
  it("Rechtewechsel entfernt Antwort und Quellenpassagen und sperrt spätes Wiederpersistieren bis zu einer neuen Antwort", () => {
    const stand = {
      entwurf: "",
      startadressen: [],
      antwort: {
        frage: "Frage?",
        result: {
          answered: true,
          answer: "KOPIERTER-KLARTEXT",
          sources: ["quelle-q1"],
          citedSources: ["quelle-q1"],
          steps: [],
        },
        receipt: "r",
        verschlossen: [],
        gapId: null,
        angezeigtAm: new Date().toISOString(),
      },
    };
    arbeitsstandSchreiben(localStorage, "konto-a", stand as never);
    merkeAntwortRechtewechsel(localStorage, "konto-a");
    arbeitsstandSchreiben(localStorage, "konto-a", stand as never);
    expect(Object.values(localStorage).join("")).not.toContain("KOPIERTER-KLARTEXT");
    expect(Object.values(localStorage).join("")).not.toContain("quelle-q1");
    bestaetigeNeueAntwort("konto-a");
    arbeitsstandSchreiben(localStorage, "konto-a", {
      ...stand,
      antwort: {
        ...stand.antwort,
        result: { ...stand.antwort.result, answer: "Neue aktuelle Antwort" },
      },
    } as never);
    expect(arbeitsstandLesen(localStorage, "konto-a")?.antwort?.result.answer).toBe(
      "Neue aktuelle Antwort",
    );
  });
});

it("ein alter Rechtewechselmarker wird beim Lesen in eine gelöschte Kopie mit eigenem Fragefaden überführt", () => {
  const konto = "legacy-entzug";
  const key = `kw.fragen.arbeitsstand.v1:${konto}`;
  localStorage.setItem(
    key,
    JSON.stringify({
      entwurf: "Eigene neue Eingabe",
      startadressen: [],
      antwort: {
        frage: "Eigene ältere Frage",
        rechtepruefungAusstehend: true,
        result: {
          answered: true,
          answer: "ALTER-ENTZOGENER-KLARTEXT",
          sources: ["legacy-quelle"],
          citedSources: ["legacy-quelle"],
          steps: [],
        },
        receipt: "legacy",
        verschlossen: [],
        gapId: null,
        angezeigtAm: new Date().toISOString(),
      },
    }),
  );
  expect(arbeitsstandLesen(localStorage, konto)).toMatchObject({
    entwurf: "Eigene neue Eingabe",
    fragenFaden: ["Eigene ältere Frage"],
    antwort: null,
  });
  expect(localStorage.getItem(key)).not.toContain("ALTER-ENTZOGENER-KLARTEXT");
  expect(localStorage.getItem(key)).not.toContain("legacy-quelle");
});

it("zwei gleichzeitige Änderungen desselben lokalen Vorgangs werden verglichen; der veraltete Schreiber wird ehrlich abgewiesen", async () => {
  await mount("edit-a");
  await mount("edit-b");
  await act(async () => {
    expect(await port("edit-a").queue.enqueue(op("Ausgang"))).toBe(true);
  });
  const id = port("edit-a").queue.queue[0]?.id;
  if (!id) throw new Error("Lokaler Ausgang fehlt");
  let result: unknown;
  await act(async () => {
    result = await Promise.all([
      port("edit-a").queue.replace(id, { title: "Erste Änderung" }, "Erste Änderung"),
      port("edit-b").queue.replace(id, { title: "Zweite Änderung" }, "Zweite Änderung"),
    ]);
  });
  expect(result).toEqual([true, false]);
  expect(readOfflineQueue<{ title: string }>().map((o) => o.title)).toEqual(["Erste Änderung"]);
  expect(port("edit-b").queue.persistError).toContain("anderen Fenster");
});
it("gleichzeitige Offlineupdates desselben Serverentwurfs überschreiben keinen neu angenommenen lokalen Stand", async () => {
  await mount("update-a");
  await mount("update-b");
  const update = (title: string): NeuerVorgang => ({
    ...op(title),
    kind: "draft.update",
    draftId: "server-entwurf",
    seenUpdatedAt: "2026-10-26T10:00:00.000Z",
  });
  let result: unknown;
  await act(async () => {
    result = await Promise.all([
      port("update-a").queue.enqueue(update("Erste lokale Fassung")),
      port("update-b").queue.enqueue(update("Zweite lokale Fassung")),
    ]);
  });
  expect(result).toEqual([true, false]);
  expect(readOfflineQueue<{ title: string }>().map((o) => o.title)).toEqual([
    "Erste lokale Fassung",
  ]);
  expect(port("update-b").queue.persistError).toContain("anderen Fenster");
});
