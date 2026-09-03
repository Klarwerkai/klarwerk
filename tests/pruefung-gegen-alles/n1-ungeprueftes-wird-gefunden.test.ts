// ================================================================================================
// JOB 3020 · N1 — DER DRY-RUN SIEHT AUCH DEN UNGEPRUEFTEN BESTAND, UND DER TREFFER NENNT SEINEN ORT.
// ================================================================================================
//
// Pedis Diktat vom 30.07.: „Vor dem Einreichen sieht man, ob es das schon gibt — auch als
// ungepruefter Eintrag — und wo es liegt."
//
// AUSGANGSLAGE (gemessen an HEAD 7cf92ce): `POST /api/check-text` prueft ausschliesslich gegen den
// VALIDIERTEN Bestand — der Pool-Filter in `check-text-detection.ts` verlangte
// `k.status === "validiert"` auf BEIDEN Wegen (semantisch wie lexikalisch). Wer denselben
// Sachverhalt einreichte, der schon als noch nicht validiertes Wissensobjekt im Haus lag, bekam
// „nichts gefunden" und legte die Dublette an. Der Verlust entstand im Filter, NICHT an der Quelle:
// `findCandidates` ist statusneutral (`repo-candidates.test.ts:54-70`).
//
// DIE GRENZE BLEIBT, WO SIE WAR: Der Add-in-Weg ist auf `checktext.validated` verpflichtet und
// sieht weiterhin NUR Validiertes (F2). Vertrauliche Objekte erscheinen auf KEINEM Weg (F3) — der
// Riegel aus SCRUM-502 wird durch diese Runde nicht gelockert.
//
// Gefahren wird an der ECHTEN Route ueber `buildApp(buildServices())` mit `KLARWERK_ADDON_API=1`,
// nicht an einem nachgebauten Handler.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const ADDON_KEY_HEADER = "x-klarwerk-addon-key";
const KEY = "s3cr3t-addon-key";

// Near-identische Kerntexte → deterministischer Treffer (kein Modell, kein Textabfluss).
const TITEL = "Pumpe entlüften";
const SEED_STMT = "Nach dem Anfahren 10 Sekunden warten, dann die Pumpe entlüften.";
const CHECK_STMT = "Nach dem Anfahren 10 Sekunden warten und dann die Pumpe entlüften.";
// Kalibrierung: thematisch fremd, gleiche Laenge/Form — teilt kein Inhaltstoken mit dem Bestand.
const FREMD_STMT = "Die Buchhaltung schließt das Geschäftsjahr zum einunddreißigsten Dezember ab.";

const SAVED: Record<string, string | undefined> = {};
const KEYS = ["KLARWERK_ADDON_API", "KLARWERK_ADDON_API_KEY"];
beforeEach(() => {
  for (const k of KEYS) {
    SAVED[k] = process.env[k];
  }
  process.env.KLARWERK_ADDON_API = "1";
  process.env.KLARWERK_ADDON_API_KEY = KEY;
});
afterEach(() => {
  for (const k of KEYS) {
    if (SAVED[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = SAVED[k];
    }
  }
});

async function loggedInApp() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  return { app, headers };
}

type App = ReturnType<typeof buildApp>;

// Legt ein Wissensobjekt an und laesst es OFFEN (kein `rate` → status bleibt „offen").
async function seedOffen(
  app: App,
  headers: Record<string, string>,
  opts: { titel?: string; statement?: string; kategorie?: string } = {},
) {
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: opts.titel ?? TITEL,
      statement: opts.statement ?? SEED_STMT,
      type: "best_practice",
      category: opts.kategorie ?? "Instandhaltung",
      neededValidations: 1,
    },
  });
  return created.json().id as string;
}

// Legt ein VALIDIERTES Wissensobjekt an (POST + rate up → status „validiert").
async function seedValidiert(
  app: App,
  headers: Record<string, string>,
  opts: { titel?: string; statement?: string; kategorie?: string } = {},
) {
  const id = await seedOffen(app, headers, opts);
  await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers,
    payload: { action: "rate", verdict: "up" },
  });
  return id;
}

// Stuft ein Objekt hoch — der Vertraulichkeitsriegel ist der eigentliche Gegenstand von F3.
async function stufeVertraulich(app: App, headers: Record<string, string>, id: string) {
  const res = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers,
    payload: { action: "confidentiality", level: "vertraulich" },
  });
  expect(res.statusCode).toBe(200);
  expect(res.json().confidentiality).toBe("vertraulich");
}

function pruefeAlsMensch(app: App, headers: Record<string, string>, text: string, titel = TITEL) {
  return app.inject({
    method: "POST",
    url: "/api/check-text",
    headers,
    payload: { text, title: titel },
  });
}

function pruefeAlsAddon(app: App, text: string, titel = TITEL) {
  return app.inject({
    method: "POST",
    url: "/api/check-text",
    headers: { [ADDON_KEY_HEADER]: KEY },
    payload: { text, title: titel },
  });
}

describe("JOB 3020 N1: der angemeldete Mensch prüft gegen ALLES", () => {
  it("F1 · ein noch nicht validiertes Objekt wird gefunden und nennt Zustand + Kategorie", async () => {
    const { app, headers } = await loggedInApp();
    const offenId = await seedOffen(app, headers, { kategorie: "Instandhaltung" });

    const res = await pruefeAlsMensch(app, headers, CHECK_STMT);
    expect(res.statusCode).toBe(200);
    const treffer = res.json().duplicates.find((d: { koId: string }) => d.koId === offenId);
    // Vor dieser Runde: der validated-only-Pool warf das Objekt weg → `duplicates: []`.
    expect(treffer, "das offene Objekt muss als Treffer erscheinen").toBeDefined();
    expect(treffer.koStatus).toBe("offen");
    expect(treffer.koCategory).toBe("Instandhaltung");
    expect(treffer.method).toBe("deterministic"); // kein Modell, kein Textabfluss
  });

  it("F4 · das validierte Objekt wird weiter gefunden und trägt koStatus 'validiert'", async () => {
    const { app, headers } = await loggedInApp();
    const validId = await seedValidiert(app, headers, { kategorie: "Wartung" });

    const res = await pruefeAlsMensch(app, headers, CHECK_STMT);
    expect(res.statusCode).toBe(200);
    const treffer = res.json().duplicates.find((d: { koId: string }) => d.koId === validId);
    expect(treffer, "das validierte Objekt bleibt ein Treffer").toBeDefined();
    expect(treffer.koStatus).toBe("validiert");
    expect(treffer.koCategory).toBe("Wartung");
  });

  it("K · Kalibrierung: ein thematisch fremder Text findet NICHTS (der Prüfstand sieht Unterschiede)", async () => {
    const { app, headers } = await loggedInApp();
    await seedOffen(app, headers);
    await seedValidiert(app, headers, { titel: "Ventil prüfen", statement: SEED_STMT });

    const res = await pruefeAlsMensch(
      app,
      headers,
      `${FREMD_STMT} Der Abschluss wird testiert und abgelegt.`,
      "Jahresabschluss",
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().duplicates).toEqual([]);
  });

  it("Die Antwort sagt, WOGEGEN geprüft wurde (Hinweis nennt den ungeprüften Bestand)", async () => {
    const { app, headers } = await loggedInApp();
    await seedOffen(app, headers);
    const res = await pruefeAlsMensch(app, headers, CHECK_STMT);
    expect(res.statusCode).toBe(200);
    expect(res.json().note).toContain("nicht validiert");
  });
});

describe("JOB 3020 N1: die Riegel bleiben, wo sie waren", () => {
  it("F2 · derselbe Text über den Add-in-Pfad findet das offene Objekt NICHT", async () => {
    const { app, headers } = await loggedInApp();
    const offenId = await seedOffen(app, headers);

    const res = await pruefeAlsAddon(app, CHECK_STMT);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.duplicates.some((d: { koId: string }) => d.koId === offenId)).toBe(false);
    // Der Add-in-Weg prüft unverändert nur Validiertes → kein Hinweis über den ungeprüften Bestand.
    expect(body.note).toBeNull();
  });

  it("F2b · das VALIDIERTE Objekt bleibt für das Add-in sichtbar (der Riegel ist kein Totalausfall)", async () => {
    const { app, headers } = await loggedInApp();
    const validId = await seedValidiert(app, headers, { kategorie: "Wartung" });

    const res = await pruefeAlsAddon(app, CHECK_STMT);
    expect(res.statusCode).toBe(200);
    const treffer = res.json().duplicates.find((d: { koId: string }) => d.koId === validId);
    expect(treffer).toBeDefined();
    expect(treffer.koStatus).toBe("validiert");
  });

  it("F3 · ein OFFENES, vertrauliches Objekt erscheint auf KEINEM Weg — auch sein Titel nicht", async () => {
    const { app, headers } = await loggedInApp();
    const GEHEIM = "Sonderventil Kennung 4711";
    const geheimId = await seedOffen(app, headers, { titel: GEHEIM, kategorie: "Sonderanlage" });
    await stufeVertraulich(app, headers, geheimId);

    // Derselbe Titel + near-identischer Text → ohne den Riegel wäre das ein deterministischer Treffer.
    const alsMensch = await pruefeAlsMensch(app, headers, CHECK_STMT, GEHEIM);
    expect(alsMensch.statusCode).toBe(200);
    expect(alsMensch.json().duplicates).toEqual([]);
    expect(alsMensch.payload).not.toContain(GEHEIM);

    const alsAddon = await pruefeAlsAddon(app, CHECK_STMT, GEHEIM);
    expect(alsAddon.statusCode).toBe(200);
    expect(alsAddon.json().duplicates).toEqual([]);
    expect(alsAddon.payload).not.toContain(GEHEIM);
  });

  it("F5 · Dry-Run-Garantie bleibt: nach dem Fund ist NICHTS entstanden (persisted:false)", async () => {
    const { app, headers } = await loggedInApp();
    const offenId = await seedOffen(app, headers);

    const res = await pruefeAlsMensch(app, headers, CHECK_STMT);
    expect(res.json().persisted).toBe(false);
    expect(res.json().duplicates.some((d: { koId: string }) => d.koId === offenId)).toBe(true);

    const board = await app.inject({ method: "GET", url: "/api/duplicates", headers });
    expect(board.json()).toHaveLength(0);
    const gaps = await app.inject({ method: "GET", url: "/api/gaps", headers });
    expect(gaps.json()).toHaveLength(0);
    const kos = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect(kos.json()).toHaveLength(1); // nur das Seed-KO, kein transientes angelegt
  });
});
