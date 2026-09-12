// ================================================================================================
// JOB 3756 T3 · M — WER ABGELAUFEN IST, LIEST DEN SATZ, DER FÜR IHN GILT
// ================================================================================================
//
// DER BEFUND, gegen den diese Datei steht: JOB 3665 hat den Ablauf gebaut, aber den Satz dazu
// geliehen. Ein Gast, dessen Befristung vorbei war, las „Konto ist noch nicht freigegeben." — und
// das ist nicht bloß ungenau, es schickt ihn in die falsche Richtung: sein Konto WAR freigegeben,
// der Weg zurück führt über die Befristung (nehmen oder verlängern), nicht über eine neue Freigabe.
//
// WARUM ÜBER DEN ECHTEN DRAHT UND NICHT ÜBER `meldung()`: Der Mensch liest nicht den Katalog, er
// liest die Antwort einer Route. Zwischen beidem liegen zwei Glieder, die je für sich brechen
// können — die Wurfstelle im Dienst (welcher SCHLÜSSEL) und `sendError` samt `sprache()` (welche
// SPRACHE). Ein Fall, der `meldung("ACCESS_EXPIRED","en")` aufriefe, bewiese von dieser Kette
// nichts. Deshalb `buildApp` + `app.inject`, wie in `tests/q9-serverfehlertexte/server.test.ts`.
//
// WARUM M2 GENAUSO PFLICHT IST WIE M1: Ein Satz, der immer „abgelaufen" sagt, erfüllte M1 und wäre
// derselbe Fehler in die andere Richtung. Die Zusage dieses Auftrags ist die UNTERSCHEIDUNG, nicht
// der neue Satz.
//
// DER FEHLERCODE BLEIBT `NOT_APPROVED` (M5). Er trägt den HTTP-Status 403 und den Vertrag der
// Clients, die auf ihn prüfen; nur der Meldungsschlüssel wechselt. Ein neuer Code wäre eine
// Vertragsänderung, für die es keinen Anlass gibt.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const PASSWORT = "geheim12345";
const ADMIN = { name: "Admin", email: "admin@job3756.test", password: PASSWORT };
const GAST = { name: "Gast", email: "gast@job3756.test", password: PASSWORT };
const OHNE_FREIGABE = { name: "Neu", email: "neu@job3756.test", password: PASSWORT };

/**
 * Ein Zeitpunkt, der sicher in der Vergangenheit liegt — statt einer verstellten Uhr. `Date.now()`
 * zu übermalen wäre ein zweiter beweglicher Teil in einem Fall, der über die Sprache der Antwort
 * urteilt; ein fester Wert von 2020 ist an jedem Tag, an dem dieser Test läuft, abgelaufen.
 */
const ABGELAUFEN = "2020-01-01T00:00:00.000Z";

let services: ReturnType<typeof buildServices>;
let app: ReturnType<typeof buildApp>;
let adminId: string;
let gastId: string;

beforeEach(async () => {
  services = buildServices();
  app = buildApp(services);
  // Zwei Konten, und der Admin zuerst: ein Gast, der zugleich der letzte Admin wäre, träfe beim
  // Befristen den Aussperrschutz und überdeckte jede Aussage über den Ablauf.
  const admin = await services.auth.register(ADMIN);
  const gast = await services.auth.register(GAST);
  await services.auth.approveUser(gast.id, admin.id);
  adminId = admin.id;
  gastId = gast.id;
});

afterEach(async () => {
  await app.close();
});

function anmelden(konto: { email: string; password: string }, sprache?: string) {
  return app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: sprache ? { "accept-language": sprache } : {},
    payload: { email: konto.email, password: konto.password },
  });
}

describe("JOB 3756 M · der abgelaufene Zugang sagt, dass er abgelaufen ist", () => {
  it("M1 — der abgelaufene Gast liest seinen eigenen Satz", async () => {
    await services.auth.setAccessExpiry(gastId, ABGELAUFEN, adminId);

    const res = await anmelden(GAST);

    expect(res.statusCode).toBe(403);
    expect(res.json().message).toBe("Ihr Zugang ist abgelaufen.");
  });

  it("M2 — wer noch nie freigegeben wurde, liest weiterhin seinen anderen Satz", async () => {
    // Die Unterscheidung ist der Zweck des Auftrags. Ohne diesen Fall hätte man einen falschen
    // Satz gegen einen anderen falschen tauschen können und es nicht gemerkt.
    await services.auth.register(OHNE_FREIGABE);

    const res = await anmelden(OHNE_FREIGABE);

    expect(res.statusCode).toBe(403);
    expect(res.json().message).toBe("Konto ist noch nicht freigegeben.");
  });

  it("M3 dieselbe Lage auf Englisch und Niederländisch", async () => {
    // Über den echten `accept-language`-Kopf (`routes.ts` `sprache()`), nicht über einen Aufruf von
    // `meldung()`: die Sprachwahl ist ein eigenes Glied der Kette und bricht eigenständig.
    await services.auth.setAccessExpiry(gastId, ABGELAUFEN, adminId);

    const en = await anmelden(GAST, "en");
    expect(en.statusCode).toBe(403);
    expect(en.json().message).toBe("Your access has expired.");

    const nl = await anmelden(GAST, "nl");
    expect(nl.statusCode).toBe(403);
    expect(nl.json().message).toBe("Je toegang is verlopen.");
  });

  it("M4 — der SSO-Eingang trägt denselben Schlüssel", async () => {
    // Die naheliegende Halbheit: nur `login` ändern. Dann sagte dieselbe Lage je nach Anmeldeart
    // etwas anderes. Auf Dienstebene geprüft (wie in `tests/demo-zugang-gaeste/`), weil der
    // SSO-Rückweg über den Anbieter läuft und keine eigene Route für diesen Fehlschlag hat.
    const claims = {
      sub: "gast-subjekt",
      email: "sso@job3756.test",
      name: "SSO-Gast",
      roles: [],
      iss: "https://idp.example.com",
      rolesClaimPresent: false,
    };
    const erste = await services.auth.loginWithOidc(claims, true, "viewer");
    await services.auth.setAccessExpiry(erste.user.id, ABGELAUFEN, adminId);

    await expect(services.auth.loginWithOidc(claims, true, "viewer")).rejects.toMatchObject({
      code: "NOT_APPROVED",
      message: "ACCESS_EXPIRED",
    });
  });

  it("M5 — der Vertrag bleibt: Fehlercode NOT_APPROVED, Status 403", async () => {
    // Clients prüfen auf `error`, nicht auf den Satz. Ein neuer Code wäre eine stille
    // Vertragsänderung an einer Stelle, an der sich fachlich nichts geändert hat.
    await services.auth.setAccessExpiry(gastId, ABGELAUFEN, adminId);

    const res = await anmelden(GAST);

    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("NOT_APPROVED");
  });

  it("M6 — ein Konto ohne Befristung meldet sich unverändert an", async () => {
    // Die Kalibrierung gegen ein Dauer-Nein: eine Sperre, die IMMER zuschlägt, erfüllte M1 und M3.
    const res = await anmelden(GAST);

    expect(res.statusCode).toBe(200);
    expect(res.json().user.id).toBe(gastId);
  });
});
