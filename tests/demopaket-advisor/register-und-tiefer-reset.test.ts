// ================================================================================================
// JOB 3277 · E (RUNDE 2) — DAS REGISTER, DER VOLLE RESET UND DIE DUBLETTEN.
// ================================================================================================
//
// DIESE DATEI IST DIE ANTWORT AUF BENS PRÜFLÜCKEN. Runde 1 war an vier Stellen grün, ohne richtig
// zu sein — und alle vier waren unentdeckt geblieben, weil kein Test sie stellte. Jede Lücke steht
// hier als eigener Fall, formuliert als die Frage, die am Freitag wirklich gestellt wird:
//
//   E1  Ich habe im EDITOR gearbeitet.        Der Editor schreibt `bodyHtml`, und die Leseansicht
//                                             zeigt `bodyHtml`. Runde 1 setzte nur `statement`
//                                             zurück — sichtbar blieb der eigene Text.
//   E2  Ich habe nur die Kategorie verstellt.  Runde 1 verglich Titel und Text, sonst nichts: die
//       / Es ist nicht mehr freigegeben.       Abweichung war unsichtbar, „unverändert" war falsch.
//   E3  Ich habe zweimal geklickt.             Runde 1 legte zwölf Objekte an, meldete sechs und
//                                             liess beim Entfernen sechs stehen.
//   E4  Was genau fasst das Zurücksetzen an?   Runde 1 konnte es nicht sagen: die Zugehörigkeit war
//                                             geraten. Jetzt ist sie AUFGESCHRIEBEN und abfragbar.
//
// Gemessen wird an der ECHTEN App (buildServices/buildApp, echte Dienste, echter Guard) — kein Mock
// des Prüflings, und kein Fall, der seinen eigenen Ausgangszustand behauptet: jeder liest den
// geladenen Stand zuerst ab und vergleicht danach dagegen.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { EXAMPLE_PROVIDER, EXAMPLE_TITLE_PREFIX } from "../../services/app/src/example-packages";
import { ADVISOR_ICT_EN_V1 } from "../../services/app/src/example-packages/advisor-ict-en-v1";
import {
  lesePaketlauf,
  paketlaufMerker,
} from "../../services/app/src/example-packages/paketlauf-register";

const PAKET = ADVISOR_ICT_EN_V1.id;

async function adminApp() {
  const services = buildServices();
  const app = buildApp(services);
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
  const admin = (await services.auth.listUsers()).find((u) => u.role === "admin");
  return {
    app,
    services,
    adminId: (admin as { id: string }).id,
    headers: { authorization: `Bearer ${login.json().token}` },
  };
}

type App = Awaited<ReturnType<typeof adminApp>>["app"];
type Kopf = Record<string, string>;

const laden = (app: App, headers: Kopf, id = PAKET) =>
  app.inject({ method: "POST", url: `/api/admin/demo-packages/${id}/load`, headers });
const zuruecksetzen = (app: App, headers: Kopf, id = PAKET) =>
  app.inject({ method: "POST", url: `/api/admin/demo-packages/${id}/reset`, headers });
const entfernen = (app: App, headers: Kopf, id = PAKET) =>
  app.inject({ method: "DELETE", url: `/api/admin/demo-packages/${id}`, headers });
/** JOB 3277 R4: die Vorschau gehört zu einer AKTION — ohne Angabe zeigt sie das Zurücksetzen. */
const vorschau = (
  app: App,
  headers: Kopf,
  id = PAKET,
  aktion: "zuruecksetzen" | "entfernen" | null = null,
) =>
  app.inject({
    method: "GET",
    url: `/api/admin/demo-packages/${id}/preview${aktion ? `?aktion=${aktion}` : ""}`,
    headers,
  });
const uebersicht = (app: App, headers: Kopf) =>
  app.inject({ method: "GET", url: "/api/admin/demo-packages", headers });

interface Bilanz {
  package: string;
  run: string | null;
  created: number;
  updated: number;
  skipped: number;
  removed: number;
  /** JOB 3277 R3: davon zugeordnete Nicht-Bausteine (Import-/Entwurfsobjekte der Vorführung). */
  removedAssigned: number;
  registered: number;
  duplicates: number;
  skippedInTrash: number;
  closedConflicts: number;
  closedDuplicates: number;
  failures: { key: string; grund: string }[];
}

interface Vorschau {
  package: string;
  /** JOB 3277 R4: die Aktion, deren Plan die Antwort zeigt. */
  aktion: "zuruecksetzen" | "entfernen";
  runs: string[];
  counts: Record<string, number>;
  /** JOB 3277 R3: ALLE zugeordneten Objekte — auch die unregistrierten — je mit Behandlung/Grund. */
  entries: {
    id: string;
    art: string | null;
    run: string | null;
    key: string | null;
    title: string;
    behandlung: "wiederherstellen" | "entfernen";
    grund: "baustein" | "dublette" | "zugeordnet";
    abweichungen: string[];
  }[];
  missing: number;
}

/** Das geladene Objekt eines Bausteins — über seinen Paketanker, nicht über den Titel. */
async function baustein(services: { ko: { list: () => Promise<unknown[]> } }, key: string) {
  const kos = (await services.ko.list()) as {
    id: string;
    sources?: { externalId?: string }[];
  }[];
  const treffer = kos.find((k) =>
    (k.sources ?? []).some((s) => s.externalId === `${PAKET}/${key}`),
  );
  expect(treffer, `Baustein ${key}`).toBeDefined();
  return treffer as { id: string };
}

// ================================================================================================
// E1 — DER EDITOR SCHREIBT `bodyHtml`, ALSO MUSS DER RESET IHN ZURÜCKSETZEN.
// ================================================================================================
describe("JOB 3277 E1 · Zurücksetzen stellt den SICHTBAREN Inhalt wieder her", () => {
  it("im Editor bearbeiteter Rumpf → Reset stellt Rumpf UND Text zeichengleich her", async () => {
    const { app, services, headers } = await adminApp();
    await laden(app, headers);
    const t03 = await baustein(services, "T03");

    // Der Ausgangszustand wird ABGELESEN, nicht behauptet: das Paket legt einen Rumpf an, und
    // genau dieser Rumpf ist der Maßstab. Wäre er leer, wäre der ganze Fall wertlos — deshalb
    // steht das hier als eigene Zusicherung.
    const vorher = await services.ko.get(t03.id);
    const rumpfVorher = vorher?.bodyHtml ?? "";
    expect(rumpfVorher.length).toBeGreaterThan(50);
    expect(rumpfVorher).toContain("only needs eight characters");

    // So arbeitet ein Mensch am Freitag: im WYSIWYG-Editor. Der schreibt `bodyHtml`.
    await services.ko.revise(
      t03.id,
      { bodyHtml: "<p>PEDI hat den Fehler wegdiskutiert.</p>", statement: "Wegdiskutiert." },
      "admin",
    );
    const bearbeitet = await services.ko.get(t03.id);
    expect(bearbeitet?.bodyHtml).toContain("wegdiskutiert");

    // Die Übersicht MUSS das als Bearbeitung sehen — sonst böte sie das Zurücksetzen gar nicht an.
    const zwischen = (await uebersicht(app, headers)).json() as {
      packages: { id: string; edited: number }[];
    };
    expect(zwischen.packages.find((p) => p.id === PAKET)?.edited).toBe(1);

    const reset = (await zuruecksetzen(app, headers)).json() as Bilanz;
    expect(reset.updated).toBe(1);
    expect(reset.skipped).toBe(5);
    expect(reset.failures).toEqual([]);

    const wieder = await services.ko.get(t03.id);
    // DER KERN DIESES FALLS: der sichtbare Rumpf ist wieder der des Vertrags — Zeichen für Zeichen.
    expect(wieder?.bodyHtml).toBe(rumpfVorher);
    expect(wieder?.bodyHtml).not.toContain("wegdiskutiert");
    expect(wieder?.statement).toBe(vorher?.statement);
    // Und der absichtliche Vorführfehler steht wieder da, wo der Import ihn finden muss.
    expect(wieder?.bodyHtml).toContain("only needs eight characters");
    expect(wieder?.status).toBe("validiert");
  });

  // ============================================================================================
  // DER FALL, DER DEN VERGLEICH WIRKLICH AUF DIE PROBE STELLT.
  // ============================================================================================
  // Oben ändert sich mit dem Rumpf auch der Text — ein Reset, der nur `statement` vergleicht,
  // fiele dort noch nicht auf. Eine reine FORMATIERUNG im Editor (ein Wort fett) lässt den Text
  // Zeichen für Zeichen gleich und ändert nur die Darstellung. Genau hier entscheidet sich, ob
  // `bodyHtml` wirklich zum verglichenen Ausgangszustand gehört — oder nur zufällig mitläuft.
  it("NUR die Formatierung geändert (gleicher Text, anderer Rumpf) → erkannt und zurückgesetzt", async () => {
    const { app, services, headers } = await adminApp();
    await laden(app, headers);
    const s02 = await baustein(services, "S02");
    const vorher = await services.ko.get(s02.id);
    const rumpfVorher = vorher?.bodyHtml ?? "";
    const textVorher = vorher?.statement ?? "";
    expect(rumpfVorher).toContain("<p>Every new customer");
    expect(textVorher.length).toBeGreaterThan(50);

    // Ein Wort fett — wie es im Editor mit zwei Klicks geschieht. Der Text reist unverändert mit
    // (so speichert der Editor: Rumpf UND Text), damit sich dieser Fall wirklich nur am Rumpf
    // entscheidet.
    await services.ko.revise(
      s02.id,
      {
        bodyHtml: rumpfVorher.replace(
          "named service contact",
          "<strong>named</strong> service contact",
        ),
        statement: textVorher,
      },
      "admin",
    );
    const bearbeitet = await services.ko.get(s02.id);
    // Die Voraussetzung dieses Falls, ausdrücklich nachgemessen: der TEXT ist unverändert …
    expect(bearbeitet?.statement).toBe(textVorher);
    // … und trotzdem steht im Rumpf jetzt etwas anderes.
    expect(bearbeitet?.bodyHtml).not.toBe(rumpfVorher);
    expect(bearbeitet?.bodyHtml).toContain("<strong>");

    // Ein Vergleich, der nur den Text kennt, sähe hier NICHTS.
    const zwischen = (await uebersicht(app, headers)).json() as {
      packages: { id: string; edited: number }[];
    };
    expect(zwischen.packages.find((p) => p.id === PAKET)?.edited).toBe(1);

    const reset = (await zuruecksetzen(app, headers)).json() as Bilanz;
    expect(reset.updated).toBe(1);
    const wieder = await services.ko.get(s02.id);
    expect(wieder?.bodyHtml).toBe(rumpfVorher);
    expect(wieder?.bodyHtml).not.toContain("<strong>");
    expect(wieder?.status).toBe("validiert");
  });
});

// ================================================================================================
// E2 — „UNVERÄNDERT" DARF NICHT HEISSEN „TITEL UND TEXT STIMMEN".
// ================================================================================================
describe("JOB 3277 E2 · auch Metadaten und die Freigabe gehören zum Ausgangszustand", () => {
  it("nur die KATEGORIE verstellt → als bearbeitet erkannt und zurückgesetzt", async () => {
    const { app, services, headers } = await adminApp();
    await laden(app, headers);
    const t01 = await baustein(services, "T01");
    const vorher = await services.ko.get(t01.id);
    await services.ko.updateCategory(t01.id, "Völlig anderer Bereich", "admin");

    // Runde 1 zählte hier 0 bearbeitet — die Abweichung war unsichtbar.
    const zwischen = (await uebersicht(app, headers)).json() as {
      packages: { id: string; edited: number }[];
    };
    expect(zwischen.packages.find((p) => p.id === PAKET)?.edited).toBe(1);

    const reset = (await zuruecksetzen(app, headers)).json() as Bilanz;
    expect(reset.updated).toBe(1);
    expect(reset.skipped).toBe(5);
    const wieder = await services.ko.get(t01.id);
    expect(wieder?.category).toBe(vorher?.category);
    expect(wieder?.status).toBe("validiert");
  });

  it("nur die SCHLAGWORTE verstellt → zurückgesetzt, ohne den Registermerker zu verlieren", async () => {
    const { app, services, headers } = await adminApp();
    await laden(app, headers);
    const c01 = await baustein(services, "C01");
    const merkerVorher = lesePaketlauf((await services.ko.get(c01.id))?.tags, PAKET);
    expect(merkerVorher).not.toBeNull();

    await services.ko.updateTags(c01.id, ["voellig", "andere", "schlagworte"], "admin");
    const reset = (await zuruecksetzen(app, headers)).json() as Bilanz;
    expect(reset.updated).toBe(1);

    const wieder = await services.ko.get(c01.id);
    expect(wieder?.tags).toContain("beispiel");
    expect(wieder?.tags).toContain(PAKET);
    expect(wieder?.tags).not.toContain("voellig");
    // Die Zugehörigkeit überlebt das Zurücksetzen — sonst wäre das Objekt danach herrenlos.
    expect(lesePaketlauf(wieder?.tags, PAKET)).not.toBeNull();
  });

  it("nur die FREIGABE verloren (rote Stimme) → Reset gibt wieder frei, ohne den Text anzufassen", async () => {
    const { app, services, headers, adminId } = await adminApp();
    await laden(app, headers);
    const s04 = await baustein(services, "S04");
    const vorher = await services.ko.get(s04.id);

    // Der echte Weg, auf dem ein Objekt seine Freigabe verliert: eine rote Stimme.
    await services.validation.rate(s04.id, adminId, "down");
    expect((await services.ko.get(s04.id))?.status).not.toBe("validiert");

    // Runde 1 hielt dieses Objekt für „unverändert" — der Bestand war damit still entwertet.
    const zwischen = (await uebersicht(app, headers)).json() as {
      packages: { id: string; edited: number }[];
    };
    expect(zwischen.packages.find((p) => p.id === PAKET)?.edited).toBe(1);

    const reset = (await zuruecksetzen(app, headers)).json() as Bilanz;
    expect(reset.updated).toBe(1);
    expect(reset.failures).toEqual([]);
    const wieder = await services.ko.get(s04.id);
    expect(wieder?.status).toBe("validiert");
    // Der Text war nie das Problem und wurde deshalb auch nicht angefasst.
    expect(wieder?.statement).toBe(vorher?.statement);
    expect(wieder?.version).toBe(vorher?.version);
  });
});

// ================================================================================================
// E3 — ZWEI KLICKS DÜRFEN NICHT ZWÖLF OBJEKTE ERGEBEN, UND EINE DUBLETTE DARF NICHT VERSCHWIEGEN
//      WERDEN.
// ================================================================================================
describe("JOB 3277 E3 · gleichzeitiges Laden und vorhandene Dubletten", () => {
  it("zwei gleichzeitige Ladeaufrufe erzeugen zusammen GENAU sechs Objekte", async () => {
    const { app, services, headers } = await adminApp();
    // Genau Bens Messung: nicht nacheinander, sondern gleichzeitig.
    const [a, b] = await Promise.all([laden(app, headers), laden(app, headers)]);
    const eins = a.json() as Bilanz;
    const zwei = b.json() as Bilanz;
    expect(eins.failures).toEqual([]);
    expect(zwei.failures).toEqual([]);
    // Zusammen sechs Anlagen — welcher der beiden Läufe sie macht, ist offen und darf es sein.
    expect(eins.created + zwei.created).toBe(6);
    expect(eins.skipped + zwei.skipped).toBe(6);
    // Und der Bestand ist die Wahrheit: sechs Objekte, sechs eindeutige Anker.
    const kos = await services.ko.list();
    expect(kos.length).toBe(6);
    const anker = kos.flatMap((k) => (k.sources ?? []).map((s) => s.externalId));
    expect(new Set(anker).size).toBe(6);
    // Die beiden Läufe tragen verschiedene Kennungen — sonst wäre „run_id" ein leeres Wort.
    expect(eins.run).not.toBe(zwei.run);
  });

  it("eine BEREITS vorhandene Dublette wird gezählt, angezeigt und beim Zurücksetzen entfernt", async () => {
    const { app, services, headers } = await adminApp();
    await laden(app, headers);
    const t03 = await baustein(services, "T03");
    const original = await services.ko.get(t03.id);

    // Eine Kopie mit demselben Anker, wie sie vor der Warteschlange entstehen konnte (oder in einem
    // zweiten Serverprozess entstünde). Sie ist echt vorhanden — also muss sie auch gezählt werden.
    const kopie = await services.ko.create({
      title: original?.title ?? "",
      statement: original?.statement ?? "",
      type: original?.type ?? "technik",
      category: original?.category ?? "Technical",
      author: "admin",
      tags: ["beispiel", PAKET],
      sources: [
        {
          id: `${PAKET}/T03`,
          label: "Kopie",
          url: null,
          excerpt: null,
          kind: "external",
          peerValidated: false,
          provider: EXAMPLE_PROVIDER,
          externalId: `${PAKET}/T03`,
          sourceVersion: 1,
          author: "admin",
          at: new Date().toISOString(),
        },
      ],
      demoSeed: true,
    });
    expect((await services.ko.list()).length).toBe(7);

    // DIE ÜBERSICHT VERSCHWEIGT SIE NICHT: sieben liegen da, eine ist überzählig.
    const stand = (await uebersicht(app, headers)).json() as {
      packages: { id: string; loaded: number; duplicates: number }[];
    };
    expect(stand.packages.find((p) => p.id === PAKET)).toMatchObject({
      loaded: 7,
      duplicates: 1,
    });

    const reset = (await zuruecksetzen(app, headers)).json() as Bilanz;
    expect(reset.duplicates).toBe(1);
    expect(reset.removed).toBe(1);
    expect(reset.failures).toEqual([]);
    // Die Kopie ist weg, der registrierte Träger steht noch.
    expect((await services.ko.list()).length).toBe(6);
    expect(await services.ko.get(kopie.id)).toBeFalsy();
    expect(await services.ko.get(t03.id)).toBeTruthy();
  });

  it("das Entfernen lässt keine Dublette stehen — es räumt ALLE Objekte des Pakets ab", async () => {
    const { app, services, headers } = await adminApp();
    await laden(app, headers);
    const t01 = await baustein(services, "T01");
    const original = await services.ko.get(t01.id);
    await services.ko.create({
      title: original?.title ?? "",
      statement: original?.statement ?? "",
      type: original?.type ?? "technik",
      category: original?.category ?? "Technical",
      author: "admin",
      tags: ["beispiel", PAKET],
      sources: [
        {
          id: `${PAKET}/T01`,
          label: "Kopie",
          url: null,
          excerpt: null,
          kind: "external",
          peerValidated: false,
          provider: EXAMPLE_PROVIDER,
          externalId: `${PAKET}/T01`,
          sourceVersion: 1,
          author: "admin",
          at: new Date().toISOString(),
        },
      ],
      demoSeed: true,
    });
    expect((await services.ko.list()).length).toBe(7);
    const bilanz = (await entfernen(app, headers)).json() as Bilanz;
    // Sieben lagen da, sieben gehen — in Runde 1 wären sechs gemeldet und eine zurückgeblieben.
    expect(bilanz.removed).toBe(7);
    expect(await services.ko.list()).toEqual([]);
  });
});

// ================================================================================================
// E4 — DIE ZUGEHÖRIGKEIT STEHT GESCHRIEBEN, UND DIE VORSCHAU LIEST SIE VOR.
// ================================================================================================
describe("JOB 3277 E4 · Paketlauf-Register und Vorschau", () => {
  it("jedes geladene Objekt trägt einen Registereintrag mit Paket, Art und Lauf des Ladelaufs", async () => {
    const { app, services, headers } = await adminApp();
    const bilanz = (await laden(app, headers)).json() as Bilanz;
    expect(bilanz.registered).toBe(6);

    for (const item of ADVISOR_ICT_EN_V1.items) {
      const objekt = await services.ko.get((await baustein(services, item.key)).id);
      const eintrag = lesePaketlauf(objekt?.tags, PAKET);
      expect(eintrag, item.key).not.toBeNull();
      expect(eintrag?.art, item.key).toBe("seed");
      // Der Lauf im Merker IST der Lauf aus der Bilanz — nicht irgendeiner.
      expect(eintrag?.lauf, item.key).toBe(bilanz.run);
    }
    // Ein Merker eines FREMDEN Pakets wird nicht gelesen — die Zugehörigkeit ist paketgenau.
    const eines = await services.ko.get((await baustein(services, "S02")).id);
    expect(lesePaketlauf(eines?.tags, "ein-anderes-paket")).toBeNull();
  });

  it("die Vorschau nennt GENAU die zugeordneten Kennungen — und kein fremdes Objekt", async () => {
    const { app, services, headers } = await adminApp();
    await laden(app, headers);
    // Ein fremdes Demo-Objekt am selben Tisch: es gehört NICHT zu diesem Paket.
    const fremd = await services.ko.create({
      title: "Fremdes Demo-Objekt",
      statement: "Gehört einem anderen Weg und muss unberührt bleiben.",
      type: "technik",
      category: "Montage",
      author: "admin",
      tags: ["beispiel"],
      demoSeed: true,
    });

    const res = await vorschau(app, headers);
    expect(res.statusCode).toBe(200);
    const sicht = res.json() as Vorschau;
    expect(sicht.package).toBe(PAKET);
    // Anzahl je Art — genau die Zählung, die die Nachführung verlangt.
    expect(sicht.counts).toEqual({ seed: 6 });
    expect(sicht.runs.length).toBe(1);
    expect(sicht.entries.length).toBe(6);
    expect(sicht.missing).toBe(0);
    // Alle sechs sind Bausteine und werden hergestellt — nichts geht.
    expect(sicht.entries.every((e) => e.behandlung === "wiederherstellen")).toBe(true);
    expect(sicht.entries.every((e) => e.grund === "baustein")).toBe(true);
    // Die Kennungen sind die des Bestands, und das fremde Objekt ist NICHT dabei.
    const ids = new Set(sicht.entries.map((e) => e.id));
    expect(ids.has(fremd.id)).toBe(false);
    for (const item of ADVISOR_ICT_EN_V1.items) {
      expect(ids.has((await baustein(services, item.key)).id), item.key).toBe(true);
    }
    // Nichts ist bearbeitet, und die Vorschau sagt genau das — je Objekt, nicht pauschal.
    expect(sicht.entries.every((e) => e.abweichungen.length === 0)).toBe(true);

    // Und die Vorschau ist eine LESEANSICHT: sie verändert nichts.
    expect((await services.ko.list()).length).toBe(7);
    expect((await services.ko.get(fremd.id))?.version).toBe(fremd.version);
  });

  it("die Vorschau benennt, WAS an einem bearbeiteten Objekt abweicht — vor dem Eingriff", async () => {
    const { app, services, headers } = await adminApp();
    await laden(app, headers);
    const c02 = await baustein(services, "C02");
    await services.ko.revise(c02.id, { statement: "Von Hand." }, "admin");
    await services.ko.updateCategory(c02.id, "Anderswo", "admin");

    const sicht = (await vorschau(app, headers)).json() as Vorschau;
    const eintrag = sicht.entries.find((e) => e.id === c02.id);
    expect(eintrag).toBeDefined();
    // Gemessen, nicht geraten: Inhalt, Metadaten und die durch die Revision verlorene Freigabe.
    expect(eintrag?.abweichungen).toContain("inhalt");
    expect(eintrag?.abweichungen).toContain("metadaten");
    expect(eintrag?.abweichungen).toContain("freigabe");
    // Die anderen fünf stehen unbehelligt da.
    expect(sicht.entries.filter((e) => e.abweichungen.length === 0).length).toBe(5);
  });

  it("Altbestand mit Paketanker ohne Registereintrag: ausgewiesen — und vom nächsten Lauf nachgetragen", async () => {
    const { app, services, headers } = await adminApp();
    // Ein Objekt, wie es vor dem Register entstanden ist: Anker ja, Merker nein.
    const alt = await services.ko.create({
      title: `${EXAMPLE_TITLE_PREFIX}Named customer contact`,
      statement: "Altbestand ohne Registereintrag.",
      type: "best_practice",
      category: "Sales",
      author: "admin",
      tags: ["beispiel", PAKET],
      sources: [
        {
          id: `${PAKET}/S02`,
          label: "Alt",
          url: null,
          excerpt: null,
          kind: "external",
          peerValidated: false,
          provider: EXAMPLE_PROVIDER,
          externalId: `${PAKET}/S02`,
          sourceVersion: 1,
          author: "admin",
          at: new Date().toISOString(),
        },
      ],
      demoSeed: true,
    });

    // Er wird als zugehörig ERKANNT und steht MIT SEINER KENNUNG in der Vorschau — als „nicht
    // registriert", aber eben nicht bloss als Anzahl (Bens Korrekturpflicht 2 zu Runde 2).
    const vorLauf = (await vorschau(app, headers)).json() as Vorschau;
    expect(vorLauf.entries.map((e) => e.id)).toEqual([alt.id]);
    expect(vorLauf.entries[0]?.art).toBeNull();
    expect(vorLauf.counts).toEqual({ nicht_registriert: 1 });
    // Er trägt den Anker von S02 und ist damit dessen Träger: er wird HERGESTELLT, nicht entfernt.
    expect(vorLauf.entries[0]?.behandlung).toBe("wiederherstellen");
    expect(vorLauf.missing).toBe(5);

    // Der nächste Ladelauf trägt die Zugehörigkeit nach, ohne den Text anzufassen.
    const bilanz = (await laden(app, headers)).json() as Bilanz;
    expect(bilanz.created).toBe(5);
    expect(bilanz.skipped).toBe(1);
    expect(bilanz.registered).toBe(6);
    const danach = await services.ko.get(alt.id);
    expect(lesePaketlauf(danach?.tags, PAKET)).not.toBeNull();
    expect(danach?.statement).toBe("Altbestand ohne Registereintrag.");

    const nachLauf = (await vorschau(app, headers)).json() as Vorschau;
    expect(nachLauf.entries.every((e) => e.art === "seed")).toBe(true);
    expect(nachLauf.entries.length).toBe(6);
    expect(nachLauf.missing).toBe(0);
  });

  it("die Vorschau ist admin-pflichtig und kennt kein erfundenes Paket", async () => {
    const { app, services, headers } = await adminApp();
    const zweiter = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Normalo", email: "n@x.de", password: "secret123" },
    });
    const admin = (await services.auth.listUsers()).find((u) => u.role === "admin");
    await services.auth.approveUser(
      (zweiter.json() as { id: string }).id,
      (admin as { id: string }).id,
    );
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "n@x.de", password: "secret123" },
    });
    const fremd = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
    expect((await vorschau(app, fremd)).statusCode).toBe(403);
    expect((await vorschau(app, headers, "gibt-es-nicht")).statusCode).toBe(404);
  });
});

// ================================================================================================
// E5 (RUNDE 3) — DIE DEMO-WIEDERHOLUNG: WAS WÄHREND DER VORFÜHRUNG ENTSTAND, GEHT WIEDER.
// ================================================================================================
//
// BENS KORREKTURPFLICHT 1 ZU RUNDE 2. Bis dahin wies der Reset registrierte Objekte der Arten
// `import` und `entwurf` als FEHLSCHLAG ab: sie standen im Register, waren in der Vorschau gezählt
// — und blieben liegen. Das ist der Fall, für den das Register überhaupt gebaut wurde.
//
// WAS DER AUSGANGSZUSTAND IST, entscheidet alles: das Paket verspricht die sechs freigegebenen
// Bausteine, sonst nichts. Ein über den Confluence-Import angenommenes Objekt war vor der
// Vorführung nicht da; die Wiederholung stellt den Zustand VOR dem Import her, also muss es weg —
// samt der Konflikte und Doppelungen, die es erzeugt hat. Fremde Daten bleiben, weil die Auswahl
// ausschliesslich aus Registereintrag und Paketanker entsteht, nie aus Titel oder Ähnlichkeit.
describe("JOB 3277 E5 · registrierte Import-/Entwurfsobjekte werden zurückgesetzt", () => {
  /** Ein Objekt, wie es der selektive Confluence-Import erzeugt: fremde Herkunft, Paketmerker. */
  async function importObjekt(
    services: Awaited<ReturnType<typeof adminApp>>["services"],
    lauf: string,
    confluenceId: string,
    art: "import" | "entwurf" = "import",
  ) {
    return services.ko.create({
      title: `Advisor page ${confluenceId}`,
      statement: "Aus dem Confluence-Import der Vorführung.",
      type: "technik",
      category: "Technical",
      author: "admin",
      // Der Paketmerker steht NEBEN der Confluence-Herkunft — er ersetzt sie nicht.
      tags: [paketlaufMerker({ paket: PAKET, art, lauf })],
      sources: [
        {
          id: confluenceId,
          label: "Confluence",
          url: null,
          excerpt: null,
          kind: "external",
          peerValidated: false,
          provider: "confluence",
          externalId: confluenceId,
          sourceVersion: 1,
          author: "admin",
          at: new Date().toISOString(),
        },
      ],
    });
  }

  it("Vorschau zählt sie je Art und weist sie als „wird entfernt“ aus — mit ihren Kennungen", async () => {
    const { app, services, headers } = await adminApp();
    const bilanz = (await laden(app, headers)).json() as Bilanz;
    const lauf = bilanz.run as string;
    const imp = await importObjekt(services, lauf, "24903695");
    const entw = await importObjekt(services, lauf, "24903696", "entwurf");

    const sicht = (await vorschau(app, headers)).json() as Vorschau;
    // Anzahl je Art — die Zählung, die die Nachführung verlangt.
    expect(sicht.counts).toEqual({ seed: 6, import: 1, entwurf: 1 });
    expect(sicht.entries.length).toBe(8);
    // Die beiden stehen als „wird entfernt" da, mit Grund — nicht als stille Zeile.
    const geht = sicht.entries.filter((e) => e.behandlung === "entfernen");
    expect(geht.map((e) => e.id).sort()).toEqual([imp.id, entw.id].sort());
    expect(geht.every((e) => e.grund === "zugeordnet")).toBe(true);
    // Und die sechs Bausteine bleiben.
    expect(sicht.entries.filter((e) => e.behandlung === "wiederherstellen").length).toBe(6);
  });

  it("Reset entfernt sie samt Folgeeinträgen, stellt die sechs Bausteine her, lässt Fremdes stehen", async () => {
    const { app, services, headers } = await adminApp();
    const lauf = ((await laden(app, headers)).json() as Bilanz).run as string;
    const imp = await importObjekt(services, lauf, "24903695");
    const entw = await importObjekt(services, lauf, "24903696", "entwurf");
    // Ein echtes Nutzerobjekt, das die Vorführung nichts angeht.
    const echt = await services.ko.create({
      title: "Drehmoment der Spannpratze am Rundtisch",
      statement: "Die Spannpratze am Rundtisch wird mit 45 Nm angezogen und danach gekontert.",
      type: "technik",
      category: "Montage",
      author: "admin",
      tags: ["echt"],
    });
    // Ein Konflikt, wie ihn der Import am Freitag gegen die Baseline erzeugt.
    const t03 = await baustein(services, "T03");
    await services.conflicts.createAuto(
      { koA: imp.id, koB: t03.id, type: "truth", description: "Router-Widerspruch (Prüffall)" },
      { trigger: "background", method: "deterministic", rationale: "Prüffall" },
      "admin",
    );
    // Und ein Konflikt, der das Paket NICHTS angeht — er muss offen bleiben.
    const fremderKonflikt = await services.conflicts.createAuto(
      {
        koA: echt.id,
        koB: (await baustein(services, "T01")).id,
        type: "truth",
        description: "Fremder Prüffall",
      },
      { trigger: "background", method: "deterministic", rationale: "Prüffall" },
      "admin",
    );
    // Ausserdem eine Bearbeitung an einem Baustein — der Reset muss beides zugleich können.
    await services.ko.revise(t03.id, { statement: "Wegdiskutiert." }, "admin");
    expect((await services.ko.list()).length).toBe(9);

    const reset = (await zuruecksetzen(app, headers)).json() as Bilanz;
    // DIE ZAHLEN, GETRENNT: zwei zugeordnete Objekte weg, keine Dublette, ein Baustein hergestellt.
    expect(reset.removed).toBe(2);
    expect(reset.removedAssigned).toBe(2);
    expect(reset.duplicates).toBe(0);
    expect(reset.updated).toBe(1);
    expect(reset.skipped).toBe(5);
    expect(reset.failures).toEqual([]);
    // Der Konflikt des Importobjekts ist geschlossen — kein Zeiger ins Leere.
    expect(reset.closedConflicts).toBe(1);

    // … die beiden Vorführobjekte sind weg …
    expect(await services.ko.get(imp.id)).toBeFalsy();
    expect(await services.ko.get(entw.id)).toBeFalsy();
    // … die sechs Bausteine stehen wieder im Ausgangszustand …
    const rest = await services.ko.list();
    expect(rest.length).toBe(7);
    const wieder = await services.ko.get(t03.id);
    expect(wieder?.statement).toContain("only needs eight characters");
    expect(wieder?.status).toBe("validiert");
    // … und das echte Nutzerobjekt ist Zeichen für Zeichen unberührt, sein Konflikt offen.
    const echtDanach = await services.ko.get(echt.id);
    expect(echtDanach?.statement).toBe(echt.statement);
    expect(echtDanach?.version).toBe(echt.version);
    const offen = await services.conflicts.unresolved();
    expect(offen.map((c) => c.id)).toContain(fremderKonflikt.id);

    // Und die Vorschau danach zeigt wieder genau die sechs Bausteine.
    const danach = (await vorschau(app, headers)).json() as Vorschau;
    expect(danach.counts).toEqual({ seed: 6 });
    expect(danach.entries.every((e) => e.behandlung === "wiederherstellen")).toBe(true);
  });

  it("zwei vollständige Wiederholungen enden im selben Bestand (A03-Kreis)", async () => {
    const { app, services, headers } = await adminApp();
    const abdruck = async (): Promise<string> =>
      (await services.ko.list())
        .map((k) => `${k.title}|${k.statement}|${k.status}|${k.category}`)
        .sort()
        .join("\n");

    const lauf = ((await laden(app, headers)).json() as Bilanz).run as string;
    const nachDemLaden = await abdruck();

    for (const runde of [1, 2]) {
      // Vorführung: der Import bringt ein Objekt, jemand bearbeitet einen Baustein.
      await importObjekt(services, lauf, `2490400${runde}`);
      await services.ko.revise(
        (await baustein(services, "C01")).id,
        { statement: `Runde ${runde} verstellt.` },
        "admin",
      );
      const reset = (await zuruecksetzen(app, headers)).json() as Bilanz;
      expect(reset.failures, `Runde ${runde}`).toEqual([]);
      expect(reset.removedAssigned, `Runde ${runde}`).toBe(1);
      // NACH JEDER WIEDERHOLUNG DERSELBE BESTAND — das ist die Zusage der Vorführung.
      expect(await abdruck(), `Runde ${runde}`).toBe(nachDemLaden);
    }
  });

  it("ein Registermerker eines FREMDEN Pakets macht kein Objekt zum Mitglied", async () => {
    const { app, services, headers } = await adminApp();
    await laden(app, headers);
    const fremd = await services.ko.create({
      title: "Objekt eines anderen Demopakets",
      statement: "Trägt einen Merker — aber den eines anderen Pakets.",
      type: "technik",
      category: "Montage",
      author: "admin",
      tags: [paketlaufMerker({ paket: "ein-anderes-paket", art: "import", lauf: "fremd-1" })],
    });
    const sicht = (await vorschau(app, headers)).json() as Vorschau;
    expect(sicht.entries.map((e) => e.id)).not.toContain(fremd.id);
    const reset = (await zuruecksetzen(app, headers)).json() as Bilanz;
    expect(reset.removed).toBe(0);
    expect(await services.ko.get(fremd.id)).toBeTruthy();
  });
});

// ================================================================================================
// E6 (RUNDE 4) — DIE VORSCHAU GEHÖRT ZUR AKTION.
// ================================================================================================
//
// BENS KORREKTURPFLICHT 1 ZU RUNDE 3. Es gab nur EINE Vorschau, und sie zeigte den Reset-Plan.
// Vor dem Entfernen stand damit „wird hergestellt (6)", während der Vollzug genau diese sechs
// Objekte endgültig löschte. Zurücksetzen und Entfernen sind aber gegenläufige Handgriffe: der
// eine stellt den Ausgangszustand her, der andere lässt nichts übrig. Beide aus derselben
// Ankündigung zu bedienen, geht nicht — also trägt die Frage die Aktion, und die Antwort sagt,
// zu welcher sie gehört.
describe("JOB 3277 E6 · Vorschau und Vollzug je Aktion", () => {
  it("Entfernen-Vorschau: JEDES Objekt geht, nichts wird hergestellt, nichts angelegt", async () => {
    const { app, services, headers } = await adminApp();
    const lauf = ((await laden(app, headers)).json() as Bilanz).run as string;
    // Ein Importobjekt dazu, damit beide Gründe im Plan vorkommen.
    await services.ko.create({
      title: "Advisor page 24903695",
      statement: "Aus dem Confluence-Import der Vorführung.",
      type: "technik",
      category: "Technical",
      author: "admin",
      tags: [paketlaufMerker({ paket: PAKET, art: "import", lauf })],
    });

    const sicht = (await vorschau(app, headers, PAKET, "entfernen")).json() as Vorschau;
    expect(sicht.aktion).toBe("entfernen");
    expect(sicht.entries.length).toBe(7);
    // KEIN einziges „wiederherstellen" — das ist der Kern dieses Falls.
    expect(sicht.entries.every((e) => e.behandlung === "entfernen")).toBe(true);
    // Und keine Neuanlage: nach dem Entfernen gibt es kein Paket mehr.
    expect(sicht.missing).toBe(0);
    // Der GRUND bleibt aussagekräftig: er sagt, was das Objekt war.
    expect(sicht.entries.filter((e) => e.grund === "baustein").length).toBe(6);
    expect(sicht.entries.filter((e) => e.grund === "zugeordnet").length).toBe(1);
  });

  it("bei unvollständigem Bestand: Reset kündigt Neuanlage an, Entfernen nicht", async () => {
    const { app, services, headers } = await adminApp();
    await laden(app, headers);
    // Zwei Bausteine verschwinden — wie nach einem Missgeschick in der Vorführung.
    for (const key of ["S02", "S04"]) {
      await services.ko.delete((await baustein(services, key)).id, "admin", { hard: true });
    }

    const reset = (await vorschau(app, headers, PAKET, "zuruecksetzen")).json() as Vorschau;
    expect(reset.aktion).toBe("zuruecksetzen");
    expect(reset.missing).toBe(2);
    expect(reset.entries.every((e) => e.behandlung === "wiederherstellen")).toBe(true);

    const weg = (await vorschau(app, headers, PAKET, "entfernen")).json() as Vorschau;
    expect(weg.aktion).toBe("entfernen");
    // Beim Entfernen entsteht nichts — auch nicht das, was fehlt.
    expect(weg.missing).toBe(0);
    expect(weg.entries.every((e) => e.behandlung === "entfernen")).toBe(true);
    // Dieselben vier Objekte, nur andere Behandlung: die ID-Menge ist die des Bestands.
    expect(weg.entries.map((e) => e.id).sort()).toEqual(reset.entries.map((e) => e.id).sort());
  });

  it("die angekündigten IDs sind GENAU die, die das Entfernen dann trifft", async () => {
    const { app, services, headers } = await adminApp();
    const lauf = ((await laden(app, headers)).json() as Bilanz).run as string;
    await services.ko.create({
      title: "Advisor page 24903695",
      statement: "Aus dem Confluence-Import der Vorführung.",
      type: "technik",
      category: "Technical",
      author: "admin",
      tags: [paketlaufMerker({ paket: PAKET, art: "import", lauf })],
    });
    // Ein fremdes Objekt, das weder angekündigt noch angefasst werden darf.
    const fremd = await services.ko.create({
      title: "Echtes Nutzerobjekt",
      statement: "Bleibt.",
      type: "technik",
      category: "Montage",
      author: "admin",
      tags: ["echt"],
    });

    const angekuendigt = (
      (await vorschau(app, headers, PAKET, "entfernen")).json() as Vorschau
    ).entries.map((e) => e.id);
    const vorher = (await services.ko.list()).map((k) => k.id);

    const bilanz = (await entfernen(app, headers)).json() as Bilanz;
    expect(bilanz.removed).toBe(angekuendigt.length);
    const nachher = (await services.ko.list()).map((k) => k.id);
    // WAS ANGEKÜNDIGT WAR, IST WEG — und was nicht angekündigt war, steht noch.
    expect(nachher.sort()).toEqual(vorher.filter((id) => !angekuendigt.includes(id)).sort());
    expect(nachher).toEqual([fremd.id]);
  });

  it("ohne Angabe zeigt die Vorschau das Zurücksetzen; eine erfundene Aktion wird abgewiesen", async () => {
    const { app, headers } = await adminApp();
    await laden(app, headers);
    const ohne = (await vorschau(app, headers)).json() as Vorschau;
    expect(ohne.aktion).toBe("zuruecksetzen");
    expect(ohne.entries.every((e) => e.behandlung === "wiederherstellen")).toBe(true);
    // Ein unbekannter Wert wird NICHT still auf einen der beiden Pläne gedreht.
    const krumm = await app.inject({
      method: "GET",
      url: `/api/admin/demo-packages/${PAKET}/preview?aktion=loeschen-vielleicht`,
      headers,
    });
    expect(krumm.statusCode).toBe(400);
  });
});
