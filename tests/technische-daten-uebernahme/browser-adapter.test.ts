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
import { DATENBLATT, HTML_SEITE, geaendert } from "./fixture";

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
  // Öffentliche Belegadressen dürfen beim Einreichen nur auf dieser Stufe ans Wissensobjekt
  // (bestehende Regel `decideExternalAttach`); A5 reicht ein.
  await app.inject({
    method: "PUT",
    url: "/api/external/policy",
    headers: kopf,
    payload: { stage: "search_attach" },
  });
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
  return { app, h, kopf, pfade, entwuerfe, seite, fetcher };
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

  it("A5 · Wiederholung nach dem Einreichen: die Leiste zeigt den Übernahmestand und öffnet das vorhandene Wissen", async () => {
    const { app, h, kopf, pfade, entwuerfe } = await bahn();
    try {
      await h.capture();
      await h.send({ type: "login", email: EMAIL, password: KENNWORT });
      await h.send({ type: "technik_vorschau", ziel: { objekt: "V-17" } });
      const erst = await h.send({
        type: "technik_uebernahme",
        ziel: { objekt: "V-17" },
        schutzklasse: "intern",
      });
      expect(erst.status).toBe("technik_saved");
      const [entwurf] = await entwuerfe();
      const eingereicht = await app.inject({
        method: "POST",
        url: `/api/drafts/${entwurf?.id}/promote`,
        headers: kopf,
        payload: { draftPayload: { category: "Wartung" } },
      });
      expect(eingereicht.statusCode, eingereicht.body).toBe(201);
      const koId = eingereicht.json().id as string;
      const fassung = eingereicht.json().version as number;

      // Quellenpflege aus der Leiste: die gelesene Tabelle mit dem vorhandenen Wissen abgleichen.
      const abgleich = await h.send({ type: "technik_abgleich" });
      expect(abgleich.status).toBe("technik_abgeglichen");
      expect(abgleich.technik?.abgleich).toEqual([
        `Wissen / Knowledge „Technische Daten · V-17“ · Fassung ${fassung} · unverändert / unchanged`,
      ]);
      expect(pfade).toContain("/api/technische-daten/quellenabgleich");

      // Dieselbe Seite später noch einmal übernommen.
      await h.send({ type: "recapture" });
      await h.send({ type: "technik_vorschau", ziel: { objekt: "V-17" } });
      const nochmal = await h.send({
        type: "technik_uebernahme",
        ziel: { objekt: "V-17" },
        schutzklasse: "intern",
      });
      expect(nochmal.status, "kein Fehler, sondern der tatsächliche Stand").toBe(
        "technik_im_wissen",
      );
      expect(nochmal.technik?.wissenLink).toBe(`https://app.klarwerk.ai/wissen/${koId}`);
      expect(nochmal.technik?.imWissenFreigegeben).toBe(false);
      expect(nochmal.technik?.link, "kein Entwurfslink").toBeUndefined();
      expect(await entwuerfe(), "keine Dublette").toHaveLength(0);

      // Die Leiste bietet genau dieses Objekt zum Öffnen an.
      const view = await mount({ an: h });
      await view.login();
      expect(view.el("technik-wissen").hidden).toBe(false);
      expect(view.el("technik-wissen").getAttribute("href")).toBe(
        `https://app.klarwerk.ai/wissen/${koId}`,
      );
    } finally {
      await app.close();
    }
  });

  it("A7 · Quellenpflege liest die gebundene Quelle neu; ein fehlender Abschnitt wird geklärt — gelöscht, verschoben oder entzogen", async () => {
    const { app, h, kopf, pfade, seite, fetcher } = await bahn();
    try {
      await h.capture();
      await h.send({ type: "login", email: EMAIL, password: KENNWORT });
      await h.send({ type: "technik_vorschau", ziel: { objekt: "V-17" } });
      await h.send({
        type: "technik_uebernahme",
        ziel: { objekt: "V-17" },
        schutzklasse: "intern",
      });
      const entwurf = (
        (await app.inject({ method: "GET", url: "/api/drafts", headers: kopf })).json() as {
          id: string;
        }[]
      )[0];
      const ko = (
        await app.inject({
          method: "POST",
          url: `/api/drafts/${entwurf?.id}/promote`,
          headers: kopf,
          payload: { draftPayload: { category: "Wartung" } },
        })
      ).json() as { id: string };
      const abgleiche = () => pfade.filter((p) => p === "/api/technische-daten/quellenabgleich");
      const lesungen = () => h.spuren.filter((s) => s === "scripting.executeScript").length;

      // 1. Die Seite hat sich geändert: der Abgleich liest NEU und meldet die Änderung.
      const geaenderteSeite = {
        ...seite,
        tabellen: [{ ...TABELLE, zeilen: geaendert(HTML_SEITE, 0, 2, "20 bar").zeilen }],
      };
      h.setSelected(geaenderteSeite);
      const vorher = lesungen();
      const geaendertAbgleich = await h.send({ type: "technik_abgleich" });
      expect(lesungen(), "die gebundene Quelle wird neu gelesen").toBe(vorher + 1);
      expect(geaendertAbgleich.status).toBe("technik_abgeglichen");
      expect(geaendertAbgleich.technik?.abgleich?.join("\n")).toContain(
        "Quelle geändert / Source changed",
      );

      // 2. Anderer Tabinhalt: nichts wird gesendet.
      const anzahl = abgleiche().length;
      h.setSelected({ ...seite, url: "https://ventile.example.test/andere-seite" });
      expect((await h.send({ type: "technik_abgleich" })).status).toBe("source_changed");
      expect(abgleiche()).toHaveLength(anzahl);

      // 3. Gleiche Seite, Abschnitt fehlt: nichts gesendet, die Leiste fragt nach dem Grund.
      const ohneTabelle = { ...seite, tabellen: [], tabelleGewaehlt: -1 };
      h.setSelected(ohneTabelle);
      const fehlt = await h.send({ type: "technik_abgleich" });
      expect(fehlt.status).toBe("technik_abschnitt_fehlt");
      expect(fehlt.technik?.klaerung).toBe(true);
      expect(abgleiche()).toHaveLength(anzahl);
      // „Verschoben" kennzeichnet nichts.
      const verschoben = await h.send({ type: "technik_quelle_verschoben" });
      expect(verschoben.status).toBe("technik_verschoben");
      expect(verschoben.technik?.klaerung).toBeUndefined();
      expect(abgleiche()).toHaveLength(anzahl);

      // 4. „Gelöscht" — erneut frisch gelesen, dann gekennzeichnet; am Wissensobjekt sichtbar.
      await h.send({ type: "technik_abgleich" });
      const geloescht = await h.send({ type: "technik_quelle_geloescht" });
      expect(geloescht.status).toBe("technik_abgeglichen");
      expect(geloescht.technik?.abgleich?.join("\n")).toContain(
        "Quelle nicht mehr erreichbar / Source no longer reachable",
      );
      expect(abgleiche()).toHaveLength(anzahl + 1);
      const quellen = (
        await app.inject({ method: "GET", url: `/api/kos/${ko.id}`, headers: kopf })
      ).json().sources as { sourceRemovedAt?: string }[];
      expect(quellen[0]?.sourceRemovedAt, "Vermerk am Quellenbeleg").toBeTruthy();

      // 5. Ist der Abschnitt wieder da, hebt der frische Abgleich den Vermerk auf.
      h.setSelected(seite);
      await h.send({ type: "technik_abgleich" });
      const wieder = (
        await app.inject({ method: "GET", url: `/api/kos/${ko.id}`, headers: kopf })
      ).json().sources as { sourceRemovedAt?: string }[];
      expect(wieder[0]?.sourceRemovedAt).toBeUndefined();

      // 6. „Zugriff entzogen" geht an den Rechteweg: eine Expertin darf das nicht …
      const bert = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: kopf,
        payload: {
          name: "Bert",
          email: "bert@example.test",
          password: KENNWORT,
          role: "experte",
        },
      });
      expect(bert.statusCode, bert.body).toBe(201);
      const h2 = harness(fetcher);
      h2.setSelected(seite);
      await h2.capture();
      await h2.send({ type: "login", email: "bert@example.test", password: KENNWORT });
      h2.setSelected(ohneTabelle);
      await h2.send({ type: "technik_abgleich" });
      const nurPruefung = await h2.send({ type: "technik_quelle_entzogen" });
      expect(nurPruefung.status).toBe("technik_rechte_nur_pruefung");
      const nochLesbar = await app.inject({
        method: "GET",
        url: `/api/kos/${ko.id}`,
        headers: kopf,
      });
      expect(nochLesbar.statusCode).toBe(200);
      // … die Verwaltung mit Prüfrecht schon: Quelle und Ableitung sind danach gesperrt.
      h.setSelected(ohneTabelle);
      await h.send({ type: "technik_abgleich" });
      const entzogen = await h.send({ type: "technik_quelle_entzogen" });
      expect(entzogen.status).toBe("technik_rechte_entzogen");
      const gesperrt = await app.inject({
        method: "GET",
        url: `/api/kos/${ko.id}`,
        headers: kopf,
      });
      expect([403, 404]).toContain(gesperrt.statusCode);
    } finally {
      await app.close();
    }
  });

  it("A6 · ein ausdrücklich gewähltes Datenblatt in einem zweiten Tab wird als eigener Beleg derselben Übernahme geführt", async () => {
    const { app, h, kopf, entwuerfe, seite } = await bahn();
    try {
      const blatt = {
        text: "10",
        url: DATENBLATT.url,
        title: "Datenblatt V-Serie",
        tabellen: [
          {
            abschnitt: DATENBLATT.abschnitt,
            anker: "",
            kopf: DATENBLATT.kopf,
            zeilen: DATENBLATT.zeilen,
          },
        ],
        tabelleGewaehlt: 0,
      };
      h.setTab(8, blatt);
      // 1. Das Datenblatt in seinem Tab erfassen und als Datenblatt merken.
      await h.listeners.action?.({ id: 8, url: DATENBLATT.url, title: blatt.title });
      await h.send({ type: "login", email: EMAIL, password: KENNWORT });
      const gemerkt = await h.send({ type: "technik_merken", art: "datenblatt" });
      expect(gemerkt.status).toBe("technik_gemerkt");
      expect(gemerkt.technik?.sammlung).toEqual([
        `Datenblatt · ${DATENBLATT.abschnitt} · ${DATENBLATT.url}`,
      ]);
      // 2. Die Webseite im ersten Tab erfassen (offene Übernahme wird bewusst ersetzt).
      await h.capture();
      await h.send({ type: "recapture" });
      const state = await h.send({ type: "state" });
      expect(state.selection?.url).toBe(seite.url);

      // 3. Prüfen: beide Belege, getrennte Herkunft, Abweichung mit Empfehlung und Grundlage.
      const geprueft = await h.send({ type: "technik_vorschau", ziel: { objekt: "V-17" } });
      expect(geprueft.status).toBe("technik_preview");
      expect(geprueft.technik?.belege).toEqual([
        `Datenblatt · ${DATENBLATT.abschnitt} · ${DATENBLATT.url}`,
        `Webseite · ${ABSCHNITT} · ${HTML_SEITE.url}`,
      ]);
      const werte = geprueft.technik?.ergebnis?.werte.join("\n") ?? "";
      expect(werte).toContain(`10 (bei 20 °C) · in Klärung · Datenblatt „${DATENBLATT.abschnitt}“`);
      expect(werte).toContain(`16 bar ±0,5 bar · in Klärung · Webseite „${ABSCHNITT}“`);
      const abweichungen = geprueft.technik?.ergebnis?.abweichungen ?? [];
      expect(abweichungen).toHaveLength(2);
      expect(abweichungen.join("\n")).toContain("Empfehlung: Datenblatt");
      expect(abweichungen.join("\n")).toContain("nicht die Wahrscheinlichkeit");

      // 4. Übernehmen: beide Tabs werden neu gelesen, ein Entwurf mit zwei getrennten Belegen.
      const vorher = h.spuren.filter((s) => s === "scripting.executeScript").length;
      const gesichert = await h.send({
        type: "technik_uebernahme",
        ziel: { objekt: "V-17" },
        schutzklasse: "intern",
      });
      expect(gesichert.status).toBe("technik_saved");
      expect(h.spuren.filter((s) => s === "scripting.executeScript").length).toBe(vorher + 2);
      expect(gesichert.technik?.sammlung, "gemerkte Belege sind verbraucht").toEqual([]);
      const [entwurf] = await entwuerfe();
      const d = (
        await app.inject({ method: "GET", url: `/api/drafts/${entwurf?.id}`, headers: kopf })
      ).json();
      expect(
        d.payload.pendingSources.map((q: { sourceProvider: string }) => q.sourceProvider),
      ).toEqual(["Datenblatt", "Webseite"]);
      expect(d.payload.bodyHtml).toContain("Abweichende Belege");
    } finally {
      await app.close();
    }
  });
});
