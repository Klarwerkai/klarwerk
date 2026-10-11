// ================================================================================================
// PETER-20261011-P08 · FIRMENRESET AM ECHTEN DESKTOP-JOURNALWEG, NUR AN EIGENER FIKTIVER TESTFIRMA.
// ================================================================================================
//
// Gemessen wird der Weg, den die Desktop-App nimmt (`server.ts`): `buildDevPersistServices` auf
// einer Journaldatei, `waehleWerksreset` mit DERSELBEN Schreibsperre, die echten Routen über
// `buildApp`. Ersetzt ist nur das Beenden des Prozesses (`beenden`), damit der Test den Neustart
// selbst nachstellen kann — als frische Komposition aus derselben Datei, genau wie die App.
//
// DER BESTAND IST AUSSCHLIESSLICH EIGEN UND FIKTIV (P08-AC08): jede Testfirma liegt in einem
// eigenen, frisch angelegten Temp-Verzeichnis; Namen, Adressen (`.invalid`) und Inhalte sind
// erfunden und mit `TESTFIRMA` gekennzeichnet. Keine Datenbank, kein Netz, kein Modell, keine
// Produktion. Eine ZWEITE, fremde Testfirma daneben belegt, dass der Reset nur seine eigene Datei
// anfasst.
//
//   K1  P08-AC01  Reset nur mit administrativem Resetrecht (und nur im Desktopbetrieb).
//   K2  P08-AC02  Vorschau nennt konkrete entfernte und erhaltene Mengen; sie ändert nichts.
//   K3  P08-AC03  Konten (samt Rolle und Passwort) und Firmenwörterbuch überstehen Reset + Neustart.
//   K4  P08-AC04  Ohne bewusst gesetzte Checkbox keine Löschung.
//   K5  P08-AC05  Zwei Passwortbestätigungen; reines SSO-Konto ohne passenden Weg → abgewiesen.
//   K6  P08-AC06  Abbruch und jede fehlgeschlagene Bestätigung lassen das Journal bytegleich.
//   K7  P08-AC07  Veraltete Vorschau, zweiter gleichzeitiger Reset, Schreiben nach dem Reset.
//   K8  P08-AC08  Nur die eigene gekennzeichnete Testfirma; die fremde bleibt bytegleich.
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import {
  FIRMENRESET_ZEILE,
  FirmenresetSchreibsperre,
  type JournalEntry,
  type JournalLine,
  JournalSchreibsperre,
  buildDevPersistServices,
  firmenresetZeilen,
  journaledRepos,
  readJournalLines,
} from "../../services/app/src/dev-persist";
import { waehleWerksreset } from "../../services/app/src/firmenreset-journal";

const TESTFIRMA = "P08-Testfirma Klarwerk Probe GmbH (fiktiv)";
const ADMIN = {
  name: "Ada Admin (fiktiv)",
  email: "ada@p08-testfirma.invalid",
  password: "ada-geheim-123",
};
const KOLLEGIN = {
  name: "Kim Kollegin (fiktiv)",
  email: "kim@p08-testfirma.invalid",
  password: "kim-geheim-123",
};
const BEGRIFF = {
  geltungsbereich: `${TESTFIRMA} · Instandhaltung`,
  verantwortlich: "Qualitätsstelle (fiktiv)",
  definition: { de: "Antriebsriemen der fiktiven Linie 4." },
  bezeichnungen: { de: { vorzug: "Antriebsriemen", synonyme: [], unerwuenscht: ["Gurtband"] } },
};

function tmpJournal(name: string): string {
  return join(mkdtempSync(join(tmpdir(), `kw-p08-${name}-`)), "state.jsonl");
}

const bytes = (journal: string): string =>
  existsSync(journal) ? readFileSync(journal, "utf8") : "";

/** Eine eigene, gekennzeichnete, fiktive Testfirma im Desktop-Journal — wie `server.ts` sie baut. */
async function testfirma(name = "eigen") {
  const journal = tmpJournal(name);
  const sperre = new JournalSchreibsperre();
  let beendet = 0;
  const factoryReset = waehleWerksreset({
    databaseUrl: undefined,
    journal,
    sperre,
    beenden: () => {
      beendet += 1;
    },
  });
  const services = await buildDevPersistServices(journal, sperre);
  const app = buildApp(services, { factoryReset });
  const setup = await app.inject({ method: "POST", url: "/api/auth/setup", payload: ADMIN });
  expect(setup.statusCode).toBe(201);
  const adminToken = setup.json().token as string;
  const admin = { authorization: `Bearer ${adminToken}` };
  const adminId = (await services.auth.listUsers()).find((u) => u.email === ADMIN.email)?.id ?? "";
  // Zweites Konto, freigegeben und als Controller — es muss den Reset mit Rolle überstehen.
  const kim = await services.auth.register(KOLLEGIN);
  await services.auth.approveUser(kim.id, adminId);
  await services.auth.changeRole(kim.id, "controller", adminId);
  for (const titel of ["Riemenwechsel Linie 4", "Schichtübergabe Halle 2"]) {
    await services.ko.create({
      type: "best_practice",
      category: "K",
      author: adminId,
      title: `${TESTFIRMA}: ${titel}`,
      statement: "Fiktiver Testinhalt der eigenen Testfirma.",
    });
  }
  await services.capture.createDraft(
    { title: `${TESTFIRMA}: offener Entwurf`, statement: "Fiktiver Entwurf." },
    adminId,
  );
  const begriff = await app.inject({
    method: "POST",
    url: "/api/begriffe",
    headers: admin,
    payload: BEGRIFF,
  });
  expect(begriff.statusCode).toBe(201);
  return { journal, sperre, services, app, admin, adminToken, adminId, beendet: () => beendet };
}

type Firma = Awaited<ReturnType<typeof testfirma>>;

async function vorschau(f: Firma, headers = f.admin) {
  const res = await f.app.inject({ method: "GET", url: "/api/admin/factory-reset", headers });
  return res;
}

async function kennung(f: Firma): Promise<string> {
  return (await vorschau(f)).json().vorschau.kennung as string;
}

function ausfuehren(f: Firma, payload: Record<string, unknown>, headers = f.admin) {
  return f.app.inject({ method: "POST", url: "/api/admin/factory-reset", headers, payload });
}

const gueltig = (k: string) => ({
  kennung: k,
  bestaetigt: true,
  passwort1: ADMIN.password,
  passwort2: ADMIN.password,
});

async function anmelden(f: Firma, konto: { email: string; password: string }) {
  const res = await f.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: konto.email, password: konto.password },
  });
  return { authorization: `Bearer ${res.json().token}` };
}

/** Der Neustart der Desktop-App: frische Komposition aus derselben Journaldatei. */
async function neustart(journal: string) {
  return buildDevPersistServices(journal);
}

describe("P08 · K1 · nur mit administrativem Resetrecht", () => {
  it("anonym und Controller: Vorschau und Ausführung abgewiesen, Journal bytegleich", async () => {
    const f = await testfirma();
    const vorher = bytes(f.journal);
    const k = await kennung(f);
    expect(bytes(f.journal)).toBe(vorher);
    const anonymGet = await f.app.inject({ method: "GET", url: "/api/admin/factory-reset" });
    expect(anonymGet.statusCode).toBe(401);
    const anonymPost = await f.app.inject({
      method: "POST",
      url: "/api/admin/factory-reset",
      payload: gueltig(k),
    });
    expect(anonymPost.statusCode).toBe(401);
    const kim = await anmelden(f, KOLLEGIN);
    const nachLogin = bytes(f.journal);
    expect((await vorschau(f, kim)).statusCode).toBe(403);
    const post = await ausfuehren(
      f,
      { kennung: k, bestaetigt: true, passwort1: KOLLEGIN.password, passwort2: KOLLEGIN.password },
      kim,
    );
    expect(post.statusCode).toBe(403);
    expect(bytes(f.journal)).toBe(nachLogin);
    expect(f.beendet()).toBe(0);
  });

  it("Server-/Datenbankbetrieb: nicht verfügbar, 403, nichts angefasst", async () => {
    const f = await testfirma();
    const reset = waehleWerksreset({
      databaseUrl: "postgres://nur-pruefstand.invalid/p08",
      journal: f.journal,
      beenden: () => {
        throw new Error("darf nie beenden");
      },
    });
    expect(reset.available).toBe(false);
    const app = buildApp(f.services, { factoryReset: reset });
    const vorher = bytes(f.journal);
    const status = await app.inject({
      method: "GET",
      url: "/api/admin/factory-reset",
      headers: f.admin,
    });
    expect(status.json()).toEqual({ available: false });
    const post = await app.inject({
      method: "POST",
      url: "/api/admin/factory-reset",
      headers: f.admin,
      payload: gueltig("egal"),
    });
    expect(post.statusCode).toBe(403);
    expect(bytes(f.journal)).toBe(vorher);
  });
});

describe("P08 · K2 · die Vorschau nennt konkrete Mengen und ändert nichts", () => {
  it("entfernt: 2 Wissensobjekte, Entwürfe und Anmeldungen; erhalten: 2 Konten, 1 Begriff, Protokoll", async () => {
    const f = await testfirma();
    const vorher = bytes(f.journal);
    const res = await vorschau(f);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.available).toBe(true);
    expect(body.vorschau.kennung).toMatch(/^[0-9a-f]{64}$/);
    expect(body.vorschau.entfernt.wissensobjekte).toBe(2);
    expect(body.vorschau.entfernt.offeneFragen).toBe((await f.services.ask.listGaps()).length);
    expect(body.vorschau.entfernt.weitereEintraege).toBeGreaterThan(0);
    expect(body.vorschau.entfernt.ablagen).toEqual(expect.arrayContaining(["drafts", "sessions"]));
    // Erhaltenes taucht nie unter „entfernt" auf.
    for (const bleibt of ["users", "secondFactors", "auditRepo", "begriffe"]) {
      expect(body.vorschau.entfernt.ablagen).not.toContain(bleibt);
    }
    expect(body.vorschau.erhalten).toMatchObject({ benutzerkonten: 2, woerterbuch: 1 });
    expect(body.vorschau.erhalten.protokolleintraege).toBeGreaterThan(0);
    // Die Vorschau ist lesend.
    expect(bytes(f.journal)).toBe(vorher);
    expect(f.beendet()).toBe(0);
  });
});

describe("P08 · K3 · K8 · Konten und Wörterbuch bleiben, nur die eigene Testfirma wird zurückgesetzt", () => {
  it("Reset + Neustart: Bestand weg, Konten mit Rolle/Passwort und Wörterbuch da, fremde Firma bytegleich", async () => {
    const fremd = await testfirma("fremd");
    const fremdVorher = bytes(fremd.journal);
    const f = await testfirma("eigen");
    expect(f.journal).not.toBe(fremd.journal);

    const ok = await ausfuehren(f, gueltig(await kennung(f)));
    expect(ok.statusCode).toBe(200);
    expect(f.beendet()).toBe(1);

    // Die Spur des Resets steht im neuen Journal; sie trägt Mengen, keine Inhalte.
    const spur = readJournalLines(f.journal).filter(
      (l) => l.entry.repo === FIRMENRESET_ZEILE.repo && l.entry.method === FIRMENRESET_ZEILE.method,
    );
    expect(spur).toHaveLength(1);
    expect(JSON.stringify(spur[0]?.entry)).not.toContain(TESTFIRMA);

    const neu = await neustart(f.journal);
    expect(await neu.auth.needsSetup()).toBe(false);
    expect((await neu.auth.listUsers()).map((u) => [u.email, u.role]).sort()).toEqual(
      [
        [ADMIN.email, "admin"],
        [KOLLEGIN.email, "controller"],
      ].sort(),
    );
    expect((await neu.auth.login({ email: ADMIN.email, password: ADMIN.password })).user.role).toBe(
      "admin",
    );
    expect(
      (await neu.auth.login({ email: KOLLEGIN.email, password: KOLLEGIN.password })).user.role,
    ).toBe("controller");
    const begriffe = await neu.begriffe.aktuelle();
    expect(begriffe.map((b) => b.bezeichnungen.de?.vorzug)).toEqual(["Antriebsriemen"]);
    // Entfernt: Wissensobjekte (auch Papierkorb), Entwürfe — und die alte Anmeldung.
    expect(await neu.ko.listEinschliesslichPapierkorb()).toEqual([]);
    expect(await neu.capture.listDrafts()).toEqual([]);
    expect(await neu.auth.authenticate(f.adminToken)).toBeFalsy();

    // P08-AC08: die fremde Testfirma ist nicht berührt.
    expect(bytes(fremd.journal)).toBe(fremdVorher);
    expect(fremd.beendet()).toBe(0);
  });

  it("das Firmenwörterbuch übersteht im Desktopbetrieb auch einen gewöhnlichen Neustart", async () => {
    const f = await testfirma();
    const neu = await neustart(f.journal);
    expect((await neu.begriffe.aktuelle()).map((b) => b.version)).toEqual([1]);
  });
});

describe("P08 · K4 · K5 · K6 · ohne vollständige Bestätigung keine Löschung", () => {
  it("fehlende/unechte Checkbox, fehlende Kennung, ein/zwei falsche Passwörter → abgewiesen, bytegleich", async () => {
    const f = await testfirma();
    const k = await kennung(f);
    const vorher = bytes(f.journal);
    const faelle: Array<[Record<string, unknown>, number, string]> = [
      // K4: die Checkbox muss bewusst gesetzt sein — nichts anderes zählt.
      [{ ...gueltig(k), bestaetigt: undefined }, 400, "BESTAETIGUNG_FEHLT"],
      [{ ...gueltig(k), bestaetigt: "true" }, 400, "BESTAETIGUNG_FEHLT"],
      [{ ...gueltig(k), bestaetigt: false }, 400, "BESTAETIGUNG_FEHLT"],
      // K2/K6: ohne gesehene Vorschau nichts — auch nicht der alte Ein-Passwort-Aufruf.
      [{ password: ADMIN.password }, 400, "VORSCHAU_FEHLT"],
      // K5: beide Passwörter, jedes einzeln geprüft.
      [{ ...gueltig(k), passwort2: undefined }, 401, "INVALID_PASSWORD"],
      [{ ...gueltig(k), passwort2: "falsch-falsch" }, 401, "INVALID_PASSWORD"],
      [{ ...gueltig(k), passwort1: "falsch-falsch" }, 401, "INVALID_PASSWORD"],
      [{ ...gueltig(k), passwort1: "", passwort2: "" }, 401, "INVALID_PASSWORD"],
    ];
    for (const [payload, status, code] of faelle) {
      const res = await ausfuehren(f, payload);
      expect(res.statusCode, JSON.stringify(payload)).toBe(status);
      expect(res.json().error).toBe(code);
      expect(bytes(f.journal)).toBe(vorher);
    }
    expect(f.beendet()).toBe(0);
    // K6: der Bestand ist nach einem Neustart vollständig da.
    const neu = await neustart(f.journal);
    expect(await neu.ko.listEinschliesslichPapierkorb()).toHaveLength(2);
    expect(await neu.auth.authenticate(f.adminToken)).toBeTruthy();
  });

  it("Abbruch: Vorschau ansehen und nicht ausführen ändert nichts", async () => {
    const f = await testfirma();
    const vorher = bytes(f.journal);
    await vorschau(f);
    await vorschau(f);
    expect(bytes(f.journal)).toBe(vorher);
    expect(f.beendet()).toBe(0);
  });

  it("K5: ein reines SSO-Konto (ohne Passwort) wird ohne Löschung abgewiesen", async () => {
    const journal = tmpJournal("sso");
    const sperre = new JournalSchreibsperre();
    let beendet = 0;
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
    });
    const { token } = await services.auth.loginWithOidc(
      {
        sub: "p08-sso-admin",
        email: "sso-admin@p08-testfirma.invalid",
        name: "SSO Admin (fiktiv)",
        roles: [],
        iss: "https://idp.p08-testfirma.invalid",
        rolesClaimPresent: false,
      },
      true,
    );
    const headers = { authorization: `Bearer ${token}` };
    const k = (await app.inject({ method: "GET", url: "/api/admin/factory-reset", headers })).json()
      .vorschau.kennung as string;
    const vorher = bytes(journal);
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/factory-reset",
      headers,
      payload: { kennung: k, bestaetigt: true, passwort1: "", passwort2: "" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("SSO_WIEDERANMELDUNG_ERFORDERLICH");
    expect(bytes(journal)).toBe(vorher);
    expect(beendet).toBe(0);
  });
});

describe("P08 · K7 · gleichzeitige Jobs und neue Schreibvorgänge", () => {
  it("ein Schreibvorgang nach der Vorschau macht sie ungültig → 409, nichts gelöscht", async () => {
    const f = await testfirma();
    const k = await kennung(f);
    await f.services.ko.create({
      type: "best_practice",
      category: "K",
      author: f.adminId,
      title: `${TESTFIRMA}: nach der Vorschau angelegt`,
      statement: "Fiktiv.",
    });
    const vorher = bytes(f.journal);
    const res = await ausfuehren(f, gueltig(k));
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe("VORSCHAU_VERALTET");
    expect(bytes(f.journal)).toBe(vorher);
    expect(f.beendet()).toBe(0);
    expect(await (await neustart(f.journal)).ko.listEinschliesslichPapierkorb()).toHaveLength(3);
    // Mit der neuen Vorschau geht es — sie nennt jetzt drei Wissensobjekte.
    const neueVorschau = (await vorschau(f)).json().vorschau;
    expect(neueVorschau.entfernt.wissensobjekte).toBe(3);
    expect((await ausfuehren(f, gueltig(neueVorschau.kennung))).statusCode).toBe(200);
  });

  it("zwei gleichzeitige Ausführungen: genau eine wirkt, die andere bekommt RESET_LAEUFT", async () => {
    const f = await testfirma();
    const k = await kennung(f);
    const antworten = await Promise.all([ausfuehren(f, gueltig(k)), ausfuehren(f, gueltig(k))]);
    expect(antworten.map((a) => a.statusCode).sort()).toEqual([200, 409]);
    expect(antworten.find((a) => a.statusCode === 409)?.json().error).toBe("RESET_LAEUFT");
    expect(f.beendet()).toBe(1);
  });

  it("nach dem Reset weist das Journal jeden Schreibvorgang ab; nichts davon landet im neuen Journal", async () => {
    const f = await testfirma();
    expect((await ausfuehren(f, gueltig(await kennung(f)))).statusCode).toBe(200);
    const nachReset = bytes(f.journal);
    await expect(
      f.services.ko.create({
        type: "best_practice",
        category: "K",
        author: f.adminId,
        title: `${TESTFIRMA}: zu spät`,
        statement: "Fiktiv.",
      }),
    ).rejects.toThrow();
    await expect(
      f.services.begriffe.lege({
        ...BEGRIFF,
        id: "p08-zu-spaet",
        version: 1,
        geaendertVon: f.adminId,
        geaendertAm: new Date().toISOString(),
      }),
    ).rejects.toBeInstanceOf(FirmenresetSchreibsperre);
    expect(bytes(f.journal)).toBe(nachReset);
    const neu = await neustart(f.journal);
    expect(await neu.ko.listEinschliesslichPapierkorb()).toEqual([]);
    expect((await neu.begriffe.aktuelle()).map((b) => b.id)).not.toContain("p08-zu-spaet");
  });

  it("die Sperre weist eine Mutation ab, BEVOR sie den Speicher ändert", async () => {
    const sperre = new JournalSchreibsperre();
    const zeilen: JournalEntry[] = [];
    const repos = journaledRepos(
      inMemoryRepos(),
      (e) => {
        sperre.pruefe();
        zeilen.push(e);
      },
      false,
      undefined,
      sperre,
    );
    sperre.setzen();
    await expect(
      repos.drafts.insert({
        id: "d-p08",
        payload: { title: "T", statement: "S" },
        originalAuthor: "ada",
        lastEditor: "ada",
        createdAt: "2026-10-11T00:00:00.000Z",
        updatedAt: "2026-10-11T00:00:00.000Z",
      } as never),
    ).rejects.toBeInstanceOf(FirmenresetSchreibsperre);
    expect(await repos.drafts.list()).toEqual([]);
    expect(zeilen).toEqual([]);
  });
});

describe("P08 · der Filter erhält die Prüfprotokollkette auch aus Rücknahme-Vorgängen", () => {
  it("wirksamer Vorgang: Protokollzeilen bleiben an ihrer Stelle; unwirksamer: entfällt ganz", () => {
    const zeile = (n: number, entry: JournalEntry & { vorgang?: string }): JournalLine => ({
      lineNumber: n,
      entry,
    });
    const audit = (id: string): JournalEntry => ({
      repo: "auditRepo",
      method: "append",
      args: [{ id }],
    });
    const ko = (id: string): JournalEntry => ({ repo: "koRepo", method: "update", args: [{ id }] });
    const lines: JournalLine[] = [
      zeile(1, { repo: "users", method: "insert", args: [{ id: "u1" }] }),
      zeile(2, audit("a1")),
      zeile(3, {
        repo: "ruecknahmeVorgang",
        method: "abschluss",
        args: [ko("k1"), audit("a2")],
        vorgang: "v-wirksam",
      }),
      zeile(4, { repo: "ruecknahmeVorgang", method: "bestaetigung", args: ["v-wirksam"] }),
      zeile(5, {
        repo: "ruecknahmeVorgang",
        method: "abschluss",
        args: [ko("k2"), audit("a-nie")],
        vorgang: "v-unwirksam",
      }),
      zeile(6, ko("k3")),
      zeile(7, audit("a3")),
      zeile(8, { repo: "begriffe", method: "lege", args: [{ id: "b1", version: 1 }] }),
      zeile(9, { repo: "sessions", method: "create", args: [{ token: "t" }] }),
    ];
    expect(firmenresetZeilen(lines)).toEqual([
      { repo: "users", method: "insert", args: [{ id: "u1" }] },
      audit("a1"),
      audit("a2"),
      audit("a3"),
      { repo: "begriffe", method: "lege", args: [{ id: "b1", version: 1 }] },
    ]);
  });
});
