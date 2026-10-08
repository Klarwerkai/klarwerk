// ================================================================================================
// BETROFFENENRECHTE · AUSKUNFT, DATENMITNAHME UND LÖSCHANTRAG AM SERVER (R-0661, R-0663, R-1645).
// ================================================================================================
//
// Gemessen über die ECHTE Anwendung (`buildApp(assembleServices(inMemoryRepos(), …))`, `app.inject`)
// mit gestellter Uhr. Die Vorbereitung (Kommentar, Entwurf, Einstufung) läuft über die vorhandenen
// Dienste; jeder Schritt der Betroffenenrechte selbst geht über HTTP. Getrennte Beispieldaten.
//
//   A1  „Meine Daten": Konto (ohne Passwort-Hash), eigene Objekte, Kommentare, Entwürfe, Fragen,
//       Antworten, Protokollzeilen, Übergabe-Stand und was NICHT enthalten ist — mit Grund.
//   A2  Sichtbarkeit: der eigene Kommentar bleibt, der Titel eines heute unsichtbaren Objekts nicht.
//   A3  Jede erteilte Auskunft steht im Prüfprotokoll; die Verwaltung erstellt sie auch für andere
//       Konten, ein Viewer nicht.
//   L1  Antrag im Profil: Frist ein Monat, ein offener je Konto, Begründung nicht im Protokoll.
//   L2  Daraus wird eine Verwalteraufgabe mit Frist (Glocke, Liste), überfällig nach Ablauf.
//   L3  Erledigen löscht das Konto über den vorhandenen Löschweg; die Auskunft über die alte
//       Kennung bleibt möglich (R-1645), Beiträge bleiben stehen.
//   L4  Ablehnen nur mit Grund; Zurückziehen nur durch den Antragsteller; letzter Admin geschützt.
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import {
  InMemoryLoeschantragRepo,
  LoeschantragFehler,
  loeschantragFrist,
  neuerLoeschantrag,
} from "../../services/app/src/loeschantraege";

type App = ReturnType<typeof buildApp>;

const START = Date.parse("2026-10-06T08:00:00.000Z");
const TAG = 24 * 3_600_000;

let jetzt = START;
let repos: ReturnType<typeof inMemoryRepos>;
let services: AppServices;
let app: App;
let admin = { id: "", token: "" };
let erik = { id: "", token: "" };
let vera = { id: "", token: "" };

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(rolle: string, email: string, name: string) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${admin.token}` },
    payload: { name, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await anmelden(email) };
}

const auf = (wer: string, methode: "GET" | "POST", url: string, payload?: unknown) =>
  app.inject({
    method: methode,
    url,
    headers: { authorization: `Bearer ${wer}` },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

async function eintrag(token: string, titel: string): Promise<string> {
  const angelegt = await auf(token, "POST", "/api/kos", {
    confidentiality: "intern",
    title: titel,
    statement: `${titel} — Beispielaussage für die Auskunft.`,
    type: "best_practice",
    category: "Betroffenenrechte Beispiel",
  });
  expect(angelegt.statusCode).toBe(201);
  return (angelegt.json() as { id: string }).id;
}

interface Auskunft {
  art: string;
  nutzerId: string;
  konto: { id: string; email: string; name: string } | null;
  eigeneObjekte: Array<{ id: string; titel: string | null; rollen: string[] }>;
  kommentare: Array<{ koId: string; titel: string | null; text: string }>;
  entwuerfe: Array<{ id: string; rolle: string; inhalt: { title?: string } }>;
  fragen: Array<{ id: string; frage: string }>;
  antworten: Array<{ antwortId: string }> | null;
  protokoll: Array<{ seq: number; aktion: string; ziel: string; bezug: string }>;
  uebergabe: { autorVon: number; verantwortlichFuer: number };
  loeschantraege: Array<{ id: string; status: string }>;
  kiLaeufe: Array<{ id: string; actor?: string; task: string }> | null;
  klara: {
    sitzungen: Array<{ sessionId: string; actorId: string }> | null;
    zustimmungen: Array<{ consentId: string; actorId: string; status: string }> | null;
  };
  nichtEnthalten: Array<{ datenart: string; grund: string }>;
  zaehlung: Record<string, number>;
}

interface Antrag {
  id: string;
  nutzerId: string;
  status: string;
  gestelltAm: string;
  fristBis: string;
  begruendung: string | null;
  entscheidungsgrund: string | null;
  ueberfaellig: boolean;
  nutzer?: { name: string; email: string } | null;
}

beforeEach(async () => {
  jetzt = START;
  repos = inMemoryRepos();
  services = assembleServices(repos, { datenschutzUhr: () => jetzt });
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@betroffenenrechte.test", password: "secret123" },
  });
  admin = {
    id: (await services.auth.listUsers())[0]?.id ?? "",
    token: await anmelden("ada@betroffenenrechte.test"),
  };
  erik = await konto("experte", "erik@betroffenenrechte.test", "Erik Experte");
  vera = await konto("viewer", "vera@betroffenenrechte.test", "Vera Viewer");
});

describe("A1 · „Meine Daten“ — was das System über die Person gespeichert hat", () => {
  it("enthält Konto, eigene Objekte, Kommentare, Entwürfe, Fragen, Antworten und Protokollzeilen", async () => {
    const eigenes = await eintrag(erik.token, "Kompressor 7 wöchentlich entwässern");
    const fremdes = await eintrag(admin.token, "Druckluftnetz monatlich prüfen");
    await services.ko.addComment(fremdes, erik.id, "Bei uns reicht das nicht — bitte wöchentlich.");
    await services.capture.createDraft({ title: "Eriks Entwurf zur Ölwechselfrist" }, erik.id);
    const frage = await auf(erik.token, "POST", "/api/ask", {
      question: "Wie oft wird die Kühlmittelpumpe in Halle 9 getauscht?",
    });
    expect(frage.statusCode).toBe(200);

    const antwort = await auf(erik.token, "GET", "/api/me/daten");
    expect(antwort.statusCode).toBe(200);
    const a = antwort.json() as Auskunft;
    expect(a.art).toBe("klarwerk.selbstauskunft");
    expect(a.nutzerId).toBe(erik.id);

    // Konto — ohne Passwort-Hash und Salt.
    expect(a.konto?.email).toBe("erik@betroffenenrechte.test");
    expect(antwort.body).not.toMatch(/passwordHash|passwordSalt/);

    // Eigene Objekte und Kommentare.
    expect(a.eigeneObjekte.find((o) => o.id === eigenes)?.rollen).toContain("autor");
    // Am fremden Objekt ist Erik höchstens Prüfer (eine Zuweisung), nie Autor.
    expect(a.eigeneObjekte.find((o) => o.id === fremdes)?.rollen ?? []).not.toContain("autor");
    expect(a.kommentare).toEqual([
      expect.objectContaining({
        koId: fremdes,
        titel: "Druckluftnetz monatlich prüfen",
        text: "Bei uns reicht das nicht — bitte wöchentlich.",
      }),
    ]);
    expect(a.entwuerfe.map((d) => d.inhalt.title)).toContain("Eriks Entwurf zur Ölwechselfrist");

    // Fragen und Antworten: genau das, was die Ablagen für diese Kennung tragen.
    const eigeneLuecken = (await services.ask.listGaps()).filter((g) => g.createdBy === erik.id);
    expect(a.fragen.map((f) => f.id).sort()).toEqual(eigeneLuecken.map((g) => g.id).sort());
    const eigeneAntworten = await services.answerSnapshots.listRecordsByOwner?.(erik.id);
    expect(eigeneAntworten?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(a.antworten?.map((x) => x.antwortId).sort()).toEqual(
      (eigeneAntworten ?? []).map((r) => r.answerId).sort(),
    );

    // Protokollzeilen: nur solche, in denen Erik handelt oder betroffen ist — und seine Frage ist
    // darunter (`ask.query` trägt nur Zähler, keinen Fragetext).
    expect(a.protokoll.some((p) => p.aktion === "ask.query" && p.bezug === "handelnd")).toBe(true);
    const roh = await services.audit.list();
    const passend = new Set(
      roh.filter((e) => e.actor === erik.id || e.target === erik.id).map((e) => e.seq),
    );
    expect(a.protokoll.every((p) => passend.has(p.seq))).toBe(true);
    // Die Auskunft selbst wird NACH dem Zusammenstellen protokolliert — sie steht noch nicht darin.
    expect(a.protokoll.some((p) => p.aktion === "datenschutz.auskunft")).toBe(false);

    // Übergabe-Stand und das, was nicht in der Datei steht.
    expect(a.uebergabe.autorVon).toBeGreaterThanOrEqual(1);
    // Was nicht in der Datei steht, steht mit Grund da (Beispiel: Befunde zu Objektpaaren).
    const befunde = a.nichtEnthalten.find((n) => n.datenart === "befunde");
    expect(befunde?.grund.length ?? 0).toBeGreaterThan(10);
    // Nacharbeit 4: KI-Läufe und Klara sind kein „nicht enthalten" mehr.
    expect(a.nichtEnthalten.map((n) => n.datenart)).not.toContain("modelllaeufe");
    expect(a.nichtEnthalten.map((n) => n.datenart)).not.toContain("klara");
    expect(a.zaehlung.kommentare).toBe(1);
    expect(a.zaehlung.antworten).toBe(a.antworten?.length);
  });

  it("verlangt eine Anmeldung", async () => {
    const ohne = await app.inject({ method: "GET", url: "/api/me/daten" });
    expect(ohne.statusCode).toBe(401);
  });
});

describe("A2 · Sichtbarkeit: eigener Beitrag ja, Titel eines unsichtbaren Objekts nein", () => {
  it("nach der Einstufung als vertraulich bleibt Eriks Kommentar, der Titel fällt weg", async () => {
    const fremdes = await eintrag(admin.token, "Vertrauliche Lieferantenbewertung");
    await services.ko.addComment(fremdes, erik.id, "Lieferant B war zweimal zu spät.");
    await services.ko.setConfidentiality(fremdes, "vertraulich", admin.id);

    const a = (await auf(erik.token, "GET", "/api/me/daten")).json() as Auskunft;
    expect(a.kommentare).toEqual([
      expect.objectContaining({
        koId: fremdes,
        titel: null,
        text: "Lieferant B war zweimal zu spät.",
      }),
    ]);

    // Die Verwaltung darf das Objekt sehen — in IHRER Auskunft über Erik steht der Titel.
    const v = (
      await auf(admin.token, "GET", `/api/datenschutz/auskunft/${erik.id}`)
    ).json() as Auskunft;
    expect(v.kommentare[0]?.titel).toBe("Vertrauliche Lieferantenbewertung");
  });
});

describe("A3 · Auskunft im Prüfprotokoll; die Verwaltung erstellt sie auch für andere Konten", () => {
  it("Selbstauskunft und Verwalterauskunft werden belegt, ohne Inhalt", async () => {
    expect((await auf(erik.token, "GET", "/api/me/daten")).statusCode).toBe(200);
    expect((await auf(admin.token, "GET", `/api/datenschutz/auskunft/${erik.id}`)).statusCode).toBe(
      200,
    );
    const belege = await services.audit.list({ action: "datenschutz.auskunft" });
    expect(belege.map((b) => [b.actor, b.target, b.payload.weg])).toEqual([
      [erik.id, erik.id, "selbst"],
      [admin.id, erik.id, "verwaltung"],
    ]);
  });

  it("ein Viewer erstellt keine Auskunft über andere und sieht kein Verzeichnis", async () => {
    expect((await auf(vera.token, "GET", `/api/datenschutz/auskunft/${erik.id}`)).statusCode).toBe(
      403,
    );
    expect(
      (await auf(vera.token, "GET", "/api/datenschutz/verarbeitungsverzeichnis")).statusCode,
    ).toBe(403);
    expect((await auf(vera.token, "GET", "/api/datenschutz/loeschantraege")).statusCode).toBe(403);
  });

  it("das Verzeichnis kommt als JSON und als Markdown aus dem System", async () => {
    const json = await auf(admin.token, "GET", "/api/datenschutz/verarbeitungsverzeichnis");
    expect(json.statusCode).toBe(200);
    const v = json.json() as { art: string; taetigkeiten: unknown[]; datenarten: unknown[] };
    expect(v.art).toBe("klarwerk.verarbeitungsverzeichnis");
    expect(v.taetigkeiten.length).toBeGreaterThan(0);
    expect(v.datenarten.length).toBeGreaterThan(20);
    const md = await auf(
      admin.token,
      "GET",
      "/api/datenschutz/verarbeitungsverzeichnis?format=markdown",
    );
    expect(md.statusCode).toBe(200);
    expect(md.headers["content-type"]).toMatch(/text\/markdown/);
    expect(md.body).toMatch(/^# Verzeichnis der Verarbeitungstätigkeiten/);
    expect(
      (await auf(admin.token, "GET", "/api/datenschutz/verarbeitungsverzeichnis?format=pdf"))
        .statusCode,
    ).toBe(400);
  });
});

describe("L1 · der Antrag im Profil", () => {
  it("Frist ein Monat; ein offener Antrag je Konto; Begründung nur am Antrag", async () => {
    const gestellt = await auf(erik.token, "POST", "/api/me/loeschantrag", {
      begruendung: "Ich verlasse das Unternehmen zum Monatsende.",
    });
    expect(gestellt.statusCode).toBe(201);
    const antrag = gestellt.json() as Antrag;
    expect(antrag.status).toBe("offen");
    expect(antrag.gestelltAm).toBe("2026-10-06T08:00:00.000Z");
    expect(antrag.fristBis).toBe("2026-11-06T08:00:00.000Z");
    expect(antrag.begruendung).toBe("Ich verlasse das Unternehmen zum Monatsende.");

    const zweiter = await auf(erik.token, "POST", "/api/me/loeschantrag", {});
    expect(zweiter.statusCode).toBe(409);
    expect((zweiter.json() as { error: string }).error).toBe("BEREITS_OFFEN");

    const eigene = (await auf(erik.token, "GET", "/api/me/loeschantrag")).json() as {
      antraege: Antrag[];
    };
    expect(eigene.antraege.map((x) => x.status)).toEqual(["offen"]);

    const belege = await services.audit.list({ action: "loeschantrag.gestellt" });
    expect(belege).toHaveLength(1);
    expect(belege[0]?.actor).toBe(erik.id);
    expect(belege[0]?.payload).toEqual({ nutzerId: erik.id, fristBis: "2026-11-06T08:00:00.000Z" });
    expect(JSON.stringify(belege)).not.toContain("Unternehmen");
  });

  it("die Frist fällt bei kürzeren Monaten auf den Monatsletzten", () => {
    expect(loeschantragFrist(new Date("2026-01-31T10:00:00.000Z")).toISOString()).toBe(
      "2026-02-28T10:00:00.000Z",
    );
    expect(loeschantragFrist(new Date("2026-12-15T10:00:00.000Z")).toISOString()).toBe(
      "2027-01-15T10:00:00.000Z",
    );
  });

  it("ohne zugesagte Haltbarkeit (Desktop-Journal) wird kein Antrag angenommen", async () => {
    const ablage = new InMemoryLoeschantragRepo(true);
    await expect(
      ablage.lege(neuerLoeschantrag("u-1", null, new Date(START))),
    ).rejects.toBeInstanceOf(LoeschantragFehler);
  });
});

describe("L2 · daraus wird eine Verwalteraufgabe mit Frist", () => {
  it("die Glocke der Verwaltung zeigt den Antrag — die des Antragstellers nicht", async () => {
    await auf(erik.token, "POST", "/api/me/loeschantrag", {});
    const glocke = (await auf(admin.token, "GET", "/api/notifications")).json() as Array<{
      id: string;
      kind: string;
      title: string;
      fristBis?: string;
      ueberfaellig?: boolean;
    }>;
    const aufgabe = glocke.find((n) => n.kind === "loeschantrag");
    expect(aufgabe).toEqual(
      expect.objectContaining({
        title: "Erik Experte",
        fristBis: "2026-11-06T08:00:00.000Z",
        ueberfaellig: false,
      }),
    );
    const eigene = (await auf(erik.token, "GET", "/api/notifications")).json() as Array<{
      kind: string;
    }>;
    expect(eigene.some((n) => n.kind === "loeschantrag")).toBe(false);

    const liste = (await auf(admin.token, "GET", "/api/datenschutz/loeschantraege")).json() as {
      antraege: Antrag[];
    };
    expect(liste.antraege).toEqual([
      expect.objectContaining({
        nutzerId: erik.id,
        status: "offen",
        ueberfaellig: false,
        nutzer: { name: "Erik Experte", email: "erik@betroffenenrechte.test" },
      }),
    ]);
  });

  it("nach Ablauf der Frist ist die Aufgabe überfällig und erscheint neu in der Glocke", async () => {
    await auf(erik.token, "POST", "/api/me/loeschantrag", {});
    const vorher = (await auf(admin.token, "GET", "/api/notifications")).json() as Array<{
      id: string;
      kind: string;
    }>;
    jetzt = START + 31 * TAG + 3_600_000;
    const nachher = (await auf(admin.token, "GET", "/api/notifications")).json() as Array<{
      id: string;
      kind: string;
      ueberfaellig?: boolean;
    }>;
    const alt = vorher.find((n) => n.kind === "loeschantrag");
    const neu = nachher.find((n) => n.kind === "loeschantrag");
    expect(neu?.ueberfaellig).toBe(true);
    expect(neu?.id).toBe(`${alt?.id}-ueberfaellig`);
    const liste = (await auf(admin.token, "GET", "/api/datenschutz/loeschantraege")).json() as {
      antraege: Antrag[];
    };
    expect(liste.antraege[0]?.ueberfaellig).toBe(true);
  });
});

describe("L3 · Erledigen löscht über den vorhandenen Löschweg", () => {
  it("Konto und Sitzung sind weg, der Antrag ist erledigt, die Auskunft über die alte Kennung bleibt", async () => {
    const eigenes = await eintrag(erik.token, "Ventil 3 vor Winter schliessen");
    const antrag = (await auf(erik.token, "POST", "/api/me/loeschantrag", {})).json() as Antrag;

    const erledigt = await auf(
      admin.token,
      "POST",
      `/api/datenschutz/loeschantraege/${antrag.id}/erledigen`,
      {},
    );
    expect(erledigt.statusCode).toBe(200);
    expect((erledigt.json() as Antrag).status).toBe("erledigt");

    expect((await services.auth.listUsers()).some((u) => u.id === erik.id)).toBe(false);
    expect((await auf(erik.token, "GET", "/api/me/loeschantrag")).statusCode).toBe(401);
    expect((await services.audit.list({ action: "user.delete", target: erik.id })).length).toBe(1);
    expect((await services.audit.list({ action: "loeschantrag.erledigt" })).length).toBe(1);

    // R-1645: die Auskunft über die alte Kennung — Konto weg, Beiträge (noch) mit seiner Kennung.
    const a = (
      await auf(admin.token, "GET", `/api/datenschutz/auskunft/${erik.id}`)
    ).json() as Auskunft;
    expect(a.konto).toBeNull();
    expect(a.eigeneObjekte.map((o) => o.id)).toContain(eigenes);
    expect(a.loeschantraege.map((x) => x.status)).toEqual(["erledigt"]);

    // Ein erledigter Antrag lässt sich nicht ein zweites Mal entscheiden.
    const nochmal = await auf(
      admin.token,
      "POST",
      `/api/datenschutz/loeschantraege/${antrag.id}/ablehnen`,
      { grund: "zu spät" },
    );
    expect(nochmal.statusCode).toBe(409);
  });
});

describe("L4 · Ablehnen, Zurückziehen, letzter Admin", () => {
  it("Ablehnen braucht einen Grund; danach kann ein neuer Antrag gestellt werden", async () => {
    const antrag = (await auf(erik.token, "POST", "/api/me/loeschantrag", {})).json() as Antrag;
    const ohneGrund = await auf(
      admin.token,
      "POST",
      `/api/datenschutz/loeschantraege/${antrag.id}/ablehnen`,
      {},
    );
    expect(ohneGrund.statusCode).toBe(400);
    expect((ohneGrund.json() as { error: string }).error).toBe("GRUND_FEHLT");
    const mitGrund = await auf(
      admin.token,
      "POST",
      `/api/datenschutz/loeschantraege/${antrag.id}/ablehnen`,
      { grund: "Laufendes Prüfverfahren, Aufbewahrungspflicht bis Jahresende." },
    );
    expect(mitGrund.statusCode).toBe(200);
    expect(mitGrund.json()).toEqual(
      expect.objectContaining({
        status: "abgelehnt",
        entscheidungsgrund: "Laufendes Prüfverfahren, Aufbewahrungspflicht bis Jahresende.",
      }),
    );
    expect((await services.auth.listUsers()).some((u) => u.id === erik.id)).toBe(true);
    const beleg = await services.audit.list({ action: "loeschantrag.abgelehnt" });
    expect(JSON.stringify(beleg)).not.toContain("Prüfverfahren");
    expect((await auf(erik.token, "POST", "/api/me/loeschantrag", {})).statusCode).toBe(201);
  });

  it("nur der Antragsteller zieht zurück; ein fremder Antrag ist nicht vorhanden", async () => {
    const antrag = (await auf(vera.token, "POST", "/api/me/loeschantrag", {})).json() as Antrag;
    const fremd = await auf(erik.token, "POST", `/api/me/loeschantrag/${antrag.id}/zurueckziehen`);
    expect(fremd.statusCode).toBe(404);
    const eigen = await auf(vera.token, "POST", `/api/me/loeschantrag/${antrag.id}/zurueckziehen`);
    expect(eigen.statusCode).toBe(200);
    expect((eigen.json() as Antrag).status).toBe("zurueckgezogen");
    const glocke = (await auf(admin.token, "GET", "/api/notifications")).json() as Array<{
      kind: string;
    }>;
    expect(glocke.some((n) => n.kind === "loeschantrag")).toBe(false);
  });

  it("der Antrag des letzten Admins wird nicht durch Löschen erledigt — er bleibt offen", async () => {
    const antrag = (await auf(admin.token, "POST", "/api/me/loeschantrag", {})).json() as Antrag;
    const versuch = await auf(
      admin.token,
      "POST",
      `/api/datenschutz/loeschantraege/${antrag.id}/erledigen`,
      {},
    );
    expect(versuch.statusCode).toBe(409);
    expect((versuch.json() as { error: string }).error).toBe("LETZTER_ADMIN");
    expect((await services.auth.listUsers()).some((u) => u.id === admin.id)).toBe(true);
    const liste = (await auf(admin.token, "GET", "/api/datenschutz/loeschantraege")).json() as {
      antraege: Antrag[];
    };
    expect(liste.antraege.find((x) => x.id === antrag.id)?.status).toBe("offen");
  });
});

// ================================================================================================
// NACHARBEIT 4 (BEN) — DIE DREI BEFUNDE, JE MIT GEGENPROBE.
// ================================================================================================

/** Ein KI-Lauf mit Laufkontext — so, wie ihn das Protokoll ablegt (nur Metadaten). */
function kiLauf(id: string, actor: string) {
  return {
    id,
    task: "answer" as const,
    provider: "deterministic",
    demo: true,
    fallback: false,
    startedAt: "2026-10-06T08:01:00.000Z",
    finishedAt: "2026-10-06T08:01:01.000Z",
    status: "success" as const,
    actor,
  };
}

/** Eine Klara-Sitzung samt erteilter Zustimmung für `actorId`. */
async function klaraSitzung(sessionId: string, actorId: string): Promise<void> {
  await services.klaraSessions.insertSession({
    sessionId,
    tenantId: "instanz",
    actorId,
    addinInstanceId: `addin-${sessionId}`,
    documentContextId: `dok-${sessionId}`,
    createdAt: "2026-10-06T08:02:00.000Z",
    lastActivityAt: "2026-10-06T08:02:00.000Z",
    expiresAt: "2026-10-06T10:02:00.000Z",
    policyVersion: "p1",
    configurationVersion: "c1",
    consentState: "none",
    closedAt: null,
    resolutionId: `res-${sessionId}`,
    revision: 0,
  });
  const erteilt = await services.klaraSessions.grantConsent(sessionId, 0, {
    consentId: `zus-${sessionId}`,
    sessionId,
    tenantId: "instanz",
    actorId,
    documentContextId: `dok-${sessionId}`,
    consentScope: "question",
    allowedPayloadClasses: ["question"],
    providerClass: "external",
    providerBindingId: "bindung",
    modelReference: "modell",
    providerReference: "anbieter",
    addinInstanceId: `addin-${sessionId}`,
    policyVersion: "p1",
    configurationVersion: "c1",
    grantedAt: "2026-10-06T08:03:00.000Z",
    expiresAt: "2026-10-06T10:02:00.000Z",
    revokedAt: null,
    status: "granted",
    resolutionId: `res-${sessionId}`,
  });
  expect(erteilt).toBe(true);
}

describe("N4-1 · KI-Läufe und Klara-Sitzungen stehen in Selbst- und Verwaltungsauskunft", () => {
  it("die eigenen Läufe, Sitzungen und Zustimmungen — fremde nicht", async () => {
    await repos.modelRuns.append(kiLauf("lauf-erik", erik.id));
    await repos.modelRuns.append(kiLauf("lauf-vera", vera.id));
    await klaraSitzung("sitzung-erik", erik.id);
    await klaraSitzung("sitzung-vera", vera.id);

    const selbst = (await auf(erik.token, "GET", "/api/me/daten")).json() as Auskunft;
    expect(selbst.kiLaeufe?.map((l) => l.id)).toEqual(["lauf-erik"]);
    expect(selbst.klara.sitzungen?.map((s) => s.sessionId)).toEqual(["sitzung-erik"]);
    expect(selbst.klara.zustimmungen?.map((z) => [z.consentId, z.status])).toEqual([
      ["zus-sitzung-erik", "granted"],
    ]);
    expect(selbst.zaehlung.kiLaeufe).toBe(1);
    expect(selbst.zaehlung.klaraSitzungen).toBe(1);
    expect(selbst.zaehlung.klaraZustimmungen).toBe(1);

    // Dieselben Daten in der Auskunft der Verwaltung über Erik.
    const verwaltung = (
      await auf(admin.token, "GET", `/api/datenschutz/auskunft/${erik.id}`)
    ).json() as Auskunft;
    expect(verwaltung.kiLaeufe?.map((l) => l.id)).toEqual(["lauf-erik"]);
    expect(verwaltung.klara.sitzungen?.map((s) => s.sessionId)).toEqual(["sitzung-erik"]);
    expect(verwaltung.klara.zustimmungen?.map((z) => z.consentId)).toEqual(["zus-sitzung-erik"]);
  });
});

describe("N4-2 · Entscheidungen über den eigenen Löschantrag stehen in den Protokollzeilen", () => {
  it("die Ablehnung durch die Verwaltung erscheint beim Antragsteller als „betroffen“", async () => {
    const antrag = (await auf(erik.token, "POST", "/api/me/loeschantrag", {})).json() as Antrag;
    const abgelehnt = await auf(
      admin.token,
      "POST",
      `/api/datenschutz/loeschantraege/${antrag.id}/ablehnen`,
      { grund: "Aufbewahrungspflicht bis Jahresende." },
    );
    expect(abgelehnt.statusCode).toBe(200);
    const a = (await auf(erik.token, "GET", "/api/me/daten")).json() as Auskunft;
    const zeilen = a.protokoll.filter((p) => p.ziel === antrag.id);
    expect(zeilen.map((p) => [p.aktion, p.bezug])).toEqual([
      ["loeschantrag.gestellt", "handelnd"],
      ["loeschantrag.abgelehnt", "betroffen"],
    ]);
    // Vera ist nicht betroffen — die Entscheidung über Eriks Antrag steht nicht in ihrer Auskunft.
    const v = (await auf(vera.token, "GET", "/api/me/daten")).json() as Auskunft;
    expect(v.protokoll.some((p) => p.ziel === antrag.id)).toBe(false);
  });

  it("die Erledigung erscheint in der Auskunft über die gelöschte Kennung", async () => {
    const antrag = (await auf(erik.token, "POST", "/api/me/loeschantrag", {})).json() as Antrag;
    expect(
      (await auf(admin.token, "POST", `/api/datenschutz/loeschantraege/${antrag.id}/erledigen`, {}))
        .statusCode,
    ).toBe(200);
    const a = (
      await auf(admin.token, "GET", `/api/datenschutz/auskunft/${erik.id}`)
    ).json() as Auskunft;
    expect(
      a.protokoll.some((p) => p.aktion === "loeschantrag.erledigt" && p.bezug === "betroffen"),
    ).toBe(true);
  });
});

describe("N4-3 · konkurrierende Entscheidungen: nur die gewinnende Erledigung löscht", () => {
  /** Hält `deleteUser` an, bis der Test es freigibt — das Fenster zwischen Übernahme und Löschen. */
  function loeschenAnhalten(): { freigeben: () => void } {
    const original = services.auth.deleteUser.bind(services.auth);
    let freigeben: () => void = () => undefined;
    const sperre = new Promise<void>((r) => {
      freigeben = r;
    });
    services.auth.deleteUser = async (id: string, actor: string) => {
      await sperre;
      return original(id, actor);
    };
    return { freigeben: () => freigeben() };
  }

  async function warteAufStatus(id: string, status: string): Promise<void> {
    for (let i = 0; i < 200; i++) {
      if ((await services.loeschantraege.finde(id))?.status === status) {
        return;
      }
      await new Promise((r) => setTimeout(r, 1));
    }
    throw new Error(`Antrag ${id} erreicht ${status} nicht`);
  }

  it("während der Erledigung scheitern Zurückziehen und Ablehnen; Konto, Antrag und Protokoll passen zusammen", async () => {
    const antrag = (await auf(erik.token, "POST", "/api/me/loeschantrag", {})).json() as Antrag;
    const halt = loeschenAnhalten();
    const erledigung = auf(
      admin.token,
      "POST",
      `/api/datenschutz/loeschantraege/${antrag.id}/erledigen`,
      {},
    );
    await warteAufStatus(antrag.id, "in_bearbeitung");

    const zurueck = await auf(
      erik.token,
      "POST",
      `/api/me/loeschantrag/${antrag.id}/zurueckziehen`,
    );
    expect(zurueck.statusCode).toBe(409);
    const ablehnung = await auf(
      admin.token,
      "POST",
      `/api/datenschutz/loeschantraege/${antrag.id}/ablehnen`,
      { grund: "zu spät" },
    );
    expect(ablehnung.statusCode).toBe(409);
    // Eine zweite Erledigung gewinnt die Übernahme nicht.
    const zweite = await auf(
      admin.token,
      "POST",
      `/api/datenschutz/loeschantraege/${antrag.id}/erledigen`,
      {},
    );
    expect(zweite.statusCode).toBe(409);

    halt.freigeben();
    expect((await erledigung).statusCode).toBe(200);
    expect((await services.loeschantraege.finde(antrag.id))?.status).toBe("erledigt");
    expect((await services.auth.listUsers()).some((u) => u.id === erik.id)).toBe(false);
    expect((await services.audit.list({ action: "loeschantrag.erledigt" })).length).toBe(1);
    expect((await services.audit.list({ action: "loeschantrag.zurueckgezogen" })).length).toBe(0);
    expect((await services.audit.list({ action: "loeschantrag.abgelehnt" })).length).toBe(0);
    expect((await services.audit.list({ action: "user.delete", target: erik.id })).length).toBe(1);
  });

  it("wer zuerst zurückzieht, gewinnt — die Erledigung löscht dann nichts", async () => {
    const antrag = (await auf(erik.token, "POST", "/api/me/loeschantrag", {})).json() as Antrag;
    expect(
      (await auf(erik.token, "POST", `/api/me/loeschantrag/${antrag.id}/zurueckziehen`)).statusCode,
    ).toBe(200);
    const spaet = await auf(
      admin.token,
      "POST",
      `/api/datenschutz/loeschantraege/${antrag.id}/erledigen`,
      {},
    );
    expect(spaet.statusCode).toBe(409);
    expect((await services.auth.listUsers()).some((u) => u.id === erik.id)).toBe(true);
    expect((await services.loeschantraege.finde(antrag.id))?.status).toBe("zurueckgezogen");
  });

  it("scheitert das Löschen, ist der Antrag wieder offen und erneut erledigbar", async () => {
    const antrag = (await auf(erik.token, "POST", "/api/me/loeschantrag", {})).json() as Antrag;
    const original = services.auth.deleteUser.bind(services.auth);
    services.auth.deleteUser = async () => {
      throw new Error("Datenbank vorübergehend nicht erreichbar");
    };
    const fehlgeschlagen = await auf(
      admin.token,
      "POST",
      `/api/datenschutz/loeschantraege/${antrag.id}/erledigen`,
      {},
    );
    expect(fehlgeschlagen.statusCode).toBe(500);
    expect((await services.loeschantraege.finde(antrag.id))?.status).toBe("offen");
    expect((await services.audit.list({ action: "loeschantrag.erledigt" })).length).toBe(0);

    services.auth.deleteUser = original;
    const erneut = await auf(
      admin.token,
      "POST",
      `/api/datenschutz/loeschantraege/${antrag.id}/erledigen`,
      {},
    );
    expect(erneut.statusCode).toBe(200);
    expect((await services.auth.listUsers()).some((u) => u.id === erik.id)).toBe(false);
  });

  it("eine liegengebliebene Übernahme wird nach Ablauf wieder übernehmbar — nur mit eigener Marke abschliessbar", async () => {
    const ablage = new InMemoryLoeschantragRepo();
    const antrag = neuerLoeschantrag("u-x", null, new Date(START));
    expect(await ablage.lege(antrag)).toBe(true);
    const erste = { token: "t1", am: "2026-10-06T08:00:00.000Z", von: "admin" };
    expect(await ablage.uebernehmen(antrag.id, erste, "2026-10-06T07:55:00.000Z")).toBeDefined();
    // Nicht abgelaufen: keine zweite Übernahme.
    const zweite = { token: "t2", am: "2026-10-06T08:01:00.000Z", von: "admin" };
    expect(await ablage.uebernehmen(antrag.id, zweite, "2026-10-06T07:56:00.000Z")).toBeUndefined();
    // Abgelaufen: die zweite übernimmt; die erste kann nicht mehr abschliessen.
    const uebernommen = await ablage.uebernehmen(antrag.id, zweite, "2026-10-06T08:05:00.000Z");
    expect(uebernommen?.uebernahme?.token).toBe("t2");
    const mitAlterMarke = { ...antrag, status: "erledigt" as const, uebernahme: erste };
    expect(await ablage.abschliessen(mitAlterMarke, "in_bearbeitung")).toBe(false);
    expect(await ablage.freigeben(antrag.id, "t1")).toBe(false);
    const mitNeuerMarke = { ...antrag, status: "erledigt" as const, uebernahme: zweite };
    expect(await ablage.abschliessen(mitNeuerMarke, "in_bearbeitung")).toBe(true);
    // Während der Bearbeitung kann für dasselbe Konto kein zweiter Antrag entstehen.
    const andere = neuerLoeschantrag("u-y", null, new Date(START));
    await ablage.lege(andere);
    await ablage.uebernehmen(andere.id, erste, "2026-10-06T07:00:00.000Z");
    expect(await ablage.lege(neuerLoeschantrag("u-y", null, new Date(START)))).toBe(false);
  });
});
