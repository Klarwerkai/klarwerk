// ================================================================================================
// aufnahme:20260922:gesamt-leserechte · Ben, Nacharbeit 10 — DIE LADEBILANZ DER LESEVARIANTEN.
// ================================================================================================
//
// DER BEFUND: `POST /api/admin/lesevarianten/laden` (`users.manage`) gab die Bilanz über den
// UNGEFILTERTEN Bestand aus. `textGeaendert`/`originalGeaendert` nannten Objektkennungen, die
// übrigen Felder zählten unsichtbare Objekte mit. `users.manage` ersetzt aber kein Space-Leserecht
// (`sichtbarkeit.ts`, `spaceErlaubt`): ein Admin ohne Mitgliedschaft erfuhr so Kennung und Existenz
// eines Objekts aus einem geschlossenen Space.
//
// GEMESSEN über die echten Routen (buildApp, Anwendungsspeicher). Zwei Objekte tragen Anker der
// echten Lieferung `advisor-ict-en-v1`: eines offen, eines in einem Mitglieder-Space. Für das
// geschützte liegt bereits eine ältere Übersetzung, damit der Lauf seine KENNUNG in
// `textGeaendert` nennt.
//   · Admin MIT Mitgliedschaft → die Kennung steht in der Bilanz (GEGENPROBE: der Weg trägt).
//   · Admin OHNE Mitgliedschaft → seine Bilanz ist FELD FÜR FELD die eines Bestands, in dem das
//     geschützte Objekt gar nicht existiert. Keine Kennung, kein Zählwert, kein Datensatzschlüssel
//     verrät den Unterschied.
//   · Die Zuordnung selbst bleibt bestandsweit: auch dieser Lauf legt die Variante des geschützten
//     Objekts an — der Mitglieds-Admin liest sie danach.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import { lokalisierungsPaket } from "../../services/app/src/lesevarianten";
import { type AuditEntry, hashEntryFuerVersion, verifyChain } from "../../services/audit";
import type { KoSource } from "../../services/knowledge-object";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

const KENNWORT = "geheim12345";
const PAKET = "advisor-ict-en-v1";

const LIEFERUNG = (() => {
  const paket = lokalisierungsPaket(PAKET);
  if (!paket) {
    throw new Error(`Die Lieferung ${PAKET} fehlt — ohne sie misst dieser Test nichts.`);
  }
  const mitSeite = paket.records.filter((r) => r.confluence_id);
  const geschuetzt = mitSeite[0];
  const offen = mitSeite[1];
  if (!geschuetzt?.confluence_id || !offen?.confluence_id) {
    throw new Error("Die Lieferung trägt keine zwei Datensätze mit Seiten-Id.");
  }
  const sprache = paket.languages.find((l) => l !== geschuetzt.original_language);
  if (!sprache) {
    throw new Error("Die Lieferung trägt keine Übersetzungssprache.");
  }
  return { geschuetzt, offen, sprache };
})();

async function anmelden(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, `Anmeldung ${email}: ${res.body}`).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

function quelleFuer(seitenId: string, autor: string): KoSource {
  return {
    id: `quelle-${seitenId}`,
    label: `Confluence-Seite ${seitenId}`,
    url: null,
    excerpt: null,
    kind: "external",
    peerValidated: false,
    provider: "Confluence",
    externalId: seitenId,
    author: autor,
    at: "2026-01-01T00:00:00.000Z",
  };
}

async function objektMitAnker(
  services: AppServices,
  autor: string,
  seitenId: string,
  titel: string,
): Promise<string> {
  const ko = await services.ko.create({
    title: titel,
    statement: `${titel} — Kernaussage.`,
    type: "best_practice",
    category: "Onboarding",
    author: autor,
    sources: [quelleFuer(seitenId, autor)],
  });
  return ko.id;
}

/**
 * `mitGeschuetztem: false` baut denselben Bestand OHNE das Space-Objekt — die Vergleichsgröße für
 * „nicht sichtbar ist wie nicht vorhanden".
 */
async function buehne(opts: { mitGeschuetztem: boolean }) {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@lesevarianten.test", password: KENNWORT },
  });
  const ada = await anmelden(app, "ada@lesevarianten.test");
  for (const [name, email, role] of [
    ["Lea Leitung", "lea@lesevarianten.test", "experte"],
    ["Erik Experte", "erik@lesevarianten.test", "experte"],
    ["Carla Controller", "carla@lesevarianten.test", "controller"],
    ["Mia Mitglied", "mia@lesevarianten.test", "admin"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: ada,
      payload: { name, email, password: KENNWORT, role },
    });
    expect(res.statusCode, `Konto ${email}: ${res.body}`).toBe(201);
  }
  const k = {
    ada,
    mia: await anmelden(app, "mia@lesevarianten.test"),
    erik: await anmelden(app, "erik@lesevarianten.test"),
    carla: await anmelden(app, "carla@lesevarianten.test"),
  };
  const liste = await app.inject({ method: "GET", url: "/api/spaces/konten", headers: k.erik });
  expect(liste.statusCode, liste.body).toBe(200);
  const id = (name: string): string =>
    (liste.json().konten as { id: string; name: string }[]).find((x) => x.name === name)?.id ?? "";
  const ids = {
    lea: id("Lea Leitung"),
    erik: id("Erik Experte"),
    carla: id("Carla Controller"),
    mia: id("Mia Mitglied"),
  };
  expect(
    Object.values(ids).every((x) => x.length > 0),
    JSON.stringify(ids),
  ).toBe(true);

  // Das offene Objekt steht in jedem Aufbau.
  const offenId = await objektMitAnker(
    services,
    ids.erik,
    LIEFERUNG.offen.confluence_id as string,
    "Offenes Onboarding",
  );
  // Der Space — Lea zuständig, Erik schreibt, Carla und Mia lesen; Ada ist kein Mitglied. Er steht
  // in BEIDEN Aufbauten (Nacharbeit 15): verglichen wird ein Bestand mit und ohne die geschützten
  // VORGÄNGE, nicht mit und ohne Space.
  const space = await app.inject({
    method: "POST",
    url: "/api/spaces",
    headers: k.carla,
    payload: {
      name: "Personalakte Nord",
      zweck: "Nur für die Mitglieder dieses Bereichs.",
      verantwortlich: ids.lea,
      zugang: "mitglieder",
      ansichten: [],
      mitglieder: [
        { nutzer: ids.erik, recht: "schreiben" },
        { nutzer: ids.carla, recht: "lesen" },
        { nutzer: ids.mia, recht: "lesen" },
      ],
    },
  });
  expect(space.statusCode, space.body).toBe(201);
  const spaceId = (space.json() as { id: string }).id;
  if (!opts.mitGeschuetztem) {
    return { app, services, k, ids, offenId, geschuetztId: null };
  }

  const geschuetztId = await objektMitAnker(
    services,
    ids.erik,
    LIEFERUNG.geschuetzt.confluence_id as string,
    "Geschütztes Onboarding",
  );
  const v = await app.inject({
    method: "POST",
    url: "/api/spaces/verschiebung/vorschau",
    headers: k.erik,
    payload: { koId: geschuetztId, zielSpaceId: spaceId },
  });
  expect(v.statusCode, v.body).toBe(200);
  const vor = v.json() as {
    quelle: { id: string; version: number } | null;
    ziel: { id: string; version: number } | null;
  };
  const verschoben = await app.inject({
    method: "POST",
    url: "/api/spaces/verschiebung",
    headers: k.erik,
    payload: {
      koId: geschuetztId,
      zielSpaceId: spaceId,
      basis: {
        quelleId: vor.quelle?.id ?? null,
        quelleVersion: vor.quelle?.version ?? null,
        zielId: vor.ziel?.id ?? null,
        zielVersion: vor.ziel?.version ?? null,
      },
    },
  });
  expect(verschoben.statusCode, verschoben.body).toBe(200);

  // Eine ÄLTERE Übersetzung des geschützten Objekts — der Lauf ersetzt sie und nennt dabei
  // seine Kennung in `textGeaendert`.
  await services.lesevarianten.upsert({
    koId: geschuetztId,
    lang: LIEFERUNG.sprache,
    originalLanguage: LIEFERUNG.geschuetzt.original_language,
    title: "Veraltete Übersetzung",
    statement: "Veraltet.",
    bodyHtml: "<p>Veraltet.</p>",
    herkunft: `lokale Lieferung ${PAKET}`,
    status: LIEFERUNG.geschuetzt.translation_status,
    sourceBodySha256: null,
    originalSha256: "veraltet",
    uebersetzungSha256: "veraltet",
    quellabgleich: "unbestaetigt",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  return { app, services, k, ids, offenId, geschuetztId };
}

const laden = (app: App, kopf: Kopf) =>
  app.inject({
    method: "POST",
    url: "/api/admin/lesevarianten/laden",
    headers: kopf,
    payload: { package: PAKET },
  });

describe("POST /api/admin/lesevarianten/laden — die Bilanz folgt der Lesepolicy des Aufrufers", () => {
  it("Admin mit Space-Mitgliedschaft: die Kennung des geschützten Objekts steht in der Bilanz", async () => {
    const { app, k, geschuetztId } = await buehne({ mitGeschuetztem: true });
    const res = await laden(app, k.mia);
    expect(res.statusCode, res.body).toBe(200);
    const bilanz = res.json() as { textGeaendert: string[]; nichtZugeordnet: string[] };
    // GEGENPROBE: der Weg trägt — sonst bewiese die Sperre unten nichts.
    expect(bilanz.textGeaendert).toContain(geschuetztId);
    expect(bilanz.nichtZugeordnet).not.toContain(LIEFERUNG.geschuetzt.key);
    await app.close();
  });

  it("Admin ohne Space-Leserecht: Bilanz Feld für Feld wie ohne das geschützte Objekt", async () => {
    const mit = await buehne({ mitGeschuetztem: true });
    const res = await laden(mit.app, mit.k.ada);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.body).not.toContain(mit.geschuetztId as string);

    const ohne = await buehne({ mitGeschuetztem: false });
    const vergleich = await laden(ohne.app, ohne.k.ada);
    expect(vergleich.statusCode, vergleich.body).toBe(200);
    // Keine Kennung, kein Zählwert, kein Datensatzschlüssel verrät das unsichtbare Objekt.
    expect(res.json()).toEqual(vergleich.json());
    expect(res.json().nichtZugeordnet).toContain(LIEFERUNG.geschuetzt.key);

    // Die Zuordnung blieb bestandsweit: Adas Lauf hat die Variante des geschützten Objekts
    // trotzdem geschrieben — das Mitglied liest sie danach in der Lieferfassung.
    const variante = await mit.app.inject({
      method: "GET",
      url: `/api/kos/${mit.geschuetztId}/lesevariante/${LIEFERUNG.sprache}`,
      headers: mit.k.mia,
    });
    expect(variante.statusCode, variante.body).toBe(200);
    expect(variante.json().title).not.toBe("Veraltete Übersetzung");
    // Und Ada selbst bekommt das Objekt auch auf diesem Weg nicht.
    const fremd = await mit.app.inject({
      method: "GET",
      url: `/api/kos/${mit.geschuetztId}/lesevariante/${LIEFERUNG.sprache}`,
      headers: mit.k.ada,
    });
    expect(fremd.statusCode).toBe(404);
    await mit.app.close();
    await ohne.app.close();
  });
});

// ------------------------------------------------------------------------------------------------
// Ben, Nacharbeit 13/14 — DER NEBENWEG ÜBER DAS PROTOKOLL. `GET /api/audit` und
// `GET /api/audit/export` (`ko.validate`) gaben objektbezogene Einträge (`ko.created`,
// `ko.space-changed`, die Ladebilanz …) ungefiltert aus. Gemessen wird jetzt das VOLLSTÄNDIGE
// API-Ergebnis — Liste ohne Filter, Exportdatei, Befund-Kennungen —, nicht ein vorab gefilterter
// Ausschnitt; dazu die berechtigte Einsicht des Mitglieds und die Prüfbarkeit der Datei, die
// tatsächlich ausgeliefert wird.
// ------------------------------------------------------------------------------------------------
interface ExportDatei {
  format: string;
  head?: unknown;
  inspection?: unknown;
  entries: (Partial<AuditEntry> & { action: string })[];
}

async function auditAbruf(app: App, kopf: Kopf, koId: string) {
  const liste = await app.inject({ method: "GET", url: "/api/audit", headers: kopf });
  expect(liste.statusCode, liste.body).toBe(200);
  const datei = await app.inject({ method: "GET", url: "/api/audit/export", headers: kopf });
  expect(datei.statusCode, datei.body.slice(0, 300)).toBe(200);
  const befunde = await app.inject({
    method: "GET",
    url: `/api/audit/ko/${koId}/findings`,
    headers: kopf,
  });
  expect(befunde.statusCode, befunde.body).toBe(200);
  return {
    listeRoh: liste.body,
    liste: liste.json() as AuditEntry[],
    dateiRoh: datei.body,
    datei: datei.json() as ExportDatei,
    befunde: befunde.json() as { ids: string[] },
  };
}

/** Die Form, die `ladeLesevarianten` bis Nacharbeit 13 schrieb — mit Kennung und Zählwerten. */
const alteLadebilanz = (geschuetztId: string) => ({
  actor: "alt",
  action: "lesevarianten.load",
  target: PAKET,
  payload: {
    records: 40,
    zugeordnet: 2,
    objekte: 2,
    neu: 0,
    aktualisiert: 2,
    textGeaendert: [geschuetztId],
    nichtZugeordnet: [],
    quellabgleichBestaetigt: 0,
    quellabgleichUnbestaetigt: 2,
  },
});

describe("Auditliste, Export und Befunde nach der Lesepolicy des Lesers", () => {
  it("Admin ohne Mitgliedschaft: keine Kennung im vollständigen Ergebnis; Export ist eine Leseransicht", async () => {
    const mit = await buehne({ mitGeschuetztem: true });
    const geschuetztId = mit.geschuetztId as string;
    expect((await laden(mit.app, mit.k.mia)).statusCode).toBe(200);
    await mit.services.audit.record(alteLadebilanz(geschuetztId));
    // Vorbedingung: die Kette TRÄGT die Kennung — als Ziel (`ko.created`, Space-Wechsel …) und in
    // der historischen Ladebilanz. Sonst bewiese das Fehlen unten nichts.
    const gespeichert = await mit.services.audit.list();
    expect(gespeichert.some((e) => e.target === geschuetztId)).toBe(true);
    expect(JSON.stringify(gespeichert)).toContain(geschuetztId);

    const ada = await auditAbruf(mit.app, mit.k.ada, geschuetztId);
    expect(ada.listeRoh).not.toContain(geschuetztId);
    expect(ada.dateiRoh).not.toContain(geschuetztId);
    expect(ada.befunde).toEqual({ ids: [] });
    // Die historische Ladebilanz geht an Ada gar nicht hinaus — ihre Zählwerte umfassen Unsichtbares.
    expect(ada.liste.some((e) => e.actor === "alt")).toBe(false);
    // Ada bekommt KEINE umgeschriebene Kette, sondern eine als solche gekennzeichnete Ansicht.
    expect(ada.datei.format).toBe("klarwerk-audit-ansicht");
    expect(ada.datei.head).toBeUndefined();
    expect(ada.datei.inspection).toBeUndefined();
    for (const e of ada.datei.entries) {
      expect(e.hash).toBeUndefined();
      expect(e.prevHash).toBeUndefined();
    }
    // Was Ada sehen darf, bleibt: die Anlage des offenen Objekts steht in Liste und Ansicht.
    expect(ada.liste.some((e) => e.target === mit.offenId)).toBe(true);
    expect(ada.datei.entries.some((e) => e.target === mit.offenId)).toBe(true);
    await mit.app.close();
  });

  it("Mitglied: berechtigte Einsicht — volle Kette samt historischer Ladebilanz, außerhalb prüfbar", async () => {
    const mit = await buehne({ mitGeschuetztem: true });
    const geschuetztId = mit.geschuetztId as string;
    expect((await laden(mit.app, mit.k.mia)).statusCode).toBe(200);
    await mit.services.audit.record(alteLadebilanz(geschuetztId));

    const mia = await auditAbruf(mit.app, mit.k.mia, geschuetztId);
    expect(mia.liste.some((e) => e.target === geschuetztId)).toBe(true);
    expect(mia.liste.some((e) => e.actor === "alt")).toBe(true);
    expect(mia.datei.format).toBe("klarwerk-audit-export");
    const eintraege = mia.datei.entries as AuditEntry[];
    // Der historische Ladeeintrag steht UNVERÄNDERT in der ausgelieferten Datei …
    const alt = eintraege.find((e) => e.actor === "alt");
    expect(alt?.payload.textGeaendert).toEqual([geschuetztId]);
    // … und genau DIESE Datei rechnet sich außerhalb nach: Kette und jeder Einzelhash.
    expect(verifyChain(eintraege)).toBe(true);
    for (const e of eintraege) {
      const { hash, ...material } = e;
      expect(hashEntryFuerVersion(material)).toBe(hash);
    }
    await mit.app.close();
  });

  it("die gespeicherte Kette bleibt unverändert prüfbar, auch nach dem Abruf der Leseransicht", async () => {
    const mit = await buehne({ mitGeschuetztem: true });
    await mit.services.audit.record(alteLadebilanz(mit.geschuetztId as string));
    await auditAbruf(mit.app, mit.k.ada, mit.geschuetztId as string);
    const pruefung = await mit.app.inject({
      method: "GET",
      url: "/api/audit/verify",
      headers: mit.k.mia,
    });
    expect(pruefung.statusCode, pruefung.body).toBe(200);
    expect(pruefung.json().ok).toBe(true);
    expect(verifyChain(await mit.services.audit.list())).toBe(true);
    await mit.app.close();
  });
});

// ------------------------------------------------------------------------------------------------
// Ben, Nacharbeit 15 — GELÖSCHTE OBJEKTE, INDIREKTE BEFUNDE, METADATEN.
// ------------------------------------------------------------------------------------------------

/** Ersetzt Kennungen (in Reihenfolge des Auftretens) und Zeitstempel durch Platzhalter. */
function normalisiert(roh: string): unknown {
  const nummer = new Map<string, string>();
  const ohneKennung = roh.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    (id) => {
      const vorhanden = nummer.get(id);
      if (vorhanden) {
        return vorhanden;
      }
      const neu = `<id-${nummer.size + 1}>`;
      nummer.set(id, neu);
      return neu;
    },
  );
  return JSON.parse(
    ohneKennung.replace(/\d{4}-\d{2}-\d{2}T\d{2}[:-]\d{2}[:-]\d{2}[.-]\d{3}Z/g, "<zeit>"),
  );
}

describe("Protokoll nach Endlöschung und für indirekte Befundbezüge", () => {
  it("Endlöschung gibt die verborgenen Einträge NICHT frei; das Mitglied sieht die Löschung", async () => {
    const mit = await buehne({ mitGeschuetztem: true });
    const geschuetztId = mit.geschuetztId as string;
    // Vorher: verborgen — die Ausgangslage, sonst bewiese das Danach nichts.
    expect((await auditAbruf(mit.app, mit.k.ada, geschuetztId)).listeRoh).not.toContain(
      geschuetztId,
    );
    // Der vorgesehene Löschweg: Papierkorb, dann endgültig (purgeKo, `ko.purged`).
    await mit.services.ko.delete(geschuetztId, mit.ids.erik);
    await mit.services.ko.purgeTrashed(geschuetztId, mit.ids.erik);
    const fakten = await mit.services.ko.sichtbarkeitsfaktenAller();
    expect(
      fakten.some((f) => f.id === geschuetztId),
      "das Objekt ist wirklich weg",
    ).toBe(false);

    const ada = await auditAbruf(mit.app, mit.k.ada, geschuetztId);
    expect(ada.listeRoh).not.toContain(geschuetztId);
    expect(ada.dateiRoh).not.toContain(geschuetztId);
    expect(ada.befunde).toEqual({ ids: [] });
    expect(ada.listeRoh).not.toContain("Geschütztes Onboarding");

    // GEGENPROBE: das Mitglied liest die Löschung und die früheren Einträge weiter.
    const mia = await auditAbruf(mit.app, mit.k.mia, geschuetztId);
    expect(mia.liste.some((e) => e.action === "ko.purged" && e.target === geschuetztId)).toBe(true);
    expect(mia.liste.some((e) => e.action === "ko.created" && e.target === geschuetztId)).toBe(
      true,
    );
    expect(mia.datei.format).toBe("klarwerk-audit-export");
    expect(verifyChain(mia.datei.entries as AuditEntry[])).toBe(true);
    await mit.app.close();
  });

  it("Befundbelege ohne Objektkennung: zugeordnet über den Befund, nicht zuzuordnen ⇒ verborgen", async () => {
    const mit = await buehne({ mitGeschuetztem: true });
    const geschuetztId = mit.geschuetztId as string;
    const fassungA = (await mit.services.ko.get(geschuetztId))?.version as number;
    const fassungB = (await mit.services.ko.get(mit.offenId))?.version as number;
    await mit.services.conflicts.createAuto(
      {
        koA: geschuetztId,
        koB: mit.offenId,
        type: "truth",
        description: "Nacharbeit 15: Konflikt zwischen geschütztem und offenem Objekt",
        koAVersion: fassungA,
        koBVersion: fassungB,
      },
      { trigger: "background", method: "deterministic" },
    );
    const [konfliktId] = await mit.services.conflicts.idsForKo(geschuetztId);
    expect(konfliktId, "Vorbedingung: der Konflikt besteht").toBeTruthy();
    // Altbelege in der Form vor R-0766: nur die Befund-Kennung, keine `koIds`.
    await mit.services.audit.record({
      actor: "alt",
      action: "conflict.resolved",
      target: konfliktId as string,
    });
    const unbekannt = randomUUID();
    await mit.services.audit.record({
      actor: "alt",
      action: "overlap.kept-separate",
      target: unbekannt,
    });

    const ada = await auditAbruf(mit.app, mit.k.ada, mit.offenId);
    expect(ada.listeRoh).not.toContain(konfliktId as string);
    expect(ada.dateiRoh).not.toContain(konfliktId as string);
    expect(ada.listeRoh, "nicht zuzuordnen ⇒ verborgen").not.toContain(unbekannt);
    expect(ada.dateiRoh).not.toContain(unbekannt);
    // Befunde des SICHTBAREN Objekts: der Konflikt mit dem geschützten erscheint nicht.
    expect(ada.befunde.ids).not.toContain(konfliktId);

    // GEGENPROBE: das Mitglied (liest jeden Space) sieht beide Belege und den Befund.
    const mia = await auditAbruf(mit.app, mit.k.mia, mit.offenId);
    expect(mia.liste.some((e) => e.target === konfliktId && e.actor === "alt")).toBe(true);
    expect(mia.liste.some((e) => e.target === unbekannt)).toBe(true);
    expect(mia.befunde.ids).toContain(konfliktId);
    await mit.app.close();
  });
});

describe("Metadaten: vollständige Antworten mit und ohne geschützte Vorgänge", () => {
  async function ablauf(mitGeschuetztem: boolean) {
    const b = await buehne({ mitGeschuetztem });
    // Ein berechtigter Vollexport VORAB — sein Beleg (`audit.exported`) trägt Zähler und Kopf der
    // ganzen Kette und liegt danach in der Historie, die Ada liest.
    const voll = await b.app.inject({ method: "GET", url: "/api/audit/export", headers: b.k.mia });
    expect(voll.statusCode).toBe(200);
    expect((voll.json() as { format: string }).format).toBe("klarwerk-audit-export");
    const ada = {
      liste: await b.app.inject({ method: "GET", url: "/api/audit", headers: b.k.ada }),
      pruefung: await b.app.inject({ method: "GET", url: "/api/audit/verify", headers: b.k.ada }),
      datei: await b.app.inject({ method: "GET", url: "/api/audit/export", headers: b.k.ada }),
    };
    const mia = await b.app.inject({ method: "GET", url: "/api/audit/verify", headers: b.k.mia });
    await b.app.close();
    return { ada, mia: mia.json() as { ok: boolean; count: number }, b };
  }

  it("Ada liest Liste, Prüfbericht und Export Feld für Feld wie ohne die geschützten Vorgänge", async () => {
    const mit = await ablauf(true);
    const ohne = await ablauf(false);
    for (const [weg, a, o] of [
      ["Liste", mit.ada.liste, ohne.ada.liste],
      ["Prüfbericht", mit.ada.pruefung, ohne.ada.pruefung],
      ["Export", mit.ada.datei, ohne.ada.datei],
    ] as const) {
      expect(a.statusCode, weg).toBe(200);
      expect(normalisiert(a.body), weg).toEqual(normalisiert(o.body));
      expect(a.body, weg).not.toContain(mit.b.geschuetztId as string);
    }
    // Keine Kettenfelder, keine globalen Zählwerte in der Ansicht.
    const liste = mit.ada.liste.json() as Record<string, unknown>[];
    for (const e of liste) {
      expect("hash" in e || "prevHash" in e || "hashVersion" in e).toBe(false);
    }
    expect(liste.map((e) => e.seq)).toEqual(liste.map((_, i) => i + 1));
    const exportBeleg = liste.find((e) => e.action === "audit.exported");
    expect(exportBeleg?.payload).toEqual({});

    // GEGENPROBE: die berechtigte Kettenprüfung bleibt — über die GANZE Kette, also mit den
    // geschützten Vorgängen mehr Einträge als ohne.
    expect(mit.mia.ok).toBe(true);
    expect(ohne.mia.ok).toBe(true);
    expect(mit.mia.count).toBeGreaterThan(ohne.mia.count);
  });
});
