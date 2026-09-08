import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { CAPTURE_FRONT_DOOR_ROUTE } from "../../apps/web/src/lib/captureFrontDoor";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { DRAFTS_BODY_LIMIT } from "../../services/app/src/routes/capture-routes";
import { DRAFT_LIMITS } from "../../services/capture";
import { pages } from "./fixtures";
import { harness, read } from "./harness";
const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (
    html: string,
  ) => {
    window: {
      document: {
        querySelectorAll(selector: string): { replaceWith(text: string): void }[];
        querySelector(selector: string): unknown;
        body: {
          textContent: string | null;
          lastElementChild: { textContent: string | null } | null;
        };
      };
      close(): void;
    };
  };
};

async function setup(selection?: { text: string; url: string; title: string }) {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      name: "Browser Test",
      email: "browser@example.test",
      password: "test-password-3203",
    },
  });
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  let lose = false;
  let forced = 0;
  const fetcher: typeof fetch = async (input, options) => {
    const url = String(input);
    expect(new URL(url).origin).toBe("https://app.klarwerk.ai");
    expect(options?.credentials).toBe("omit");
    expect(options?.redirect).toBe("error");
    const body = options?.body ? JSON.parse(String(options.body)) : undefined;
    calls.push({ url, body });
    if (forced) return new Response("{}", { status: forced });
    const response = await app.inject({
      method: options?.method === "POST" ? "POST" : "GET",
      url: new URL(url).pathname,
      headers: options?.headers as Record<string, string>,
      // Preserve the actual wire body so Fastify's JSON parser catches malformed logout requests.
      ...(options?.body !== undefined ? { payload: String(options.body) } : {}),
    });
    if (lose && url.endsWith("/api/drafts")) {
      lose = false;
      throw new Error("lost response");
    }
    return new Response(response.statusCode === 204 ? null : response.body, {
      status: response.statusCode,
    });
  };
  const h = harness(fetcher);
  if (selection) {
    h.setSelected(selection);
    await h.listeners.menu?.(
      { menuItemId: "capture", pageUrl: selection.url, selectionText: selection.text },
      { id: 7, url: selection.url, title: selection.title },
    );
  } else await h.capture();
  await h.send({ type: "login", email: "browser@example.test", password: "test-password-3203" });
  return {
    ...h,
    app,
    calls,
    fetcher,
    loseNext: () => {
      lose = true;
    },
    force: (status: number) => {
      forced = status;
    },
  };
}
const save = {
  type: "save",
  form: {
    title: "Browser-Ausarbeitung",
    context: "Kontext\nPrüfung ä",
    confidentiality: "vertraulich",
  },
};

describe("KLARA-BROWSER B0 · ausgeliefertes Paket", () => {
  it("MV3 lädt ausschließlich lokale Einstiegspunkte mit engem Host und ohne Seitenzugriff auf Token", () => {
    const manifest = JSON.parse(read("manifest.json"));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.host_permissions).toEqual(["https://app.klarwerk.ai/*"]);
    // JOB 3278 · CHR-02: `sidePanel` ist HINZUGEKOMMEN, damit Klara neben der Seite stehen kann
    // statt in einem eigenen Tab. Bewusst nachgeführt und weiterhin abschliessend gepinnt — dies
    // ist der Wächter gegen schleichende Rechteausweitung, deshalb bleibt die Liste vollständig.
    expect(manifest.permissions.sort()).toEqual(
      ["activeTab", "contextMenus", "scripting", "sidePanel", "storage"].sort(),
    );
    expect(read(manifest.background.service_worker)).toContain("onMessage.addListener");
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.externally_connectable).toBeUndefined();
    expect(manifest.web_accessible_resources).toBeUndefined();
    expect(read("selection.js")).not.toMatch(
      /storage|token|fetch|XMLHttpRequest|sendMessage|innerHTML/,
    );
    expect(read("panel.js")).not.toMatch(/innerHTML|insertAdjacentHTML|fetch\(/);
    expect(read("panel.html")).toContain('src="panel.js"');
  });
  it("Kontextmenü bietet bewusste Auswahl auf HTTP und HTTPS ohne Dauerrechte an", async () => {
    const h = harness(async () => {
      throw new Error("kein Netz");
    });
    await h.listeners.installed?.();
    expect(h.menus).toEqual([
      {
        id: "capture",
        title: "In Klarwerk übernehmen",
        contexts: ["selection"],
        documentUrlPatterns: ["http://*/*", "https://*/*"],
      },
    ]);
  });
  it.each([
    "http://printer.test:8080/setup",
    "https://docs.example.test/interface?mode=usb#setup",
    "https://www.perplexity.ai.evil.test/guide",
  ])("normale Quelle %s ist erlaubt, ohne sie zum Netzwerkziel zu machen", async (url) => {
    const h = harness(async () => {
      throw new Error("kein Netz");
    });
    h.setSelected({ ...h.selected, url });
    await h.capture();
    const result = await h.send({ type: "state" });
    expect(result.status).toBe("preview");
    expect(result.selection?.url).toBe(url);
  });
  it("Volltext überlebt echte POST-, Sanitizer- und GET-Route einschließlich Kontext und Herkunft", async () => {
    const h = await setup();
    try {
      const result = await h.send(save);
      expect(result.status).toBe("saved");
      expect(result.link).toContain(`${CAPTURE_FRONT_DOOR_ROUTE}?draft=`);
      const id = new URL(result.link!).searchParams.get("draft");
      const token = (h.data.auth as { token: string }).token;
      const response = await h.app.inject({
        method: "GET",
        url: `/api/drafts/${id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      const draft = response.json();
      expect(draft.payload.statement.length).toBeLessThan(h.selected.text.length);
      expect(
        draft.payload.bodyHtml,
        "Volltext fehlt im wieder geöffneten Entwurfskörper",
      ).toContain("Langer Originalsatz. ".repeat(100));
      expect(draft.payload.bodyHtml).toContain("&lt;script&gt;");
      expect(draft.payload.bodyHtml).not.toContain("<script>");
      expect(draft.payload.bodyHtml).toContain("Kontext<br>Prüfung ä");
      expect(draft.payload.bodyHtml).toContain("Browser / www.perplexity.ai");
      expect(draft.payload.bodyHtml).toContain(h.selected.url);
      expect(draft.payload.bodyHtml).toContain(result.selection?.capturedAt);
      expect(draft.payload.pendingSources[0].excerpt).toBe(
        h.selected.text.slice(0, DRAFT_LIMITS.sourceExcerpt),
      );
      expect(draft.payload.pendingSources[0].sourceProvider).toBe("Browser");
      expect(draft.payload.confidentiality).toBe("vertraulich");
      expect(draft.payload.origin).toBeUndefined();
      expect(result.link).not.toContain(token);
    } finally {
      await h.app.close();
    }
  });
  it.each(pages)(
    "$name: echte Route erhält Volltext und tatsächliche Herkunft nach Wiederöffnen",
    async (page) => {
      const h = await setup(page);
      try {
        const preview = await h.send({ type: "state" });
        expect(preview.status).toBe("preview");
        expect(preview.selection).toMatchObject({
          text: page.text,
          title: page.title,
          url: page.url,
        });
        expect(h.calls.filter((c) => c.url.endsWith("/api/drafts"))).toHaveLength(0);
        await h.listeners.activated?.({ tabId: 22 });
        const saved = await h.send(save);
        expect(saved.status).toBe("saved");
        const restarted = harness(h.fetcher, h.data);
        const reopened = await restarted.send({ type: "state" });
        expect(reopened.status).toBe("saved");
        expect(reopened.selection).toEqual(preview.selection);
        const id = new URL(reopened.link!).searchParams.get("draft");
        const response = await h.app.inject({
          method: "GET",
          url: `/api/drafts/${id}`,
          headers: { authorization: `Bearer ${(h.data.auth as { token: string }).token}` },
        });
        expect(response.statusCode).toBe(200);
        const draft = response.json();
        const dom = new JSDOM(draft.payload.bodyHtml ?? "");
        try {
          for (const br of dom.window.document.querySelectorAll("br")) br.replaceWith("\n");
          expect(
            dom.window.document.body.lastElementChild?.textContent,
            "Volltext fehlt im wieder geöffneten Entwurfskörper",
          ).toBe(page.text);
          expect(dom.window.document.body.textContent).toContain(save.form.context);
          expect(dom.window.document.body.textContent).toContain(page.title);
          expect(dom.window.document.body.textContent).toContain(page.url);
          expect(dom.window.document.body.textContent).toContain(preview.selection?.capturedAt);
          expect(dom.window.document.querySelector("script")).toBeNull();
        } finally {
          dom.window.close();
        }
        expect(draft.payload.statement.length).toBeLessThan(page.text.length);
        expect(draft.payload.pendingSources[0]).toEqual({
          label: `Browser / ${new URL(page.url).hostname}`,
          url: page.url,
          excerpt: page.text.slice(0, DRAFT_LIMITS.sourceExcerpt),
          sourceProvider: "Browser",
        });
        expect(draft.payload.confidentiality).toBe("vertraulich");
        expect(h.calls.every((c) => new URL(c.url).origin === "https://app.klarwerk.ai")).toBe(
          true,
        );
      } finally {
        await h.app.close();
      }
    },
  );
  it("Antwortverlust und Worker-Neustart wiederholen denselben Vorgang und erzeugen genau einen Entwurf", async () => {
    const h = await setup();
    try {
      h.loseNext();
      expect((await h.send(save)).status).toBe("uncertain");
      const restarted = harness(h.fetcher, h.data);
      expect((await restarted.send({ type: "state" })).status).not.toBe("saved");
      expect((await restarted.send(save)).status).toBe("saved");
      const posts = h.calls.filter((c) => c.url.endsWith("/api/drafts"));
      expect(posts).toHaveLength(2);
      expect(posts[1]?.body.operationId, "Wiederholung hat einen neuen Vorgangsschlüssel").toBe(
        posts[0]?.body.operationId,
      );
      expect(posts[1]?.body).toEqual(posts[0]?.body);
      const token = (h.data.auth as { token: string }).token;
      const drafts = await h.app.inject({
        method: "GET",
        url: "/api/drafts",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(drafts.json()).toHaveLength(1);
    } finally {
      await h.app.close();
    }
  });
  it("unzulässiger Absender und allgemeiner Netzauftrag erreichen kein Netzwerk", async () => {
    let requests = 0;
    const h = harness(async () => {
      requests++;
      return new Response("{}");
    });
    expect(
      (
        await h.send(save, {
          id: "test-extension",
          url: "https://www.perplexity.ai",
          tab: { id: 7 },
        })
      ).status,
    ).toBe("forbidden_sender");
    expect((await h.send({ type: "fetch", url: "https://evil.test" })).status).toBe(
      "invalid_message",
    );
    expect(requests).toBe(0);
  });
  it.each([
    [401, "expired"],
    [403, "denied"],
    [409, "conflict"],
    [413, "too_large"],
    [429, "rate_limited"],
    [503, "server_error"],
    [400, "rejected"],
  ])("HTTP %s ist unterscheidbar und erhält Auswahl und Vorgang", async (status, expected) => {
    const h = await setup();
    try {
      h.force(Number(status));
      expect((await h.send(save)).status).toBe(expected);
      expect((h.data.work as { selection: unknown }).selection).toBeTruthy();
      expect(JSON.stringify(h.data)).not.toContain("test-password-3203");
      h.force(0);
      if (status === 401) {
        expect(h.data.auth).toBeNull();
        await h.send({
          type: "login",
          email: "browser@example.test",
          password: "test-password-3203",
        });
      }
      expect((await h.send(save)).status).toBe("saved");
      const posts = h.calls.filter((c) => c.url.endsWith("/api/drafts"));
      expect(posts[1]?.body.operationId).toBe(posts[0]?.body.operationId);
    } finally {
      await h.app.close();
    }
  });
  it("Doppelklick blockiert den zweiten POST; Änderung beginnt einen neuen Vorgang, Rückänderung findet den alten", async () => {
    const h = await setup();
    try {
      const [a, b] = await Promise.all([h.send(save), h.send(save)]);
      expect([a.status, b.status].sort()).toEqual(["busy", "saved"]);
      expect(h.calls.filter((c) => c.url.endsWith("/api/drafts"))).toHaveLength(1);
      await h.send({ ...save, form: { ...save.form, context: "Andere Notiz" } });
      await h.send(save);
      const posts = h.calls.filter((c) => c.url.endsWith("/api/drafts"));
      expect(posts[1]?.body.operationId).not.toBe(posts[0]?.body.operationId);
      expect(posts[2]?.body.operationId).toBe(posts[0]?.body.operationId);
    } finally {
      await h.app.close();
    }
  });
  it("erneutes Öffnen verlangt frisches Rücklesen; offline wird kein Cache-Erfolg behauptet", async () => {
    const h = await setup();
    try {
      await h.send(save);
      const restarted = harness(h.fetcher, h.data);
      expect((await restarted.send({ type: "state" })).status).toBe("saved");
      h.force(503);
      const result = await restarted.send({ type: "state" });
      expect(result.status).toBe("server_error");
      expect(result.link).toBeUndefined();
      expect(result.selection?.text).toBe(h.selected.text);
    } finally {
      await h.app.close();
    }
  });
  it("andere Konten übernehmen keine Auswahl und keine alten Vorgangsschlüssel", async () => {
    const h = await setup();
    try {
      const second = await h.app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "B", email: "b@example.test", password: "test-password-3203" },
      });
      await h.app.inject({
        method: "POST",
        url: `/api/auth/users/${second.json().id}/approve`,
        headers: { authorization: `Bearer ${(h.data.auth as { token: string }).token}` },
      });
      h.force(401);
      await h.send(save);
      h.force(0);
      const result = await h.send({
        type: "login",
        email: "b@example.test",
        password: "test-password-3203",
      });
      expect(result.status).toBe("account_changed");
      expect(result.selection).toBeUndefined();
      expect(h.data.work).toBeUndefined();
      expect((await h.send(save)).status).toBe("stale_preview");
    } finally {
      await h.app.close();
    }
  });
  it("Abmelden löscht Sitzung und sensible Auswahl, Abbrechen vor POST erzeugt nichts", async () => {
    const h = await setup();
    try {
      expect((await h.send({ type: "cancel" })).status).toBe("cancelled");
      expect(h.calls.filter((c) => c.url.endsWith("/api/drafts"))).toHaveLength(0);
      await h.capture();
      await h.send({ type: "logout" });
      expect(h.data).toEqual({});
      expect((await h.send(save)).status).toBe("stale_preview");
    } finally {
      await h.app.close();
    }
  });
  it("Logout widerruft am echten Fastify nur die Erweiterungssitzung und meldet logged_out", async () => {
    const h = await setup();
    try {
      const token = (h.data.auth as { token: string }).token;
      const secondLogin = await h.app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "browser@example.test", password: "test-password-3203" },
      });
      expect(secondLogin.statusCode).toBe(200);
      const secondToken: string = secondLogin.json().token;
      expect(secondToken === token).toBe(false);
      const me = (sessionToken: string) =>
        h.app.inject({
          method: "GET",
          url: "/api/auth/me",
          headers: { authorization: `Bearer ${sessionToken}` },
        });
      expect((await me(token)).statusCode).toBe(200);
      expect((await me(secondToken)).statusCode).toBe(200);

      const result = await h.send({ type: "logout" });

      expect
        .soft((await me(token)).statusCode, "Erweiterungssitzung wurde nicht widerrufen")
        .toBe(401);
      expect.soft(result.status).toBe("logged_out");
      expect((await me(secondToken)).statusCode, "Zweite Sitzung muss gültig bleiben").toBe(200);
      expect(h.calls.map((call) => new URL(call.url).pathname)).toEqual([
        "/api/auth/login",
        "/api/auth/logout",
      ]);
      expect(h.data).toEqual({});
      expect(result.user).toBeUndefined();
      expect(result.selection).toBeUndefined();
      expect(result.link).toBeUndefined();
    } finally {
      await h.app.close();
    }
  });
  it("abgelehnter Logout meldet nur logged_out_local und löscht trotzdem flüchtige Daten", async () => {
    const h = await setup();
    try {
      const token = (h.data.auth as { token: string }).token;
      h.force(503);
      expect((await h.send({ type: "logout" })).status).toBe("logged_out_local");
      expect(h.data).toEqual({});
      const stillActive = await h.app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(stillActive.statusCode).toBe(200);
    } finally {
      await h.app.close();
    }
  });
  it("Quelle bleibt eingefroren, neue Auswahl überschreibt nicht und alte Vorschau kann nicht speichern", async () => {
    const h = await setup();
    try {
      const original = await h.send({ type: "state" });
      await h.listeners.activated?.({ tabId: 15 });
      h.setSelected({
        text: "ANDERER CHAT",
        url: "https://www.perplexity.ai/search/other",
        title: "Anders",
      });
      await h.capture();
      const current = await h.send({ type: "state" });
      expect(current.selection).toEqual(original.selection);
      expect(current.sourceChanged).toBe(true);
      expect(current.pendingCapture).toBe(true);
      expect((await h.send({ ...save, captureId: "stale" })).status).toBe("stale_preview");
    } finally {
      await h.app.close();
    }
  });
  it.each(["", " \n", "a".repeat(200001)])(
    "leere oder überlange Auswahl wird vor Netzwerk und Ablage abgelehnt (%#)",
    async (text) => {
      const h = harness(async () => {
        throw new Error("kein Netz erlaubt");
      });
      h.setSelected({ ...h.selected, text });
      await h.capture();
      const result = await h.send({ type: "state" });
      expect(result.status).toBe(text.length > 200000 ? "selection_too_large" : "empty");
      expect(result.selection).toBeUndefined();
    },
  );
  it.each([
    "chrome://settings",
    "file:///tmp/anleitung.html",
    "data:text/html,Anleitung",
    "chrome-extension://other/page.html",
    "about:blank",
    "ftp://printer.test/guide",
    "https://user:pw@www.perplexity.ai/x",
  ])("unzulässige Quelle %s wird nicht erfasst", async (url) => {
    const h = harness(async () => {
      throw new Error("kein Netz erlaubt");
    });
    h.setSelected({ ...h.selected, url });
    await h.capture();
    expect((await h.send({ type: "state" })).status).toBe("unsupported");
  });
  it("offene Vertraulichkeit bleibt im echten Entwurf fehlend und im Körper ausdrücklich offen", async () => {
    const h = await setup();
    try {
      const result = await h.send({ ...save, form: { ...save.form, confidentiality: "" } });
      expect(result.status).toBe("saved");
      const sent = h.calls.find((c) => c.url.endsWith("/api/drafts"))?.body;
      expect(sent).not.toHaveProperty("confidentiality");
      expect(sent?.bodyHtml).toContain("Offen / Not classified");
      expect(Object.keys(result)).not.toContain("token");
    } finally {
      await h.app.close();
    }
  });
  it("Längengrenzen bleiben am Serververtrag gebunden, größter B0-Text bleibt als UTF-8-JSON darunter", async () => {
    const worker = read("worker.js");
    expect(worker).toContain(`const SOURCE_URL = ${DRAFT_LIMITS.sourceUrl};`);
    expect(worker).toContain(`const SOURCE_LABEL = ${DRAFT_LIMITS.sourceLabel};`);
    expect(worker).toContain(`const EXCERPT = ${DRAFT_LIMITS.sourceExcerpt};`);
    expect(DRAFTS_BODY_LIMIT).toBe(5 * 1024 * 1024);
    const h = await setup();
    try {
      await h.send({ type: "cancel" });
      h.setSelected({ ...h.selected, text: '"<&😀'.repeat(40000) });
      await h.capture();
      expect((await h.send(save)).status).toBe("saved");
      const body = h.calls.find((c) => c.url.endsWith("/api/drafts"))?.body;
      expect(new TextEncoder().encode(JSON.stringify(body)).byteLength).toBeLessThan(
        DRAFTS_BODY_LIMIT,
      );
      expect(String(body?.statement)).toHaveLength(200000);
      // JOB 3279: die Kernaussage allein beweist nichts über den KÖRPER. Genau dort kürzte ein
      // Deckel je Textknoten die größte zulässige Übernahme still von 200.000 auf 20.000 Zeichen
      // — gemessen, nicht vermutet. Der Körper muss den ganzen Text tragen.
      expect(String(body?.bodyHtml), "Der Entwurfskörper wurde still gekürzt").toContain(
        "&quot;&lt;&amp;😀".repeat(2000),
      );
      // 40.000 × „&quot;&lt;&amp;😀" sind 680.000 UTF-16-Einheiten allein für den Inhalt.
      expect(String(body?.bodyHtml).length).toBeGreaterThan(680000);
    } finally {
      await h.app.close();
    }
  });
  it.each(["title", "url"])(
    "zu langes Quellenfeld %s wird abgelehnt und nicht gekürzt",
    async (field) => {
      const h = harness(async () => {
        throw new Error("kein Netz");
      });
      h.setSelected({
        ...h.selected,
        ...(field === "title"
          ? { title: "x".repeat(DRAFT_LIMITS.sourceLabel + 1) }
          : { url: `https://www.perplexity.ai/${"x".repeat(DRAFT_LIMITS.sourceUrl)}` }),
      });
      await h.capture();
      expect((await h.send({ type: "state" })).status).toBe("selection_too_large");
    },
  );
  it("Kontextmenü bei Seitenwechsel lehnt die verspätete Auswahl ab", async () => {
    const h = harness(async () => {
      throw new Error("kein Netz");
    });
    await h.listeners.menu?.(
      {
        menuItemId: "capture",
        pageUrl: "https://www.perplexity.ai/search/earlier",
        selectionText: "Alt",
      },
      { id: 7 },
    );
    expect((await h.send({ type: "state" })).status).toBe("source_changed");
  });
  it("fremdes Ziel im Speicherauftrag wird niemals zum Netzwerkziel", async () => {
    const h = await setup();
    try {
      expect(
        (
          await h.send({
            ...save,
            url: "https://evil.test/leak",
            method: "PUT",
            headers: { Authorization: "evil" },
          })
        ).status,
      ).toBe("saved");
      expect(h.calls.every((c) => new URL(c.url).origin === "https://app.klarwerk.ai")).toBe(true);
      expect(h.calls.map((c) => new URL(c.url).pathname)).toEqual([
        "/api/auth/login",
        "/api/drafts",
      ]);
    } finally {
      await h.app.close();
    }
  });
});
