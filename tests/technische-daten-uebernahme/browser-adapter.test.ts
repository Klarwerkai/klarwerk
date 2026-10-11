// ================================================================================================
// BPA-02 · DER BROWSERADAPTER — VOM MARKIERTEN TABELLENABSCHNITT ZUM GEÖFFNETEN ENTWURF.
// ================================================================================================
//
// Ben (Nacharbeit 3): „In Browserextension und Weboberfläche gibt es keinen Aufrufer." Diese Datei
// misst den Weg an den unveränderten Bauteilen der Chrome-Leiste: `selection.js` im Dokument,
// `worker.js` im Prüfstand (`../klara-browser/harness`), `panel.html`/`panel.js` gemountet
// (`../klara-browser/panel-dom`) — und dahinter die echte App (`buildApp(buildServices())`).
//
//   A1 · Das Inhaltsskript liefert die markierte Tabelle mit genauem Abschnitt, Anker, Kopf, Zeilen.
//   A2 · Leiste: Prüfen zeigt Werte mit Herkunft; Übernehmen liest den Tab neu, speichert einen
//        eigenen Entwurf mit Abschnitt/Fassung und bietet genau ihn zum Öffnen an.
//   A3 · Geänderte Tabelle zwischen Prüfen und Übernehmen: nichts gespeichert, neue Fassung gezeigt.
//   A4 · Anderer Tabinhalt (Navigation) oder keine Tabelle: nichts gesendet.
//
// GRENZE, BENANNT: Das ist ein Prüfstand mit gestelltem `chrome.scripting`; eine echte Chrome-Probe
// mit Hostversion, Rollen und Kontextwechsel ersetzt er nicht (getrennt offen).
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { belegFassung } from "../../services/app/src/technische-daten";
import { harness, read, verfahren } from "../klara-browser/harness";
import { mount, schliesseFenster } from "../klara-browser/panel-dom";
import { HTML_SEITE, geaendert } from "./fixture";

const { JSDOM } = createRequire(import.meta.url)("jsdom") as {
  JSDOM: new (
    html: string,
    options: { url: string; runScripts: "outside-only" },
  ) => {
    window: {
      document: {
        querySelector(s: string): unknown;
        createRange(): { selectNodeContents(n: unknown): void };
      };
      getSelection(): { addRange(r: unknown): void } | null;
      eval(code: string): unknown;
      close(): void;
    };
  };
};

const EMAIL = "a@example.test";
const KENNWORT = "fixture-password";
const ABSCHNITT = "Technische Daten · Tabelle 1";
const TABELLE = {
  abschnitt: ABSCHNITT,
  anker: "technische-daten",
  kopf: HTML_SEITE.kopf,
  zeilen: HTML_SEITE.zeilen,
};

afterEach(() => schliesseFenster());

type Ergebnis = {
  tabellen: { abschnitt: string; anker: string; kopf: string[]; zeilen: string[][] }[];
  tabelleGewaehlt: number;
};

function inhaltsskript(markieren: string | null): Ergebnis {
  const zeilen = HTML_SEITE.zeilen
    .map((z) => `<tr>${z.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("");
  const dom = new JSDOM(
    `<title>V-Serie</title><main><h2>Technische Daten</h2>
     <table id="technische-daten"><thead><tr>${HTML_SEITE.kopf.map((k) => `<th>${k}</th>`).join("")}</tr></thead>
     <tbody>${zeilen}</tbody></table></main>`,
    { url: HTML_SEITE.url, runScripts: "outside-only" },
  );
  try {
    if (markieren) {
      const range = dom.window.document.createRange();
      range.selectNodeContents(dom.window.document.querySelector(markieren));
      dom.window.getSelection()?.addRange(range);
    }
    return dom.window.eval(read("selection.js")) as Ergebnis;
  } finally {
    dom.window.close();
  }
}

/** Die echte App hinter dem Worker — derselbe Brückenbau wie im Paketvertrag der Leiste. */
async function bahn() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Anna", email: EMAIL, password: KENNWORT },
  });
  const anna = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: EMAIL, password: KENNWORT },
  });
  const kopf = { authorization: `Bearer ${anna.json().token}` };
  const pfade: string[] = [];
  const fetcher: typeof fetch = async (input, options) => {
    const url = new URL(String(input));
    expect(url.origin).toBe("https://app.klarwerk.ai");
    expect(options?.credentials).toBe("omit");
    pfade.push(url.pathname);
    const res = await app.inject({
      method: verfahren(options),
      url: url.pathname,
      headers: options?.headers as Record<string, string>,
      ...(options?.body !== undefined ? { payload: String(options.body) } : {}),
    });
    return new Response(res.statusCode === 204 ? null : res.body, { status: res.statusCode });
  };
  const h = harness(fetcher);
  const seite = {
    text: "16 bar ±0,5 bar",
    url: HTML_SEITE.url,
    title: "V-Serie Absperrventile",
    tabellen: [TABELLE],
    tabelleGewaehlt: 0,
  };
  h.setSelected(seite);
  const entwuerfe = async () =>
    (
      (await app.inject({ method: "GET", url: "/api/drafts", headers: kopf })).json() as {
        id: string;
        payload: { title?: string };
      }[]
    ).filter((d) => d.payload.title?.startsWith("Technische Daten"));
  return { app, h, kopf, pfade, entwuerfe, seite };
}

describe("BPA-02 · Browseradapter", () => {
  it("A1 · das Inhaltsskript liefert die markierte Tabelle mit Abschnitt, Anker, Kopf und Zeilen", () => {
    const mit = inhaltsskript("td");
    expect(mit.tabelleGewaehlt).toBe(0);
    expect(mit.tabellen[0]).toEqual(TABELLE);
    const ohne = inhaltsskript(null);
    expect(ohne.tabelleGewaehlt, "ohne Markierung ist keine Tabelle gewählt").toBe(-1);
    expect(ohne.tabellen).toHaveLength(1);
  });

  it("A2 · Leiste: Prüfen, Übernehmen mit Neulesen, Entwurf mit Abschnitt und Fassung öffnen", async () => {
    const { app, h, kopf, pfade, entwuerfe } = await bahn();
    try {
      const view = await mount({ an: h });
      await view.login();
      expect(view.el("technik").hidden).toBe(false);
      expect(view.el("technik-abschnitt").textContent).toBe(ABSCHNITT);
      expect(view.el("technik-uebernehmen").disabled, "ohne Prüfung keine Übernahme").toBe(true);

      view.el("technik-objekt").value = "V-17";
      view.el("technik-pruefen").click();
      await view.settle();
      expect(view.el("status").textContent).toContain("Technische Daten geprüft");
      expect(view.el("technik-werte").textContent).toContain(
        "V-17 / DN25 · Betriebsdruck: 16 bar ±0,5 bar",
      );
      expect(view.el("technik-werte").textContent).not.toContain("V-18");
      expect(await entwuerfe(), "Prüfen speichert nichts").toHaveLength(0);

      const gelesen = h.spuren.filter((s) => s === "scripting.executeScript").length;
      view.el("technik-schutz").value = "intern";
      view.el("technik-uebernehmen").click();
      await view.settle();
      expect(
        h.spuren.filter((s) => s === "scripting.executeScript").length,
        "vor dem Speichern wird der Tab neu gelesen",
      ).toBe(gelesen + 1);
      expect(view.el("status").textContent).toContain("als ungeprüfter Entwurf gesichert");
      expect(pfade.filter((p) => p.startsWith("/api/technische-daten/"))).toEqual([
        "/api/technische-daten/vorschau",
        "/api/technische-daten/uebernahme",
      ]);

      const [entwurf] = await entwuerfe();
      expect(entwurf, "genau ein Entwurf").toBeDefined();
      const href = view.el("technik-open").getAttribute("href");
      expect(view.el("technik-open").hidden).toBe(false);
      expect(href).toBe(
        `https://app.klarwerk.ai/capture/frontdoor?draft=${entwurf?.id ?? ""}&lang=de`,
      );
      const d = (
        await app.inject({ method: "GET", url: `/api/drafts/${entwurf?.id}`, headers: kopf })
      ).json();
      expect(d.payload.confidentiality).toBe("intern");
      expect(d.payload.pendingSources[0].url).toBe(`${HTML_SEITE.url}#technische-daten`);
      expect(d.payload.pendingSources[0].excerpt).toContain(`Abschnitt: ${ABSCHNITT}`);
      const fassung = belegFassung({ ...HTML_SEITE, abschnitt: ABSCHNITT });
      expect(d.payload.pendingSources[0].excerpt).toContain(`Fassung sha256:${fassung}`);
    } finally {
      await app.close();
    }
  });

  it("A3 · geänderte Tabelle zwischen Prüfen und Übernehmen: nichts gespeichert, neue Fassung gezeigt", async () => {
    const { app, h, entwuerfe, seite } = await bahn();
    try {
      await h.capture();
      await h.send({ type: "login", email: EMAIL, password: KENNWORT });
      const geprueft = await h.send({ type: "technik_vorschau", ziel: { objekt: "V-17" } });
      expect(geprueft.status).toBe("technik_preview");
      expect(geprueft.technik?.geprueft).toBe(true);

      const neu = geaendert(HTML_SEITE, 0, 2, "20 bar");
      const geaenderteSeite = { ...seite, tabellen: [{ ...TABELLE, zeilen: neu.zeilen }] };
      h.setSelected(geaenderteSeite);
      const anders = await h.send({
        type: "technik_uebernahme",
        ziel: { objekt: "V-17" },
        schutzklasse: "intern",
      });
      expect(anders.status).toBe("technik_changed");
      expect(anders.technik?.ergebnis?.werte.join("\n")).toContain("Betriebsdruck: 20 bar");
      expect(await entwuerfe()).toHaveLength(0);

      // Die gezeigte neue Fassung ist jetzt die geprüfte; eine weitere Lesung derselben speichert.
      const danach = await h.send({
        type: "technik_uebernahme",
        ziel: { objekt: "V-17" },
        schutzklasse: "intern",
      });
      expect(danach.status).toBe("technik_saved");
      const link = /^https:\/\/app\.klarwerk\.ai\/capture\/frontdoor\?draft=/;
      expect(danach.technik?.link).toMatch(link);
      expect(await entwuerfe()).toHaveLength(1);
    } finally {
      await app.close();
    }
  });

  it("A4 · anderer Tabinhalt oder keine Tabelle: nichts wird gesendet", async () => {
    const { app, h, pfade, seite } = await bahn();
    try {
      await h.capture();
      await h.send({ type: "login", email: EMAIL, password: KENNWORT });
      await h.send({ type: "technik_vorschau", ziel: {} });
      h.setSelected({ ...seite, url: "https://ventile.example.test/andere-seite" });
      const weg = await h.send({ type: "technik_uebernahme", ziel: {} });
      expect(weg.status).toBe("source_changed");
      expect(pfade).not.toContain("/api/technische-daten/uebernahme");

      // Neue Übernahme ohne Tabelle an der Markierung: der Weg bleibt zu.
      h.setSelected({ text: "Fließtext", url: HTML_SEITE.url, title: "V-Serie" });
      await h.send({ type: "recapture" });
      const ohne = await h.send({ type: "state" });
      expect(ohne.technik).toBeUndefined();
      const versucht = await h.send({ type: "technik_vorschau", ziel: {} });
      expect(versucht.status).toBe("technik_none");
      expect(pfade.filter((p) => p === "/api/technische-daten/vorschau")).toHaveLength(1);
    } finally {
      await app.close();
    }
  });
});
