// ================================================================================================
// PETER-20261011-P08 · AC05/AC06 — ZWEIMALIGE PASSENDE SSO-WIEDERANMELDUNG AM DESKTOP-JOURNAL.
// ================================================================================================
//
// Ben (Nacharbeit 4): reine SSO-Konten wurden grundsätzlich abgewiesen; der positive Weg fehlte.
// Gemessen wird hier der neue Weg über die ECHTEN Routen auf einer eigenen, gekennzeichneten,
// fiktiven SSO-Testfirma im Desktop-Journal (`buildDevPersistServices` + `waehleWerksreset`, wie
// `server.ts`): Start → Anbieter → Rückruf, zweimal; dann der Reset ohne Passwort.
//
// DER ANBIETER IST EINE ATTRAPPE, und das ist die ehrliche Grenze: ein echter Identitätsanbieter
// ist im Prüfstand nicht erreichbar. Die Attrappe verhält sich an den Stellen, auf die es ankommt,
// wie einer — sie stellt einen Code nur für einen `state` aus, den sie selbst gesehen hat, bindet ihn
// an das `nonce` dieser Anfrage, prüft beim Einlösen dasselbe `nonce` und meldet die Identität
// (Aussteller, Subjekt), die der Test „anmeldet". Gemessen wird damit die Produktlogik: Bindung an
// Konto und Sitzung, Reihenfolge, Einmaligkeit, passende Identität, Abbruch, Einlösen.
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../services/app/src/build-app";
import { JournalSchreibsperre, buildDevPersistServices } from "../../services/app/src/dev-persist";
import { waehleWerksreset } from "../../services/app/src/firmenreset-journal";
import type { OidcClaims, OidcConfig, OidcProvider } from "../../services/auth";

const TESTFIRMA = "P08-SSO-Testfirma Klarwerk Probe GmbH (fiktiv)";
const ISS = "https://idp.p08-sso-testfirma.invalid";
const ADMIN = {
  sub: "p08-sso-admin",
  email: "sso-admin@p08-sso-testfirma.invalid",
  name: "SSO-Admin (fiktiv)",
};

const bytes = (journal: string): string =>
  existsSync(journal) ? readFileSync(journal, "utf8") : "";

/** Ein Anbieter, der state/nonce wie ein echter behandelt; `anmelden` simuliert die Wiederanmeldung. */
function attrappe() {
  const gesehen = new Map<string, string>(); // state → nonce
  const codes = new Map<string, { nonce: string; sub: string; iss: string }>();
  let zaehler = 0;
  const anbieter: OidcProvider = {
    autoProvision: true,
    config: {} as OidcConfig,
    authorizeUrl: ({ state, nonce }) => {
      gesehen.set(state, nonce);
      return `${ISS}/authorize?state=${encodeURIComponent(state)}&nonce=${encodeURIComponent(nonce)}`;
    },
    exchange: async (code) => {
      if (!codes.has(code)) {
        throw new Error("invalid_grant");
      }
      return `idtoken:${code}`;
    },
    verify: async (idToken, nonce): Promise<OidcClaims> => {
      const eintrag = codes.get(idToken.slice("idtoken:".length));
      if (!eintrag || eintrag.nonce !== nonce) {
        throw new Error("nonce mismatch");
      }
      return {
        sub: eintrag.sub,
        iss: eintrag.iss,
        email: ADMIN.email,
        name: ADMIN.name,
        roles: [],
        rolesClaimPresent: false,
      };
    },
    mapRole: () => "viewer",
  };
  return {
    anbieter,
    /** Die Wiederanmeldung beim Anbieter: liefert den Code für diesen `state`. */
    anmelden(state: string, identitaet: { sub: string; iss?: string } = ADMIN): string {
      const nonce = gesehen.get(state);
      if (nonce === undefined) {
        throw new Error("Anbieter kennt diesen state nicht");
      }
      zaehler += 1;
      const code = `code-${zaehler}`;
      codes.set(code, { nonce, sub: identitaet.sub, iss: identitaet.iss ?? ISS });
      return code;
    },
  };
}

async function ssoTestfirma(mitAnbieter = true) {
  const journal = join(mkdtempSync(join(tmpdir(), "kw-p08-sso-")), "state.jsonl");
  const sperre = new JournalSchreibsperre();
  let beendet = 0;
  const idp = attrappe();
  const services = await buildDevPersistServices(journal, sperre);
  const app = buildApp(services, {
    factoryReset: waehleWerksreset({
      databaseUrl: undefined,
      journal,
      sperre,
      beenden: () => {
        beendet += 1;
      },
    }),
    ...(mitAnbieter ? { firmenresetOidc: idp.anbieter } : {}),
  });
  // Das erste Konto der leeren Instanz: ein reines SSO-Konto, Bootstrap-Admin, ohne Passwort.
  const anmeldung = async () =>
    services.auth.loginWithOidc({ ...ADMIN, iss: ISS, roles: [], rolesClaimPresent: false }, true);
  const { token } = await anmeldung();
  const headers = { authorization: `Bearer ${token}` };
  const begriff = await app.inject({
    method: "POST",
    url: "/api/begriffe",
    headers,
    payload: {
      geltungsbereich: `${TESTFIRMA} · Instandhaltung`,
      verantwortlich: "Qualitätsstelle (fiktiv)",
      definition: { de: "Antriebsriemen der fiktiven Linie 4." },
      bezeichnungen: { de: { vorzug: "Antriebsriemen", synonyme: [], unerwuenscht: [] } },
    },
  });
  expect(begriff.statusCode).toBe(201);
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: "intern",
      title: `${TESTFIRMA}: Riemenwechsel Linie 4`,
      statement: "Fiktiver Testinhalt der eigenen SSO-Testfirma.",
      type: "best_practice",
      category: "Wartung",
      neededValidations: 1,
    },
  });
  expect(ko.statusCode).toBeLessThan(300);
  return { journal, services, app, headers, idp, anmeldung, beendet: () => beendet };
}

type Firma = Awaited<ReturnType<typeof ssoTestfirma>>;

async function status(f: Firma, headers = f.headers) {
  return (await f.app.inject({ method: "GET", url: "/api/admin/factory-reset", headers })).json();
}

/** Schritt beginnen → Anbieteradresse; liefert den `state`. */
async function starte(f: Firma, schritt: 1 | 2, headers = f.headers) {
  const res = await f.app.inject({
    method: "GET",
    url: `/api/admin/factory-reset/sso/start?schritt=${schritt}`,
    headers,
  });
  return res;
}

function stateAus(location: string): string {
  return new URL(location).searchParams.get("state") ?? "";
}

async function rueckruf(f: Firma, code: string, state: string, headers = f.headers) {
  return f.app.inject({
    method: "POST",
    url: "/api/admin/factory-reset/sso",
    headers,
    payload: { code, state },
  });
}

/** Ein vollständiger Schritt: Start, Anmeldung beim Anbieter, Rückruf. */
async function schritt(f: Firma, n: 1 | 2) {
  const start = await starte(f, n);
  expect(start.statusCode).toBe(302);
  const state = stateAus(start.headers.location as string);
  return rueckruf(f, f.idp.anmelden(state), state);
}

const ausfuehren = (f: Firma, kennung: string, extra: Record<string, unknown> = {}) =>
  f.app.inject({
    method: "POST",
    url: "/api/admin/factory-reset",
    headers: f.headers,
    payload: { kennung, bestaetigt: true, ...extra },
  });

describe("P08 · K5 · zweimalige passende SSO-Wiederanmeldung — Erfolg", () => {
  it("zwei Wiederanmeldungen, dann Reset ohne Passwort; Konto und Wörterbuch überstehen den Neustart", async () => {
    const f = await ssoTestfirma();
    const anfang = await status(f);
    expect(anfang.sso).toEqual({ erforderlich: true, eingerichtet: true, bestaetigt: 0 });

    const start = await starte(f, 1);
    expect(start.statusCode).toBe(302);
    const ziel = new URL(start.headers.location as string);
    // Eine echte WIEDERanmeldung wird verlangt, und der state ist dem Reset zugeordnet.
    expect(ziel.searchParams.get("prompt")).toBe("login");
    expect(ziel.searchParams.get("max_age")).toBe("0");
    expect(stateAus(ziel.toString()).startsWith("firmenreset.")).toBe(true);
    const state1 = stateAus(ziel.toString());
    const eins = await rueckruf(f, f.idp.anmelden(state1), state1);
    expect(eins.statusCode).toBe(200);
    expect(eins.json()).toEqual({ bestaetigt: 1 });
    expect((await status(f)).sso.bestaetigt).toBe(1);

    const zwei = await schritt(f, 2);
    expect(zwei.json()).toEqual({ bestaetigt: 2 });

    const vorher = bytes(f.journal);
    const ok = await ausfuehren(f, (await status(f)).vorschau.kennung);
    expect(ok.statusCode).toBe(200);
    expect(f.beendet()).toBe(1);
    expect(bytes(f.journal)).not.toBe(vorher);

    const neu = await buildDevPersistServices(f.journal);
    expect(await neu.auth.needsSetup()).toBe(false);
    const konten = await neu.auth.listUsers();
    expect(konten.map((k) => [k.email, k.role, k.oidcSubject])).toEqual([
      [ADMIN.email, "admin", ADMIN.sub],
    ]);
    expect((await neu.begriffe.aktuelle()).map((b) => b.bezeichnungen.de?.vorzug)).toEqual([
      "Antriebsriemen",
    ]);
    expect(await neu.ko.listEinschliesslichPapierkorb()).toEqual([]);
  });
});

describe("P08 · K5 · K6 · ohne zwei passende Wiederanmeldungen keine Löschung", () => {
  it("keine oder nur eine Wiederanmeldung → 403, Journal bytegleich", async () => {
    const f = await ssoTestfirma();
    const kennung = (await status(f)).vorschau.kennung as string;
    const vorher = bytes(f.journal);
    const ohne = await ausfuehren(f, kennung);
    expect(ohne.statusCode).toBe(403);
    expect(ohne.json().error).toBe("SSO_WIEDERANMELDUNG_ERFORDERLICH");
    expect((await schritt(f, 1)).statusCode).toBe(200);
    const eine = await ausfuehren(f, kennung);
    expect(eine.statusCode).toBe(403);
    expect(bytes(f.journal)).toBe(vorher);
    expect(f.beendet()).toBe(0);
  });

  it("Abbruch: nach zwei Bestätigungen verwirft „Abbrechen“ sie — danach keine Löschung", async () => {
    const f = await ssoTestfirma();
    await schritt(f, 1);
    await schritt(f, 2);
    const verworfen = await f.app.inject({
      method: "POST",
      url: "/api/admin/factory-reset/sso",
      headers: f.headers,
      payload: { verwerfen: true },
    });
    expect(verworfen.json()).toEqual({ bestaetigt: 0 });
    expect((await status(f)).sso.bestaetigt).toBe(0);
    const vorher = bytes(f.journal);
    const res = await ausfuehren(f, (await status(f)).vorschau.kennung);
    expect(res.statusCode).toBe(403);
    expect(bytes(f.journal)).toBe(vorher);
    expect(f.beendet()).toBe(0);
  });

  it("Abbruch beim Anbieter (kein Rückruf) bestätigt nichts", async () => {
    const f = await ssoTestfirma();
    expect((await starte(f, 1)).statusCode).toBe(302);
    expect((await status(f)).sso.bestaetigt).toBe(0);
    const vorher = bytes(f.journal);
    expect((await ausfuehren(f, (await status(f)).vorschau.kennung)).statusCode).toBe(403);
    expect(bytes(f.journal)).toBe(vorher);
  });

  it("fehlgeschlagene Wiederanmeldungen: fremdes Konto, Anbieterfehler, Wiederholung, fremde Sitzung, falsche Reihenfolge", async () => {
    const f = await ssoTestfirma();
    const vorher = bytes(f.journal);

    // Schritt 2 vor Schritt 1.
    const zuFrueh = await starte(f, 2);
    expect(zuFrueh.statusCode).toBe(409);
    expect(zuFrueh.json().error).toBe("SSO_SCHRITT_UNGUELTIG");

    // Schritt 1 gelingt, dann meldet der Anbieter in Schritt 2 ein ANDERES Konto an.
    await schritt(f, 1);
    const s2 = stateAus((await starte(f, 2)).headers.location as string);
    const fremd = await rueckruf(f, f.idp.anmelden(s2, { sub: "jemand-anderes" }), s2);
    expect(fremd.statusCode).toBe(401);
    expect(fremd.json().error).toBe("SSO_KONTO_PASST_NICHT");
    // … und die ganze Bestätigung ist verworfen, auch Schritt 1.
    expect((await status(f)).sso.bestaetigt).toBe(0);

    // Derselbe Aussteller-Name, aber ein fremder Aussteller.
    const s3 = stateAus((await starte(f, 1)).headers.location as string);
    const fremderAussteller = await rueckruf(
      f,
      f.idp.anmelden(s3, { sub: ADMIN.sub, iss: "https://boese.invalid" }),
      s3,
    );
    expect(fremderAussteller.json().error).toBe("SSO_KONTO_PASST_NICHT");

    // Anbieterfehler beim Einlösen (Code, den der Anbieter nie ausgestellt hat).
    const s4 = stateAus((await starte(f, 1)).headers.location as string);
    const kaputt = await rueckruf(f, "nie-ausgestellt", s4);
    expect(kaputt.statusCode).toBe(401);
    expect(kaputt.json().error).toBe("SSO_ANMELDUNG_FEHLGESCHLAGEN");

    // Wiederholung eines bereits verbrauchten Rückrufs.
    const s5 = stateAus((await starte(f, 1)).headers.location as string);
    const code5 = f.idp.anmelden(s5);
    expect((await rueckruf(f, code5, s5)).statusCode).toBe(200);
    const nochmal = await rueckruf(f, code5, s5);
    expect(nochmal.statusCode).toBe(409);
    expect(nochmal.json().error).toBe("SSO_VORGANG_UNBEKANNT");

    // Ein Rückruf aus einer ANDEREN Sitzung desselben Kontos zählt nicht.
    const zweiteSitzung = { authorization: `Bearer ${(await f.anmeldung()).token}` };
    const s6 = stateAus((await starte(f, 2)).headers.location as string);
    const andereSitzung = await rueckruf(f, f.idp.anmelden(s6), s6, zweiteSitzung);
    expect(andereSitzung.statusCode).toBe(409);
    expect(andereSitzung.json().error).toBe("SSO_VORGANG_UNBEKANNT");
    expect((await status(f, zweiteSitzung)).sso.bestaetigt).toBe(0);

    // Nichts davon hat etwas gelöscht. (Die zweite Anmeldung hat nur ihre Sitzung ins Journal
    // geschrieben — Mengen des Bestands sind unverändert.)
    expect(f.beendet()).toBe(0);
    expect(bytes(f.journal).startsWith(vorher)).toBe(true);
    expect(await f.services.ko.listEinschliesslichPapierkorb()).toHaveLength(1);
  });

  it("die Bestätigung wird beim Ausführen eingelöst: nach veralteter Vorschau muss neu bestätigt werden", async () => {
    const f = await ssoTestfirma();
    const alteKennung = (await status(f)).vorschau.kennung as string;
    await schritt(f, 1);
    await schritt(f, 2);
    // Ohne Haken: abgewiesen, und die Bestätigung bleibt (sie wird erst nach Haken/Kennung eingelöst).
    const ohneHaken = await ausfuehren(f, alteKennung, { bestaetigt: false });
    expect(ohneHaken.statusCode).toBe(400);
    expect((await status(f)).sso.bestaetigt).toBe(2);
    // Ein Schreibvorgang macht die Vorschau ungültig.
    await f.services.capture.createDraft({ title: `${TESTFIRMA}: neu`, statement: "fiktiv" }, "x");
    const veraltet = await ausfuehren(f, alteKennung);
    expect(veraltet.statusCode).toBe(409);
    expect(veraltet.json().error).toBe("VORSCHAU_VERALTET");
    expect((await status(f)).sso.bestaetigt).toBe(0);
    const nochmal = await ausfuehren(f, (await status(f)).vorschau.kennung);
    expect(nochmal.statusCode).toBe(403);
    expect(f.beendet()).toBe(0);
  });

  it("ohne eingerichteten Anbieter: Start abgewiesen, Reset abgewiesen, nichts gelöscht", async () => {
    const f = await ssoTestfirma(false);
    expect((await status(f)).sso).toMatchObject({ erforderlich: true, eingerichtet: false });
    const start = await starte(f, 1);
    expect(start.statusCode).toBe(409);
    expect(start.json().error).toBe("SSO_NICHT_EINGERICHTET");
    const vorher = bytes(f.journal);
    expect((await ausfuehren(f, (await status(f)).vorschau.kennung)).statusCode).toBe(403);
    expect(bytes(f.journal)).toBe(vorher);
  });

  it("K1: die neuen Türen stehen hinter dem Resetrecht — anonym 401, Controller 403", async () => {
    const f = await ssoTestfirma();
    const adminId = (await f.services.auth.listUsers()).find((u) => u.email === ADMIN.email)?.id;
    const kim = await f.services.auth.register({
      name: "Kim Kollegin (fiktiv)",
      email: "kim@p08-sso-testfirma.invalid",
      password: "kim-geheim-123",
    });
    await f.services.auth.approveUser(kim.id, adminId ?? "");
    await f.services.auth.changeRole(kim.id, "controller", adminId ?? "");
    const login = await f.services.auth.login({
      email: "kim@p08-sso-testfirma.invalid",
      password: "kim-geheim-123",
    });
    const controller = { authorization: `Bearer ${login.token}` };
    const vorher = bytes(f.journal);
    for (const [kopf, erwartet] of [
      [{}, 401],
      [controller, 403],
    ] as const) {
      const start = await f.app.inject({
        method: "GET",
        url: "/api/admin/factory-reset/sso/start?schritt=1",
        headers: kopf,
      });
      expect(start.statusCode).toBe(erwartet);
      const rueck = await f.app.inject({
        method: "POST",
        url: "/api/admin/factory-reset/sso",
        headers: kopf,
        payload: { verwerfen: true },
      });
      expect(rueck.statusCode).toBe(erwartet);
    }
    expect(bytes(f.journal)).toBe(vorher);
  });

  it("ein Konto MIT Passwort bekommt keinen SSO-Schritt", async () => {
    const f = await ssoTestfirma();
    await f.services.auth.register({
      name: "Pia Passwort (fiktiv)",
      email: "pia@p08-sso-testfirma.invalid",
      password: "pia-geheim-123",
    });
    const pia = (await f.services.auth.listUsers()).find((u) => u.email.startsWith("pia@"));
    const adminId = (await f.services.auth.listUsers()).find((u) => u.email === ADMIN.email)?.id;
    await f.services.auth.approveUser(pia?.id ?? "", adminId ?? "");
    await f.services.auth.changeRole(pia?.id ?? "", "admin", adminId ?? "");
    const login = await f.services.auth.login({
      email: "pia@p08-sso-testfirma.invalid",
      password: "pia-geheim-123",
    });
    const pk = { authorization: `Bearer ${login.token}` };
    expect((await status(f, pk)).sso.erforderlich).toBe(false);
    const start = await starte(f, 1, pk);
    expect(start.statusCode).toBe(409);
    expect(start.json().error).toBe("SSO_NICHT_VORGESEHEN");
  });
});
