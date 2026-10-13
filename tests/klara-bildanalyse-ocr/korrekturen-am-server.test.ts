// ================================================================================================
// OCR-E02 · BERICHTIGTER BILDTEXT AM ECHTEN SERVER — Speichern, Neuladen, Rückgängig, Rücksetzen,
// Bindung an Quelle und Bildfassung, Nutzer- und Rollenregeln.
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-fundstellen-korrekturen, Kriterien K6, K7, K8, K9 (mit K11).
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos()))`, `app.inject`)
// mit fiktiven Konten. Die Berichtigungen liegen im vorhandenen Assistenzprofil (W17) unter
// `/api/me/assistenz/bildkorrekturen`.
//
//   S1  K6 — setzen; eine NEUE Anmeldung („Neuladen“, zweites Gerät) liest dieselbe Berichtigung;
//       ein anderes Profilschreiben (Name, Einstellung) lässt sie stehen.
//   S2  K7 — rückgängig holt die frühere Berichtigung, danach den Rohbefund; zurücksetzen entfernt
//       sie ganz. Gespeichert wird nur Text — keine Bilddaten.
//   S3  K8 — gebunden an Quelle UND Bildfassung: andere Quelle oder andere Bytes haben keine.
//   S4  K9 — Rollen: Betrachter (viewer) darf nicht berichtigen (403, `darfBearbeiten: false`);
//       ein zweites Konto sieht nichts; eine fremde Kontokennung → 403, nichts geändert.
//   S5  Ungültige Eingaben → 400, nichts gespeichert; das Prüfprotokoll nennt keinen Text.
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

let services: AppServices;
let app: App;
let erik = { id: "", token: "" };
let vera = { id: "", token: "" };
let clara = { id: "", token: "" };

const BASIS = "/api/me/assistenz/bildkorrekturen";
const BILD_A = `sha256:${"a".repeat(64)}`;
const BILD_A_VERAENDERT = `sha256:${"b".repeat(64)}`;
const QUELLE = "office:anhang-1";

interface Antwort {
  darfBearbeiten: boolean;
  korrekturen: {
    quelle: string;
    inhaltskennung: string;
    ort: string | null;
    text: string;
    schritte: number;
  }[];
}

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(adminToken: string, rolle: string, email: string, name: string) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email) };
}

const auf = (wer: string, methode: "GET" | "PUT", payload?: unknown, url = BASIS) =>
  app.inject({
    method: methode,
    url,
    headers: { authorization: `Bearer ${wer}` },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

async function lies(wer: string): Promise<Antwort> {
  const r = await auf(wer, "GET");
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Antwort;
}

async function aendere(wer: string, eingabe: Record<string, unknown>): Promise<Antwort> {
  const r = await auf(wer, "PUT", eingabe);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Antwort;
}

const setzen = (text: string, quelle = QUELLE, inhaltskennung = BILD_A) => ({
  aktion: "setzen",
  quelle,
  inhaltskennung,
  ort: "f1-b1",
  text,
});

beforeEach(async () => {
  services = assembleServices(inMemoryRepos());
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@bildkorrektur.test", password: "secret123" },
  });
  const adminToken = await anmelden("ada@bildkorrektur.test");
  erik = await konto(adminToken, "experte", "erik@bildkorrektur.test", "Erik Experte");
  vera = await konto(adminToken, "viewer", "vera@bildkorrektur.test", "Vera Viewer");
  clara = await konto(adminToken, "controller", "clara@bildkorrektur.test", "Clara Controller");
});

describe("S1 · K6 — Berichtigung übersteht Neuladen und andere Profiländerungen", () => {
  it("setzen; neue Anmeldung liest sie; Name und Einstellung ändern lässt sie stehen", async () => {
    expect(await lies(erik.token)).toEqual({ darfBearbeiten: true, korrekturen: [] });
    const gesetzt = await aendere(erik.token, setzen("Herr Müller zahlt 4.250 EUR"));
    expect(gesetzt.korrekturen).toEqual([
      {
        quelle: QUELLE,
        inhaltskennung: BILD_A,
        ort: "f1-b1",
        text: "Herr Müller zahlt 4.250 EUR",
        schritte: 0,
        geaendertAm: expect.any(String),
      },
    ]);

    // „Neuladen“: eine neue Anmeldung liest denselben Stand.
    const zweite = await anmelden("erik@bildkorrektur.test");
    expect((await lies(zweite)).korrekturen.map((k) => k.text)).toEqual([
      "Herr Müller zahlt 4.250 EUR",
    ]);

    // Andere Schreiber am selben Profil lassen die Berichtigung stehen.
    const einstellung = { bildAutomatik: false, fassung: 0 };
    const profil = await auf(zweite, "PUT", einstellung, "/api/me/assistenz");
    expect(profil.statusCode, profil.body).toBe(200);
    const name = await auf(
      zweite,
      "PUT",
      { name: "Mia", avatar: "eule", einrichtungAbschliessen: true, fassung: 1 },
      "/api/me/assistenz",
    );
    expect(name.statusCode, name.body).toBe(200);
    expect((await lies(zweite)).korrekturen.map((k) => k.text)).toEqual([
      "Herr Müller zahlt 4.250 EUR",
    ]);

    // Dasselbe Bild noch einmal mit demselben Text: nichts ändert sich (kein neuer Schritt).
    const gleich = await aendere(zweite, setzen("Herr Müller zahlt 4.250 EUR"));
    expect(gleich.korrekturen[0]?.schritte).toBe(0);
  });
});

describe("S2 · K7 — rückgängig und zurücksetzen stellen den Rohbefund wieder her", () => {
  it("zwei Berichtigungen, rückgängig, rückgängig, dann zurücksetzen", async () => {
    await aendere(erik.token, setzen("Herr Müller"));
    const zweite = await aendere(erik.token, setzen("Herr Müller-Lüdenscheidt"));
    expect(zweite.korrekturen[0]).toMatchObject({ text: "Herr Müller-Lüdenscheidt", schritte: 1 });

    const zurueck = await aendere(erik.token, {
      aktion: "rueckgaengig",
      quelle: QUELLE,
      inhaltskennung: BILD_A,
    });
    expect(zurueck.korrekturen[0]).toMatchObject({ text: "Herr Müller", schritte: 0 });

    // Kein früherer Schritt mehr: rückgängig heißt jetzt „Rohbefund“ — die Berichtigung entfällt.
    const roh = await aendere(erik.token, {
      aktion: "rueckgaengig",
      quelle: QUELLE,
      inhaltskennung: BILD_A,
    });
    expect(roh.korrekturen).toEqual([]);

    await aendere(erik.token, setzen("Herr Müller"));
    const zurueckgesetzt = await aendere(erik.token, {
      aktion: "zuruecksetzen",
      quelle: QUELLE,
      inhaltskennung: BILD_A,
    });
    expect(zurueckgesetzt.korrekturen).toEqual([]);
    expect((await lies(erik.token)).korrekturen).toEqual([]);

    // Gespeichert wird nur die Bindung und Text — keine Bilddaten, keine data-URL.
    const p = await services.assistenzProfile.hole(erik.id);
    expect(JSON.stringify(p ?? {})).not.toMatch(/data:image|base64/);
  });
});

describe("S3 · K8 — keine Übertragung auf eine andere Quelle oder ein verändertes Bild", () => {
  it("dieselbe Quelle mit anderen Bytes und andere Quelle mit denselben Bytes: getrennt", async () => {
    await aendere(erik.token, setzen("LAGER 29"));
    await aendere(erik.token, setzen("LAGER 30", QUELLE, BILD_A_VERAENDERT));
    await aendere(erik.token, setzen("ANDERE DATEI", "datei:fremd.pptx", BILD_A));
    const stand = await lies(erik.token);
    const finde = (quelle: string, kennung: string) =>
      stand.korrekturen.filter((k) => k.quelle === quelle && k.inhaltskennung === kennung);
    expect(finde(QUELLE, BILD_A).map((k) => k.text)).toEqual(["LAGER 29"]);
    expect(finde(QUELLE, BILD_A_VERAENDERT).map((k) => k.text)).toEqual(["LAGER 30"]);
    expect(finde("datei:fremd.pptx", BILD_A).map((k) => k.text)).toEqual(["ANDERE DATEI"]);

    // Zurücksetzen einer Bildfassung lässt die anderen unberührt.
    await aendere(erik.token, {
      aktion: "zuruecksetzen",
      quelle: QUELLE,
      inhaltskennung: BILD_A_VERAENDERT,
    });
    const danach = await lies(erik.token);
    expect(danach.korrekturen.map((k) => k.text).sort()).toEqual(["ANDERE DATEI", "LAGER 29"]);
  });
});

describe("S4 · K9 — bestehende Nutzer- und Rollenregeln gelten für Bearbeitung und Gespeichertes", () => {
  it("Betrachter: darf nicht berichtigen (403), sieht keine fremden Berichtigungen", async () => {
    await aendere(erik.token, setzen("Herr Müller"));
    expect(await lies(vera.token)).toEqual({ darfBearbeiten: false, korrekturen: [] });
    const verboten = await auf(vera.token, "PUT", setzen("Versuch"));
    expect(verboten.statusCode).toBe(403);
    expect(await lies(vera.token)).toEqual({ darfBearbeiten: false, korrekturen: [] });
    // Ohne Anmeldung: 401 für Lesen und Schreiben.
    const anonymLesen = await app.inject({ method: "GET", url: BASIS });
    expect(anonymLesen.statusCode).toBe(401);
    const anonymSchreiben = await app.inject({ method: "PUT", url: BASIS, payload: setzen("x") });
    expect(anonymSchreiben.statusCode).toBe(401);
  });

  it("zweites Konto mit Schreibrecht: eigene, getrennte Berichtigungen", async () => {
    await aendere(erik.token, setzen("Herr Müller"));
    expect(await lies(clara.token)).toEqual({ darfBearbeiten: true, korrekturen: [] });
    await aendere(clara.token, setzen("Frau Schmidt"));
    expect((await lies(erik.token)).korrekturen.map((k) => k.text)).toEqual(["Herr Müller"]);
    expect((await lies(clara.token)).korrekturen.map((k) => k.text)).toEqual(["Frau Schmidt"]);
  });

  it("eine fremde Kontokennung im Rumpf oder in der Adresse → 403, nichts geändert", async () => {
    await aendere(erik.token, setzen("Herr Müller"));
    const fremd = await auf(clara.token, "PUT", { ...setzen("Übernahme"), kontoId: erik.id });
    expect(fremd.statusCode).toBe(403);
    const fremdLesen = await auf(clara.token, "GET", undefined, `${BASIS}?kontoId=${erik.id}`);
    expect(fremdLesen.statusCode).toBe(403);
    expect((await lies(erik.token)).korrekturen.map((k) => k.text)).toEqual(["Herr Müller"]);
    expect((await lies(clara.token)).korrekturen).toEqual([]);
  });
});

describe("S5 · ungültige Eingaben und Prüfprotokoll", () => {
  it("unbekannte Aktion, falsche Kennung, Steuerzeichen, zu lang → 400 mit Grund", async () => {
    const faelle: [Record<string, unknown>, string][] = [
      [{ aktion: "loeschen", quelle: QUELLE, inhaltskennung: BILD_A }, "aktion"],
      [setzen("x", QUELLE, "md5:abc"), "inhaltskennung"],
      [setzen("x", ""), "quelle"],
      [setzen("Text mit \u0007 Glocke"), "text"],
      [setzen("x".repeat(10_001)), "text"],
    ];
    for (const [eingabe, grund] of faelle) {
      const r = await auf(erik.token, "PUT", eingabe);
      expect([r.statusCode, (r.json() as { grund?: string }).grund]).toEqual([400, grund]);
    }
    expect((await lies(erik.token)).korrekturen).toEqual([]);
    // Zeilenumbrüche sind erlaubt (Textpassagen).
    const mehrzeilig = await aendere(erik.token, setzen("Zeile 1\nZeile 2"));
    expect(mehrzeilig.korrekturen[0]?.text).toBe("Zeile 1\nZeile 2");
  });

  it("das Prüfprotokoll vermerkt das Ereignis, nie den Text", async () => {
    await aendere(erik.token, setzen("GEHEIMER BILDTEXT 4711"));
    const eintraege = await services.audit.list();
    const ereignis = eintraege.filter((e) => e.action === "assistenz.bildkorrektur.geaendert");
    expect(ereignis).toHaveLength(1);
    expect(JSON.stringify(eintraege)).not.toContain("GEHEIMER BILDTEXT");
  });
});
