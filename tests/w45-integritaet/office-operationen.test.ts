import { afterEach, describe, expect, it } from "vitest";
import { type KlaraPanel, createKlaraPanel, reply } from "../app/klara-panel-fixture";
// @vitest-environment jsdom
import { baueFrischeBuehne, schliesseBuehnen } from "../beta-rollenabnahme/buehne";
import { type Abruf, type ExcelStand, abbauen, starte } from "../office-addin/buehne";
let panel: KlaraPanel | undefined;
afterEach(async () => {
  panel?.restore();
  panel = undefined;
  abbauen();
  await schliesseBuehnen();
});
describe("W4.5 tatsächlich ausgelieferte Office-Sendewege", () => {
  it("Word-Auswahl hält nach Antwortverlust dieselbe Kennung und wechselt sie mit dem Inhalt", async () => {
    let versuch = 0;
    panel = createKlaraPanel({
      selectionText: "Auswahltext",
      selectionHtml: "<p>Auswahltext</p>",
      routes: {
        "/api/categories": reply(200, { categories: [] }),
        "/api/drafts": () => {
          versuch++;
          if (versuch < 3) throw new Error("Antwort verloren");
          return reply(200, { id: "vorhanden" });
        },
      },
    });
    await panel.flush();
    panel.setTab("capture");
    await panel.flush();
    panel.sendSelection();
    await panel.flush();
    panel.sendSelection();
    await panel.flush();
    const lasten = () =>
      panel!.calls
        .filter((c) => c.url === "/api/drafts" && c.method === "POST")
        .map((c) => JSON.parse(c.body!));
    expect(lasten()).toHaveLength(2);
    expect(lasten()[0].operationId).toMatch(/^office-/);
    expect(lasten()[1].operationId).toBe(lasten()[0].operationId);
    const titel = panel.q("#capture-titel")!;
    titel.value = "Anderer Titel";
    titel.dispatchEvent(new Event("input", { bubbles: true }));
    panel.sendSelection();
    await panel.flush();
    expect(lasten()).toHaveLength(3);
    expect(lasten()[2].operationId).not.toBe(lasten()[1].operationId);
    expect(panel.q("#open-link")?.href).toContain("draft=vorhanden");
  });

  it("Excel hält die Kennung beim verlorenen Ergebnis und übernimmt eine 200-Wiederholung", async () => {
    const excel: ExcelStand = {
      mappe: "Probe.xlsx",
      aktiv: "Blatt1",
      auswahl: ["A1"],
      syncs: 0,
      blaetter: {
        Blatt1: { geschuetzt: false, zellen: { A1: { wert: "Alter Inhalt", formel: null } } },
      },
    };
    let versuch = 0;
    const regel = (a: Abruf) =>
      a.url === "/api/drafts"
        ? { status: ++versuch < 3 ? 503 : 200, body: { id: "d-gleich" } }
        : undefined;
    const { fenster, abrufe } = await starte(
      {
        host: "Excel",
        plattform: "Mac",
        version: "16.89",
        url: "https://fiktiv.invalid/Probe.xlsx",
        stufen: { ExcelApi: ["1.1", "1.9"] },
      },
      { excel },
      [regel],
    );
    await fenster.entwurfSenden();
    await fenster.entwurfSenden();
    const lasten = () =>
      abrufe.filter((a) => a.url === "/api/drafts").map((a) => JSON.parse(a.body!));
    expect(lasten()[0].operationId).toBe(lasten()[1].operationId);
    expect(lasten()[0].operationId).toMatch(/^office-/);
    excel.blaetter.Blatt1!.zellen.A1 = { wert: "Neuer Inhalt", formel: null };
    await fenster.kontextLesen();
    await fenster.entwurfSenden();
    expect(lasten()[2].operationId).not.toBe(lasten()[1].operationId);
    expect(
      (
        globalThis as unknown as {
          document: { getElementById: (id: string) => { textContent: string } };
        }
      ).document.getElementById("rueckgabe-meldung").textContent,
    ).toContain("Entwurf");
  });

  it.each(["propose", "revise-release"] as const)(
    "Word-Rückweg %s wiederholt nach echtem Antwortverlust denselben gespeicherten Erfolg",
    async (aktion) => {
      const w = await baueFrischeBuehne();
      const rolle = aktion === "propose" ? "experte" : "admin";
      const ziel = await w.services.ko.create({
        title: "Word Rückwegziel",
        statement: "Alter Inhalt",
        author: w.konto.experte.id,
        category: "Wartung",
        type: "best_practice",
        confidentiality: "intern",
      });
      await w.services.aiCheckWorker?.idle();
      panel = createKlaraPanel({
        selectionText:
          "Vor jeder Wartung wird die Anlage drucklos geschaltet und gegen Wiedereinschalten gesichert.",
        selectionHtml:
          "<p>Vor jeder Wartung wird die Anlage drucklos geschaltet und gegen Wiedereinschalten gesichert.</p>",
        routes: {
          "/api/auth/me": reply(200, w.konto[rolle]),
          "/api/categories": reply(200, { categories: [] }),
          "/api/check-text": reply(200, {
            duplicates: [
              {
                koId: ziel.id,
                koTitle: ziel.title,
                relation: "teilweise",
                koStatus: "offen",
                koCategory: "Wartung",
              },
            ],
            conflicts: [],
            note: null,
          }),
        },
      });
      const basisFetch = globalThis.fetch;
      const rufe: { body: Record<string, unknown>; status: number }[] = [];
      let verloren = false;
      const fetchMitApp = async (url: unknown, init?: RequestInit) => {
        if (String(url) !== `/api/kos/${ziel.id}`) return basisFetch(String(url), init);
        const antwort = await w.app.inject({
          method: (init?.method ?? "GET") as "GET" | "PUT",
          url: String(url),
          headers: {
            authorization: `Bearer ${w.sitzung[rolle]}`,
            ...(init?.body ? { "content-type": "application/json" } : {}),
          },
          ...(init?.body ? { payload: String(init.body) } : {}),
        });
        if (init?.method === "PUT") {
          rufe.push({ body: JSON.parse(String(init.body)), status: antwort.statusCode });
          if (!verloren && antwort.statusCode === 200) {
            verloren = true;
            throw new Error("Gespeicherte Antwort verloren");
          }
        }
        return {
          ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
          status: antwort.statusCode,
          headers: new Headers(),
          json: async () => antwort.json(),
          text: async () => antwort.body,
        };
      };
      globalThis.fetch = fetchMitApp as typeof fetch;
      (globalThis as unknown as { window: { fetch: typeof fetch } }).window.fetch =
        globalThis.fetch;
      panel.setTab("capture");
      await panel.flush();
      const knopf = (
        globalThis as unknown as {
          document: { querySelector: (s: string) => { click: () => void } | null };
        }
      ).document.querySelector("#rw-liste button");
      expect(knopf, JSON.stringify(panel.calls)).not.toBeNull();
      knopf!.click();
      await panel.flush();
      panel.q("#rw-btn")!.click();
      await panel.flush();
      expect(verloren).toBe(true);
      panel.q("#rw-btn")!.click();
      await panel.flush();
      expect(rufe).toHaveLength(2);
      expect(rufe.map((x) => x.status)).toEqual([200, 200]);
      expect(rufe[0]!.body.operationId).toMatch(/^word-/);
      expect(rufe[1]!.body.operationId).toBe(rufe[0]!.body.operationId);
      const stand = (await w.services.ko.get(ziel.id))!;
      if (aktion === "propose") {
        expect(stand.version).toBe(ziel.version);
        expect(stand.proposals).toHaveLength(1);
        expect(panel.text("#rw-status")).toContain("Eingereicht");
      } else {
        expect(stand.version).toBe(ziel.version + 1);
        expect(stand.statement).toBe(
          "Vor jeder Wartung wird die Anlage drucklos geschaltet und gegen Wiedereinschalten gesichert.",
        );
        expect(panel.text("#rw-status")).toContain(`Version ${stand.version}`);
      }
      expect(stand.wordReturnOps).toHaveLength(1);
      const payload = structuredClone(rufe[0]!.body);
      if (aktion === "propose")
        payload.proposal = { ...(payload.proposal as object), statement: "Abweichender Inhalt" };
      else payload.changes = { ...(payload.changes as object), statement: "Abweichender Inhalt" };
      const anders = await w.app.inject({
        method: "PUT",
        url: `/api/kos/${ziel.id}`,
        headers: { authorization: `Bearer ${w.sitzung[rolle]}` },
        payload,
      });
      expect(anders.statusCode).toBe(409);
      if (aktion === "propose") {
        await w.services.auth.changeRole(w.konto.experte.id, "viewer", w.konto.admin.id);
        const ohneRecht = await w.app.inject({
          method: "PUT",
          url: `/api/kos/${ziel.id}`,
          headers: { authorization: `Bearer ${w.sitzung.experte}` },
          payload: rufe[0]!.body,
        });
        expect(ohneRecht.statusCode).toBe(403);
      }
    },
  );
});
