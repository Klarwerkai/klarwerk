// ================================================================================================
// AW06-K02 (Ben, Nacharbeit 4) — DIE ANNAHME NENNT FASSUNG, PERSON, ZEITPUNKT UND KONTOREGEL.
// ================================================================================================
//
// Vorher hielt der Entscheidungsbeleg nur `verdict`/`koVersion` fest; welche Prüfregel galt —
// einschliesslich der erforderlichen Freigabezahl —, stand nirgends. Und die beiden Freigabewege
// des Wissensobjekt-Dienstes (Überarbeiten-und-Freigeben, Übernahme eines Vorschlags) hängten gar
// keinen Verweis auf ihren Beleg an die neue Fassung.
//
// GEMESSEN AM ECHTEN HTTP-WEG mit echten Rollen. Je Kontoweg ein Fall:
//   A1 Bewertungsweg (Peer-Prüfung, mit Freigabezahl) · A2 Admin-Freigabe (direkte Annahme)
//   A3 Überarbeiten und Freigeben (direkte Annahme) · A4 Pflichtprüfung · A5 freiwillige
//   Zweitprüfung · A6 Gegenprobe: eine Inhaltsänderung übernimmt die frühere Annahme nicht.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

interface Annahme {
  fassung: number;
  person: string;
  zeitpunkt: string;
  kontoregel: string | null;
  benoetigt?: number;
}

interface Stand {
  version: number;
  status: string;
  annahme?: Annahme;
  proposals?: { id: string }[];
}

async function anmelden(app: App, email: string): Promise<Kopf> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

async function konto(app: App, admin: Kopf, rolle: string, email: string) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: { name: `Konto ${email}`, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return { kopf: await anmelden(app, email), id: (angelegt.json() as { id: string }).id };
}

async function buehne() {
  const app = buildApp(buildServices());
  const erst = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@aw.test", password: "secret123" },
  });
  const adminId = (erst.json() as { id: string }).id;
  const admin = { kopf: await anmelden(app, "pedi@aw.test"), id: adminId };
  return {
    app,
    admin,
    admin2: await konto(app, admin.kopf, "admin", "ada@aw.test"),
    controller: await konto(app, admin.kopf, "controller", "carl@aw.test"),
    experte: await konto(app, admin.kopf, "experte", "eva@aw.test"),
  };
}

async function anlegen(app: App, kopf: Kopf, neededValidations?: number): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: kopf,
    payload: {
      confidentiality: "intern",
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
      ...(neededValidations === undefined ? {} : { neededValidations }),
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { id: string }).id;
}

async function put(app: App, kopf: Kopf, id: string, payload: Record<string, unknown>) {
  const res = await app.inject({ method: "PUT", url: `/api/kos/${id}`, headers: kopf, payload });
  expect(res.statusCode, res.body).toBe(200);
  return res;
}

async function stand(app: App, kopf: Kopf, id: string): Promise<Stand> {
  const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: kopf });
  expect(res.statusCode).toBe(200);
  return res.json() as Stand;
}

function zeitpunktGueltig(annahme: Annahme | undefined): boolean {
  return !Number.isNaN(Date.parse(annahme?.zeitpunkt ?? ""));
}

describe("AW06-K02 · die Annahme nennt ihre Kontoregel", () => {
  it("A1 · Bewertungsweg: Peer-Prüfung mit der Freigabezahl, die für die Fassung galt", async () => {
    const b = await buehne();
    const id = await anlegen(b.app, b.admin.kopf, 2);
    await put(b.app, b.controller.kopf, id, { action: "rate", verdict: "up" });
    expect((await stand(b.app, b.experte.kopf, id)).annahme).toBeUndefined();
    await put(b.app, b.admin2.kopf, id, { action: "rate", verdict: "up" });

    const s = await stand(b.app, b.experte.kopf, id);
    expect(s.status).toBe("validiert");
    expect(s.annahme).toMatchObject({
      fassung: s.version,
      person: b.admin2.id,
      kontoregel: "peer-pruefung",
      benoetigt: 2,
    });
    expect(zeitpunktGueltig(s.annahme)).toBe(true);
  });

  it("A2 · Admin-Freigabe: direkte Annahme durch ein Konto mit Freigaberecht", async () => {
    const b = await buehne();
    const id = await anlegen(b.app, b.experte.kopf);
    await put(b.app, b.admin.kopf, id, { action: "admin-validate" });
    const s = await stand(b.app, b.experte.kopf, id);
    expect(s.annahme).toMatchObject({
      fassung: s.version,
      person: b.admin.id,
      kontoregel: "direktannahme",
    });
    expect(s.annahme?.benoetigt).toBeUndefined();
  });

  it("A3 · Überarbeiten und Freigeben: die NEUE Fassung trägt ihre direkte Annahme", async () => {
    const b = await buehne();
    const id = await anlegen(b.app, b.admin.kopf);
    await put(b.app, b.admin.kopf, id, { action: "admin-validate" });
    const vorher = await stand(b.app, b.admin.kopf, id);
    await put(b.app, b.admin2.kopf, id, {
      action: "revise-release",
      changes: { statement: "Bei Überdruck Ventil X sofort manuell schließen." },
      expectedVersion: vorher.version,
    });
    const s = await stand(b.app, b.experte.kopf, id);
    expect(s.version).toBe(vorher.version + 1);
    expect(s.annahme).toMatchObject({
      fassung: s.version,
      person: b.admin2.id,
      kontoregel: "direktannahme",
    });
  });

  it("A4 · Pflichtprüfung: der Experte reicht ein, eine andere Person nimmt an", async () => {
    const b = await buehne();
    const id = await anlegen(b.app, b.admin.kopf);
    await put(b.app, b.admin.kopf, id, { action: "admin-validate" });
    const vorher = await stand(b.app, b.admin.kopf, id);
    await put(b.app, b.experte.kopf, id, {
      action: "propose",
      proposal: { statement: "Ventil X zusätzlich verplomben.", baseVersion: vorher.version },
    });
    const vorschlag = (await stand(b.app, b.admin.kopf, id)).proposals?.[0]?.id ?? "";
    await put(b.app, b.admin.kopf, id, {
      action: "decide-proposal",
      proposalId: vorschlag,
      decision: "uebernehmen",
      expectedVersion: vorher.version,
    });
    const s = await stand(b.app, b.experte.kopf, id);
    expect(s.annahme).toMatchObject({
      fassung: vorher.version + 1,
      person: b.admin.id,
      kontoregel: "pflichtpruefung",
    });
  });

  it("A5 · freiwillige Zweitprüfung: ein Konto mit Freigaberecht gibt zur Prüfung, ein anderes nimmt an", async () => {
    const b = await buehne();
    const id = await anlegen(b.app, b.admin.kopf);
    await put(b.app, b.admin.kopf, id, { action: "admin-validate" });
    const vorher = await stand(b.app, b.admin.kopf, id);
    await put(b.app, b.admin2.kopf, id, {
      action: "propose",
      proposal: { statement: "Ventil X zusätzlich verplomben.", baseVersion: vorher.version },
    });
    const vorschlag = (await stand(b.app, b.admin.kopf, id)).proposals?.[0]?.id ?? "";
    await put(b.app, b.admin.kopf, id, {
      action: "decide-proposal",
      proposalId: vorschlag,
      decision: "uebernehmen",
      expectedVersion: vorher.version,
    });
    const s = await stand(b.app, b.experte.kopf, id);
    expect(s.annahme).toMatchObject({
      fassung: vorher.version + 1,
      person: b.admin.id,
      kontoregel: "freiwillige-zweitpruefung",
    });
  });

  it("A7 · eine gelbe Stimme an der weiter validierten Fassung verdrängt die Annahme nicht und wird keine", async () => {
    const b = await buehne();
    const controller2 = await konto(b.app, b.admin.kopf, "controller", "cleo@aw.test");
    const id = await anlegen(b.app, b.admin.kopf, 3);
    await put(b.app, b.controller.kopf, id, { action: "rate", verdict: "up" });
    await put(b.app, b.admin2.kopf, id, { action: "rate", verdict: "up" });
    await put(b.app, b.admin.kopf, id, { action: "rate", verdict: "up" });
    const angenommen = await stand(b.app, b.experte.kopf, id);
    expect(angenommen.status).toBe("validiert");
    expect(angenommen.annahme).toMatchObject({
      person: b.admin.id,
      kontoregel: "peer-pruefung",
      benoetigt: 3,
    });

    // Die zusätzliche gelbe Stimme: Status bleibt validiert (3 grün, 0 rot), der neueste
    // Entscheidungsverweis zeigt jetzt auf die Rückgabe.
    await put(b.app, controller2.kopf, id, { action: "rate", verdict: "warn" });
    const danach = await stand(b.app, b.experte.kopf, id);
    expect(danach.status).toBe("validiert");
    expect(danach.version).toBe(angenommen.version);
    // Die Annahme steht unverändert da — dieselbe Person, derselbe Zeitpunkt, dieselbe Regel.
    expect(danach.annahme).toEqual(angenommen.annahme);
    // Gegenprobe: die gelbe Stimme ist NICHT zur Annahme umgedeutet worden.
    expect(danach.annahme?.person).not.toBe(controller2.id);
  });

  it("A8 · eine weitere grüne Stimme an der validierten Fassung ersetzt die erste Annahme nicht", async () => {
    const b = await buehne();
    const id = await anlegen(b.app, b.admin.kopf, 1);
    await put(b.app, b.controller.kopf, id, { action: "rate", verdict: "up" });
    const erst = (await stand(b.app, b.experte.kopf, id)).annahme;
    expect(erst?.person).toBe(b.controller.id);
    await put(b.app, b.admin2.kopf, id, { action: "rate", verdict: "up" });
    expect((await stand(b.app, b.experte.kopf, id)).annahme).toEqual(erst);
  });

  it("A6 · GEGENPROBE: eine Inhaltsänderung übernimmt die frühere Annahme nicht", async () => {
    const b = await buehne();
    const id = await anlegen(b.app, b.experte.kopf);
    await put(b.app, b.admin.kopf, id, { action: "admin-validate" });
    expect((await stand(b.app, b.experte.kopf, id)).annahme?.kontoregel).toBe("direktannahme");
    const vorher = await stand(b.app, b.admin.kopf, id);
    await put(b.app, b.admin.kopf, id, {
      action: "revise",
      changes: { statement: "Bei Überdruck Ventil X und Y manuell schließen." },
      expectedVersion: vorher.version,
    });
    const s = await stand(b.app, b.experte.kopf, id);
    expect(s.version).toBe(vorher.version + 1);
    expect(s.status).toBe("offen");
    expect(s.annahme).toBeUndefined();
  });
});
