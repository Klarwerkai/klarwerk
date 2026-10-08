// ================================================================================================
// aufnahme:20260922:gesamt-leserechte — DIE AUSGABEWEGE TRAGEN DIE LESEPOLICY DES BETRACHTERS.
// ================================================================================================
//
// DER BEFUND (Quelleninspektion am Stand a27922e6): Output Factory (`/api/output/sources`,
// `/api/output/generate`) und SCORM-Übergabe (`/api/output/scorm/pruefen`, `/paket`) fragten nur
// die Stufe am Objekt, nie den Menschen davor:
//
//   · eine fremde Kennung antwortete je nach Zustand verschieden (UNKNOWN_KO / NOT_VALIDATED /
//     CONFIDENTIAL) — eine Existenzauskunft; die SCORM-Prüfung nannte bei CONFIDENTIAL sogar den
//     TITEL des fremden vertraulichen Objekts;
//   · der führende Space (produkt:20261007:spaces) galt auf diesen Wegen nicht;
//   · ein Bild, dessen Kennung ein validiertes Objekt nur im Fließtext NENNT, ging ins Paket — obwohl
//     der Bildabruf (`GET /api/objects/:id/raw`) dieselbe Behauptung seit mega78 abweist.
//
// Gemessen wird über die ECHTEN Routen (buildApp, Anwendungsspeicher), dazu der fail-closed-Vertrag
// der beiden Dienste ohne Filter. Jede Sperre hat eine Gegenprobe, die zeigt, dass der berechtigte
// Weg offen bleibt — sonst wäre ein pauschales Nein nicht von der Lesepolicy zu unterscheiden.
import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  type ZurufModell,
  klaraZurufRoutes,
} from "../../services/app/src/routes/klara-session-routes";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../services/knowledge-object";
import {
  LmsExportService,
  OutputService,
  type OutputSichtbarkeit,
  type ScormBetrachter,
} from "../../services/output";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const GEHEIMER_TITEL = "Rezeptur Kühlmittel Q7 nur für Controlling";

beforeAll(() => {
  vi.stubEnv("KLARWERK_LMS_EMPFAENGER", "moodle-referenz=Moodle 4.5 Referenz");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

/** Admin (sieht alles) · Autorin (experte) · Leser (experte, nicht Autor, ohne ko.validate). */
async function buehne(marke: string) {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: `admin@${marke}.test`, password: "geheim12345" },
  });
  const admin = await login(app, `admin@${marke}.test`, "geheim12345");
  for (const email of [`autorin@${marke}.test`, `leser@${marke}.test`]) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role: "experte" },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  return {
    app,
    admin,
    autorin: await login(app, `autorin@${marke}.test`, "geheim12345"),
    leser: await login(app, `leser@${marke}.test`, "geheim12345"),
  };
}

async function anlegen(
  app: App,
  wer: Auth,
  felder: { title: string; confidentiality: string; bodyHtml?: string },
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: wer,
    payload: {
      statement: `Kernaussage zu ${felder.title}`,
      type: "best_practice",
      category: "Anlage 1",
      measures: ["Schritt 1"],
      ...felder,
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function freigeben(app: App, admin: Auth, id: string): Promise<void> {
  const res = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: admin,
    // Bestätigt eine etwa erkannte Dublette gleich mit — Gegenstand ist hier nicht das Dublettentor.
    payload: { action: "admin-validate", duplicateAcknowledged: true },
  });
  expect(res.statusCode, res.body).toBe(200);
}

async function stufeSetzen(app: App, wer: Auth, id: string, level: string): Promise<void> {
  const res = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: wer,
    payload: { action: "confidentiality", level },
  });
  expect(res.statusCode, res.body).toBe(200);
}

const erzeugen = (app: App, wer: Auth, koIds: string[]) =>
  app.inject({
    method: "POST",
    url: "/api/output/generate",
    headers: wer,
    payload: { kind: "instruction", koIds },
  });

const scorm = (app: App, wer: Auth, tuer: "pruefen" | "paket", koIds: string[]) =>
  app.inject({
    method: "POST",
    url: `/api/output/scorm/${tuer}`,
    headers: wer,
    payload: { koIds, sprache: "de", empfaenger: "moodle-referenz" },
  });

/** Die Antwort mit der angefragten Kennung durch einen Platzhalter ersetzt — so werden zwei
 *  Antworten vergleichbar, die sich NUR in der Kennung unterscheiden dürfen. */
const ohneKennung = (text: string, id: string): string => text.split(id).join("<KENNUNG>");

const UNBEKANNT = "00000000-0000-4000-8000-000000000000";

describe("Lesepolicy auf den Ausgabewegen (Output Factory, SCORM)", () => {
  it("ein fremdes vertrauliches Objekt antwortet wie eine unbekannte Kennung — ohne Titel", async () => {
    const { app, admin, autorin, leser } = await buehne("lr-aus-1");
    // Derselbe Weg wie im Alltag: die Autorin legt an und stuft ihr Objekt selbst ein.
    const geheim = await anlegen(app, autorin, {
      title: GEHEIMER_TITEL,
      confidentiality: "intern",
    });
    await stufeSetzen(app, autorin, geheim, "vertraulich");
    await freigeben(app, admin, geheim);

    // Output Factory: dieselbe Antwort wie für eine Kennung, die es nicht gibt.
    const verborgen = await erzeugen(app, leser, [geheim]);
    const unbekannt = await erzeugen(app, leser, [UNBEKANNT]);
    expect(verborgen.statusCode).toBe(unbekannt.statusCode);
    expect(ohneKennung(verborgen.body, geheim)).toBe(ohneKennung(unbekannt.body, UNBEKANNT));
    expect(verborgen.body).not.toContain(GEHEIMER_TITEL);

    // SCORM-Prüfung: derselbe Befund wie für eine unbekannte Kennung, kein Titel.
    const pVerborgen = await scorm(app, leser, "pruefen", [geheim]);
    const pUnbekannt = await scorm(app, leser, "pruefen", [UNBEKANNT]);
    expect(pVerborgen.statusCode).toBe(200);
    expect(pVerborgen.body).not.toContain(GEHEIMER_TITEL);
    expect(ohneKennung(JSON.stringify(pVerborgen.json().befunde), geheim)).toBe(
      ohneKennung(JSON.stringify(pUnbekannt.json().befunde), UNBEKANNT),
    );
    expect(pVerborgen.json().befunde.map((b: { code: string }) => b.code)).toEqual(["UNKNOWN_KO"]);
    const paket = await scorm(app, leser, "paket", [geheim]);
    expect(paket.statusCode).toBe(422);
    expect(paket.body).not.toContain(GEHEIMER_TITEL);

    // Quellenliste: das Objekt kommt nicht vor.
    const quellen = await app.inject({ method: "GET", url: "/api/output/sources", headers: leser });
    expect(quellen.statusCode).toBe(200);
    expect(quellen.body).not.toContain(geheim);

    // GEGENPROBE — wer das Objekt sehen darf (Autorin, Admin), bekommt weiter die ehrliche
    // Stufen-Sperre. Die Lesepolicy blendet nur aus, was der Betrachter nicht sehen darf.
    for (const wer of [autorin, admin]) {
      const p = await scorm(app, wer, "pruefen", [geheim]);
      expect(p.json().befunde.map((b: { code: string }) => b.code)).toEqual(["CONFIDENTIAL"]);
      const g = await erzeugen(app, wer, [geheim]);
      expect(g.json().error).toBe("CONFIDENTIAL");
    }
  });

  it("Rechteentzug: nach dem Hochstufen gibt der FOLGEABRUF nichts mehr heraus", async () => {
    const { app, admin, autorin, leser } = await buehne("lr-aus-2");
    const id = await anlegen(app, autorin, {
      title: "Ventilwartung Linie 3",
      confidentiality: "intern",
    });
    await freigeben(app, admin, id);

    const vorher = await erzeugen(app, leser, [id]);
    expect(vorher.statusCode, vorher.body).toBe(200);
    expect(vorher.json().markdown).toContain("Ventilwartung Linie 3");
    const pVorher = await scorm(app, leser, "pruefen", [id]);
    expect(pVorher.json().exportierbar, pVorher.body).toBe(true);

    // Der Admin stuft hoch — der Entzug trifft den Leser, der weder Autor noch Prüfer ist.
    await stufeSetzen(app, admin, id, "vertraulich");

    const nachher = await erzeugen(app, leser, [id]);
    const unbekannt = await erzeugen(app, leser, [UNBEKANNT]);
    expect(nachher.statusCode).toBe(unbekannt.statusCode);
    expect(ohneKennung(nachher.body, id)).toBe(ohneKennung(unbekannt.body, UNBEKANNT));
    expect(nachher.body).not.toContain("Ventilwartung Linie 3");
    const pNachher = await scorm(app, leser, "pruefen", [id]);
    expect(pNachher.json().exportierbar).toBe(false);
    expect(pNachher.body).not.toContain("Ventilwartung Linie 3");
  });

  it("ein im Fließtext behauptetes fremdes Bild geht nicht ins Paket", async () => {
    const { app, admin, autorin, leser } = await buehne("lr-aus-3");

    // Die Autorin lädt ein Bild hoch und hängt es an IHR vertrauliches Objekt.
    const hochladen = async (wer: Auth): Promise<string> => {
      const res = await app.inject({
        method: "POST",
        url: "/api/objects",
        headers: wer,
        payload: {
          name: "typenschild.png",
          mime: "image/png",
          data: PNG_DATA_URL,
          kind: "image",
          purpose: "attachment",
        },
      });
      expect(res.statusCode, res.body).toBe(201);
      return res.json().id as string;
    };
    const fremdesBild = await hochladen(autorin);
    const traeger = await anlegen(app, autorin, { title: "Träger", confidentiality: "intern" });
    const attach = await app.inject({
      method: "PUT",
      url: `/api/kos/${traeger}`,
      headers: autorin,
      payload: {
        action: "attach",
        attachment: { name: "typenschild.png", mime: "image/png", objectId: fremdesBild },
      },
    });
    expect(attach.statusCode, attach.body).toBe(200);
    await stufeSetzen(app, autorin, traeger, "vertraulich");
    const roh = await app.inject({
      method: "GET",
      url: `/api/objects/${fremdesBild}/raw`,
      headers: leser,
    });
    expect(roh.statusCode, "VORBEDINGUNG: der Bildabruf verweigert dem Leser das Bild").toBe(404);

    // Der Leser schreibt die fremde Kennung in den Fließtext seines eigenen Objekts; es wird
    // freigegeben (der Fließtext ist eine Behauptung, kein Berechtigungsnachweis).
    const eigen = await anlegen(app, leser, {
      title: "Mein Objekt mit Bild",
      confidentiality: "intern",
      bodyHtml: `<p>Siehe</p><img src="/api/objects/${fremdesBild}/raw" alt="Bild">`,
    });
    await freigeben(app, admin, eigen);

    const p = await scorm(app, leser, "pruefen", [eigen]);
    expect(p.statusCode).toBe(200);
    expect(p.json().exportierbar, p.body).toBe(false);
    expect(p.json().befunde).toContainEqual(
      expect.objectContaining({ code: "MEDIA_MISSING", koId: eigen }),
    );
    const paket = await scorm(app, leser, "paket", [eigen]);
    expect(paket.statusCode).toBe(422);

    // GEGENPROBE 1 — der Admin darf das Bild sehen; für ihn geht dasselbe Objekt durch.
    const pAdmin = await scorm(app, admin, "pruefen", [eigen]);
    expect(pAdmin.json().exportierbar, pAdmin.body).toBe(true);

    // GEGENPROBE 2 — ein EIGENES Bild im eigenen Fließtext bleibt exportierbar (mega78-Kalibrierung).
    const eigenesBild = await hochladen(leser);
    const mitEigenemBild = await anlegen(app, leser, {
      title: "Mein Objekt mit eigenem Bild",
      confidentiality: "intern",
      bodyHtml: `<p>Siehe</p><img src="/api/objects/${eigenesBild}/raw" alt="Bild">`,
    });
    await freigeben(app, admin, mitEigenemBild);
    const pEigen = await scorm(app, leser, "pruefen", [mitEigenemBild]);
    expect(pEigen.json().exportierbar, pEigen.body).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------
// Der Dienstvertrag: ohne tauglichen Filter ist NICHTS sichtbar (mega76 Block A), und ein Filter,
// der ein internes Objekt verbirgt (etwa ein fremder Space), wirkt auf allen vier Türen.
// ------------------------------------------------------------------------------------------------

function ko(p: Partial<KnowledgeObject> & { id: string }): KnowledgeObject {
  return {
    title: `Titel ${p.id}`,
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "anna",
    author: "anna",
    neededValidations: 1,
    assignments: [],
    confidentiality: "intern",
    asset: null,
    createdAt: "2026-01-01",
    history: [{ version: 1, at: "2026-01-01", author: "anna", note: "angelegt" }],
    comments: [],
    attachments: [],
    sources: [],
    ...p,
  } as KnowledgeObject;
}

async function dienste() {
  const repo = new InMemoryKoRepo();
  await repo.insert(ko({ id: "OFFEN" }));
  await repo.insert(ko({ id: "SPACE-FREMD", title: "Titel im fremden Space" }));
  const koService = new KoService({ repo });
  const output = new OutputService({ koService });
  const lms = new LmsExportService({
    koService,
    medien: async () => undefined,
    empfaenger: [{ id: "moodle-referenz", label: "Moodle" }],
  });
  return { output, lms };
}

const ohneFremdenSpace: OutputSichtbarkeit = (k) => k.id !== "SPACE-FREMD";
const eingabe = (koIds: string[]) => ({
  koIds,
  sprache: "de" as const,
  empfaenger: "moodle-referenz",
});

describe("Ausgabedienste: Lesepolicy ist Pflicht und fail-closed", () => {
  it("ein verborgenes internes Objekt fehlt in Liste, Erzeugung und SCORM-Prüfung", async () => {
    const { output, lms } = await dienste();
    expect((await output.listEligible(ohneFremdenSpace)).map((s) => s.id)).toEqual(["OFFEN"]);
    await expect(
      output.generate({ kind: "instruction", koIds: ["SPACE-FREMD"] }, ohneFremdenSpace),
    ).rejects.toMatchObject({ code: "UNKNOWN_KO" });
    const betrachter: ScormBetrachter = { ko: ohneFremdenSpace, medium: async () => true };
    const p = await lms.pruefe(eingabe(["SPACE-FREMD"]), betrachter);
    expect(p.befunde.map((b) => b.code)).toEqual(["UNKNOWN_KO"]);
    expect(JSON.stringify(p)).not.toContain("Titel im fremden Space");
    // Gegenprobe: das sichtbare Objekt geht durch.
    expect((await lms.pruefe(eingabe(["OFFEN"]), betrachter)).exportierbar).toBe(true);
  });

  it("ohne Filter (ein Aufrufer, den der Compiler nicht sieht) ist nichts sichtbar", async () => {
    const { output, lms } = await dienste();
    const fehlt = undefined as never;
    expect(await output.listEligible(fehlt)).toEqual([]);
    await expect(
      output.generate({ kind: "instruction", koIds: ["OFFEN"] }, fehlt),
    ).rejects.toMatchObject({ code: "UNKNOWN_KO" });
    expect((await lms.pruefe(eingabe(["OFFEN"]), fehlt)).exportierbar).toBe(false);
    const halb = { ko: () => true } as unknown as ScormBetrachter;
    const mitBild = new LmsExportService({
      koService: {
        get: async () => ko({ id: "BILD", bodyHtml: '<img src="/api/objects/OBJ-1/raw" alt="x">' }),
      },
      medien: async () => {
        throw new Error("Die Bytes dürfen ohne Medienurteil gar nicht gelesen werden.");
      },
      empfaenger: [{ id: "moodle-referenz", label: "Moodle" }],
    });
    const p = await mitBild.pruefe(eingabe(["BILD"]), halb);
    expect(p.exportierbar).toBe(false);
    expect(p.befunde.map((b) => b.code)).toContain("MEDIA_MISSING");
  });
});

// ------------------------------------------------------------------------------------------------
// Der Zuruf (`POST /api/klara/sessions/:id/zuruf`): Quellen aus einem fremden Space erreichen den
// Formulierer nicht. Das Tor ist hier bewilligend — gemessen wird die Quellenauswahl, nicht die
// Einwilligung (die misst tests/ka6-memo-panel/memo-route.test.ts).
// ------------------------------------------------------------------------------------------------

const FREMDE_AUSSAGE = "Schichtzulage Werk Nord steigt ab Oktober um vier Prozent.";

async function zurufBuehne() {
  const repo = new InMemoryKoRepo();
  await repo.insert(
    ko({ id: "KO-FREMD", title: "Zulage Nord", statement: FREMDE_AUSSAGE, spaceId: "S-FREMD" }),
  );
  await repo.insert(
    ko({
      id: "KO-OFFEN",
      title: "Pausenregel",
      statement: "Pause nach vier Stunden.",
      spaceId: "S-OFFEN",
    }),
  );
  const aufrufe: string[] = [];
  const modell: ZurufModell = {
    async complete(_system, user) {
      aufrufe.push(user);
      return "Memo aus den Belegen.";
    },
  };
  const guards = {
    requirePermission: async () => ({
      id: "leser-1",
      role: "experte",
      spaceLesbar: new Set(["S-OFFEN"]),
    }),
  } as never;
  const app = Fastify();
  app.register(
    klaraZurufRoutes(
      {
        sessions: {
          async pruefeExterneAusfuehrung() {
            return { erlaubt: true, resolution: { provider: "anbieter", model: "modell" } };
          },
        },
        ko: new KoService({ repo }),
        modell,
      },
      guards,
    ),
  );
  await app.ready();
  const zuruf = (koIds: string[]) =>
    app.inject({
      method: "POST",
      url: "/api/klara/sessions/sitzung-1/zuruf",
      // Vollständige Bindung — sonst fragt der Erzeuger das Tor gar nicht erst (fail-closed) und
      // jede Antwort wäre CONSENT_MISSING, auch die Gegenprobe.
      headers: {
        "content-type": "application/json",
        "x-klara-instance": "inst-1",
        "x-klara-document": "doc-1",
      },
      payload: JSON.stringify({ art: "erstellen", text: "Formuliere ein Memo.", koIds }),
    });
  return { app, aufrufe, zuruf };
}

describe("Zuruf: Quellen nur aus dem, was der Betrachter sehen darf", () => {
  it("ein Objekt im fremden Space antwortet wie eine unbekannte Kennung, sein Inhalt geht nicht hinaus", async () => {
    const { app, aufrufe, zuruf } = await zurufBuehne();
    const verborgen = await zuruf(["KO-FREMD"]);
    const unbekannt = await zuruf(["KO-GIBT-ES-NICHT"]);
    expect(verborgen.statusCode).toBe(unbekannt.statusCode);
    expect(verborgen.body).toBe(unbekannt.body);
    // Die Einwilligung lag vor — die Absage kommt aus der Quellenauswahl, nicht vom Tor.
    expect(verborgen.json().error).toBe("NO_BASIS");
    expect(verborgen.body).not.toContain("Zulage Nord");
    expect(aufrufe.join("\n")).not.toContain(FREMDE_AUSSAGE);

    // GEGENPROBE — die sichtbare Quelle wird verwendet und als Herkunft genannt.
    const offen = await zuruf(["KO-OFFEN"]);
    expect(offen.statusCode, offen.body).toBe(200);
    expect(offen.json().herkunft.map((h: { koId: string }) => h.koId)).toEqual(["KO-OFFEN"]);
    expect(aufrufe.join("\n")).toContain("Pause nach vier Stunden.");
    await app.close();
  });
});
