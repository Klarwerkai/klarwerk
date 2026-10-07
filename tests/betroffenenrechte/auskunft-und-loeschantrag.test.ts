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
  services = assembleServices(inMemoryRepos(), { datenschutzUhr: () => jetzt });
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
    const klara = a.nichtEnthalten.find((n) => n.datenart === "klara");
    expect(klara?.grund.length ?? 0).toBeGreaterThan(10);
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
