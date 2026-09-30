// ================================================================================================
// LAUF gesamt-import-adoption, RUNDE 3 — BENS NACHBARBEFUNDE N1–N4.
// ================================================================================================
//
// N1  Zwei überlappende Annahmen gleichen Inhalts (Promise.all) legten zwei Objekte an.
// N2  Ohne Import-Schalter erkannte ein Wiederimport derselben externalId das gelöschte Objekt im
//     Papierkorb nicht (`keine`), und die Annahme legte eine zweite Kennung an.
// N3  Mit eingeschaltetem Import-Schalter startete JEDE Annahme die KI-Erkennung (R-0145).
// N4  Der erfolgreiche Fehlerabschluss schrieb den bei der Annahme neu erhobenen Befund nicht mit.
import { afterEach, describe, expect, it } from "vitest";
import type { ImportCandidate as WebImportCandidate } from "../../apps/web/src/api/types";
import { candidateFindings } from "../../apps/web/src/lib/extConcept";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import {
  type ClaimResolution,
  type DublettenPruefung,
  InMemoryCandidateRepo,
  type KandidatDublettenbefund,
  LibraryService,
} from "../../services/library-analytics";

interface KandidatDto {
  id: string;
  duplicate: boolean;
  koId: string | null;
  status: string;
  dublettenbefund?: KandidatDublettenbefund;
}

const EINTRAG = {
  title: "Filterkerze wechseln",
  statement: "Die Filterkerze bei jedem Oelwechsel mit tauschen",
  type: "best_practice" as const,
  category: "Wartung",
  confidentiality: "intern" as const,
};

/** Eine Prüfung, die nie ähnlich meldet — entschieden wird allein im exakten Pass (wie bei Ben). */
const NIE_AEHNLICH: DublettenPruefung = () => ({ dublette: false });

const vorherSchalter = process.env.KLARWERK_CONFLUENCE_IMPORT;
afterEach(() => {
  if (vorherSchalter === undefined) {
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
  } else {
    process.env.KLARWERK_CONFLUENCE_IMPORT = vorherSchalter;
  }
});

async function dienst(candidates = new InMemoryCandidateRepo()) {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  return { koService, library: new LibraryService({ koService, candidates }) };
}

async function angemeldeteApp(marke: string, services = buildServices()) {
  const app = buildApp(services);
  const zugang = { name: "Admin", email: `${marke}@nachbarn.test`, password: "secret123" };
  await app.inject({ method: "POST", url: "/api/auth/register", payload: zugang });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: zugang.email, password: zugang.password },
  });
  return { app, headers: { authorization: `Bearer ${login.json().token}` } };
}

type App = Awaited<ReturnType<typeof angemeldeteApp>>["app"];
type Headers = Record<string, string>;

async function reiheEin(app: App, headers: Headers, items: unknown[]): Promise<KandidatDto[]> {
  const res = await app.inject({
    method: "POST",
    url: "/api/library/import",
    headers,
    payload: { items },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as KandidatDto[];
}

async function nimmAn(
  app: App,
  headers: Headers,
  id: string,
  extra: Record<string, unknown> = {},
): Promise<KandidatDto> {
  const res = await app.inject({
    method: "PUT",
    url: `/api/library/import/candidates/${id}`,
    headers,
    payload: { action: "accept", ...extra },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as KandidatDto;
}

async function koZahl(app: App, headers: Headers): Promise<number> {
  const res = await app.inject({ method: "GET", url: "/api/kos", headers });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as unknown[]).length;
}

describe("N1 · überlappende Annahmen gleichen Inhalts legen genau ein Objekt an", () => {
  it("N1 · Dienst: zwei identische Kandidaten, Promise.all → genau ein Wissensobjekt", async () => {
    const { koService, library } = await dienst();
    const [a] = await library.createImportCandidates([EINTRAG], "importeur", NIE_AEHNLICH);
    const [b] = await library.createImportCandidates([EINTRAG], "importeur", NIE_AEHNLICH);

    const [ra, rb] = await Promise.all([
      library.reviewImportCandidate(a!.id, "accept", "controller", undefined, NIE_AEHNLICH),
      library.reviewImportCandidate(b!.id, "accept", "controller", undefined, NIE_AEHNLICH),
    ]);

    const angelegt = [ra.koId, rb.koId].filter((id) => id !== null);
    expect(angelegt, "Genau eine der beiden Annahmen legt an.").toHaveLength(1);
    expect(await koService.list()).toHaveLength(1);
    // Die andere nennt das Objekt der ersten.
    const zweite = ra.koId === null ? ra : rb;
    expect(zweite.dublettenbefund).toEqual({
      ergebnis: "identisch",
      treffer: { art: "wissensobjekt", koId: angelegt[0] },
    });
  });

  // EHRLICHE GRENZE: dieser Drahtfall bestand auch am Stand VOR dem Riegel — `inject` verzahnt die
  // fünf Anfragen hier nicht nachweislich. Er ist eine Regressionsprobe des Drahtwegs; der
  // TRENNENDE Nachweis für N1 ist der Dienstfall darüber.
  it("N1b · Draht: fünf gleichzeitige Annahmen gleichen Inhalts → ein Objekt", async () => {
    const { app, headers } = await angemeldeteApp("n1b");
    const kandidaten: KandidatDto[] = [];
    for (let i = 0; i < 5; i += 1) {
      kandidaten.push(...(await reiheEin(app, headers, [EINTRAG])));
    }
    const ergebnisse = await Promise.all(kandidaten.map((k) => nimmAn(app, headers, k.id)));
    expect(ergebnisse.filter((r) => r.koId !== null)).toHaveLength(1);
    expect(await koZahl(app, headers)).toBe(1);
  });

  it("N1c · ein werfender Schritt blockiert den Riegel nicht: die nächste Annahme läuft durch", async () => {
    const { koService, library } = await dienst();
    const [a] = await library.createImportCandidates([EINTRAG], "importeur", NIE_AEHNLICH);
    const [b] = await library.createImportCandidates(
      [{ ...EINTRAG, title: "Anderer Eintrag", statement: "Ganz anderer Inhalt" }],
      "importeur",
      NIE_AEHNLICH,
    );
    const werfend: DublettenPruefung = () => {
      throw new Error("Pruefung faellt aus");
    };
    const [ra, rb] = await Promise.all([
      library.reviewImportCandidate(a!.id, "accept", "controller", undefined, werfend),
      library.reviewImportCandidate(b!.id, "accept", "controller", undefined, NIE_AEHNLICH),
    ]);
    // A: nicht prüfbar → fail-closed nichts angelegt; B: läuft danach normal.
    expect(ra.koId).toBeNull();
    expect(rb.koId).toBeTruthy();
    expect(await koService.list()).toHaveLength(1);
  });
});

describe("N2 · ohne Import-Schalter kennt der Wiederimport das Objekt im Papierkorb", () => {
  const MIT_HERKUNFT = {
    ...EINTRAG,
    provider: "customer-wiki",
    externalId: "source-42",
    sourceVersion: 7,
    url: "https://wiki.example.test/seiten/source-42",
  };

  it("N2 · annehmen, löschen, identisch erneut importieren: `im_papierkorb` mit Kennung, keine zweite Kennung", async () => {
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
    const { app, headers } = await angemeldeteApp("n2");
    const [erster] = await reiheEin(app, headers, [MIT_HERKUNFT]);
    const koId = (await nimmAn(app, headers, erster!.id)).koId as string;
    expect(koId).toBeTruthy();
    const geloescht = await app.inject({ method: "DELETE", url: `/api/kos/${koId}`, headers });
    expect(geloescht.statusCode, geloescht.body).toBeLessThan(300);

    const [wieder] = await reiheEin(app, headers, [MIT_HERKUNFT]);
    expect(wieder?.duplicate).toBe(true);
    expect(wieder?.dublettenbefund).toEqual({
      ergebnis: "im_papierkorb",
      treffer: { art: "wissensobjekt", koId },
    });
    // Q2c: die Fläche leitet daraus „liegt im Papierkorb, Kennung <id>" ab, nicht „Dublette".
    const befund = candidateFindings(wieder as unknown as WebImportCandidate);
    expect(befund.imPapierkorb).toEqual({ koId });
    expect(befund.duplicate).toBe(false);

    const angenommen = await nimmAn(app, headers, wieder!.id);
    expect(angenommen.koId, "Keine zweite Kennung für denselben Datensatz.").toBeNull();
    expect(angenommen.dublettenbefund?.ergebnis).toBe("im_papierkorb");
    expect(await koZahl(app, headers)).toBe(0);
  });

  it("N2b · gelöscht ERST nach dem Einreihen: die Annahme erkennt den Papierkorb trotzdem", async () => {
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
    const { app, headers } = await angemeldeteApp("n2b");
    const [erster] = await reiheEin(app, headers, [MIT_HERKUNFT]);
    const koId = (await nimmAn(app, headers, erster!.id)).koId as string;
    // Neue Fassung derselben Quelle eingereiht, solange das Objekt noch lebt …
    const [neu] = await reiheEin(app, headers, [
      { ...MIT_HERKUNFT, sourceVersion: 8, statement: `${MIT_HERKUNFT.statement} und prüfen` },
    ]);
    // … dann wird das Objekt gelöscht, und erst danach angenommen.
    await app.inject({ method: "DELETE", url: `/api/kos/${koId}`, headers });
    const angenommen = await nimmAn(app, headers, neu!.id);
    expect(angenommen.koId).toBeNull();
    expect(angenommen.dublettenbefund).toEqual({
      ergebnis: "im_papierkorb",
      treffer: { art: "wissensobjekt", koId },
    });
    expect(await koZahl(app, headers)).toBe(0);
  });

  it("N2c · eine ANDERE externalId bleibt vom Papierkorb unberührt", async () => {
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
    const { app, headers } = await angemeldeteApp("n2c");
    const [erster] = await reiheEin(app, headers, [MIT_HERKUNFT]);
    const koId = (await nimmAn(app, headers, erster!.id)).koId as string;
    await app.inject({ method: "DELETE", url: `/api/kos/${koId}`, headers });

    const [anders] = await reiheEin(app, headers, [
      {
        ...MIT_HERKUNFT,
        externalId: "source-43",
        title: "Anderes Dokument",
        statement: "Ein ganz anderer Inhalt aus derselben Quelle",
      },
    ]);
    expect(anders?.dublettenbefund).toEqual({ ergebnis: "keine" });
    expect((await nimmAn(app, headers, anders!.id)).koId).toBeTruthy();
  });
});

describe("N3 · die Annahme ruft ohne ausdrückliche Anforderung kein Modell auf (R-0145)", () => {
  async function mitZaehler(marke: string) {
    const services = buildServices();
    const zaehler = { aufrufe: 0 };
    const conflict = services.reasoner.judgeConflictOutcome.bind(services.reasoner);
    const duplicate = services.reasoner.judgeDuplicateOutcome.bind(services.reasoner);
    services.reasoner.judgeConflictOutcome = async (...args) => {
      zaehler.aufrufe += 1;
      return conflict(...args);
    };
    services.reasoner.judgeDuplicateOutcome = async (...args) => {
      zaehler.aufrufe += 1;
      return duplicate(...args);
    };
    return { ...(await angemeldeteApp(marke, services)), zaehler };
  }

  // Zwei unterscheidbare Urlaubsregelungen — die zweite hat mit der ersten einen Prüfpartner.
  const ERSTE = {
    title: "Urlaubsanspruch",
    statement: "Der Urlaub betraegt 28 Tage pro Jahr.",
    type: "best_practice",
    category: "Personal",
    confidentiality: "intern",
  };
  const ZWEITE = { ...ERSTE, title: "Urlaubsregelung", statement: "Der Urlaub betraegt 30 Tage." };

  for (const [fall, schalter] of [
    ["Schalter aus", undefined],
    ["Schalter an", "1"],
  ] as const) {
    it(`N3 · ${fall}: zwei Importe angenommen → null Urteilsaufrufe`, async () => {
      if (schalter === undefined) {
        delete process.env.KLARWERK_CONFLUENCE_IMPORT;
      } else {
        process.env.KLARWERK_CONFLUENCE_IMPORT = schalter;
      }
      const { app, headers, zaehler } = await mitZaehler(`n3-${schalter ?? "aus"}`);
      for (const eintrag of [ERSTE, ZWEITE]) {
        const [k] = await reiheEin(app, headers, [eintrag]);
        expect((await nimmAn(app, headers, k!.id)).koId).toBeTruthy();
      }
      expect(await koZahl(app, headers)).toBe(2);
      expect(zaehler.aufrufe, "Kein Urteil ist bestellt — also läuft keins.").toBe(0);
    });
  }

  it("N3b · KALIBRIERUNG: fordert der Prüfer die KI-Prüfung an, läuft sie wirklich", async () => {
    process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
    const { app, headers, zaehler } = await mitZaehler("n3b");
    const [erste] = await reiheEin(app, headers, [ERSTE]);
    await nimmAn(app, headers, erste!.id);
    const [zweite] = await reiheEin(app, headers, [ZWEITE]);
    await nimmAn(app, headers, zweite!.id, { kiPruefung: true });
    expect(zaehler.aufrufe, "Sonst prüfte N3 nichts: der Zähler muss anschlagen können.").toBe(2);
  });
});

describe("N4 · auch der Fehlerabschluss schreibt den neuen Befund mit", () => {
  it("N4 · A abgelehnt, B angenommen, Statuswrite wirft einmal → angenommen MIT Befund `keine`", async () => {
    class EinmalWerfend extends InMemoryCandidateRepo {
      geworfen = false;
      override resolveClaim(id: string, opId: string, next: ClaimResolution) {
        if (!this.geworfen && next.status === "angenommen" && next.koId) {
          this.geworfen = true;
          return Promise.reject(new Error("Statuspersistenz faellt einmal aus"));
        }
        return super.resolveClaim(id, opId, next);
      }
    }
    const repo = new EinmalWerfend();
    const { koService, library } = await dienst(repo);
    const [a] = await library.createImportCandidates([EINTRAG], "importeur", NIE_AEHNLICH);
    const [b] = await library.createImportCandidates([EINTRAG], "importeur", NIE_AEHNLICH);
    expect(b?.dublettenbefund).toEqual({
      ergebnis: "identisch",
      treffer: { art: "kandidat", kandidatId: a?.id },
    });
    await library.reviewImportCandidate(a!.id, "reject", "controller");

    const r = await library.reviewImportCandidate(
      b!.id,
      "accept",
      "controller",
      undefined,
      NIE_AEHNLICH,
    );
    expect(repo.geworfen, "Vorbedingung: der Fehlerabschluss wurde wirklich durchlaufen.").toBe(
      true,
    );
    expect(r.status).toBe("angenommen");
    expect(r.koId).toBeTruthy();
    expect(await koService.list()).toHaveLength(1);

    const gespeichert = await repo.findById(b!.id);
    expect(gespeichert?.duplicate).toBe(false);
    expect(gespeichert?.dublettenbefund).toEqual({ ergebnis: "keine" });
  });
});
