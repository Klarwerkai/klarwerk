// ================================================================================================
// JOB 2626 · D1 — DER VERTRAG DER TORLAGE: `AskResult.verschlossen`
// ================================================================================================
//
// Pedis Frage vom 27.08. bekam „Keine belastbare Grundlage" — ehrlich und unbrauchbar: drei Tore
// seines Dokuments waren gleichzeitig zu (nicht validiert, keine Stufe, kein Volltext), und der
// Satz nannte keines. Der Bau meldet die TORLAGE; diese Datei pinnt seinen Vertrag dort, wo der
// Grund entsteht (services/ask). Die SICHTBARKEIT beim Menschen misst der Schwestertest
// `job2626-klara-torlage-sichtbar-mounted.test.tsx` an der echten Ask-Seite.
//
// Die vier Zusagen, je als eigener Fall:
//   V1 · OHNE Betrachterfilter fehlt das Feld VOLLSTAENDIG (mega77: schon der Feldname im
//        Koerper waere ein Ansatzpunkt; genau die Form, die JOB 1591 D2 fuer `ungeprueft` baute).
//   V2 · Bei Nicht-Antwort stehen die zuen Tore — ALLE, am Objekt gemessen.
//   V3 · Bei einer Antwort fehlt das Feld (die Torlage gehoert zur Nicht-Antwort).
//   V4 · Vertrauliches erscheint NIE (dieselbe dropConfidential-Linie wie die Antwort selbst) —
//        auch dann nicht, wenn der Betrachterfilter es erlauben wuerde.
//   V5 · Der Betrachterfilter traegt: verneint er das Objekt, wird es nicht gemeldet.
//   V6 · NICHTS ERFINDEN (§4): ein Kandidat, dessen drei Tore offen sind und der trotzdem nicht
//        trug (Substanz am Relevanztor), bekommt KEIN Tor angedichtet.
import { beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";

// Bestand OHNE HTTP-Schicht: derselbe Serviceverbund, den auch die App traegt. Der Schwestertest
// fuehrt den vollen Weg ueber Route und Flaeche; hier geht es um den Servicevertrag selbst —
// direkt am `services.ask`, mit Objekten aus dem echten `services.ko`.
type Services = ReturnType<typeof buildServices>;

const TITEL = "Turbinenwartung Kesselhaus";
const STATEMENT = "Zustaendigkeit liegt beim Schichtleiter.";
// Genau EIN gemeinsames Inhaltstoken mit dem Titel („Turbinenwartung") — der Kandidat kommt in
// die Vorauswahl, faellt aber am Substanz-Tor (meetsAnswerSubstance): der echte Pedi-Fall,
// deterministisch nachgebaut. Die Dichtheit wird in V2 gemessen, nicht angenommen.
const FRAGE =
  "Welche Schutzausruestung ist bei der Turbinenwartung im Druckbehaelter vorgeschrieben?";
const ALLE_SICHTBAR = (): boolean => true;

let services: Services;
let autorId: string;

beforeEach(async () => {
  services = buildServices();
  const app = buildApp(services);
  await app.ready();
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@job2626.test", password: "geheim12345" },
  });
  expect(reg.statusCode, `Registrierung fehlgeschlagen: ${reg.body}`).toBeLessThan(300);
  autorId =
    (reg.json() as { user?: { id: string }; id?: string }).user?.id ??
    (reg.json() as { id?: string }).id ??
    "";
  await app.close();
});

async function koAnlegen(extra: Record<string, unknown> = {}): Promise<string> {
  const ko = await services.ko.create({
    title: TITEL,
    statement: STATEMENT,
    type: "best_practice",
    category: "Wartung",
    author: autorId,
    ...extra,
  } as never);
  return (ko as { id: string }).id;
}

describe("JOB 2626 · V — der Vertrag der Torlage", () => {
  it("V1 · ohne Betrachterfilter FEHLT das Feld vollstaendig — auch bei Nicht-Antwort", async () => {
    await koAnlegen();
    const out = await services.ask.ask(FRAGE, autorId, "de");
    expect(out.result.answered).toBe(false);
    expect("verschlossen" in out, "der Feldname selbst ist ein Ansatzpunkt (mega77)").toBe(false);
  });

  it("V2 · bei Nicht-Antwort stehen ALLE zuen Tore des getroffenen Dokuments", async () => {
    const id = await koAnlegen();
    const out = await services.ask.ask(FRAGE, autorId, "de", {
      verschlossenSichtbarFuer: ALLE_SICHTBAR,
    });
    expect(out.result.answered, "der Prueffall traegt nur als Nicht-Antwort").toBe(false);
    expect(out.verschlossen).toBeDefined();
    const eintrag = out.verschlossen?.find((h) => h.id === id);
    expect(eintrag, "das getroffene Dokument fehlt in der Torlage").toBeDefined();
    expect(eintrag?.title).toBe(TITEL);
    // Alle drei Tore sind zu — eines zu nennen und zwei zu verschweigen, schickt in die
    // falsche Richtung (§2 des Auftrags).
    expect(eintrag?.freigabeFehlt, "nicht validiert -> Freigabe fehlt").toBe(true);
    expect(eintrag?.stufeFehlt, "keine Stufe persistiert -> Stufe fehlt").toBe(true);
    expect(eintrag?.volltextFehlt, "kein bodyText -> Volltext fehlt").toBe(true);
  });

  it("V3 · bei einer Antwort fehlt das Feld — die Torlage gehoert zur Nicht-Antwort", async () => {
    await koAnlegen();
    // Dieselbe Vorauswahl, aber die Frage IST der Titel — die Substanz reicht, der
    // deterministische Weg antwortet mit der Aussage des Treffers.
    const out = await services.ask.ask(`${TITEL} Zustaendigkeit`, autorId, "de", {
      verschlossenSichtbarFuer: ALLE_SICHTBAR,
    });
    expect(out.result.answered, "der Prueffall traegt nur als Antwort").toBe(true);
    expect("verschlossen" in out).toBe(false);
  });

  it("V4 · Vertrauliches erscheint NIE — dieselbe Linie, die die Antwort schuetzt", async () => {
    const id = await koAnlegen({ confidentiality: "vertraulich" });
    const out = await services.ask.ask(FRAGE, autorId, "de", {
      verschlossenSichtbarFuer: ALLE_SICHTBAR,
    });
    expect(out.result.answered).toBe(false);
    // KALIBRIERUNG: die Stufe ist wirklich persistiert — sonst maesse dieser Fall nichts.
    const ko = await services.ko.get(id);
    expect((ko as { confidentiality?: string } | undefined)?.confidentiality).toBe("vertraulich");
    expect(out.verschlossen?.some((h) => h.id === id) ?? false).toBe(false);
    expect(
      JSON.stringify(out.verschlossen ?? []),
      "auch der Titel darf nicht reisen",
    ).not.toContain(TITEL);
  });

  it("V5 · der Betrachterfilter traegt: verneint er das Objekt, wird es nicht gemeldet", async () => {
    const id = await koAnlegen();
    const out = await services.ask.ask(FRAGE, autorId, "de", {
      verschlossenSichtbarFuer: () => false,
    });
    expect(out.result.answered).toBe(false);
    // Das Feld IST da (es wurde nachgesehen) — aber leer: „in dieser Vorauswahl nichts, was DU
    // sehen darfst". Abwesend hiesse dagegen „nicht gefragt" (V1).
    expect(out.verschlossen).toBeDefined();
    expect(out.verschlossen?.some((h) => h.id === id) ?? false).toBe(false);
  });

  it("V6 · NICHTS ERFINDEN: offene Tore werden einem gefallenen Kandidaten nicht angedichtet", async () => {
    // Drei offene Tore: validiert, Stufe gesetzt, Volltext vorhanden — aber die Frage teilt mit
    // dem Dokument weiterhin nur das eine Titeltoken: keine Antwort, und KEIN Tor ist zu.
    const id = await koAnlegen({
      bodyHtml: "<p>Der Pruefplan des Kesselhauses wird jaehrlich fortgeschrieben.</p>",
    });
    await services.ko.setConfidentiality(id, "intern", autorId);
    await services.validation.adminValidate(id, autorId);
    const out = await services.ask.ask(FRAGE, autorId, "de", {
      verschlossenSichtbarFuer: ALLE_SICHTBAR,
    });
    expect(out.result.answered, "der Prueffall traegt nur als Nicht-Antwort").toBe(false);
    // KALIBRIERUNG der drei offenen Tore — gemessen, nicht angenommen:
    const ko = (await services.ko.get(id)) as
      | { status?: string; confidentiality?: string }
      | undefined;
    expect(ko?.status).toBe("validiert");
    expect(ko?.confidentiality).toBe("intern");
    const projektion = await services.ko.searchProjectionOf(id);
    expect(projektion?.bodyText.trim().length ?? 0).toBeGreaterThan(0);
    // Und die Zusage: kein Eintrag — die generische Leermeldung bleibt die ehrliche Auskunft.
    expect(out.verschlossen?.some((h) => h.id === id) ?? false).toBe(false);
  });
});
