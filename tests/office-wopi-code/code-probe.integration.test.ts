// ================================================================================================
// OFFICE IM ARTIKEL · INTEGRATIONSPROBE MIT COLLABORA ONLINE (CODE) — Nacharbeit 1, bens Befund 1.
// ================================================================================================
//
// Auftrag `produkt:20261007:office-machbarkeit`. Der reale technische Nachweis des gewählten Wegs C
// (Plan, Abschnitt 2): ein ECHTER Collabora-Editor (Container `collabora/code`) bearbeitet eine
// fiktive Word-Datei über den Klarwerk-Hostweg (`erstelleWopiHost`), eingebettet als iframe in eine
// Host-Seite, bedient in einem echten Chromium.
//
//   C1  Öffnen     Discovery lesen, Editor im iframe mit Zugangsmarke laden; der Editor ruft
//                  CheckFileInfo, GetFile und Lock am Hostweg und meldet „Document_Loaded".
//   C2  Ändern und Speichern
//                  Text einfügen, „Speichern" auslösen; der Editor schickt PutFile, der Hostweg
//                  legt den Arbeitsstand als neues Objekt ab, und die DOCX darin enthält den Text.
//   C3  Zwei Übernahmen derselben offenen Sitzung (bens Befund 2 im echten Editor): Fassung 2,
//                  dann nach einer zweiten Änderung Fassung 3 — kein KO_STALE gegen sich selbst.
//   C4  Schließen und Wiederöffnen
//                  Seite schließen; der Editor entsperrt (Sitzungsende). Neu öffnen mit frischer
//                  Marke: GetFile liefert das Objekt der übernommenen Fassung (3, oder 4, falls der
//                  Editor beim Schließen noch einmal speichert), und dessen Text enthält beide
//                  Änderungen. Die Ausgangsfassung liegt unverändert im Objektspeicher.
//
// UMFANG, AUSDRÜCKLICH BEGRENZT:
//   · Nur `.docx` (Word). Excel und PowerPoint laufen über denselben Hostweg, sind hier aber NICHT
//     geprüft.
//   · Geändert wird über die Nachrichtenschnittstelle des Editors (UNO-Befehl `InsertText` per
//     postMessage) und nicht per Tastatur; gespeichert über `Action_Save`.
//   · Der Artikel ist die `ArtikelAttrappe` (Plan U3 fehlt im Wissensobjektdienst); Rechte und
//     Sitzungen liegen im Arbeitsspeicher. Die Darstellungstreue wird nicht beurteilt.
//   · Das Abbild ist `collabora/code` (Entwicklungsausgabe, MPL 2.0; nur für Test). Ohne Docker,
//     ohne Netz zum Abbild oder ohne Chromium scheitert diese Datei am Start — das ist dann ein
//     fehlendes Prüfmittel, kein Befund am Hostweg.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { type Browser, type Page, chromium } from "playwright";
import { GenericContainer, type StartedTestContainer, TestContainers, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type OfficeRechte, stelleZugangsmarkeAus } from "../../services/app/src/office-wopi";
import {
  SpeicherWopiSitzungen,
  type WopiProtokolleintrag,
  erstelleWopiHost,
} from "../../services/app/src/office-wopi-host";
import { InMemoryObjectRepo, ObjectStore, decodeDataUrl } from "../../services/object-store";
import {
  ArtikelAttrappe,
  DOCX_MIME,
  type HostServer,
  docxText,
  fiktivesDocx,
  starteHostServer,
} from "./werkzeug";

/** Überschreibbar, damit ein Betreiber eine feste Fassung des Abbilds vorgeben kann. */
const ABBILD = process.env.KLARWERK_CODE_ABBILD ?? "collabora/code:latest";
const CODE_PORT = 9980;
const SCHLUESSEL = Buffer.alloc(32, 9);
const KO = "ko-office-probe";
const ANHANG = "anh-office-probe";
const AUSGANG = "Ausgangstext der fiktiven Probeanleitung.";
const AENDERUNG_1 = " KWPROBE-EINS";
const AENDERUNG_2 = " KWPROBE-ZWEI";
const RECHTE: OfficeRechte = {
  darfLesen: true,
  darfBearbeiten: true,
  darfFreigegebenesAendern: false,
};
const BILDER = join(process.cwd(), "test-results", "office-wopi-code");

// Die Seitenausdrücke stehen als Text: der Wurzel-tsc kennt keine DOM-Typen, und `window` in
// einer Testdatei wäre dort ein Typfehler. Ausgewertet werden sie im Chromium.
const DOKUMENT_GELADEN =
  "window.meldungen.some((m) => m && m.MessageId === 'App_LoadingStatus' && " +
  "m.Values && m.Values.Status === 'Document_Loaded')";

function sendeAusdruck(nachricht: unknown): string {
  return `window.sende(${JSON.stringify(nachricht)})`;
}

function attribute(tag: string): Record<string, string> {
  const werte: Record<string, string> = {};
  for (const [, name, wert] of tag.matchAll(/([A-Za-z_:-]+)="([^"]*)"/g)) {
    if (name !== undefined && wert !== undefined) {
      werte[name] = wert;
    }
  }
  return werte;
}

function html(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Die einbettende Seite — das WOPI-Muster: Formular-POST mit Marke in ein iframe. */
function hostSeite(editorUrl: string, editorUrsprung: string, marke: string, bis: number): string {
  return `<!doctype html><meta charset="utf-8"><title>Klarwerk Office-Probe</title>
<form id="f" method="post" target="editor" action="${html(editorUrl)}">
<input type="hidden" name="access_token" value="${html(marke)}">
<input type="hidden" name="access_token_ttl" value="${bis}">
</form>
<iframe name="editor" id="editor" style="width:1200px;height:800px;border:0"></iframe>
<script>
window.meldungen = [];
const ursprung = ${JSON.stringify(editorUrsprung)};
window.sende = (m) => document.getElementById("editor").contentWindow.postMessage(
  JSON.stringify(Object.assign({ SendTime: Date.now() }, m)), ursprung);
window.addEventListener("message", (e) => {
  if (e.origin !== ursprung) return;
  let m;
  try { m = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
  window.meldungen.push(m);
  if (m && m.MessageId === "App_LoadingStatus" && m.Values && m.Values.Status === "Frame_Ready") {
    window.sende({ MessageId: "Host_PostmessageReady" });
  }
});
document.getElementById("f").submit();
</script>`;
}

async function warteAuf(bedingung: () => boolean, ms: number, was: string): Promise<void> {
  const ende = Date.now() + ms;
  while (!bedingung()) {
    if (Date.now() > ende) {
      throw new Error(`Zeitüberschreitung (${ms} ms): ${was}`);
    }
    await new Promise((weiter) => setTimeout(weiter, 250));
  }
}

describe("Office im Artikel · CODE-Integrationsprobe (nur .docx)", { timeout: 600_000 }, () => {
  const objekte = new ObjectStore({ repo: new InMemoryObjectRepo() });
  const protokoll: (WopiProtokolleintrag & { at: number })[] = [];
  let artikel: ArtikelAttrappe;
  let host: ReturnType<typeof erstelleWopiHost>;
  let server: HostServer;
  let code: StartedTestContainer | undefined;
  let browser: Browser | undefined;
  let editorUrl = "";
  let editorUrsprung = "";

  const seit = (zeitpunkt: number): WopiProtokolleintrag[] =>
    protokoll.filter((e) => e.at >= zeitpunkt);

  async function textVonObjekt(objectId: string): Promise<string> {
    const gespeichert = await objekte.read(objectId);
    const bytes = gespeichert ? decodeDataUrl(gespeichert.data)?.bytes : undefined;
    if (!bytes) {
      throw new Error(`Objekt ${objectId} fehlt im Objektspeicher`);
    }
    return docxText(bytes);
  }

  async function oeffne(fassung: number, bild: string): Promise<Page> {
    const { marke, bis } = stelleZugangsmarkeAus(
      { koId: KO, anhangId: ANHANG, nutzerId: "probe-person", schreiben: true, fassung },
      SCHLUESSEL,
      Date.now(),
    );
    server.setzeSeite(hostSeite(editorUrl, editorUrsprung, marke, bis));
    if (!browser) {
      throw new Error("Chromium läuft nicht");
    }
    const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await seite.goto(`http://localhost:${server.port}/probe`);
    await seite.waitForFunction(DOKUMENT_GELADEN, undefined, { timeout: 180_000 });
    await seite.screenshot({ path: join(BILDER, bild) });
    return seite;
  }

  async function aendereUndSpeichere(seite: Page, text: string): Promise<string> {
    const ab = Date.now();
    const einfuegen = {
      MessageId: "Send_UNO_Command",
      Values: { Command: ".uno:InsertText", Args: { Text: { type: "string", value: text } } },
    };
    const speichern = {
      MessageId: "Action_Save",
      Values: { DontTerminateEdit: true, DontSaveIfUnmodified: false, Notify: true },
    };
    await seite.evaluate(sendeAusdruck(einfuegen));
    await seite.evaluate(sendeAusdruck(speichern));
    await warteAuf(
      () => seit(ab).some((e) => e.vorgang === "PutFile" && e.status === 200),
      120_000,
      "PutFile des Editors am Hostweg",
    );
    const put = seit(ab).find((e) => e.vorgang === "PutFile" && e.status === 200);
    if (!put?.objectId) {
      throw new Error("PutFile ohne Objektkennung");
    }
    return put.objectId;
  }

  beforeAll(async () => {
    mkdirSync(BILDER, { recursive: true });
    const start = await fiktivesDocx(AUSGANG);
    const ref = await objekte.put({
      name: "Probeanleitung.docx",
      mime: DOCX_MIME,
      data: `data:${DOCX_MIME};base64,${start.toString("base64")}`,
      purpose: "attachment",
    });
    artikel = new ArtikelAttrappe({
      koId: KO,
      version: 1,
      status: "offen",
      author: "autor-fiktiv",
      attachments: [
        {
          id: ANHANG,
          name: "Probeanleitung.docx",
          mime: DOCX_MIME,
          objectId: ref.id,
          // Unveränderte Objektspeicher-Metadaten wie in `ko-routes.ts` (Länge der Daten-URL);
          // die Dateigröße für den Editor misst der Hostweg selbst (Nacharbeit 2).
          size: ref.size,
        },
      ],
    });

    // Der Hostweg hinter node:http — auf allen Schnittstellen, damit der Container ihn erreicht.
    let seitenUrsprung = "";
    host = erstelleWopiHost({
      schluessel: SCHLUESSEL,
      jetzt: () => Date.now(),
      objekte,
      artikel,
      rechte: async () => RECHTE,
      nutzerName: async () => "Probeperson (fiktiv)",
      sitzungen: new SpeicherWopiSitzungen(),
      get postMessageOrigin() {
        return seitenUrsprung;
      },
      protokoll: (eintrag) => protokoll.push({ ...eintrag, at: Date.now() }),
    });
    server = await starteHostServer((anfrage) => host.bearbeite(anfrage));
    seitenUrsprung = `http://localhost:${server.port}`;
    await TestContainers.exposeHostPorts(server.port);

    const wopiHost = `http://host.testcontainers.internal:${server.port}`;
    const bereit = Wait.forHttp("/hosting/discovery", CODE_PORT).forStatusCode(200);
    const parameter = [
      "--o:ssl.enable=false",
      "--o:ssl.termination=false",
      `--o:net.frame_ancestors=${seitenUrsprung}`,
    ].join(" ");
    code = await new GenericContainer(ABBILD)
      .withEnvironment({ aliasgroup1: wopiHost, DONT_GEN_SSL_CERT: "1", extra_params: parameter })
      .withExposedPorts(CODE_PORT)
      .withWaitStrategy(bereit.withStartupTimeout(300_000))
      .start();
    editorUrsprung = `http://${code.getHost()}:${code.getMappedPort(CODE_PORT)}`;

    // Discovery: die Aktion „edit" für .docx. Ihr Pfad wird an die von außen erreichbare Herkunft
    // gehängt — der Editor kennt im Container nur seinen inneren Port.
    const xml = await (await fetch(`${editorUrsprung}/hosting/discovery`)).text();
    const aktion = [...xml.matchAll(/<action\s[^>]*>/g)]
      .map((treffer) => attribute(treffer[0]))
      .find((a) => a.ext === "docx" && a.name === "edit");
    if (!aktion?.urlsrc) {
      throw new Error("Discovery nennt keine edit-Aktion für .docx");
    }
    const pfad = new URL(aktion.urlsrc).pathname;
    const wopiSrc = encodeURIComponent(`${wopiHost}/wopi/files/${ANHANG}`);
    editorUrl = `${editorUrsprung}${pfad}?WOPISrc=${wopiSrc}`;

    browser = await chromium.launch({ headless: true });
  }, 600_000);

  afterAll(async () => {
    await browser?.close();
    await code?.stop();
    await server?.schliesse();
  });

  let seite: Page;

  it("C1: Öffnen — Editor lädt die fiktive DOCX über CheckFileInfo, GetFile und Lock", async () => {
    const ab = Date.now();
    seite = await oeffne(1, "01-geoeffnet.png");
    const vorgaenge = seit(ab).map((e) => `${e.vorgang}:${e.status}`);
    expect(vorgaenge).toContain("CheckFileInfo:200");
    expect(vorgaenge).toContain("GetFile:200");
    expect(vorgaenge).toContain("LOCK:200");
  });

  it("C2: Ändern und Speichern — PutFile legt den Arbeitsstand mit der Änderung ab", async () => {
    const objekt = await aendereUndSpeichere(seite, AENDERUNG_1);
    const text = await textVonObjekt(objekt);
    expect(text).toContain("KWPROBE-EINS");
    expect(text).toContain("Ausgangstext der fiktiven Probeanleitung");
    expect(artikel.stand.version).toBe(1);
    await seite.screenshot({ path: join(BILDER, "02-geaendert-gespeichert.png") });
  });

  it("C3: zwei Übernahmen derselben offenen Sitzung — Fassung 2, dann 3", async () => {
    expect(await host.uebernimm(ANHANG, KO, "probe-person")).toEqual({
      art: "uebernommen",
      version: 2,
    });
    await aendereUndSpeichere(seite, AENDERUNG_2);
    expect(await host.uebernimm(ANHANG, KO, "probe-person")).toEqual({
      art: "uebernommen",
      version: 3,
    });
    expect(artikel.stand.status).toBe("offen");
  });

  it("C4: Schließen und Wiederöffnen — GetFile liefert die übernommene Fassung", async () => {
    const zu = Date.now();
    await seite.close();
    await warteAuf(
      () => seit(zu).some((e) => e.vorgang === "UNLOCK" && e.status === 200),
      180_000,
      "UNLOCK des Editors nach dem Schließen",
    );
    // Fassung 3 — oder 4, falls der Editor beim Schließen noch einmal gespeichert hat und das
    // Entsperren diesen Stand übernommen hat (Plan 5.1). Kleiner als 3 ist sie nie.
    expect(artikel.stand.version).toBeGreaterThanOrEqual(3);
    const aktuell = artikel.stand.attachments[0]?.objectId;
    expect(aktuell).toBeDefined();
    const ab = Date.now();
    const wieder = await oeffne(artikel.stand.version, "03-wiedergeoeffnet.png");
    const gelesen = seit(ab).find((e) => e.vorgang === "GetFile" && e.status === 200);
    expect(gelesen?.objectId).toBe(aktuell);
    const text = await textVonObjekt(aktuell ?? "");
    expect(text).toContain("KWPROBE-EINS");
    expect(text).toContain("KWPROBE-ZWEI");
    // Rückweg: die Ausgangsfassung liegt unverändert im Objektspeicher.
    expect(await textVonObjekt(artikel.fassungen[0]?.objectId ?? "")).toBe(AUSGANG);
    await wieder.close();
  });
});
