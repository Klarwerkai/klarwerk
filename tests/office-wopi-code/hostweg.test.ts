// ================================================================================================
// OFFICE IM ARTIKEL · DER WOPI-HOSTWEG ÜBER HTTP, OHNE EDITOR (Nacharbeit 1).
// ================================================================================================
//
// Auftrag `produkt:20261007:office-machbarkeit`. Geprüft wird `erstelleWopiHost` hinter einem
// echten `node:http`-Server, angesprochen mit `fetch` so, wie ein WOPI-Editor ihn anspricht
// (Pfad, `access_token` in der Abfrage, `X-WOPI-*`-Kopfzeilen, Dateikörper). Ein Editor läuft
// hier NICHT — das tut `code-probe.integration.test.ts`. Diese Datei hält die Regeln fest, die
// auch ohne Docker messbar sind, vor allem bens Befund 2 (Sitzungsbasis):
//
//   H1  CheckFileInfo und GetFile über den Hostweg.
//   H2  Sperren, Speichern, Arbeitsstand: GetFile liefert danach den Arbeitsstand.
//   H3  Zwei EIGENE Übernahmen derselben Sitzung nacheinander: Fassung 2, dann 3 — kein KO_STALE.
//   H4  Ein zweiter Teilnehmer tritt mit älterer Marke bei: die Basis bleibt, seine Übernahme
//       gelingt.
//   H5  Fremde Änderung außerhalb der Sitzung: Konflikt, die Basis wird NICHT nachgezogen — auch
//       beim zweiten Versuch nicht.
//   H6  Entsperren beendet die Sitzung; ein offener Arbeitsstand mit Konflikt wird protokolliert,
//       nicht übernommen. Neue Sitzung nur mit aktueller Marke.
//   H7  Entsperren mit offenem Arbeitsstand ohne Konflikt übernimmt ihn als Fassung.
//   H8  Entzogenes Bearbeitungsrecht wirkt ab der nächsten Anfrage, auch mit Schreibmarke.
//   H9  Ohne oder mit fremder Marke: 401.
//   H10 (Nacharbeit 2, bens Befund) CheckFileInfo.Size ist die Länge des GetFile-Inhalts — für einen
//       Anhang mit unveränderten Objektspeicher-Metadaten (`size` = Länge der Daten-URL), für
//       Altbestand ohne `size` und für den Arbeitsstand einer Sitzung (H2). Die Übernahme schreibt
//       weiter die Speichergröße nach Objektspeicher-Konvention in den Anhang (H3).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type OfficeRechte, stelleZugangsmarkeAus } from "../../services/app/src/office-wopi";
import {
  SpeicherWopiSitzungen,
  type WopiProtokolleintrag,
  erstelleWopiHost,
} from "../../services/app/src/office-wopi-host";
import { InMemoryObjectRepo, ObjectStore } from "../../services/object-store";
import {
  ArtikelAttrappe,
  DOCX_MIME,
  type HostServer,
  docxText,
  fiktivesDocx,
  starteHostServer,
} from "./werkzeug";

const SCHLUESSEL = Buffer.alloc(32, 3);
const ANHANG = "anh-probe-1";
const ANHANG_ALT = "anh-probe-alt";
const KO = "ko-probe-1";
const ALLE_RECHTE: OfficeRechte = {
  darfLesen: true,
  darfBearbeiten: true,
  darfFreigegebenesAendern: false,
};

describe("WOPI-Hostweg über HTTP", () => {
  const uhr = { jetzt: Date.UTC(2026, 9, 7, 12, 0, 0) };
  const objekte = new ObjectStore({ repo: new InMemoryObjectRepo() });
  const protokoll: WopiProtokolleintrag[] = [];
  let rechte: OfficeRechte = ALLE_RECHTE;
  let artikel: ArtikelAttrappe;
  let server: HostServer;
  let host: ReturnType<typeof erstelleWopiHost>;

  let startDateigroesse = 0;
  let startSpeichergroesse = 0;

  const markeFuer = (anhangId: string, nutzerId: string, fassung: number): string =>
    stelleZugangsmarkeAus(
      { koId: KO, anhangId, nutzerId, schreiben: true, fassung },
      SCHLUESSEL,
      uhr.jetzt,
    ).marke;
  const marke = (nutzerId: string, fassung: number): string => markeFuer(ANHANG, nutzerId, fassung);

  /** `Size` aus CheckFileInfo neben der Länge dessen, was GetFile tatsächlich ausliefert. */
  async function groessen(
    anhangId: string,
    zugang: string,
  ): Promise<{ size: number; getFile: number }> {
    const pfad = `/wopi/files/${anhangId}`;
    const info = (await (await rufe("GET", pfad, zugang)).json()) as { Size: number };
    const geliefert = await (await rufe("GET", `${pfad}/contents`, zugang)).arrayBuffer();
    return { size: info.Size, getFile: geliefert.byteLength };
  }

  async function rufe(
    methode: "GET" | "POST",
    pfad: string,
    zugang: string | undefined,
    kopf: Record<string, string> = {},
    koerper?: Buffer,
  ): Promise<Response> {
    const abfrage = zugang === undefined ? "" : `?access_token=${encodeURIComponent(zugang)}`;
    return fetch(`http://127.0.0.1:${server.port}${pfad}${abfrage}`, {
      method: methode,
      headers: kopf,
      ...(koerper === undefined ? {} : { body: koerper }),
    });
  }

  const datei = `/wopi/files/${ANHANG}`;
  const inhalt = `${datei}/contents`;
  const sperre = (zugang: string, override: string, lock: string): Promise<Response> =>
    rufe("POST", datei, zugang, { "X-WOPI-Override": override, "X-WOPI-Lock": lock });
  const speichere = async (zugang: string, lock: string, text: string): Promise<Response> => {
    const kopf = { "X-WOPI-Override": "PUT", "X-WOPI-Lock": lock };
    return rufe("POST", inhalt, zugang, kopf, await fiktivesDocx(text));
  };
  const uebernimm = (nutzerId: string) => host.uebernimm(ANHANG, KO, nutzerId);

  beforeAll(async () => {
    const start = await fiktivesDocx("Ausgangstext der fiktiven Anleitung");
    const ref = await objekte.put({
      name: "Anleitung.docx",
      mime: DOCX_MIME,
      data: `data:${DOCX_MIME};base64,${start.toString("base64")}`,
      purpose: "attachment",
    });
    startDateigroesse = start.length;
    startSpeichergroesse = ref.size;
    const alt = await fiktivesDocx("Altbestand ohne Groessenangabe");
    const altRef = await objekte.put({
      name: "Altbestand.docx",
      mime: DOCX_MIME,
      data: `data:${DOCX_MIME};base64,${alt.toString("base64")}`,
      purpose: "attachment",
    });
    artikel = new ArtikelAttrappe({
      koId: KO,
      version: 1,
      status: "offen",
      author: "autor-fiktiv",
      attachments: [
        // Die Metadaten genau so, wie `ko-routes.ts` sie anlegt: `size` ist `stored.size` aus dem
        // Objektspeicher (Länge der Daten-URL) — nicht die Dateigröße (bens Befund, Nacharbeit 2).
        {
          id: ANHANG,
          name: "Anleitung.docx",
          mime: DOCX_MIME,
          objectId: ref.id,
          size: ref.size,
        },
        // Altbestand: ein Anhang ganz ohne `size`.
        { id: ANHANG_ALT, name: "Altbestand.docx", mime: DOCX_MIME, objectId: altRef.id },
      ],
    });
    host = erstelleWopiHost({
      schluessel: SCHLUESSEL,
      jetzt: () => uhr.jetzt,
      objekte,
      artikel,
      rechte: async () => rechte,
      nutzerName: async (id) => `Testperson ${id}`,
      sitzungen: new SpeicherWopiSitzungen(),
      protokoll: (eintrag) => protokoll.push(eintrag),
    });
    server = await starteHostServer((anfrage) => host.bearbeite(anfrage));
  });

  afterAll(async () => {
    await server?.schliesse();
  });

  it("H9: ohne Marke oder mit der Marke eines anderen Anhangs → 401", async () => {
    expect((await rufe("GET", datei, undefined)).status).toBe(401);
    const fremd = stelleZugangsmarkeAus(
      { koId: KO, anhangId: "anderer", nutzerId: "a", schreiben: true, fassung: 1 },
      SCHLUESSEL,
      uhr.jetzt,
    ).marke;
    expect((await rufe("GET", datei, fremd)).status).toBe(401);
  });

  it("H1: CheckFileInfo und GetFile liefern Anhang und Ausgangsinhalt", async () => {
    const info = await rufe("GET", datei, marke("nutzer-a", 1));
    expect(info.status).toBe(200);
    expect(await info.json()).toMatchObject({
      BaseFileName: "Anleitung.docx",
      UserCanWrite: true,
      SupportsLocks: true,
      UserFriendlyName: "Testperson nutzer-a",
    });
    const datei1 = await rufe("GET", inhalt, marke("nutzer-a", 1));
    expect(datei1.status).toBe(200);
    expect(await docxText(Buffer.from(await datei1.arrayBuffer()))).toBe(
      "Ausgangstext der fiktiven Anleitung",
    );
  });

  it("H10: CheckFileInfo.Size = Länge des GetFile-Inhalts", async () => {
    // Vorbedingung: die Speichergröße am Anhang ist wirklich NICHT die Dateigröße — sonst wäre
    // dieser Fall keine Gegenprobe zu bens Befund.
    expect(startSpeichergroesse).toBeGreaterThan(startDateigroesse);

    const anleitung = await groessen(ANHANG, marke("nutzer-a", 1));
    expect(anleitung.getFile).toBe(startDateigroesse);
    expect(anleitung.size).toBe(anleitung.getFile);

    // Altbestand ohne `size`: früher 0, jetzt die gemessene Länge.
    const altbestand = await groessen(ANHANG_ALT, markeFuer(ANHANG_ALT, "nutzer-a", 1));
    expect(altbestand.getFile).toBeGreaterThan(0);
    expect(altbestand.size).toBe(altbestand.getFile);
  });

  it("H2: Sperren und Speichern legen einen Arbeitsstand an, GetFile liefert ihn", async () => {
    const a = marke("nutzer-a", 1);
    expect((await sperre(a, "LOCK", "sitzung-1")).status).toBe(200);
    expect((await speichere(a, "sitzung-1", "Stand A1")).status).toBe(200);
    const gelesen = await rufe("GET", inhalt, a);
    expect(await docxText(Buffer.from(await gelesen.arrayBuffer()))).toBe("Stand A1");
    // Noch keine Fassung: Speichern ist Arbeitsstand, nicht Übernahme.
    expect(artikel.stand.version).toBe(1);
    // H10 für den Arbeitsstand: Size misst die Bytes, die GetFile in der Sitzung ausliefert.
    const stand = await groessen(ANHANG, a);
    expect(stand.size).toBe(stand.getFile);
  });

  it("H3: zwei eigene Übernahmen derselben Sitzung — Fassung 2, dann 3, kein KO_STALE", async () => {
    const a = marke("nutzer-a", 1);
    expect(await uebernimm("nutzer-a")).toEqual({ art: "uebernommen", version: 2 });
    expect((await speichere(a, "sitzung-1", "Stand A2")).status).toBe(200);
    expect(await uebernimm("nutzer-a")).toEqual({ art: "uebernommen", version: 3 });
    expect(artikel.stand.status).toBe("offen");
    // Versionsrückweg: jede Fassung hat ihr eigenes Objekt, das alte bleibt lesbar.
    const objekte2 = artikel.fassungen.map((f) => f.objectId);
    expect(new Set(objekte2).size).toBe(3);
    const fassung2 = await objekte.read(artikel.fassungen[1]?.objectId ?? "");
    expect(fassung2?.data.startsWith(`data:${DOCX_MIME};base64,`)).toBe(true);
    // Die Übernahme schreibt die Speichergröße nach Objektspeicher-Konvention in den Anhang —
    // dieselbe Angabe, die `ko-routes.ts` aus `stored.size` übernimmt.
    const anhang = artikel.stand.attachments.find((x) => x.id === ANHANG);
    const gespeichert = await objekte.metadata(anhang?.objectId ?? "");
    expect(anhang?.size).toBe(gespeichert?.size);
  });

  it("H4: ein zweiter Teilnehmer mit älterer Marke tritt bei, die Basis bleibt", async () => {
    // Seine Marke trägt die Öffnungsfassung 1; die Sitzung steht auf Basis 3.
    const b = marke("nutzer-b", 1);
    expect((await sperre(b, "REFRESH_LOCK", "sitzung-1")).status).toBe(200);
    expect((await speichere(b, "sitzung-1", "Stand B1")).status).toBe(200);
    expect(await uebernimm("nutzer-b")).toEqual({ art: "uebernommen", version: 4 });
  });

  it("H5: fremde Änderung → Konflikt; die Basis wird nicht still nachgezogen", async () => {
    const a = marke("nutzer-a", 1);
    artikel.fremdeAenderung(); // Fassung 5, außerhalb der Sitzung
    expect((await speichere(a, "sitzung-1", "Stand A3")).status).toBe(200);
    const konflikt = { art: "fremde-aenderung", basisFassung: 4, artikelFassung: 5 };
    expect(await uebernimm("nutzer-a")).toEqual(konflikt);
    expect(await uebernimm("nutzer-a")).toEqual(konflikt);
    expect(artikel.stand.version).toBe(5);
  });

  it("H6: Entsperren beendet die Sitzung; neue Sitzung nur mit aktueller Marke", async () => {
    const a = marke("nutzer-a", 1);
    const vorher = protokoll.length;
    expect((await sperre(a, "UNLOCK", "sitzung-1")).status).toBe(200);
    expect(protokoll.slice(vorher)).toContainEqual(
      expect.objectContaining({ vorgang: "Uebernahme beim Ende: fremde-aenderung", status: 409 }),
    );
    expect(artikel.stand.version).toBe(5);
    // Die alte Marke (Öffnungsfassung 1) beginnt keine neue Sitzung.
    const alt = await sperre(a, "LOCK", "sitzung-2");
    expect(alt.status).toBe(409);
    expect(alt.headers.get("X-WOPI-LockFailureReason")).toContain("Fassung 5");
    expect((await sperre(marke("nutzer-a", 5), "LOCK", "sitzung-2")).status).toBe(200);
  });

  it("H7: Entsperren mit offenem Arbeitsstand ohne Konflikt übernimmt ihn", async () => {
    const a = marke("nutzer-a", 5);
    expect((await speichere(a, "sitzung-2", "Stand beim Schliessen")).status).toBe(200);
    expect((await sperre(a, "UNLOCK", "sitzung-2")).status).toBe(200);
    expect(artikel.stand.version).toBe(6);
    // Wiederöffnen: GetFile liefert den übernommenen Stand der neuen Fassung.
    const wieder = await rufe("GET", inhalt, marke("nutzer-a", 6));
    expect(await docxText(Buffer.from(await wieder.arrayBuffer()))).toBe("Stand beim Schliessen");
  });

  it("H8: entzogenes Bearbeitungsrecht wirkt ab der nächsten Anfrage", async () => {
    const a = marke("nutzer-a", 6);
    expect((await sperre(a, "LOCK", "sitzung-3")).status).toBe(200);
    rechte = { ...ALLE_RECHTE, darfBearbeiten: false };
    try {
      expect((await speichere(a, "sitzung-3", "darf nicht")).status).toBe(401);
      const info = await (await rufe("GET", datei, a)).json();
      expect(info).toMatchObject({ UserCanWrite: false, ReadOnly: true });
    } finally {
      rechte = ALLE_RECHTE;
    }
  });
});
