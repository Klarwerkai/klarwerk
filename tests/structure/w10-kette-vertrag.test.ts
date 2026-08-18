// ================================================================================================
// JOB 550 / D5 — DER W10-KETTENVERTRAG: EIN KANONISCHES MODELL, EINE AKTUELLE MATRIX,
// SECHS AUSGEFÜHRTE NEGATIVKANTEN UND DIE ERKLÄRUNGSKETTE.
// ================================================================================================
//
// Das rote Vollurteil `_relay/kopf/outbox/BEN3-PRUEFUNG-JOB-550-D4.md` ist der Auftragstext dieses
// Durchgangs. Es benennt sieben Prüflücken; vier davon werden hier ausführbar geschlossen:
//
//   Prüflücke 1  Vollständige W10-Matrix — jede Stufe mit Zustand, Pfad und AKTUELLEM Laufbeleg.
//   Prüflücke 2  Zählvertrag — fünf Glieder, neun Schritte und zehn Indizes in EIN Modell.
//   Prüflücke 4  Negativkanten — alle sechs AUSGEFÜHRT, nicht behauptet.
//   Prüflücke 5  Erklärungskette — kein grüner Vollständigkeitsanspruch bei PARTIAL oder DRIFT.
//
// WARUM DIESE DATEI ÜBERHAUPT NÖTIG IST. Das Urteil sagt wörtlich: „Ein unveränderter
// Testdateihash bestätigt nur, dass der Vertragstext nicht driftete. Er zeigt weder, dass der Test
// auf Base oder Main heute startet, noch dass die behaupteten Fälle bestehen." Genau diese Lücke
// zwischen „steht geschrieben" und „läuft heute" schliesst diese Datei — sie FÜHRT AUS, was die
// bisherigen Durchgänge nur gelesen haben.
//
// WAS SIE AUSDRÜCKLICH NICHT TUT: Sie ersetzt nicht `fresh-capture-to-use-e2e.test.ts`. Jener Test
// ist der Produktfluss; dieser hier ist sein VERTRAG — er misst die Reichweite der Kette und die
// Kanten, an denen sie halten muss.
import { describe, expect, it } from "vitest";
import type { AnswerResult, KnowledgeObject } from "../../apps/web/src/api/types";
import { answerGrade } from "../../apps/web/src/lib/answerGrade";
import { answerStatus } from "../../apps/web/src/lib/askView";
import { applyBodyAssistSection } from "../../apps/web/src/lib/bodyAiAssist";
import { applyBodyTemplate } from "../../apps/web/src/lib/bodyTemplates";
import { captureNextSteps } from "../../apps/web/src/lib/captureSuccess";
import { editorContentQuality } from "../../apps/web/src/lib/editorContentQuality";
import { koOverview } from "../../apps/web/src/lib/koOverview";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  ANSWER_SNAPSHOT_SCHEMA_VERSION,
  type AnswerEvidenceRef,
  type AnswerEvidenceSnapshot,
  answerSnapshotIntegrity,
  answerSnapshotStatus,
  hashAnswerSnapshot,
} from "../../services/ask";

// ================================================================================================
// TEIL A — DER ZÄHLVERTRAG (Prüflücke 2)
// ================================================================================================
//
// DAS PROBLEM, WÖRTLICH AUS DEM URTEIL: „fünf Glieder, neun Schritte und die im Bericht tatsächlich
// genannten zehn Indizes müssen in genau ein kanonisches Modell überführt werden. Erwartet ist eine
// eindeutige Abbildung ohne Doppelzählung oder ausgelassene Kante."
//
// DIE AUFLÖSUNG, und sie ist arithmetisch und nicht rhetorisch:
//
//   · Es gibt GENAU ZEHN Stufen, `S0` bis `S9`. Das ist die kanonische Zählung.
//   · „Neun Schritte" zählte `S1..S9` und behandelte `S0` als Vorstufe statt als Stufe. Dieselbe
//     Menge, sobald `S0` als Stufe zugelassen ist — keine ausgelassene Kante, keine neue.
//   · „Fünf Glieder" ist keine konkurrierende Zählung, sondern eine GRUPPIERUNG derselben zehn
//     Stufen in fünf Zuständigkeiten. Ein Glied ist ein Thema, kein Intervall: die Kette wechselt
//     zwischen Prüfweg und Nutzung, weil der E2E-Vertrag bewusst VOR und NACH der Validierung misst.
//   · Die zehn nummerierten Kommentare in `fresh-capture-to-use-e2e.test.ts` sind
//     ZUSICHERUNGSGRUPPEN, keine Stufen. Zwei Stufen tragen je zwei Gruppen (`S3` und `S5`);
//     deshalb decken zehn Gruppen acht Stufen. 8 gedeckte + 2 offene = 10. Damit geht die Rechnung
//     auf, die das Urteil als „rechnerisch ungeschlossen" gerügt hat.
type Zustand = "IST" | "PARTIAL" | "DRIFT" | "FEHLT";
type Glied = "G1_AUFNAHME" | "G2_ANFANGSZUSTAND" | "G3_PRUEFWEG" | "G4_NUTZUNG" | "G5_ERKLAERUNG";

interface Stufe {
  readonly id: string;
  readonly name: string;
  readonly glied: Glied;
  /** Die Zusicherungsgruppen aus `fresh-capture-to-use-e2e.test.ts`, die diese Stufe decken. */
  readonly e2eGruppen: readonly number[];
  readonly zustand: Zustand;
  /** Der Pfad, an dem die Stufe im Produkt hängt — absolut ab Repowurzel. */
  readonly pfad: string;
}

const W10: readonly Stufe[] = [
  {
    id: "S0",
    name: "Rohdokument → Wissen",
    glied: "G1_AUFNAHME",
    e2eGruppen: [],
    zustand: "FEHLT",
    pfad: "(kein Träger in dieser Kette)",
  },
  {
    id: "S1",
    name: "Studio-Strukturierung (Vorlage + KI-Abschnitt)",
    glied: "G1_AUFNAHME",
    e2eGruppen: [1],
    zustand: "IST",
    pfad: "apps/web/src/lib/bodyTemplates.ts + apps/web/src/lib/bodyAiAssist.ts",
  },
  {
    id: "S2",
    name: "Fresh Capture über die echte HTTP-Route",
    glied: "G1_AUFNAHME",
    e2eGruppen: [2],
    zustand: "IST",
    pfad: "services/app/src/routes/ko-routes.ts (POST /api/kos)",
  },
  {
    id: "S3",
    name: "Ehrlicher Frischezustand: offen, Trust 0, Version 1",
    glied: "G2_ANFANGSZUSTAND",
    e2eGruppen: [3, 6],
    zustand: "IST",
    pfad: "apps/web/src/lib/koOverview.ts",
  },
  {
    id: "S4",
    name: "Server-Sanitizer erhält die Studio-Struktur",
    glied: "G2_ANFANGSZUSTAND",
    e2eGruppen: [4],
    zustand: "IST",
    pfad: "apps/web/src/lib/editorContentQuality.ts",
  },
  {
    id: "S5",
    name: "Übergabe in die Prüfung: Capture-Success und Validation Board",
    glied: "G3_PRUEFWEG",
    e2eGruppen: [5, 7],
    zustand: "IST",
    pfad: "apps/web/src/lib/captureSuccess.ts + GET /api/validation/board",
  },
  {
    id: "S6",
    name: "Nutzung VOR der Validierung — ehrlich ungeprüft",
    glied: "G4_NUTZUNG",
    e2eGruppen: [8],
    zustand: "IST",
    pfad: "services/app/src/routes/ask-routes.ts (POST /api/ask)",
  },
  {
    id: "S7",
    name: "Validierung über die echte Bewertung",
    glied: "G3_PRUEFWEG",
    e2eGruppen: [9],
    zustand: "IST",
    pfad: "services/app/src/routes/ko-routes.ts (PUT /api/kos/:id, action rate)",
  },
  {
    id: "S8",
    name: "Nutzung NACH der Validierung — gesichert und quellengebunden",
    glied: "G4_NUTZUNG",
    e2eGruppen: [10],
    zustand: "IST",
    pfad: "services/app/src/routes/ask-routes.ts (POST /api/ask)",
  },
  {
    id: "S9",
    name: "Erklärung des Belegs am Antwortweg (AnswerEvidenceSnapshot)",
    glied: "G5_ERKLAERUNG",
    e2eGruppen: [],
    zustand: "FEHLT",
    pfad: "services/ask/src/types.ts (Kern vorhanden, am Antwortweg nicht verdrahtet)",
  },
];

const ALLE_GLIEDER: readonly Glied[] = [
  "G1_AUFNAHME",
  "G2_ANFANGSZUSTAND",
  "G3_PRUEFWEG",
  "G4_NUTZUNG",
  "G5_ERKLAERUNG",
];

describe("JOB 550 · Teil A — der Zählvertrag ist eindeutig", () => {
  it("A1 · genau zehn Stufen, lückenlos S0..S9, keine doppelt", () => {
    expect(W10).toHaveLength(10);
    expect(W10.map((s) => s.id)).toEqual([
      "S0",
      "S1",
      "S2",
      "S3",
      "S4",
      "S5",
      "S6",
      "S7",
      "S8",
      "S9",
    ]);
    expect(new Set(W10.map((s) => s.id)).size).toBe(10);
  });

  it("A2 · die fünf Glieder ZERLEGEN die zehn Stufen — jede Stufe genau einmal, kein Glied leer", () => {
    // Zerlegung heisst beides: nichts doppelt (jede Stufe trägt GENAU EIN Glied) und nichts
    // ausgelassen (die Vereinigung ist die volle Menge). Ein Modell, das nur eine der beiden
    // Richtungen prüft, lässt genau den Fehler zu, den das Urteil rügt.
    expect(new Set(W10.map((s) => s.glied)).size).toBe(5);
    for (const glied of ALLE_GLIEDER) {
      expect(W10.filter((s) => s.glied === glied).length).toBeGreaterThan(0);
    }
    const summe = ALLE_GLIEDER.reduce((n, g) => n + W10.filter((s) => s.glied === g).length, 0);
    expect(summe).toBe(W10.length);
  });

  it("A3 · die zehn E2E-Zusicherungsgruppen decken genau acht Stufen — die Rechnung geht auf", () => {
    const gruppen = W10.flatMap((s) => s.e2eGruppen);
    // Jede Gruppe 1..10 kommt GENAU EINMAL vor: keine Doppelzählung.
    expect([...gruppen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const gedeckt = W10.filter((s) => s.e2eGruppen.length > 0);
    const offen = W10.filter((s) => s.e2eGruppen.length === 0);
    expect(gedeckt).toHaveLength(8);
    expect(offen).toHaveLength(2);
    expect(gedeckt.length + offen.length).toBe(10);
  });

  it("A4 · gedeckt ⇔ IST und offen ⇔ FEHLT — der Zustand ist aus der Deckung abgeleitet, nicht behauptet", () => {
    for (const s of W10) {
      expect(s.zustand).toBe(s.e2eGruppen.length > 0 ? "IST" : "FEHLT");
    }
    expect(W10.filter((s) => s.zustand === "FEHLT").map((s) => s.id)).toEqual(["S0", "S9"]);
  });

  it("A5 · die Lesart „neun Schritte“ ist dieselbe Menge ohne S0 — keine ausgelassene Kante", () => {
    const neunSchritte = W10.filter((s) => s.id !== "S0");
    expect(neunSchritte).toHaveLength(9);
    expect(new Set([...neunSchritte.map((s) => s.id), "S0"]).size).toBe(10);
  });
});

// ================================================================================================
// TEIL B — DIE W10-MATRIX MIT AKTUELLEM LAUFBELEG (Prüflücke 1)
// ================================================================================================
//
// Das Urteil verlangt „aktuellen Laufbeleg" statt historischer Quelltextlesung. Deshalb wird die
// Kette hier in EINEM Lauf tatsächlich durchfahren und je Stufe eine eigene Zusicherung gesetzt.
// Der Lauf ist offline: `buildApp(buildServices())` baut In-Memory-Repos, es gibt keinen Netz-,
// Datenbank- oder Modellzugriff.
type App = ReturnType<typeof buildApp>;

async function login(app: App, email: string, password: string): Promise<Record<string, string>> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  return { authorization: `Bearer ${res.json().token}` };
}

const ask = (app: App, headers: Record<string, string>, frage: string) =>
  app.inject({ method: "POST", url: "/api/ask", headers, payload: { question: frage } });

/** Ein frisches Werk mit Admin — jede Kante startet auf leerem Bestand. */
async function frischesWerk(): Promise<{
  app: App;
  services: ReturnType<typeof buildServices>;
  admin: Record<string, string>;
}> {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  return { app, services, admin: await login(app, "a@x.de", "secret123") };
}

const FRAGE = "Wie wird der Hydraulikzylinder HZ7 entlüftet?";

async function erfasse(
  app: App,
  admin: Record<string, string>,
  titel = "Hydraulikzylinder HZ7 sicher entlüften",
) {
  let bodyHtml = applyBodyTemplate("", "procedure", "de");
  bodyHtml = applyBodyAssistSection(
    bodyHtml,
    "Sicherheitshinweis\nVor dem Entlüften des Hydraulikzylinders HZ7 den Systemdruck vollständig ablassen.",
  );
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: admin,
    payload: {
      title: titel,
      statement: "Vor dem Entlüften des Hydraulikzylinders HZ7 den Systemdruck ablassen.",
      bodyHtml,
      type: "best_practice",
      category: "Anlage 2",
      neededValidations: 1,
    },
  });
  return { created, bodyHtml };
}

describe("JOB 550 · Teil B — die acht IST-Stufen laufen heute", () => {
  it("B1 · S1 bis S8 in einem Lauf, jede Stufe einzeln belegt", async () => {
    const { app, admin } = await frischesWerk();

    // S1 — Studio-Strukturierung.
    const { created, bodyHtml } = await erfasse(app, admin);
    expect(bodyHtml).toContain("<h3>Sicherheitshinweis</h3>");

    // S2 — Fresh Capture über die echte Route.
    expect(created.statusCode).toBe(201);
    const ko = created.json() as KnowledgeObject & { bodyHtml: string };

    // S3 — ehrlicher Frischezustand.
    expect(ko.status).toBe("offen");
    expect(ko.trust).toBe(0);
    expect(ko.version).toBe(1);
    expect(koOverview(ko).usability).toBe("needs-work");

    // S4 — der Sanitizer hält die Struktur.
    const quality = editorContentQuality({ bodyHtml: ko.bodyHtml, attachments: [] });
    expect(quality.hasHeadings).toBe(true);
    expect(quality.hasLists).toBe(true);
    expect(quality.hasBlocks).toBe(true);

    // S5 — Übergabe in die Prüfung: Wegweiser UND Board.
    expect(captureNextSteps(ko.id, "admin").find((s) => s.primary)?.to).toContain("/validierung");
    const board = await app.inject({ method: "GET", url: "/api/validation/board", headers: admin });
    expect(board.statusCode).toBe(200);
    expect((board.json() as KnowledgeObject[]).some((k) => k.id === ko.id)).toBe(true);

    // S6 — Nutzung VOR der Validierung: beantwortet, aber ehrlich ungeprüft.
    const vorher = (await ask(app, admin, FRAGE)).json().result as AnswerResult;
    expect(vorher.answered).toBe(true);
    expect(vorher.sources).toContain(ko.id);
    expect(vorher.knowledgeClass).not.toBe("gesichert");

    // S7 — Validierung über die echte Bewertung.
    const rate = await app.inject({
      method: "PUT",
      url: `/api/kos/${ko.id}`,
      headers: admin,
      payload: { action: "rate", verdict: "up" },
    });
    expect(rate.statusCode).toBe(200);
    const validiert = (
      await app.inject({ method: "GET", url: `/api/kos/${ko.id}`, headers: admin })
    ).json() as KnowledgeObject;
    expect(validiert.status).toBe("validiert");

    // S8 — Nutzung NACH der Validierung: gesichert und quellengebunden.
    const nachher = await ask(app, admin, FRAGE);
    const ergebnis = nachher.json().result as AnswerResult;
    expect(ergebnis.knowledgeClass).toBe("gesichert");
    expect(ergebnis.sources).toEqual([ko.id]);
    expect(nachher.json().gap).toBeNull();
  });

  it("B2 · S9 ist heute NICHT verdrahtet — die Antwort trägt keinen Belegschnappschuss", async () => {
    // REICHWEITENGRENZE, ausdrücklich: Der Snapshot-KERN existiert (services/ask/src/types.ts) und
    // wird in Teil D auch ausgeführt. Was FEHLT, ist seine Verdrahtung AM ANTWORTWEG. Genau das
    // misst dieser Fall — und er misst es an der Antwort, nicht am Vorhandensein einer Datei.
    //
    // Dieser Fall wird rot, sobald jemand S9 verdrahtet. Das ist beabsichtigt: dann ist die Matrix
    // veraltet und muss fortgeschrieben werden. Ein Test, der eine Lücke stillschweigend überlebt,
    // wäre genau die Sorte Beleg, die das Urteil zurückgewiesen hat.
    const { app, admin } = await frischesWerk();
    await erfasse(app, admin);
    const antwort = (await ask(app, admin, FRAGE)).json();
    expect(antwort.result).toBeDefined();
    expect(antwort.snapshot).toBeUndefined();
    expect(antwort.evidenceSnapshot).toBeUndefined();
    expect(W10.find((s) => s.id === "S9")?.zustand).toBe("FEHLT");
  });
});

// ================================================================================================
// TEIL C — DIE SECHS NEGATIVKANTEN, AUSGEFÜHRT (Prüflücke 4)
// ================================================================================================
//
// Das Urteil: „Alle sechs Negativkanten aktuell ausführen. Bis zu einem belegten Lauf sind auch
// zweiter Lauf, frische Base und fehlende Quelle als `UNGEPRÜFT` zu führen, nicht als `ERFÜLLT`."
// D4 hat sie ausdrücklich als ungeprüft geführt. Hier laufen alle sechs.
describe("JOB 550 · Teil C — alle sechs Negativkanten laufen", () => {
  it("N1 · zweiter Lauf: zwei Werke teilen keinen Bestand", async () => {
    const erstes = await frischesWerk();
    await erfasse(erstes.app, erstes.admin);
    const treffer = (await ask(erstes.app, erstes.admin, FRAGE)).json().result as AnswerResult;
    expect(treffer.answered).toBe(true);

    // Das ZWEITE Werk darf vom ersten nichts wissen — sonst wäre jede Isolationszusage der
    // übrigen Fälle wertlos, weil sie sich gegenseitig den Bestand vererbten.
    const zweites = await frischesWerk();
    const leer = (await ask(zweites.app, zweites.admin, FRAGE)).json().result as AnswerResult;
    expect(leer.answered).toBe(false);
    expect(leer.sources).toHaveLength(0);
  });

  it("N2 · frische Base: Registrierung, Erfassung und Validierung laufen vollständig im Lauf", async () => {
    // „Frische Base" heisst: nichts ist vorgeseedet. Der erste registrierte Mensch wird Admin, und
    // die ganze Kette bis „gesichert" entsteht innerhalb dieses einen Laufs.
    const { app, admin } = await frischesWerk();
    const { created } = await erfasse(app, admin);
    const ko = created.json() as KnowledgeObject;
    await app.inject({
      method: "PUT",
      url: `/api/kos/${ko.id}`,
      headers: admin,
      payload: { action: "rate", verdict: "up" },
    });
    const ergebnis = (await ask(app, admin, FRAGE)).json().result as AnswerResult;
    expect(ergebnis.knowledgeClass).toBe("gesichert");
  });

  it("N3 · fehlende Quelle: keine Rateantwort, sondern eine ehrliche Lücke", async () => {
    const { app, admin } = await frischesWerk();
    const res = await ask(app, admin, "Wie kalibriere ich das Quantenflux-Aggregat ZZZ?");
    const body = res.json();
    expect((body.result as AnswerResult).answered).toBe(false);
    expect((body.result as AnswerResult).sources).toHaveLength(0);
    expect(body.gap).not.toBeNull();
    expect(body.gap.status).toBe("offen");
  });

  it("N4 · Konflikt: ein offener Wahrheitskonflikt nimmt dem validierten Wissen die Sicherung", async () => {
    const { app, admin } = await frischesWerk();
    const a = (await erfasse(app, admin)).created.json() as KnowledgeObject;
    const b = (
      await erfasse(app, admin, "Hydraulikzylinder HZ7 unter Druck entlüften")
    ).created.json() as KnowledgeObject;
    for (const id of [a.id, b.id]) {
      await app.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers: admin,
        payload: { action: "rate", verdict: "up" },
      });
    }
    const vorKonflikt = (
      await app.inject({ method: "GET", url: `/api/kos/${a.id}`, headers: admin })
    ).json() as KnowledgeObject;
    expect(vorKonflikt.status).toBe("validiert");

    const konflikt = await app.inject({
      method: "PUT",
      url: `/api/kos/${a.id}`,
      headers: admin,
      payload: {
        action: "conflict",
        conflict: {
          koA: a.id,
          koB: b.id,
          type: "truth",
          description: "Druck ablassen gegen unter Druck entlüften — beides kann nicht gelten.",
        },
      },
    });
    expect(konflikt.statusCode).toBe(201);

    // DIE EIGENTLICHE ZUSAGE: der Konflikt wirkt auf den BESTAND zurück, nicht nur auf eine Liste.
    const nachKonflikt = (
      await app.inject({ method: "GET", url: `/api/kos/${a.id}`, headers: admin })
    ).json() as KnowledgeObject;
    expect(nachKonflikt.status).not.toBe("validiert");
    expect(koOverview(nachKonflikt).usability).not.toBe("ready");
  });

  it("N5 · Rechteentzug: ohne ko.validate wird nicht bewertet, und ohne Freigabe gibt es kein Token", async () => {
    const { app, admin } = await frischesWerk();
    const ko = (await erfasse(app, admin)).created.json() as KnowledgeObject;

    // (a) Ein vom Admin angelegter Experte ist freigegeben und kann sich anmelden …
    const anlegen = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: "Erik", email: "erik@x.de", password: "secret123", role: "experte" },
    });
    expect(anlegen.statusCode).toBe(201);
    const erik = await login(app, "erik@x.de", "secret123");

    // … darf aber NICHT bewerten: `rate` verlangt `ko.validate`, das der Experte nicht hat
    // (services/rbac/src/policy.ts:16-17).
    const versuch = await app.inject({
      method: "PUT",
      url: `/api/kos/${ko.id}`,
      headers: erik,
      payload: { action: "rate", verdict: "up" },
    });
    expect(versuch.statusCode).toBe(403);

    // Gegenprobe in dieselbe Richtung: der Bestand hat sich dadurch NICHT verändert.
    const unveraendert = (
      await app.inject({ method: "GET", url: `/api/kos/${ko.id}`, headers: admin })
    ).json() as KnowledgeObject;
    expect(unveraendert.status).toBe("offen");
    expect(unveraendert.trust).toBe(0);

    // (b) Selbstregistrierung erzeugt ein NICHT freigegebenes Konto — die Anmeldung scheitert.
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Mara", email: "mara@x.de", password: "secret123" },
    });
    const maraLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "mara@x.de", password: "secret123" },
    });
    expect(maraLogin.statusCode).toBeGreaterThanOrEqual(400);
    expect(maraLogin.json().token).toBeUndefined();
  });

  it("N6 · fehlgeschlagene Verbesserung: ein `down` validiert nicht und macht die Antwort nicht gesichert", async () => {
    const { app, admin } = await frischesWerk();
    const ko = (await erfasse(app, admin)).created.json() as KnowledgeObject;

    const abgelehnt = await app.inject({
      method: "PUT",
      url: `/api/kos/${ko.id}`,
      headers: admin,
      payload: { action: "rate", verdict: "down" },
    });
    expect(abgelehnt.statusCode).toBe(200);

    const danach = (
      await app.inject({ method: "GET", url: `/api/kos/${ko.id}`, headers: admin })
    ).json() as KnowledgeObject;
    expect(danach.status).not.toBe("validiert");

    // Und die Nutzung bleibt ehrlich: keine „gesicherte" Antwort aus abgelehntem Wissen.
    const ergebnis = (await ask(app, admin, FRAGE)).json().result as AnswerResult;
    expect(ergebnis.knowledgeClass).not.toBe("gesichert");
    expect(
      answerStatus(
        answerGrade({
          answered: ergebnis.answered,
          knowledgeClass: ergebnis.knowledgeClass,
          sourcesConflicted: false,
          sourcesCheckUnproven: false,
          conflictsUnproven: false,
        }),
      ).key,
    ).not.toBe("verified");
  });
});

// ================================================================================================
// TEIL D — DIE ERKLÄRUNGSKETTE (Prüflücke 5)
// ================================================================================================
//
// Das Urteil: „`AnswerEvidenceSnapshot` mit vollständigem, partiellem und driftendem Beleg prüfen;
// erwartet ist keine grüne Vollständigkeitsbehauptung bei `PARTIAL` oder `DRIFT`."
//
// „Grün" heisst hier genau zweierlei, und beides wird geprüft: der Abschlussstatus `COMPLETE`
// (`answerSnapshotStatus`) und der Lesezustand `VALID` (`answerSnapshotIntegrity`). Ein Beleg darf
// weder das eine noch das andere behaupten, wenn er unvollständig oder verfälscht ist.
const REF_VOLL: AnswerEvidenceRef = {
  knowledgeObjectId: "KO-1",
  knowledgeObjectVersion: 3,
  evidenceRole: "carrying",
  sourceRecordId: "SRC-1",
  sourceRecordIdReason: null,
  locator: "S. 4, Absatz 2",
  locatorReason: null,
};

const REF_TEIL: AnswerEvidenceRef = {
  ...REF_VOLL,
  sourceRecordId: null,
  sourceRecordIdReason: "w2a_not_wired",
  locator: null,
  locatorReason: "no_locator_from_import",
};

function snapshot(
  evidence: readonly AnswerEvidenceRef[],
  extras: Partial<AnswerEvidenceSnapshot> = {},
): AnswerEvidenceSnapshot {
  const roh: AnswerEvidenceSnapshot = {
    answerId: "ANS-1",
    snapshotRevision: 1,
    supersedesSnapshotRevision: null,
    schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
    capturedAt: "2026-08-17T20:00:00.000Z",
    citedSources: ["KO-1"],
    evidence,
    resolutionId: "RES-1",
    resolutionIdReason: null,
    validationDecisionRef: { auditSeq: 7, auditHash: "a".repeat(64) },
    validationDecisionRefReason: null,
    status: "COMPLETE",
    integrityHash: "",
    ...extras,
  };
  // Der Hash wird BERECHNET, nicht gesetzt — sonst prüfte der Test seine eigene Zahl.
  return { ...roh, integrityHash: hashAnswerSnapshot(roh) };
}

const OFFENER_KONTEXT = { primaryResolvable: true, gesperrt: false } as const;

describe("JOB 550 · Teil D — die Erklärungskette behauptet keine Vollständigkeit, die sie nicht hat", () => {
  it("D1 · vollständiger Beleg: COMPLETE und VALID", () => {
    const s = snapshot([REF_VOLL]);
    expect(answerSnapshotStatus(s)).toBe("COMPLETE");
    expect(answerSnapshotIntegrity(s, OFFENER_KONTEXT)).toBe("VALID");
  });

  it("D2 · partieller Beleg: PARTIAL und DEGRADED — kein grüner Abschluss", () => {
    const s = snapshot([REF_TEIL]);
    expect(answerSnapshotStatus(s)).toBe("PARTIAL");
    expect(answerSnapshotStatus(s)).not.toBe("COMPLETE");
    expect(answerSnapshotIntegrity(s, OFFENER_KONTEXT)).toBe("DEGRADED");
    expect(answerSnapshotIntegrity(s, OFFENER_KONTEXT)).not.toBe("VALID");
  });

  it("D3 · driftender Beleg: der Hash trägt nicht mehr → INVALIDATED", () => {
    const echt = snapshot([REF_VOLL]);
    // DRIFT heisst: der Inhalt ist ein anderer, der Hash ist der alte. Genau das muss auffallen.
    const gedriftet: AnswerEvidenceSnapshot = { ...echt, citedSources: ["KO-1", "KO-2"] };
    expect(gedriftet.integrityHash).toBe(echt.integrityHash);
    expect(hashAnswerSnapshot(gedriftet)).not.toBe(gedriftet.integrityHash);
    expect(answerSnapshotIntegrity(gedriftet, OFFENER_KONTEXT)).toBe("INVALIDATED");
    expect(answerSnapshotIntegrity(gedriftet, OFFENER_KONTEXT)).not.toBe("VALID");
  });

  it("D4 · ohne Evidence ist der Beleg PENDING_EVIDENCE — nicht PARTIAL und nicht COMPLETE", () => {
    const s = snapshot([]);
    expect(answerSnapshotStatus(s)).toBe("PENDING_EVIDENCE");
    expect(answerSnapshotStatus(s)).not.toBe("PARTIAL");
    expect(answerSnapshotStatus(s)).not.toBe("COMPLETE");
  });

  it("D5 · Evidence ohne gebundene KO-Version ist INCOMPLETE — strukturell ungebunden ist nicht „teilweise“", () => {
    const s = snapshot([{ ...REF_VOLL, knowledgeObjectVersion: null }]);
    expect(answerSnapshotStatus(s)).toBe("INCOMPLETE");
    expect(answerSnapshotStatus(s)).not.toBe("PARTIAL");
  });
});
