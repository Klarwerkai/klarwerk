// ================================================================================================
// KLARA 11 (produkt:20261008:klara-kalender, AW-17) · MICROSOFT-365-ANBIETER GEGEN DEN GRAPH-VERTRAG.
// ================================================================================================
//
// Geprüft wird, WAS der Adapter an Microsoft Graph schicken würde und WIE er Antworten liest — über
// ein `fetch`-Double. KEIN Testfall verlässt den Prozess. Das ist ausdrücklich KEIN Nachweis gegen
// einen echten Microsoft-365-Testkalender (Anbieterzugang, Lizenz, Scopes und Mandant stehen aus).
// Ausschließlich fiktive Prüfdaten.
//
//   K1/AW17-K01  Konto/Kalender aus `/me` und `/me/calendars`; Anlegen mit Vorgangsschlüssel
//                (`transactionId` + erweiterte Eigenschaft); Ändern/Löschen nur mit `If-Match`.
//   K2/AW17-K07  Teilnehmer gehen nur hinaus, wenn sie übergeben werden; Rechte je Kalender getrennt.
//   K3           401 → abgelaufen, 403 → Recht fehlt, 5xx/Netz/Frist → ausgefallen; kein fremder Text.
//   P07-AC06     Serie, Vorkommen und Einzeltermin werden aus `type`/`seriesMasterId` gelesen.
import { describe, expect, it } from "vitest";
import {
  KalenderAnbieterFehler,
  anbieterFehlerlage,
} from "../../services/app/src/klara-kalender-anbindung";
import {
  M365KalenderAnbieter,
  M365_VORGANG_EIGENSCHAFT,
  ausGraph,
  kalenderAnbieterAusEnv,
  m365Lage,
  nachGraph,
} from "../../services/app/src/klara-kalender-m365";

const BASIS = "https://graph.microsoft.com/v1.0";
const ZUGANG = "fiktiver-zugang-0000";

interface Aufruf {
  url: string;
  methode: string;
  kopf: Record<string, string>;
  koerper: unknown;
}

function antwort(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Ein `fetch`-Double: beantwortet je Aufruf die nächste vorbereitete Antwort und merkt sich alles. */
function double(antworten: (Response | Error)[]) {
  const aufrufe: Aufruf[] = [];
  const fetchFn = (async (url: string | URL | Request, init?: RequestInit) => {
    aufrufe.push({
      url: String(url),
      methode: init?.method ?? "GET",
      kopf: (init?.headers ?? {}) as Record<string, string>,
      koerper: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    });
    expect(init?.redirect).toBe("error");
    const naechste = antworten.shift();
    if (!naechste) {
      throw new Error("keine Antwort vorbereitet");
    }
    if (naechste instanceof Error) {
      throw naechste;
    }
    return naechste;
  }) as typeof fetch;
  return { aufrufe, fetchFn };
}

function anbieter(antworten: (Response | Error)[], zugang: string | null = ZUGANG) {
  const d = double(antworten);
  const a = new M365KalenderAnbieter({
    baseUrl: BASIS,
    zugang: async () => zugang,
    fetchFn: d.fetchFn,
    timeoutMs: 1_000,
  });
  return { a, aufrufe: d.aufrufe };
}

const ME = {
  id: "obj-ada-0001",
  displayName: "Ada Testperson",
  userPrincipalName: "ada@klarwerk-test.example",
};

const EREIGNIS = {
  id: "AAMk-ext-1",
  "@odata.etag": 'W/"etag-1"',
  changeKey: "ck-1",
  subject: "Wartung Presse 4 prüfen",
  body: { contentType: "text", content: "Ölstand und Filter" },
  start: { dateTime: "2026-10-20T07:00:00.0000000", timeZone: "UTC" },
  end: { dateTime: "2026-10-20T07:30:00.0000000", timeZone: "UTC" },
  location: { displayName: "Halle B" },
  attendees: [
    {
      emailAddress: { address: "erik@klarwerk-test.example", name: "Erik Prüfer" },
      status: { response: "tentativelyAccepted" },
    },
  ],
  organizer: { emailAddress: { address: "ada@klarwerk-test.example" } },
  type: "singleInstance",
  seriesMasterId: null,
  isCancelled: false,
  singleValueExtendedProperties: [{ id: M365_VORGANG_EIGENSCHAFT, value: "kk-abc" }],
};

describe("K1 · Konto und Kalender aus Graph – mit getrennten Rechten", () => {
  it("liest Konto und unterscheidet eigenen und geteilten Kalender", async () => {
    const { a, aufrufe } = anbieter([
      antwort(200, ME),
      antwort(200, {
        value: [
          {
            id: "kal-eigen",
            name: "Kalender",
            canEdit: true,
            owner: { address: "ADA@klarwerk-test.example" },
          },
          {
            id: "kal-team",
            name: "Team Wartung",
            canEdit: true,
            owner: { address: "team@klarwerk-test.example" },
          },
          {
            id: "kal-feiertage",
            name: "Feiertage",
            canEdit: false,
            owner: { address: "feiertage@klarwerk-test.example" },
          },
        ],
      }),
    ]);
    const konto = await a.konto();
    expect(konto).toEqual({
      kennung: "obj-ada-0001",
      anzeige: "Ada Testperson",
      adresse: "ada@klarwerk-test.example",
    });
    const kalender = await a.kalender();
    expect(kalender.map((k) => [k.id, k.art, k.rechte])).toEqual([
      [
        "kal-eigen",
        "eigen",
        { lesen: true, eigeneSchreiben: true, geteiltBearbeiten: false, einladen: true },
      ],
      [
        "kal-team",
        "geteilt",
        { lesen: true, eigeneSchreiben: false, geteiltBearbeiten: true, einladen: true },
      ],
      [
        "kal-feiertage",
        "geteilt",
        { lesen: true, eigeneSchreiben: false, geteiltBearbeiten: false, einladen: false },
      ],
    ]);
    expect(aufrufe[0]?.url).toMatch(/^https:\/\/graph\.microsoft\.com\/v1\.0\/me\?/);
    expect(aufrufe[1]?.url).toMatch(/^https:\/\/graph\.microsoft\.com\/v1\.0\/me\/calendars\?/);
    expect(aufrufe[0]?.kopf.authorization).toBe(`Bearer ${ZUGANG}`);
  });
});

describe("K1 · AW17-K01 · Anlegen, Lesen, Ändern, Löschen am Graph-Vertrag", () => {
  it("Anlegen trägt den Vorgangsschlüssel als transactionId und als erweiterte Eigenschaft", async () => {
    const { a, aufrufe } = anbieter([antwort(201, EREIGNIS)]);
    const t = await a.lege(
      "kal-eigen",
      {
        titel: "Wartung Presse 4 prüfen",
        beginn: "2026-10-20T09:00:00",
        ende: "2026-10-20T09:30:00",
        zeitzone: "Europe/Berlin",
      },
      "kk-abc",
    );
    const r = aufrufe[0];
    expect(r?.methode).toBe("POST");
    expect(r?.url).toBe(`${BASIS}/me/calendars/kal-eigen/events`);
    expect(r?.koerper).toEqual({
      subject: "Wartung Presse 4 prüfen",
      start: { dateTime: "2026-10-20T09:00:00", timeZone: "Europe/Berlin" },
      end: { dateTime: "2026-10-20T09:30:00", timeZone: "Europe/Berlin" },
      transactionId: "kk-abc",
      singleValueExtendedProperties: [{ id: M365_VORGANG_EIGENSCHAFT, value: "kk-abc" }],
    });
    // Ohne übergebene Teilnehmer steht im Körper keine Teilnehmerliste.
    expect(r?.koerper).not.toHaveProperty("attendees");
    expect(t).toMatchObject({ id: "AAMk-ext-1", version: 'W/"etag-1"', vorgang: "kk-abc" });
  });

  it("Ändern und Löschen senden If-Match mit der gelesenen Fassung", async () => {
    const { a, aufrufe } = anbieter([antwort(200, EREIGNIS), antwort(204)]);
    await a.aendere("kal-eigen", "AAMk-ext-1", { ort: "Halle C" }, 'W/"etag-1"');
    await a.loesche("kal-eigen", "AAMk-ext-1", 'W/"etag-2"');
    expect(aufrufe.map((x) => [x.methode, x.kopf["if-match"]])).toEqual([
      ["PATCH", 'W/"etag-1"'],
      ["DELETE", 'W/"etag-2"'],
    ]);
    expect(aufrufe[0]?.koerper).toEqual({ location: { displayName: "Halle C" } });
    expect(aufrufe[1]?.url).toBe(`${BASIS}/me/calendars/kal-eigen/events/AAMk-ext-1`);
  });

  it("Nacharbeit 1: ohne Fassung kein PATCH und kein DELETE — es geht gar kein Aufruf hinaus", async () => {
    const { a, aufrufe } = anbieter([]);
    await expect(a.loesche("kal-eigen", "AAMk-serie", "")).rejects.toMatchObject({
      lage: "version_geaendert",
    });
    await expect(a.aendere("kal-eigen", "AAMk-ext-1", { ort: "x" }, "")).rejects.toMatchObject({
      lage: "version_geaendert",
    });
    expect(aufrufe).toHaveLength(0);
  });

  it("412 beim DELETE (Serie inzwischen geändert) ist `version_geaendert`, kein Erfolg", async () => {
    const { a, aufrufe } = anbieter([
      antwort(412, { error: { code: "ErrorIrresolvableConflict" } }),
    ]);
    await expect(a.loesche("kal-eigen", "AAMk-serie", 'W/"master-v1"')).rejects.toMatchObject({
      lage: "version_geaendert",
    });
    expect(aufrufe[0]?.kopf["if-match"]).toBe('W/"master-v1"');
  });

  it("Lesen fragt den Zeitraum über calendarView, Beschreibung als Text", async () => {
    const { a, aufrufe } = anbieter([antwort(200, { value: [EREIGNIS] })]);
    const termine = await a.liesZeitraum(
      "kal-eigen",
      "2026-10-20T00:00:00Z",
      "2026-10-21T00:00:00Z",
    );
    expect(termine).toHaveLength(1);
    const url = new URL(aufrufe[0]?.url ?? "");
    expect(url.pathname).toBe("/v1.0/me/calendars/kal-eigen/calendarView");
    expect(url.searchParams.get("startDateTime")).toBe("2026-10-20T00:00:00Z");
    expect(aufrufe[0]?.kopf.prefer).toBe('outlook.body-content-type="text"');
  });

  it("ein gelöschtes Ereignis liest sich als `null`, nicht als Fehler", async () => {
    const { a } = anbieter([antwort(404, { error: { code: "ErrorItemNotFound" } })]);
    expect(await a.hole("kal-eigen", "AAMk-weg")).toBeNull();
  });

  it("sucheVorgang filtert nach der erweiterten Eigenschaft und nimmt nur sichere Schlüssel", async () => {
    const { a, aufrufe } = anbieter([antwort(200, { value: [EREIGNIS] })]);
    expect((await a.sucheVorgang("kal-eigen", "kk-abc"))?.id).toBe("AAMk-ext-1");
    const filter = new URL(aufrufe[0]?.url ?? "").searchParams.get("$filter") ?? "";
    expect(filter).toContain(M365_VORGANG_EIGENSCHAFT);
    expect(filter).toContain("ep/value eq 'kk-abc'");
    // Ein Schlüssel mit Anführungszeichen wird nicht in einen Filter geschrieben.
    expect(await a.sucheVorgang("kal-eigen", "x' or 1 eq 1")).toBeNull();
    expect(aufrufe).toHaveLength(1);
  });
});

describe("K2 · AW17-K07 · Teilnehmer nur, wenn übergeben", () => {
  it("nachGraph übernimmt genau die übergebenen Felder", () => {
    expect(nachGraph({ titel: "A" })).toEqual({ subject: "A" });
    expect(
      nachGraph({
        teilnehmer: [{ adresse: "erik@klarwerk-test.example", name: "Erik", antwort: "offen" }],
      }),
    ).toEqual({
      attendees: [
        { emailAddress: { address: "erik@klarwerk-test.example", name: "Erik" }, type: "required" },
      ],
    });
  });

  it("Teilnehmer, Antwort und Organisator werden gelesen", () => {
    const t = ausGraph(EREIGNIS, "kal-eigen");
    expect(t.teilnehmer).toEqual([
      { adresse: "erik@klarwerk-test.example", name: "Erik Prüfer", antwort: "vorbehalt" },
    ]);
    expect(t.organisator).toBe("ada@klarwerk-test.example");
  });
});

describe("P07-AC06 · Serie, Vorkommen, Einzeltermin", () => {
  it("liest die Serienart aus type und seriesMasterId", () => {
    expect(ausGraph({ ...EREIGNIS, type: "seriesMaster" }, "k").serienart).toBe("serie");
    const v = ausGraph({ ...EREIGNIS, type: "occurrence", seriesMasterId: "AAMk-serie" }, "k");
    expect([v.serienart, v.serienId]).toEqual(["vorkommen", "AAMk-serie"]);
    expect(ausGraph({ ...EREIGNIS, type: "exception" }, "k").serienart).toBe("vorkommen");
    expect(ausGraph(EREIGNIS, "k").serienart).toBe("einzel");
    expect(ausGraph({ ...EREIGNIS, isCancelled: true }, "k").abgesagt).toBe(true);
  });
});

describe("K3 · Fehlerlagen ohne falschen Erfolg und ohne fremden Text", () => {
  const LAGEN: [number, string][] = [
    [401, "verbindung_abgelaufen"],
    [403, "recht_fehlt"],
    [404, "nicht_gefunden"],
    [410, "nicht_gefunden"],
    [409, "version_geaendert"],
    [412, "version_geaendert"],
    [429, "anbieter_ausgefallen"],
    [503, "anbieter_ausgefallen"],
  ];
  it.each(LAGEN)("HTTP %i → %s", (status, lage) => {
    expect(m365Lage(status)).toBe(lage);
  });

  it("403 beim Anlegen ist „Recht fehlt“ – ohne Text der Gegenstelle, ohne Zugang", async () => {
    const { a } = anbieter([
      antwort(403, { error: { message: `geheim ${ZUGANG} https://intern.example` } }),
    ]);
    const fehler = await a.lege("kal-eigen", { titel: "x" }, "kk-abc").catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(KalenderAnbieterFehler);
    expect(anbieterFehlerlage(fehler)).toBe("recht_fehlt");
    expect(String((fehler as Error).message)).not.toContain(ZUGANG);
    expect(String((fehler as Error).message)).not.toMatch(/https?:/);
  });

  it("ohne Zugang aus der Betreiber-Einspeisung: abgelaufen, und es geht kein Aufruf hinaus", async () => {
    const { a, aufrufe } = anbieter([], null);
    await expect(a.konto()).rejects.toMatchObject({ lage: "verbindung_abgelaufen" });
    expect(aufrufe).toHaveLength(0);
  });

  it("Netzfehler und unlesbare Antwort: ausgefallen", async () => {
    const netz = anbieter([new TypeError("fetch failed")]);
    await expect(netz.a.konto()).rejects.toMatchObject({ lage: "anbieter_ausgefallen" });
    const kaputt = anbieter([new Response("kein json", { status: 200 })]);
    await expect(kaputt.a.konto()).rejects.toMatchObject({ lage: "anbieter_ausgefallen" });
  });

  it("Betreiber-Einspeisung: nur vollständig, nur https, nur für genannte unveränderliche Konto-IDs", () => {
    const voll = {
      KLARWERK_KALENDER_M365_BASE_URL: BASIS,
      KLARWERK_KALENDER_M365_TOKEN: ZUGANG,
      KLARWERK_KALENDER_M365_KONTO_IDS: "konto-Ada, konto-Erik",
    };
    const e = kalenderAnbieterAusEnv(voll);
    expect(e?.fuer("konto-Ada")).toBeInstanceOf(M365KalenderAnbieter);
    expect(e?.fuer("konto-Erik")).toBeInstanceOf(M365KalenderAnbieter);
    expect(e?.fuer("vera@klarwerk-test.example")).toBeNull();
    expect(e?.fuer(undefined)).toBeNull();
    for (const fehlt of Object.keys(voll)) {
      expect(kalenderAnbieterAusEnv({ ...voll, [fehlt]: "" }), fehlt).toBeUndefined();
    }
    expect(
      kalenderAnbieterAusEnv({ ...voll, KLARWERK_KALENDER_M365_BASE_URL: "http://graph.test" }),
    ).toBeUndefined();
    // Der Zugang verlässt die Fabrik nicht als Wert.
    expect(JSON.stringify(e)).not.toContain(ZUGANG);
  });

  it("nur https: eine http-Basisadresse wird abgewiesen", () => {
    const http = () =>
      new M365KalenderAnbieter({
        baseUrl: "http://graph.microsoft.com/v1.0",
        zugang: async () => ZUGANG,
      });
    expect(http).toThrow(KalenderAnbieterFehler);
  });
});
