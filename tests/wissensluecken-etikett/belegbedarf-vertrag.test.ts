// ================================================================================================
// R-0291 — „ZU JEDER LÜCKE SOLL AUCH STEHEN, WELCHER BELEG FÜR EINE TRAGFÄHIGE ANTWORT FEHLEN WÜRDE."
// ================================================================================================
//
// Gemessen am echten Serviceverbund (Bauart `tests/app/job2626-klara-torlage-vertrag.test.ts`):
//   B1 · nichts in der Vorauswahl              → „wissensobjekt"
//   B2 · Treffer mit drei zuen Toren            → „freigabe", „stufe", „volltext"
//   B3 · Treffer mit offenen Toren, keine Antwort → „unbestimmt" (nichts wird geraten)
//   B4 · nur Vertrauliches getroffen            → „wissensobjekt" — Vertrauliches ist nie Grundlage
//        und verrät sich auch hier nicht
//   B5 · Zusammenführen und Bearbeiten erhalten den Befund
//   B6 · nur die berechtigte Sicht trägt ihn; die Häufigkeit reist in beiden Sichten
//   B7 · die reine Regel, inklusive Reihenfolge
import { beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";
import { redactGapForViewer } from "../../services/ask";
import { leiteBelegbedarfAb } from "../../services/ask/src/gap-belegbedarf";

type Services = ReturnType<typeof buildServices>;

const TITEL = "Turbinenwartung Kesselhaus";
const STATEMENT = "Zustaendigkeit liegt beim Schichtleiter.";
// Ein gemeinsames Inhaltstoken mit dem Titel: der Kandidat kommt in die Vorauswahl, trägt aber
// nicht (derselbe Prüffall wie in der Torlage, dort in V2 gemessen).
const FRAGE =
  "Welche Schutzausruestung ist bei der Turbinenwartung im Druckbehaelter vorgeschrieben?";
const FRAGE_OHNE_TREFFER = "Wie oft wird der Abscheider an Linie Zeta gespuelt?";

let services: Services;
let autorId: string;

beforeEach(async () => {
  services = buildServices();
  const app = buildApp(services);
  await app.ready();
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@r0291.test", password: "geheim12345" },
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

async function einzigeLuecke() {
  const offene = (await services.ask.listGaps()).filter((g) => g.status === "offen");
  expect(offene, "KALIBRIERUNG: genau eine offene Lücke").toHaveLength(1);
  return offene[0];
}

describe("R-0291 · der Belegbedarf entsteht mit der Lücke", () => {
  it("B1 · nichts in der Vorauswahl → es fehlt ein Wissensobjekt", async () => {
    const out = await services.ask.ask(FRAGE_OHNE_TREFFER, autorId, "de");
    expect(out.result.answered).toBe(false);
    expect(out.gap?.belegbedarf).toEqual(["wissensobjekt"]);
    expect((await einzigeLuecke())?.belegbedarf).toEqual(["wissensobjekt"]);
  });

  it("B2 · Treffer mit drei zuen Toren → alle drei Torbegriffe, in fester Reihenfolge", async () => {
    await koAnlegen();
    const out = await services.ask.ask(FRAGE, autorId, "de");
    expect(out.result.answered, "der Prüffall trägt nur als Nicht-Antwort").toBe(false);
    expect(out.gap?.belegbedarf).toEqual(["freigabe", "stufe", "volltext"]);
  });

  it("B3 · offene Tore und trotzdem keine Antwort → unbestimmt, nichts angedichtet", async () => {
    const id = await koAnlegen({
      bodyHtml: "<p>Der Pruefplan des Kesselhauses wird jaehrlich fortgeschrieben.</p>",
    });
    await services.ko.setConfidentiality(id, "intern", autorId);
    await services.validation.adminValidate(id, autorId);
    // KALIBRIERUNG der drei offenen Tore — gemessen, nicht angenommen.
    const ko = (await services.ko.get(id)) as { status?: string; confidentiality?: string };
    expect(ko.status).toBe("validiert");
    expect(ko.confidentiality).toBe("intern");
    const projektion = await services.ko.searchProjectionOf(id);
    expect(projektion?.bodyText.trim().length ?? 0).toBeGreaterThan(0);
    const out = await services.ask.ask(FRAGE, autorId, "de");
    expect(out.result.answered).toBe(false);
    expect(out.gap?.belegbedarf).toEqual(["unbestimmt"]);
  });

  it("B4 · nur Vertrauliches getroffen → wissensobjekt; kein Tor verrät das vertrauliche Objekt", async () => {
    const id = await koAnlegen({ confidentiality: "vertraulich" });
    const ko = (await services.ko.get(id)) as { confidentiality?: string };
    expect(ko.confidentiality, "KALIBRIERUNG: die Stufe ist persistiert").toBe("vertraulich");
    const out = await services.ask.ask(FRAGE, autorId, "de");
    expect(out.result.answered).toBe(false);
    expect(out.gap?.belegbedarf).toEqual(["wissensobjekt"]);
    expect(JSON.stringify(out.gap)).not.toContain(TITEL);
  });
});

describe("R-0291 · der Befund bleibt beim Zusammenführen und Bearbeiten erhalten", () => {
  it("B5 · dieselbe Frage zweimal, dann zuweisen und priorisieren → Befund unverändert", async () => {
    await koAnlegen();
    const erste = await services.ask.ask(FRAGE, autorId, "de");
    const zweite = await services.ask.ask(`${FRAGE.toUpperCase()}!!`, autorId, "de");
    expect(zweite.gap?.id, "KALIBRIERUNG: zusammengeführt, nicht neu").toBe(erste.gap?.id);
    let luecke = await einzigeLuecke();
    expect(luecke?.askCount).toBe(2);
    expect(luecke?.belegbedarf).toEqual(["freigabe", "stufe", "volltext"]);
    const id = luecke?.id ?? "";
    await services.ask.assignGap(id, autorId);
    await services.ask.setGapPriority(id, "hoch", autorId);
    luecke = await einzigeLuecke();
    expect(luecke?.assignee).toBe(autorId);
    expect(luecke?.priority).toBe("hoch");
    expect(luecke?.belegbedarf).toEqual(["freigabe", "stufe", "volltext"]);
  });

  it("B6 · nur die berechtigte Sicht trägt den Befund; die Häufigkeit reist in beiden", async () => {
    await services.ask.ask(FRAGE_OHNE_TREFFER, autorId, "de");
    await services.ask.ask(FRAGE_OHNE_TREFFER, autorId, "de");
    const luecke = await einzigeLuecke();
    if (!luecke) {
      throw new Error("Lücke fehlt");
    }
    const eigene = redactGapForViewer(luecke, { viewerId: autorId });
    expect(eigene.belegbedarf).toEqual(["wissensobjekt"]);
    expect(eigene.askCount).toBe(2);
    const fremde = redactGapForViewer(luecke, { viewerId: "jemand-anderes" });
    expect(fremde.redacted).toBe(true);
    expect("belegbedarf" in fremde, "der Befund gehört zur Frage").toBe(false);
    expect(fremde.askCount, "eine Zahl ist kein Fragetext").toBe(2);
  });
});

describe("R-0291 · die reine Regel", () => {
  const zu = (freigabe: boolean, stufe: boolean, volltext: boolean) => ({
    freigabeFehlt: freigabe,
    stufeFehlt: stufe,
    volltextFehlt: volltext,
  });

  it("B7 · leer → wissensobjekt; Tore vereinigt in fester Reihenfolge; alle offen → unbestimmt", () => {
    expect(leiteBelegbedarfAb([])).toEqual(["wissensobjekt"]);
    expect(leiteBelegbedarfAb([zu(false, false, true), zu(true, false, false)])).toEqual([
      "freigabe",
      "volltext",
    ]);
    expect(leiteBelegbedarfAb([zu(false, true, false)])).toEqual(["stufe"]);
    expect(leiteBelegbedarfAb([zu(false, false, false), zu(false, false, false)])).toEqual([
      "unbestimmt",
    ]);
  });
});
