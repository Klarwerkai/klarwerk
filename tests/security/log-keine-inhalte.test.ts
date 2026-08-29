import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ERR_OHNE_CODE,
  ERR_TEXT_UNTERDRUECKT,
  ERR_UNBEKANNT,
  LOG_STANDARDSTUFE,
  baueLoggerOptionen,
  buildApp,
  buildServices,
} from "../../services/app/src/build-app";
import { sanitizeLogText } from "../../services/app/src/log-sanitize";

// ================================================================================================
// JOB 2661 D3 · KEIN WERT UND KEINE PRÜFSUMME — AN DEN ECHTEN ROUTEN
// ================================================================================================
//
// DREI DURCHGÄNGE, DREI KANÄLE, und jeder wurde erst durch einen Prüferbefund sichtbar:
//
//   D1 gab `message` und `stack` als freien Text aus. Der Sanitizer erkennt Secret-FORMEN, keinen
//      Namen — ein Mailer-Fehler trug die Adresse ins Protokoll.
//   D2 schloss die beiden und öffnete einen dritten: den `abdruck`, den ungesalzenen SHA-256-
//      Präfix DERSELBEN Meldung. Wer den Text riet, bekam ihn am Log bestätigt. Ich hatte das
//      sogar als Nutzen beschrieben.
//   D3 nimmt den Abdruck heraus und schliesst zusätzlich `type` und `code` gegen benannte Mengen.
//      BEN: „Ein Test gegen vertrauliche Werte in `name` und `code` ist nicht belegt." Hier ist er.
//
// GEMESSEN WIRD AN ECHTEN ROUTEN: `POST /api/auth/forgot` mit einem Mailer, der wirft (die dritte
// Fundstelle des Review-Befunds, `auth/src/routes.ts:382`), und `GET /api/library/search` nach
// einem echten Rückrollen der Suchprojektion (`http.ts:125`). Kein Fall ruft `request.log` selbst.

/** Die drei Formen, die kein Sanitizer erkennen kann und die trotzdem nie im Log stehen dürfen. */
const ADRESSE = "anna.meier@klinik-nord.de";
const PERSON = "Anna Meier";
const BEFUND = "Verdacht auf Borreliose, Serologie positiv";
const MAILER_MELDUNG = `SMTP-Zustellung an ${ADRESSE} abgelehnt — Betreff: Befund ${PERSON}: ${BEFUND}`;

const SUCHBEGRIFF = "Blutwerte-Frau-Meier-Sperrvermerk";

function logPuffer() {
  const stuecke: string[] = [];
  return {
    senke: {
      write(zeile: string): void {
        stuecke.push(zeile);
      },
    },
    zeilen: (): Record<string, unknown>[] =>
      stuecke
        .join("")
        .split("\n")
        .filter((z) => z.trim().length > 0)
        .map((z) => JSON.parse(z) as Record<string, unknown>),
    roh: () => stuecke.join(""),
  };
}

async function angemeldet(app: ReturnType<typeof buildApp>, email: string) {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email, password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  return {
    token: String(login.json().token),
    headers: { authorization: `Bearer ${login.json().token}` },
  };
}

/** Baut eine App, deren Mailer mit dem übergebenen Fehler wirft. */
function appMitWerfendemMailer(fehler: Error, puffer: ReturnType<typeof logPuffer>) {
  const services = buildServices();
  return buildApp(
    {
      ...services,
      mailer: {
        send: async () => {
          throw fehler;
        },
      },
    },
    { log: { senke: puffer.senke, stufe: "info" } },
  );
}

async function bestandDannKaputt(
  app: ReturnType<typeof buildApp>,
  services: ReturnType<typeof buildServices>,
  headers: Record<string, string>,
  grund: string,
): Promise<void> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Überdruckventil prüfen",
      statement: "Bei Überdruck Ventil X schließen.",
      type: "best_practice",
      category: "Betrieb",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  expect((await services.ko.searchProjectionControl()).projectionState).toBe("V2_ACTIVE");
  await services.ko.rollbackSearchProjectionVersion(grund);
}

describe("JOB 2661 D3: kein Wert und keine Prüfsumme im Log", () => {
  // ==============================================================================================
  // DIE ABNAHME — Adresse, Name und Befund im Meldungstext.
  // ==============================================================================================
  it("Mailer-Fehler: nichts davon im Log, und KEINE Prüfsumme, mit der man es bestätigen könnte", async () => {
    const puffer = logPuffer();
    const fehler = new Error(MAILER_MELDUNG) as Error & { code?: string };
    fehler.code = "NOT_FOUND";
    const app = appMitWerfendemMailer(fehler, puffer);
    await angemeldet(app, "reset-log@x.de");

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email: "reset-log@x.de" },
    });
    expect(res.statusCode).toBe(204);

    const zeile = puffer
      .zeilen()
      .find((z) => String(z.msg ?? "").includes("Reset-Mail konnte nicht gesendet werden"));
    expect(zeile, "die Zeile aus auth/src/routes.ts:382 fehlt").toBeDefined();

    // NACHLESBAR — sonst wäre die Zeile wertlos:
    const err = zeile?.err as Record<string, unknown>;
    expect(err.code).toBe("NOT_FOUND");
    expect(err.type).toBe("Error");
    expect(String(err.herkunft)).toMatch(/^(tests|services|apps|node_modules)\/.+:\d+:\d+$/);
    expect(String(zeile?.reqId ?? "").length).toBeGreaterThan(0);

    // NICHT IM LOG — die drei Formen einzeln:
    expect(puffer.roh()).not.toContain(ADRESSE);
    expect(puffer.roh()).not.toContain(PERSON);
    expect(puffer.roh()).not.toContain("Meier");
    expect(puffer.roh()).not.toContain(BEFUND);
    expect(puffer.roh()).not.toContain("Borreliose");
    expect(puffer.roh()).not.toContain("SMTP-Zustellung");
    expect(err.message).toBe(ERR_TEXT_UNTERDRUECKT);
    expect(err.stack).toBe(ERR_TEXT_UNTERDRUECKT);

    // ------------------------------------------------------------------------------------------
    // UND DER KERN VON D3: keine Prüfsumme, mit der sich ein GERATENER Text bestätigen liesse.
    // ------------------------------------------------------------------------------------------
    // In D2 stand hier ein `abdruck` — der SHA-256-Präfix genau dieser Meldung. Wer die Adresse
    // vermutete, konnte den Abdruck lokal bilden und im Log wiederfinden. Der Raum der Vermutungen
    // ist bei einer Firmen-Mailadresse klein. Dieser Fall bildet den Angriff nach und misst, dass
    // er ins Leere läuft.
    const geratenerAbdruck = createHash("sha256")
      .update(MAILER_MELDUNG, "utf8")
      .digest("hex")
      .slice(0, 12);
    expect(puffer.roh()).not.toContain(geratenerAbdruck);
    expect(puffer.roh()).not.toContain("abdruck");
    // Auch nicht der volle Hash oder ein längerer Präfix.
    expect(puffer.roh()).not.toContain(
      createHash("sha256").update(MAILER_MELDUNG, "utf8").digest("hex"),
    );
    await app.close();
  });

  // ==============================================================================================
  // BENS AUFLAGE — vertrauliche Werte in `name` UND `code`, an der echten Route.
  // ==============================================================================================
  it("ein vertraulicher Wert im FEHLERNAMEN erreicht das Log nicht", async () => {
    const puffer = logPuffer();
    class Boshaft extends Error {
      override name = `Zustellfehler ${ADRESSE}`;
    }
    const app = appMitWerfendemMailer(new Boshaft("egal"), puffer);
    await angemeldet(app, "name-log@x.de");
    await app.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email: "name-log@x.de" },
    });

    const zeile = puffer
      .zeilen()
      .find((z) => String(z.msg ?? "").includes("Reset-Mail konnte nicht gesendet werden"));
    expect(zeile).toBeDefined();
    expect((zeile?.err as Record<string, unknown>).type).toBe(ERR_UNBEKANNT);
    expect(puffer.roh()).not.toContain(ADRESSE);
    expect(puffer.roh()).not.toContain("Meier");
    await app.close();
  });

  it("ein vertraulicher Wert im FEHLERCODE erreicht das Log nicht — auch in Domänenform nicht", async () => {
    const puffer = logPuffer();
    const fehler = new Error("egal") as Error & { code?: string };
    // Sieht aus wie ein Hauscode und wäre durch jede blosse FORMprüfung gekommen.
    fehler.code = "PATIENT_MEIER_BORRELIOSE";
    const app = appMitWerfendemMailer(fehler, puffer);
    await angemeldet(app, "code-log@x.de");
    await app.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email: "code-log@x.de" },
    });

    const zeile = puffer
      .zeilen()
      .find((z) => String(z.msg ?? "").includes("Reset-Mail konnte nicht gesendet werden"));
    expect(zeile).toBeDefined();
    expect((zeile?.err as Record<string, unknown>).code).toBe(ERR_UNBEKANNT);
    expect(puffer.roh()).not.toContain("MEIER");
    expect(puffer.roh()).not.toContain("BORRELIOSE");
    await app.close();
  });

  it("ein Fehler OHNE Code bekommt an der echten Route trotzdem einen stabilen Code", async () => {
    const puffer = logPuffer();
    const app = appMitWerfendemMailer(new Error("Verbindung abgebrochen"), puffer);
    await angemeldet(app, "ohnecode-log@x.de");
    await app.inject({
      method: "POST",
      url: "/api/auth/forgot",
      payload: { email: "ohnecode-log@x.de" },
    });

    const zeile = puffer
      .zeilen()
      .find((z) => String(z.msg ?? "").includes("Reset-Mail konnte nicht gesendet werden"));
    const err = zeile?.err as Record<string, unknown>;
    expect(err.code).toBe(ERR_OHNE_CODE);
    expect(Object.keys(err)).toContain("code");
    await app.close();
  });

  it("WARUM die Erlaubnisliste nötig war: der Sanitizer allein lässt alle drei Formen durch", () => {
    // Die Gegenprobe zu D1 — nicht am Logger, sondern an der Funktion, auf die D1 sich verliess.
    const gereinigt = sanitizeLogText(MAILER_MELDUNG, {});
    expect(gereinigt).toContain(ADRESSE);
    expect(gereinigt).toContain(PERSON);
    expect(gereinigt).toContain("Borreliose");
    // Für Secret-FORMEN taugt er sehr wohl — er war nur am falschen Platz eingesetzt.
    expect(sanitizeLogText("Authorization: Bearer abcdefgh12345678", {})).toContain("[redacted]");
  });

  it("maskierter interner Fehler: Code nachlesbar, Suchbegriff aus demselben Vorgang nicht", async () => {
    const puffer = logPuffer();
    const services = buildServices();
    const app = buildApp(services, { log: { senke: puffer.senke, stufe: "info" } });
    const { headers, token } = await angemeldet(app, "fehler-log@x.de");
    await bestandDannKaputt(app, services, headers, "JOB 2661 D3 · Nachweis Logspur");

    const res = await app.inject({
      method: "GET",
      url: `/api/library/search?q=${encodeURIComponent(SUCHBEGRIFF)}`,
      headers,
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "INTERNAL", message: "Unerwarteter Fehler." });

    const maskiert = puffer
      .zeilen()
      .filter((z) => String(z.msg ?? "").includes("Interner Betriebsfehler maskiert"));
    expect(maskiert.length).toBe(1);
    expect(maskiert[0]?.code).toBe("SEARCH_PROJECTION_NOT_READY");
    const err = maskiert[0]?.err as Record<string, unknown>;
    // Der Code steht auf der Liste und kommt deshalb durch — die Kalibrierung der Liste.
    expect(err.code).toBe("SEARCH_PROJECTION_NOT_READY");
    expect(String(err.herkunft)).toMatch(/^(tests|services|apps|node_modules)\/.+:\d+:\d+$/);

    expect(puffer.roh()).not.toContain(SUCHBEGRIFF);
    expect(puffer.roh()).not.toContain("Blutwerte");
    expect(puffer.roh()).not.toContain(token);
    expect(puffer.roh()).not.toContain("Bearer ");
    await app.close();
  });

  it("der Pfad wird geloggt, der Abfrageteil nie — und keine Adresse des Aufrufers", async () => {
    const puffer = logPuffer();
    const app = buildApp(buildServices(), { log: { senke: puffer.senke, stufe: "info" } });
    const { headers } = await angemeldet(app, "pfad-log@x.de");

    await app.inject({
      method: "GET",
      url: `/api/library/search?q=${encodeURIComponent(SUCHBEGRIFF)}&limit=5`,
      headers,
    });

    const req = puffer
      .zeilen()
      .map((z) => z.req as Record<string, unknown> | undefined)
      .find((r) => r?.pfad === "/api/library/search");
    expect(req).toBeDefined();
    expect(Object.keys(req ?? {}).sort()).toEqual(["methode", "pfad"]);
    expect(puffer.roh()).not.toContain("remoteAddress");
    expect(puffer.roh()).not.toContain("limit=5");
    expect(puffer.roh()).not.toContain(SUCHBEGRIFF);
    await app.close();
  });

  it("Gegenprobe: auf `silent` ist nichts nachlesbar — der Zustand vor diesem Bau", async () => {
    const puffer = logPuffer();
    const services = buildServices();
    const app = buildApp(services, { log: { senke: puffer.senke, stufe: "silent" } });
    const { headers } = await angemeldet(app, "still-log@x.de");
    await bestandDannKaputt(app, services, headers, "JOB 2661 D3 · Gegenprobe");
    const res = await app.inject({
      method: "GET",
      url: `/api/library/search?q=${encodeURIComponent(SUCHBEGRIFF)}`,
      headers,
    });
    expect(res.statusCode).toBe(500);
    expect(puffer.roh()).toBe("");
    await app.close();
  });

  it("die Vorgabestufe ist `info` — ein stiller Default wäre der Befund von neuem", () => {
    expect(LOG_STANDARDSTUFE).toBe("info");
    expect((baueLoggerOptionen({ stufe: "info" }) as { level?: string }).level).toBe("info");
  });
});
