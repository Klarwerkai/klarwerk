// ================================================================================================
// produkt:20261010:poc-wiederherstellung-export — DER FIKTIVE, ZUSAMMENHÄNGENDE BESTAND DER PROBE.
// ================================================================================================
//
// Eine Wahrheit für beide Prüfstände: `wissenspaket.test.ts` (Speicherablage) und
// `zusammenhang.integration.test.ts` (echte PostgreSQL, Sicherung und Restore). Angelegt wird
// ausschließlich über die echten Routen der Anwendung — kein SQL-Handstreich:
//
//   Konten   Ada (admin, liest in beiden Spaces mit), Anna (experte, Werk Nord), Bert (experte,
//            Werk Süd), Vera (viewer), Carl (controller, in keinem Space)
//   Spaces   „Werk Nord (fiktiv)“ und „Werk Süd (fiktiv)“, beide nur für Mitglieder
//   Beiträge Nord: zwei Inhaltsfassungen, Originalanhang, Quelle auf den Anhang, benannte
//            Verantwortung, Freigabe, Beziehungen zu Süd und Offen
//            Süd, Offen (kein Space), Geheim (vertraulich) — je freigegeben
//
// Alle Namen, Texte und Bytes sind erfunden.
import JSZip from "jszip";
import { expect } from "vitest";
import type { buildApp } from "../../services/app/src/build-app";
import type { WissenspaketManifest } from "../../services/app/src/wissenspaket";

export type App = ReturnType<typeof buildApp>;
export type Kopf = Record<string, string>;
export type Wer = "admin" | "anna" | "bert" | "vera" | "carl";

export const KENNWORT = "fiktiv-paket-2026";
export const KONTEN: Record<Wer, { name: string; email: string; role?: string }> = {
  admin: { name: "Ada Verwaltung", email: "ada-paket@example.test" },
  anna: { name: "Anna Nord", email: "anna-paket@example.test", role: "experte" },
  bert: { name: "Bert Sued", email: "bert-paket@example.test", role: "experte" },
  vera: { name: "Vera Leserin", email: "vera-paket@example.test", role: "viewer" },
  carl: { name: "Carl Pruefer", email: "carl-paket@example.test", role: "controller" },
};

export const NORD_TITEL = "Fiktiv: Ventil N-12 vor dem Anfahren prüfen";
export const NORD_V1 = "Vor dem Anfahren das Ventil N-12 per Hand prüfen.";
export const NORD_V2 = "Vor dem Anfahren das Ventil N-12 per Hand prüfen und den Druck notieren.";
export const SUED_TITEL = "Fiktiv: Kühlkreislauf Süd entlüften";
export const OFFEN_TITEL = "Fiktiv: Schichtübergabe offen dokumentieren";
export const GEHEIM_TITEL = "Fiktiv: Lieferantenkonditionen vertraulich";
export const ANHANG_NAME = "Prüfprotokoll N-12 (fiktiv).pdf";
export const SPACE_NORD = "Werk Nord (fiktiv)";
export const SPACE_SUED = "Werk Süd (fiktiv)";
/** Deterministische Bytes mit Nullbytes und hohen Bytes — daran fällt jede Umkodierung auf. */
export const ANHANG = Buffer.from(Array.from({ length: 64 }, (_, i) => (i * 37) % 256));

export interface Bestand {
  kopf: Record<Wer, Kopf>;
  kennung: Record<Wer, string>;
  nordId: string;
  suedId: string;
  offenId: string;
  geheimId: string;
  objektId: string;
}

export async function anmelden(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, `Anmeldung ${email}: ${res.body}`).toBe(200);
  return { authorization: `Bearer ${(res.json() as { token: string }).token}` };
}

async function lege(app: App, wer: Kopf, payload: Record<string, unknown>): Promise<string> {
  const res = await app.inject({ method: "POST", url: "/api/kos", headers: wer, payload });
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { id: string }).id;
}

async function aktion(
  app: App,
  wer: Kopf,
  id: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const res = await app.inject({ method: "PUT", url: `/api/kos/${id}`, headers: wer, payload });
  expect(res.statusCode, `${String(payload.action)}: ${res.body}`).toBeLessThan(300);
}

async function version(app: App, admin: Kopf, id: string): Promise<number> {
  const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: admin });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { version: number }).version;
}

/**
 * Ein geschlossener Space. Ada (Admin) liest mit: der Restore-Drill meldet sich mit ihrem Konto an
 * und liest den Anhangsbeleg des Nord-Beitrags zurück (Glied 7b) — ohne Leserecht wäre das ein
 * Aufbaufehler der Probe (Exit 62), kein Befund. Carl (controller) bleibt bewusst draußen.
 */
async function space(
  app: App,
  admin: Kopf,
  name: string,
  verantwortlich: string,
  mitleser: string,
) {
  const res = await app.inject({
    method: "POST",
    url: "/api/spaces",
    headers: admin,
    payload: {
      name,
      zweck: `${name} — fiktiver Berechtigungsraum der Abnahmeprobe.`,
      verantwortlich,
      zugang: "mitglieder",
      mitglieder: [
        { nutzer: verantwortlich, recht: "schreiben" },
        { nutzer: mitleser, recht: "lesen" },
      ],
      ansichten: [],
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { id: string }).id;
}

async function verschiebe(app: App, wer: Kopf, koId: string, zielSpaceId: string) {
  const v = await app.inject({
    method: "POST",
    url: "/api/spaces/verschiebung/vorschau",
    headers: wer,
    payload: { koId, zielSpaceId },
  });
  expect(v.statusCode, v.body).toBe(200);
  const vorschau = v.json() as { ziel: { version: number }; grundlage: string };
  const res = await app.inject({
    method: "POST",
    url: "/api/spaces/verschiebung",
    headers: wer,
    payload: {
      koId,
      zielSpaceId,
      basis: {
        quelleId: null,
        quelleVersion: null,
        zielId: zielSpaceId,
        zielVersion: vorschau.ziel.version,
        grundlage: vorschau.grundlage,
      },
    },
  });
  expect(res.statusCode, res.body).toBe(200);
}

async function beziehe(
  app: App,
  admin: Kopf,
  quelleId: string,
  zielId: string,
  schluessel: string,
) {
  const res = await app.inject({
    method: "POST",
    url: `/api/kos/${quelleId}/beziehungen`,
    headers: admin,
    payload: {
      zielId,
      art: "ergaenzt",
      richtung: "gerichtet",
      beitragSchluessel: schluessel,
      gesehen: {
        quelleVersion: await version(app, admin, quelleId),
        zielVersion: await version(app, admin, zielId),
      },
    },
  });
  expect(res.statusCode, res.body).toBe(201);
}

/** Legt den ganzen Bestand an. Das erste Konto wird Admin (FR-AUTH-01): die Ablage muss leer sein. */
export async function legeFiktivenBestand(app: App): Promise<Bestand> {
  const kopf = {} as Record<Wer, Kopf>;
  const kennung = {} as Record<Wer, string>;
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: KONTEN.admin.name, email: KONTEN.admin.email, password: KENNWORT },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  expect((reg.json() as { role: string }).role).toBe("admin");
  kennung.admin = (reg.json() as { id: string }).id;
  kopf.admin = await anmelden(app, KONTEN.admin.email);
  for (const wer of ["anna", "bert", "vera", "carl"] as const) {
    const k = KONTEN[wer];
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: kopf.admin,
      payload: { name: k.name, email: k.email, password: KENNWORT, role: k.role },
    });
    expect(res.statusCode, res.body).toBe(201);
    kennung[wer] = (res.json() as { id: string }).id;
    kopf[wer] = await anmelden(app, k.email);
  }

  // Nord: Anna erfasst, lädt hoch, hängt an und belegt die Quelle mit dem Anhang.
  const nordId = await lege(app, kopf.anna, {
    confidentiality: "intern",
    title: NORD_TITEL,
    statement: NORD_V1,
    type: "best_practice",
    category: "Werk Nord",
  });
  const upload = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: kopf.anna,
    payload: {
      name: ANHANG_NAME,
      mime: "application/pdf",
      data: `data:application/pdf;base64,${ANHANG.toString("base64")}`,
      confidentiality: "intern",
    },
  });
  expect(upload.statusCode, upload.body).toBe(201);
  const objektId = (upload.json() as { id: string }).id;
  await aktion(app, kopf.anna, nordId, {
    action: "attach",
    attachment: { name: ANHANG_NAME, mime: "application/pdf", objectId: objektId },
  });
  await aktion(app, kopf.anna, nordId, {
    action: "add-source",
    source: { label: "Prüfprotokoll N-12", excerpt: "Druck vor Anfahren notieren.", objectId },
  });
  // Verantwortung benennen, dann überarbeiten UND freigeben: zweite Inhaltsfassung, validiert.
  await aktion(app, kopf.admin, nordId, {
    action: "ownership",
    ownership: { owner: kennung.anna, ownerRole: "Instandhaltungsleitung Nord (fiktiv)" },
  });
  await aktion(app, kopf.admin, nordId, {
    action: "revise-release",
    changes: { statement: NORD_V2 },
  });

  const suedId = await lege(app, kopf.bert, {
    confidentiality: "intern",
    title: SUED_TITEL,
    statement: "Den Kühlkreislauf Süd vor dem Start entlüften.",
    type: "best_practice",
    category: "Werk Süd",
  });
  await aktion(app, kopf.admin, suedId, {
    action: "revise-release",
    changes: { statement: "Den Kühlkreislauf Süd vor jedem Start entlüften." },
  });
  const offenId = await lege(app, kopf.admin, {
    confidentiality: "intern",
    title: OFFEN_TITEL,
    statement: "Die Schichtübergabe wird im Schichtbuch dokumentiert.",
    type: "best_practice",
    category: "Allgemein",
  });
  await aktion(app, kopf.admin, offenId, {
    action: "revise-release",
    changes: { statement: "Die Schichtübergabe wird vollständig im Schichtbuch dokumentiert." },
  });
  const geheimId = await lege(app, kopf.admin, {
    confidentiality: "vertraulich",
    title: GEHEIM_TITEL,
    statement: "Konditionen nur im Einkauf besprechen.",
    type: "best_practice",
    category: "Einkauf",
  });
  await aktion(app, kopf.admin, geheimId, {
    action: "revise-release",
    changes: { statement: "Konditionen ausschließlich im Einkauf besprechen." },
  });

  // Beziehungen über die Raumgrenze hinweg, dann die Räume schließen.
  await beziehe(app, kopf.admin, nordId, suedId, "paket-nord-sued");
  await beziehe(app, kopf.admin, nordId, offenId, "paket-nord-offen");
  const nord = await space(app, kopf.admin, SPACE_NORD, kennung.anna, kennung.admin);
  const sued = await space(app, kopf.admin, SPACE_SUED, kennung.bert, kennung.admin);
  await verschiebe(app, kopf.anna, nordId, nord);
  await verschiebe(app, kopf.bert, suedId, sued);

  return { kopf, kennung, nordId, suedId, offenId, geheimId, objektId };
}

export interface Paket {
  roh: Buffer;
  zip: JSZip;
  manifest: WissenspaketManifest;
  texte: Map<string, string>;
}

/** Das Paket über die echte Route — und geöffnet wie mit jedem Entpackprogramm. */
export async function paketVon(app: App, wer: Kopf): Promise<Paket> {
  const res = await app.inject({
    method: "GET",
    url: "/api/library/export?format=paket",
    headers: wer,
  });
  expect(res.statusCode, res.body.slice(0, 400)).toBe(200);
  expect(res.headers["content-type"]).toContain("application/zip");
  expect(String(res.headers["content-disposition"])).toMatch(/klarwerk-wissenspaket-.*\.zip/);
  const roh = Buffer.from(res.rawPayload);
  const zip = await JSZip.loadAsync(roh);
  const texte = new Map<string, string>();
  for (const name of Object.keys(zip.files)) {
    const datei = zip.file(name);
    if (datei) {
      texte.set(name, await datei.async("string"));
    }
  }
  const manifest = JSON.parse(texte.get("MANIFEST.json") ?? "null") as WissenspaketManifest;
  expect(manifest?.format).toBe("klarwerk-wissenspaket");
  return { roh, zip, manifest, texte };
}

/**
 * Der Vergleichsstand eines Pakets: alles außer dem Zeitpunkt der Erstellung. Was nach einem
 * Restore gleich sein muss — Beiträge, Fassungen, Anhänge mit Prüfsumme, Quellen, Beziehungen,
 * Verantwortung, Freigabe, Rechte — steht hier; `erstelltAm` und die LIESMICH-Prüfsumme (sie nennt
 * den Zeitpunkt) nicht.
 */
export function vergleichsstand(p: Paket): unknown {
  const { erstelltAm: _zeit, dateien, ...rest } = p.manifest;
  return { ...rest, dateien: dateien.filter((d) => d.datei !== "LIESMICH.md") };
}
