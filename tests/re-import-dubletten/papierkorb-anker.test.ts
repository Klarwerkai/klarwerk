// ================================================================================================
// JOB 3081 — DER PAPIERKORB KENNT SEINE TOTEN: DER RE-IMPORT FINDET DEN GETRASHTEN HERKUNFTS-ANKER.
// ================================================================================================
//
// DER BEFUND, GEGEN DEN DIESE DATEI STEHT (Codex' Live-Messung R-0192 vom 05.09.2026 gegen
// `https://app.klarwerk.ai`, Fassung 1.0.0-beta.1.90; Ursache am HEAD `db7ad22` selbst gelesen):
// `acceptToKo` suchte den Herkunfts-Anker ausschliesslich ueber `koService.list()`
// (`services/library-analytics/src/service.ts:1304-1306`), und `list()` filtert getrashte Objekte
// weg (`services/knowledge-object/src/service.ts:2847-2848`). Wurde derselbe Datensatz noch einmal
// eingespielt, nachdem sein Wissensobjekt im Papierkorb lag, entstand eine ZWEITE Karteikarte fuer
// dieselbe Sache — waehrend die erste im Papierkorb liegen blieb. Der Kandidat sagte davon nichts
// (`dublettenbefund: nicht_gestellt`, `duplicate: false`).
//
// WARUM DIESE DATEI DEN ECHTEN `KoService` MIT `InMemoryKoRepo` NIMMT UND KEIN HANDGEBAUTES DOPPEL:
// gemessen wird eine ASYMMETRIE ZWEIER LESARTEN desselben Bestands — `list()` laesst getrashte
// Objekte weg, `trashedSourceAnchors()` liefert genau sie. Ein selbstgebautes Doppel muesste diese
// Asymmetrie behaupten; der echte Dienst HAT sie. P0 misst sie, statt sie zu glauben — ein Test,
// der beide Lesarten gleich beantwortet, misst nichts.
//
// WAS DIE FAELLE ABDECKEN:
//   P1  der gemessene Fall am Kandidaten (vor der Aenderung rot)
//   P1c der Mischlauf: ein `im_papierkorb`-Kandidat blockiert den textgleichen Nachfolger nicht
//   P1b dieselbe Klickstrecke durch die ECHTE Route bis in die Antwortform (vor der Aenderung rot)
//   P2  der harte Riegel in `acceptToKo` — Altkandidat OHNE Befund (vor der Aenderung rot)
//   P3  der Trash-Vertrag: adoptieren, nicht auferstehen lassen (vor der Aenderung rot)
//   P4  Vorrang des Lebenden (vorher gruen, muss gruen bleiben)
//   P5  kein zu weites Netz: gleiche externalId, anderer Provider (vorher gruen, muss gruen bleiben)
//   P7  mehrdeutige zusammengesetzte Schluessel — RUNDE 2, bens ROT (s. dort)
//   P6  der Textweg bleibt unberuehrt (vorher gruen, muss gruen bleiben)
//   Z0/Z1/Z2 das Zustandsmodell: leerer Papierkorb, Lesefehler am Kandidaten, Lesefehler am Accept
//
// RUNDE 2 — WAS BEN IN RUNDE 1 ROT MASS UND WAS DAGEGEN STEHT:
//   Der Anker-Schluessel der Kandidatenpruefung war die Verkettung `${providerKey}@${externalId}`
//   und damit NICHT injektiv; `acceptToKo` verglich daneben Feld fuer Feld. Zwei Ausdruecke fuer
//   dieselbe Gleichheit, und der schwaechere entschied zuerst: ein berechtigter Import bekam
//   `im_papierkorb` mit einer FREMDEN Kennung und wurde ohne Anlage quittiert. Beide Linien rechnen
//   jetzt mit derselben Funktion `ankerSchluessel` (service.ts) — P7a/P7b/P7c messen es.
//
// GEGENPROBE (Pflicht) — DREI RUECKDREHUNGEN IM PRODUKT, JEDE MIT IHREM EIGENEN AUSFALLMUSTER.
// Gemessen, nicht abgeleitet: die beiden Linien (Befund am Kandidaten · Riegel in `acceptToKo`)
// ersetzen einander nicht, und genau das zeigt sich daran, dass sie VERSCHIEDENE Faelle rot machen.
//
//   G1 · der Riegel zurueck auf die alte Lesart (`sucheAnkerKo` fragt den Papierkorb nicht mehr,
//        also wieder ausschliesslich `koService.list()`)  → P2 · P3 · Z2 rot.
//        P1/P1a/P1b bleiben GRUEN, weil die Kandidaten-Linie den `accept` schon vorher stoppt —
//        deshalb misst P2 den Riegel ausdruecklich an einem Kandidaten OHNE Befund.
//   G2 · der Befund zurueck auf `nicht_gestellt` (die Kandidaten-Linie schweigt wieder)
//        → P1 · P1a · P1b rot. P2/P3 bleiben GRUEN, weil der Riegel dahinter haelt.
//   G3 · die Anker-Regel ohne Provider-Vergleich (`s.externalId === externalId` allein)
//        → P5 rot: das zu weite Netz adoptiert das getrashte Objekt der FREMDEN Quelle.
//
// Jeder Ausfall traegt eine eigene Aussage, keiner ist der Nachhall eines anderen. Die gefahrenen
// Laeufe stehen wortwoertlich in `RUECKGABE.md`.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../services/knowledge-object";
import { InMemoryCandidateRepo, LibraryService } from "../../services/library-analytics";
import type { DublettenPruefung, ImportItem } from "../../services/library-analytics";

// Der Anker aus Codex' Lauf, woertlich.
const ANKER_ITEM: ImportItem = {
  title: "Codex-Abnahme R-0192",
  statement: "Der Re-Import desselben Quellobjekts darf keine zweite Karteikarte erzeugen",
  type: "best_practice",
  category: "Wartung",
  provider: "test",
  externalId: "codex-abnahme-r0192-20260905",
  sourceVersion: 1,
};

/**
 * Eine EHRLICHE Textpruefung: sie antwortet aus dem Vergleichsbestand, den der Dienst ihr reicht.
 * Damit misst P6 wirklich etwas — wuerde der Dienst getrashte Objekte in den Vergleichsbestand
 * legen, faende diese Pruefung sie und P6 wuerde rot.
 */
const TEXTGLEICHHEIT: DublettenPruefung = (item, bestand) => {
  const treffer = bestand.find((ko) => ko.title === item.title && ko.statement === item.statement);
  return treffer ? { dublette: true, koId: treffer.id, aehnlichkeit: 1 } : { dublette: false };
};

function dienst() {
  const repo = new InMemoryKoRepo();
  const koService = new KoService({ repo });
  const candidates = new InMemoryCandidateRepo();
  const library = new LibraryService({ koService, candidates, externalUpsert: true });
  // Das Doppel liegt AUF dem echten Dienst: es zaehlt nur mit und veraendert nichts (P2/P5 messen
  // daran, ob wirklich kein Wissensobjekt ANGELEGT wurde — eine Zusicherung ueber den Rueckgabewert
  // allein wuerde ein still erzeugtes zweites Objekt nicht sehen).
  const create = vi.spyOn(koService, "create");
  const restore = vi.spyOn(koService, "restore");
  const revise = vi.spyOn(koService, "revise");
  const setConfidentiality = vi.spyOn(koService, "setConfidentiality");
  // K misst daran die ausgewiesene Kostengrenze — `trashedSourceAnchors()` liest den ganzen Bestand.
  const papierkorbLesung = vi.spyOn(koService, "trashedSourceAnchors");
  return {
    repo,
    koService,
    candidates,
    library,
    create,
    restore,
    revise,
    setConfidentiality,
    papierkorbLesung,
  };
}

type Ctx = ReturnType<typeof dienst>;

/** Der Produktweg zum getrashten Anker: einspielen, annehmen, in den Papierkorb legen. */
async function importiereUndTrashe(ctx: Ctx, item: ImportItem): Promise<string> {
  const [kandidat] = await ctx.library.createImportCandidates([item], "importeur", TEXTGLEICHHEIT);
  if (!kandidat) {
    throw new Error("Vorbedingung verletzt: kein Kandidat eingereiht.");
  }
  const beschieden = await ctx.library.reviewImportCandidate(kandidat.id, "accept", "pedi");
  const koId = beschieden.koId;
  if (!koId) {
    throw new Error("Vorbedingung verletzt: der erste Accept hat kein Wissensobjekt erzeugt.");
  }
  await ctx.koService.delete(koId, "pedi");
  return koId;
}

/** Ein Wissensobjekt MIT Herkunfts-Anker unmittelbar am Dienst — fuer P4/P5/P6. */
async function legeAnkerKoAn(
  ctx: Ctx,
  opts: { title: string; statement: string; provider: string | null; externalId: string },
): Promise<string> {
  const ko = await ctx.koService.create({
    title: opts.title,
    statement: opts.statement,
    type: "best_practice",
    category: "Wartung",
    author: "pedi",
    sources: [
      {
        id: `quelle-${opts.externalId}-${opts.provider ?? "ohne"}`,
        label: opts.title,
        url: null,
        excerpt: null,
        kind: "external",
        peerValidated: false,
        provider: opts.provider,
        externalId: opts.externalId,
        sourceVersion: 1,
        author: "pedi",
        at: new Date(0).toISOString(),
      },
    ],
  });
  return ko.id;
}

async function bestandsZahlen(ctx: Ctx): Promise<{ aktiv: number; papierkorb: number }> {
  return {
    aktiv: (await ctx.koService.list()).length,
    papierkorb: (await ctx.koService.trashed()).length,
  };
}

describe("JOB 3081 · P0 — die Voraussetzung: zwei Lesarten desselben Bestands", () => {
  it("P0 · `list()` laesst das getrashte Objekt weg, `trashedSourceAnchors()` liefert seinen Anker", async () => {
    const ctx = dienst();
    const getrashteId = await importiereUndTrashe(ctx, ANKER_ITEM);

    expect(
      await ctx.koService.list(),
      "Die aktive Lesart sieht das getrashte Objekt NICHT — genau daran scheiterte die Anker-Suche.",
    ).toHaveLength(0);
    expect(await ctx.koService.trashedSourceAnchors()).toEqual([
      {
        koId: getrashteId,
        provider: "test",
        externalId: ANKER_ITEM.externalId,
      },
    ]);
  });
});

describe("JOB 3081 · P1 — der gemessene Fall: der Kandidat sagt es vor der Entscheidung", () => {
  it("P1 · Re-Import gegen einen getrashten Anker → `im_papierkorb` mit der getrashten Kennung", async () => {
    const ctx = dienst();
    const getrashteId = await importiereUndTrashe(ctx, ANKER_ITEM);

    const [kandidat] = await ctx.library.createImportCandidates(
      [ANKER_ITEM],
      "importeur",
      TEXTGLEICHHEIT,
    );

    expect(
      kandidat?.duplicate,
      "Fail-closed: aus diesem `accept` darf kein Anlagevorgang werden.",
    ).toBe(true);
    expect(
      kandidat?.dublettenbefund,
      "Der Reviewer erfaehrt VOR seiner Entscheidung, dass dieses Wissen im Papierkorb liegt — und welches Objekt gemeint ist.",
    ).toEqual({
      ergebnis: "im_papierkorb",
      treffer: { art: "wissensobjekt", koId: getrashteId },
    });
  });

  // BENS HINWEIS (Runde 1): der Testname behauptete eine vom `accept` ZURUECKGEGEBENE Kennung,
  // gemessen wurde `koId === null`. Beides ist richtig, aber es sind zwei verschiedene Saetze —
  // der Name sagt jetzt, was wirklich gemessen wird. WO die Kennung steht, ist damit die Frage,
  // und sie wird hier mitgemessen: sie steht am KANDIDATEN (`dublettenbefund.treffer.koId`), denn
  // `duplicate: true` stoppt den `accept` eine Stufe VOR dem Riegel (Lieferpunkt 4, fail-closed).
  // Die vom `accept` zurueckgegebene getrashte Kennung misst P2 — dort, wo der Riegel wirklich
  // betreten wird (Altkandidat OHNE Befund).
  it("P1a · der `accept` legt nichts an und quittiert ohne Kennung — genannt hat sie der Kandidat", async () => {
    const ctx = dienst();
    const getrashteId = await importiereUndTrashe(ctx, ANKER_ITEM);
    ctx.create.mockClear();

    const [kandidat] = await ctx.library.createImportCandidates(
      [ANKER_ITEM],
      "importeur",
      TEXTGLEICHHEIT,
    );
    if (!kandidat) {
      throw new Error("Vorbedingung verletzt: kein Kandidat eingereiht.");
    }
    expect(
      kandidat.dublettenbefund,
      "Die vorhandene (getrashte) Kennung ist genannt — am Kandidaten, vor der Entscheidung.",
    ).toEqual({ ergebnis: "im_papierkorb", treffer: { art: "wissensobjekt", koId: getrashteId } });
    const beschieden = await ctx.library.reviewImportCandidate(kandidat.id, "accept", "pruefer");

    expect(ctx.create, "Es wurde kein zweites Wissensobjekt ANGELEGT.").not.toHaveBeenCalled();
    expect(beschieden.koId, "Der `accept` einer Dublette legt nichts an.").toBeNull();
    expect(
      await bestandsZahlen(ctx),
      "Nach demselben Handgriff existiert EINE Kennung, nicht zwei.",
    ).toEqual({ aktiv: 0, papierkorb: 1 });
    expect((await ctx.koService.trashed())[0]?.id).toBe(getrashteId);
  });

  // ================================================================================================
  // P1c — BENS KORREKTURPFLICHT 2 (Runde 1): DER PLATZHALTER-NACHWEIS ALS ECHTER MISCHLAUF.
  // ================================================================================================
  //
  // Runde 1 behauptete in der Rueckgabe, ein `im_papierkorb`-Kandidat komme nicht in den
  // Vergleichsbestand des Laufs (Lieferpunkt 4, zweiter Satz) — GEMESSEN wurde das nicht: kein Fall
  // hatte einen Anker-Eintrag und einen textgleichen Nachfolger in EINEM Lauf. Ben hat den Nachweis
  // selbst gefahren und verlangt ihn dauerhaft. Hier ist er.
  //
  // WAS DER FALL MISST: ein `im_papierkorb`-Kandidat legt nichts an — also darf er auch nichts
  // blockieren. Stuende sein Platzhalter im Vergleichsbestand, bekaeme der zweite Eintrag
  // desselben Laufs `identisch` mit einer `kandidatId` als Treffer und waere nicht mehr anlegbar:
  // eine unsichtbare Blockade eines Eintrags, den niemand je als Dublette entschieden hat.
  // GEGENRICHTUNG (so misst dieser Test wirklich): wird `kandidatErzeugtWissensobjekt` in
  // `service.ts` durch `true` ersetzt, wandert der Platzhalter wieder hinein und dieser Fall wird
  // rot — der Lauf steht in `RUECKGABE.md`.
  it("P1c · getrashter Anker-Kandidat, danach ein textgleicher Eintrag OHNE Anker im SELBEN Lauf → der zweite bleibt anlegbar", async () => {
    const ctx = dienst();
    await importiereUndTrashe(ctx, ANKER_ITEM);
    ctx.create.mockClear();

    const kandidaten = await ctx.library.createImportCandidates(
      [
        ANKER_ITEM,
        // Wortgleich, aber OHNE Herkunfts-Anker: er laeuft ueber den Textweg.
        {
          title: ANKER_ITEM.title,
          statement: ANKER_ITEM.statement,
          type: "best_practice",
          category: "Wartung",
        },
      ],
      "importeur",
      TEXTGLEICHHEIT,
    );

    expect(kandidaten, "Beide Eintraege werden eingereiht.").toHaveLength(2);
    expect(kandidaten[0]?.dublettenbefund).toEqual({
      ergebnis: "im_papierkorb",
      treffer: { art: "wissensobjekt", koId: (await ctx.koService.trashed())[0]?.id },
    });
    expect(
      kandidaten[1]?.dublettenbefund,
      "Der Anker-Kandidat legt nichts an — er darf den textgleichen Nachfolger darum nicht blockieren.",
    ).toEqual({ ergebnis: "keine" });
    expect(kandidaten[1]?.duplicate).toBe(false);

    const beschieden = await ctx.library.reviewImportCandidate(
      kandidaten[1]?.id as string,
      "accept",
      "pruefer",
    );
    expect(
      beschieden.koId,
      "Und er ist wirklich anlegbar, nicht nur formal unverdaechtig.",
    ).toEqual(expect.any(String));
    expect(
      ctx.create,
      "GENAU EIN neues Wissensobjekt — das des zweiten Eintrags.",
    ).toHaveBeenCalledTimes(1);
    expect(await bestandsZahlen(ctx)).toEqual({ aktiv: 1, papierkorb: 1 });
  });
});

// ==================================================================================================
// P1b — DIESELBE KLICKSTRECKE DURCH DIE ECHTE ROUTE, BIS IN DIE ANTWORTFORM.
// ==================================================================================================
//
// Die Nutzenkette endet in diesem Auftrag an der API (die Web-Anzeige ist ausdruecklich die zweite
// Haelfte). `services/app/src/routes/library-routes.ts:83-89` reicht `dublettenbefund` unveraendert
// durch — dass das neue Ergebnis wirklich bis dorthin reist, ist eine MESSUNG, keine Ableitung.
// Der Anker-Strang haengt am generischen Import-Enable (`build-app.ts:487`), darum das Flag NUR fuer
// `buildServices` (Muster: `services/app/src/routes/confluence-import-status.test.ts:63-68`).
describe("JOB 3081 · P1b — die Antwortform der Route traegt den Befund", () => {
  const ZUGANG = { name: "Admin", email: "papierkorb-anker@x.de", password: "secret123" };

  async function angemeldeteApp() {
    process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
    const services = buildServices();
    delete process.env.KLARWERK_CONFLUENCE_IMPORT;
    const app = buildApp(services);
    await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: ZUGANG.email, password: ZUGANG.password },
    });
    return { app, services, headers: { authorization: `Bearer ${login.json().token}` } };
  }

  it("P1b · Import → accept → loeschen → identischer Re-Import: EINE Kennung, und die API sagt warum", async () => {
    const { app, headers } = await angemeldeteApp();
    const reiheEin = async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/library/import/candidates",
        headers,
        payload: { items: [ANKER_ITEM] },
      });
      expect(res.statusCode, res.body).toBe(201);
      return res.json() as { id: string }[];
    };
    const accept = async (id: string) => {
      const res = await app.inject({
        method: "PUT",
        url: `/api/library/import/candidates/${id}`,
        headers,
        payload: { action: "accept" },
      });
      expect(res.statusCode, res.body).toBe(200);
      return res.json() as { koId: string | null };
    };

    const [erster] = await reiheEin();
    const ersteKennung = (await accept(erster?.id as string)).koId;
    expect(ersteKennung, "Der erste Accept legt das Wissensobjekt an.").toEqual(expect.any(String));

    const geloescht = await app.inject({
      method: "DELETE",
      url: `/api/kos/${ersteKennung}`,
      headers,
    });
    expect(geloescht.statusCode, geloescht.body).toBe(204);

    const [zweiter] = await reiheEin();
    const liste = await app.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers,
    });
    expect(liste.statusCode, liste.body).toBe(200);
    const ausListe = (
      liste.json() as {
        id: string;
        duplicate: boolean;
        dublettenbefund?: { ergebnis: string; treffer?: { art: string; koId: string } };
      }[]
    ).find((k) => k.id === zweiter?.id);
    expect(ausListe?.duplicate).toBe(true);
    expect(
      ausListe?.dublettenbefund,
      "GET /api/library/import/candidates weist den Papierkorb-Befund mit der Kennung aus.",
    ).toEqual({ ergebnis: "im_papierkorb", treffer: { art: "wissensobjekt", koId: ersteKennung } });

    expect(
      (await accept(zweiter?.id as string)).koId,
      "Und der zweite `accept` erzeugt keine neue aktive Kennung.",
    ).toBeNull();
    const bestand = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect(bestand.statusCode, bestand.body).toBe(200);
    expect(
      bestand.json() as unknown[],
      "Der Bestand traegt KEINE zweite Karteikarte — genau das war Codex' Befund.",
    ).toHaveLength(0);
  });
});

// ==================================================================================================
// P2/P3 — DER RIEGEL IN `acceptToKo` UND DER TRASH-VERTRAG.
// ==================================================================================================
//
// Der Riegel muss auch dann greifen, wenn der Kandidat GAR KEINEN Befund traegt: Altbestand
// (`types.ts:202` ist optional), die zwei Confluence-/Jira-Anker-Wege und die Recovery erreichen
// `acceptToKo` ohne den Befund aus P1. Beide Linien ersetzen einander nicht.
describe("JOB 3081 · P2/P3 — der harte Riegel und der Trash-Vertrag", () => {
  async function altkandidatOhneBefund(ctx: Ctx, item: ImportItem, id: string): Promise<void> {
    await ctx.candidates.insert({
      id,
      item,
      status: "neu",
      duplicate: false,
      note: null,
      koId: null,
      createdAt: new Date(0).toISOString(),
    });
  }

  it("P2 · Altkandidat OHNE `dublettenbefund` → die getrashte Kennung, kein `create`, keine zweite Karteikarte", async () => {
    const ctx = dienst();
    const getrashteId = await importiereUndTrashe(ctx, ANKER_ITEM);
    const vorher = await bestandsZahlen(ctx);
    ctx.create.mockClear();
    await altkandidatOhneBefund(ctx, ANKER_ITEM, "alt-ohne-befund");

    const beschieden = await ctx.library.reviewImportCandidate(
      "alt-ohne-befund",
      "accept",
      "pruefer",
    );

    expect(
      beschieden.dublettenbefund,
      "Vorbedingung: dieser Kandidat traegt KEINEN Befund — es misst wirklich den Riegel.",
    ).toBeUndefined();
    expect(
      beschieden.koId,
      "Der Accept nennt die VORHANDENE (getrashte) Kennung statt einer neuen.",
    ).toBe(getrashteId);
    expect(ctx.create, "`this.koService.create` wird nie erreicht.").not.toHaveBeenCalled();
    expect(await bestandsZahlen(ctx), "Die Zahl der Objekte im Bestand ist unveraendert.").toEqual(
      vorher,
    );
  });

  it("P3 · hoehere `sourceVersion` gegen den getrashten Anker → das Objekt bleibt byteweise unveraendert", async () => {
    const ctx = dienst();
    const getrashteId = await importiereUndTrashe(ctx, ANKER_ITEM);
    const vorher = (await ctx.repo.findById(getrashteId)) as KnowledgeObject;
    const abdruck = JSON.stringify(vorher);
    ctx.create.mockClear();
    ctx.restore.mockClear();
    ctx.revise.mockClear();
    ctx.setConfidentiality.mockClear();
    await altkandidatOhneBefund(
      ctx,
      { ...ANKER_ITEM, sourceVersion: 2, confidentiality: "vertraulich" },
      "alt-version-2",
    );

    const beschieden = await ctx.library.reviewImportCandidate(
      "alt-version-2",
      "accept",
      "pruefer",
    );

    expect(beschieden.koId).toBe(getrashteId);
    const nachher = (await ctx.repo.findById(getrashteId)) as KnowledgeObject;
    expect(nachher.deletedAt, "Die Trash-Entscheidung steht unveraendert.").toBe(vorher.deletedAt);
    expect(nachher.version).toBe(vorher.version);
    expect(nachher.sources).toEqual(vorher.sources);
    expect(nachher.confidentiality).toBe(vorher.confidentiality);
    expect(
      JSON.stringify(nachher),
      "Ein Re-Import hebt die Loeschung eines Menschen weder auf noch schreibt er sie fort.",
    ).toBe(abdruck);
    expect(
      ctx.restore,
      "Kein `restore` — Wiederherstellen laeuft ueber den Papierkorb.",
    ).not.toHaveBeenCalled();
    expect(ctx.revise, "Kein `revise` am getrashten Objekt.").not.toHaveBeenCalled();
    expect(
      ctx.setConfidentiality,
      "Kein `setConfidentiality` am getrashten Objekt.",
    ).not.toHaveBeenCalled();
    expect(ctx.create, "Und erst recht kein zweites Wissensobjekt.").not.toHaveBeenCalled();
  });
});

// ==================================================================================================
// K — DIE AUSGEWIESENE KOSTENGRENZE IST GEMESSEN, NICHT NUR KOMMENTIERT.
// ==================================================================================================
//
// `trashedSourceAnchors()` liest den ganzen Bestand (`knowledge-object/src/service.ts:3386`). Die
// Grenze steht im Code — hier steht, dass sie hält.
describe("JOB 3081 · K — der Papierkorb wird hoechstens einmal je Lauf gelesen", () => {
  it("K1 · drei Anker-Eintraege in EINEM Lauf → GENAU EINE Papierkorb-Lesung", async () => {
    const ctx = dienst();
    await importiereUndTrashe(ctx, ANKER_ITEM);
    ctx.papierkorbLesung.mockClear();

    await ctx.library.createImportCandidates(
      [
        ANKER_ITEM,
        { ...ANKER_ITEM, externalId: "zweiter-anker" },
        { ...ANKER_ITEM, externalId: "dritter-anker" },
      ],
      "importeur",
      TEXTGLEICHHEIT,
    );

    expect(
      ctx.papierkorbLesung,
      "Die Liste wird VOR der Schleife geholt, nicht je Eintrag.",
    ).toHaveBeenCalledTimes(1);
  });

  it("K2 · ein Lauf ohne jeden Anker fragt den Papierkorb gar nicht", async () => {
    const ctx = dienst();
    ctx.papierkorbLesung.mockClear();

    await ctx.library.createImportCandidates(
      [
        {
          title: "Eintrag ohne Anker",
          statement: "Dieser Eintrag traegt keine externalId",
          type: "best_practice",
          category: "Wartung",
        },
      ],
      "importeur",
      TEXTGLEICHHEIT,
    );

    expect(ctx.papierkorbLesung, "Der Textweg fragt den Papierkorb nie.").not.toHaveBeenCalled();
  });

  it("K3 · findet der `accept` einen AKTIVEN Anker, wird der Papierkorb nicht befragt", async () => {
    const ctx = dienst();
    const [erster] = await ctx.library.createImportCandidates(
      [ANKER_ITEM],
      "importeur",
      TEXTGLEICHHEIT,
    );
    await ctx.library.reviewImportCandidate(erster?.id as string, "accept", "pedi");
    const [zweiter] = await ctx.library.createImportCandidates(
      [{ ...ANKER_ITEM, sourceVersion: 2 }],
      "importeur",
      TEXTGLEICHHEIT,
    );
    ctx.papierkorbLesung.mockClear();

    await ctx.library.reviewImportCandidate(zweiter?.id as string, "accept", "pruefer");

    expect(
      ctx.papierkorbLesung,
      "Der teure Lesepfad laeuft nur, wenn die aktive Suche nichts gefunden hat.",
    ).not.toHaveBeenCalled();
  });
});

// ==================================================================================================
// P4/P5/P6 — DIE DREI GEGENRICHTUNGEN (heute gruen, muessen gruen bleiben).
// ==================================================================================================
describe("JOB 3081 · P4 — ein aktives Wissensobjekt gewinnt immer gegen ein getrashtes", () => {
  it("P4 · derselbe Anker aktiv UND im Papierkorb → `nicht_gestellt`, und der Re-Sync revidiert das AKTIVE", async () => {
    const ctx = dienst();
    // Das AKTIVE Objekt entsteht auf dem Produktweg (Import → accept) …
    const [ersterKandidat] = await ctx.library.createImportCandidates(
      [ANKER_ITEM],
      "importeur",
      TEXTGLEICHHEIT,
    );
    const aktiveId = (
      await ctx.library.reviewImportCandidate(ersterKandidat?.id as string, "accept", "pedi")
    ).koId as string;
    // … und daneben liegt ein zweites Objekt MIT demselben Anker im Papierkorb.
    const getrashteId = await legeAnkerKoAn(ctx, {
      title: "Alte Fassung derselben Sache",
      statement: ANKER_ITEM.statement,
      provider: "test",
      externalId: ANKER_ITEM.externalId as string,
    });
    await ctx.koService.delete(getrashteId, "pedi");
    expect(aktiveId).not.toBe(getrashteId);

    const [kandidat] = await ctx.library.createImportCandidates(
      [{ ...ANKER_ITEM, sourceVersion: 2, statement: `${ANKER_ITEM.statement} (Fassung 2)` }],
      "importeur",
      TEXTGLEICHHEIT,
    );

    expect(kandidat?.duplicate, "Ein aktiver Re-Sync ist keine Dublette.").toBe(false);
    expect(
      kandidat?.dublettenbefund,
      "Der Papierkorb aendert am aktiven Re-Sync nichts — der Befund bleibt `nicht_gestellt`.",
    ).toEqual({ ergebnis: "nicht_gestellt" });

    const beschieden = await ctx.library.reviewImportCandidate(
      kandidat?.id as string,
      "accept",
      "pruefer",
    );
    expect(beschieden.koId, "Adoptiert wird das AKTIVE Objekt, nicht das getrashte.").toBe(
      aktiveId,
    );
    const aktiv = (await ctx.koService.list()).find((ko) => ko.id === aktiveId);
    expect(aktiv?.statement, "Und die hoehere Version revidiert es wie bisher.").toBe(
      `${ANKER_ITEM.statement} (Fassung 2)`,
    );
    expect(
      (await ctx.repo.findById(getrashteId))?.deletedAt,
      "Das getrashte Objekt bleibt, wo es ist.",
    ).toEqual(expect.any(String));
  });
});

describe("JOB 3081 · P5 — kein zu weites Netz: die Anker-Regel gilt im Papierkorb unveraendert", () => {
  it("P5 · gleiche externalId, ANDERER Provider im Papierkorb → kein Treffer, ein neues Wissensobjekt", async () => {
    const ctx = dienst();
    const fremdeId = await legeAnkerKoAn(ctx, {
      title: "Gleiche Kennung, andere Quelle",
      statement: "Ein Jira-Vorgang mit zufaellig gleicher Kennung",
      provider: "jira",
      externalId: ANKER_ITEM.externalId as string,
    });
    await ctx.koService.delete(fremdeId, "pedi");
    ctx.create.mockClear();

    const [kandidat] = await ctx.library.createImportCandidates(
      [ANKER_ITEM],
      "importeur",
      TEXTGLEICHHEIT,
    );

    expect(kandidat?.duplicate).toBe(false);
    expect(
      kandidat?.dublettenbefund,
      "Der Anker unterscheidet Provider — im Papierkorb genau wie aktiv.",
    ).toEqual({ ergebnis: "nicht_gestellt" });

    const beschieden = await ctx.library.reviewImportCandidate(
      kandidat?.id as string,
      "accept",
      "pruefer",
    );
    expect(beschieden.koId, "Es entsteht ein NEUES Wissensobjekt, wie bisher.").toEqual(
      expect.any(String),
    );
    expect(beschieden.koId).not.toBe(fremdeId);
    expect(ctx.create).toHaveBeenCalledTimes(1);
  });
});

// ==================================================================================================
// P7 — BENS KORREKTURPFLICHT 1 (Runde 1): DER SCHLUESSEL MUSS DIESELBE GLEICHHEIT AUSDRUECKEN WIE
// DER FELDVERGLEICH. P5 REICHTE DAFUER NICHT.
// ==================================================================================================
//
// P5 misst „gleiche externalId, anderer Provider" — verschiedene Schluessel, leicht zu treffen. Der
// Fehler der Runde 1 lag eine Ebene tiefer: der Schluessel `${providerKey}@${externalId}` ist NICHT
// injektiv, weil das Trennzeichen in BEIDEN Feldern vorkommen darf. Zwei verschiedene Anker
//   (provider "test@tenant", externalId "42")  und  (provider "test", externalId "tenant@42")
// ergaben denselben String. Ben hat es ueber die echte API gemessen: der zweite, eigenstaendige
// Import bekam `im_papierkorb` mit der FREMDEN Kennung und wurde ohne Anlage quittiert.
//
// DIESE DREI FAELLE DECKEN DIE DREI KARTEN AB, DIE DEN SCHLUESSEL BENUTZEN — Papierkorb-Karte
// (P7a), Karte der AKTIVEN Anker (P7b) und der lauf-interne Dedup (P7c). Jeder Fall wird rot,
// wenn `ankerSchluessel` in `service.ts` wieder auf die Verkettung zurueckgedreht wird; die
// gefahrenen Laeufe stehen in `RUECKGABE.md`.
describe("JOB 3081 · P7 — mehrdeutige zusammengesetzte Schluessel verwechseln keine Quellen", () => {
  // Bens Gegenprobe, woertlich: dieselben zwei Anker, dieselbe Reihenfolge.
  const ANKER_A: ImportItem = {
    title: "Anker A",
    statement: "Provider traegt das Trennzeichen, die Kennung ist kurz",
    type: "best_practice",
    category: "Wartung",
    provider: "test@tenant",
    externalId: "42",
    sourceVersion: 1,
  };
  const ANKER_B: ImportItem = {
    title: "Anker B",
    statement: "Die Kennung traegt das Trennzeichen, der Provider ist kurz",
    type: "best_practice",
    category: "Wartung",
    provider: "test",
    externalId: "tenant@42",
    sourceVersion: 1,
  };

  it("P7a · Anker A im PAPIERKORB, Anker B wird importiert → kein Papierkorb-Treffer, Anker B entsteht", async () => {
    const ctx = dienst();
    const getrashteAId = await importiereUndTrashe(ctx, ANKER_A);
    ctx.create.mockClear();

    const [kandidat] = await ctx.library.createImportCandidates(
      [ANKER_B],
      "importeur",
      TEXTGLEICHHEIT,
    );

    expect(
      kandidat?.dublettenbefund,
      "Anker B war nie da — eine Papierkorb-Auskunft ueber ihn waere erfunden.",
    ).toEqual({ ergebnis: "nicht_gestellt" });
    expect(kandidat?.duplicate, "Und der berechtigte Import darf nicht blockiert werden.").toBe(
      false,
    );

    const beschieden = await ctx.library.reviewImportCandidate(
      kandidat?.id as string,
      "accept",
      "pruefer",
    );
    expect(beschieden.koId, "Es entsteht genau ein NEUES Wissensobjekt.").toEqual(
      expect.any(String),
    );
    expect(beschieden.koId).not.toBe(getrashteAId);
    expect(ctx.create).toHaveBeenCalledTimes(1);
    expect(
      await bestandsZahlen(ctx),
      "Ein aktives Objekt, und Anker A liegt weiter im Papierkorb.",
    ).toEqual({ aktiv: 1, papierkorb: 1 });
  });

  it("P7b · Anker A AKTIV, Anker B im Papierkorb → der aktive A verdeckt den getrashten B nicht", async () => {
    const ctx = dienst();
    // Anker A aktiv im Bestand …
    const [kandidatA] = await ctx.library.createImportCandidates(
      [ANKER_A],
      "importeur",
      TEXTGLEICHHEIT,
    );
    const aktiveAId = (
      await ctx.library.reviewImportCandidate(kandidatA?.id as string, "accept", "pedi")
    ).koId as string;
    // … und Anker B liegt im Papierkorb.
    const getrashteBId = await importiereUndTrashe(ctx, ANKER_B);
    expect(aktiveAId).not.toBe(getrashteBId);

    const [kandidat] = await ctx.library.createImportCandidates(
      [ANKER_B],
      "importeur",
      TEXTGLEICHHEIT,
    );

    expect(
      kandidat?.dublettenbefund,
      "Der VORRANG DES LEBENDEN gilt fuer den EIGENEN Anker — der aktive A ist eine andere Quelle und darf B nicht stumm schalten.",
    ).toEqual({
      ergebnis: "im_papierkorb",
      treffer: { art: "wissensobjekt", koId: getrashteBId },
    });
    expect(kandidat?.duplicate).toBe(true);
  });

  // WARUM DIE BEIDEN EINTRAEGE HIER VERSCHIEDENE `sourceVersion` TRAGEN — UND WARUM DAS SEIT
  // JOB 3087 KEINE AUSKLAMMERUNG MEHR IST, SONDERN EIN EIGENER SCHNITT:
  //   Bis JOB 3087 steckte dieselbe mehrdeutige Verkettung ein zweites Mal in `openCandidateKey`
  //   (`services/library-analytics/src/repo.ts`, `${providerKey}@${ext}@${version}`) — dem
  //   Idempotenz-Schluessel der Review-Warteschlange. Mit gleicher Version ergaben Anker A und
  //   Anker B dort denselben Schluessel `test@tenant@42@1`, und `insertIfAbsent` reihte den
  //   ZWEITEN Kandidaten gar nicht erst ein (gemessen in JOB 3081 Runde 2: `expected [ { …(8) } ]
  //   to have a length of 2 but got 1`). JOB 3087 (Q2b) hat den Schluesselstring dort ABGESCHAFFT:
  //   verglichen wird jetzt feldweise `(importProviderKey(provider), externalId, sourceVersion)` —
  //   dasselbe Spalten-Tupel wie im partiellen UNIQUE-Index (`repo-pg.ts:153-155`), der schon
  //   immer richtig war. Die Faelle dazu stehen in
  //   `tests/import-schluessel-eindeutig/queue-idempotenz-verwechselt-keine-quellen.test.ts`.
  //   DIESER Fall bleibt UNVERAENDERT bei zwei Versionen: er misst genau die Stelle, die JOB 3081
  //   verantwortet — `batchExternalIds` in `service.ts`, das die Version bewusst ignoriert. Mit
  //   der alten Ankerverkettung ist der zweite Eintrag dort `duplicate: true`; dieser Fall misst,
  //   dass er es nicht mehr ist. Die Warteschlangen-Haelfte misst P7d daneben, mit GLEICHER
  //   Version — beide Faelle stehen nebeneinander, keiner ersetzt den anderen.
  it("P7c · Anker A und Anker B in EINEM Lauf → zwei Kandidaten, keiner ist die Dublette des anderen", async () => {
    const ctx = dienst();

    const kandidaten = await ctx.library.createImportCandidates(
      [ANKER_A, { ...ANKER_B, sourceVersion: 2 }],
      "importeur",
      TEXTGLEICHHEIT,
    );

    expect(kandidaten).toHaveLength(2);
    expect(
      kandidaten.map((k) => k.duplicate),
      "Zwei verschiedene Quellobjekte in einem Lauf sind keine Wiederholung desselben.",
    ).toEqual([false, false]);
    for (const kandidat of kandidaten) {
      const beschieden = await ctx.library.reviewImportCandidate(kandidat.id, "accept", "pruefer");
      expect(beschieden.koId).toEqual(expect.any(String));
    }
    expect(await bestandsZahlen(ctx)).toEqual({ aktiv: 2, papierkorb: 0 });
  });

  // JOB 3087 (Q2b) — DER AUSGEKLAMMERTE FALL, JETZT EINGELOEST.
  //
  // Derselbe Lauf wie P7c, aber mit GLEICHER `sourceVersion: 1`. Bis JOB 3087 kam hier nur EIN
  // Kandidat an: die Warteschlange verschluckte den zweiten stumm, weil ihr Schluesselstring
  // `test@tenant@42@1` fuer beide Quellen derselbe war. Gemessen wird darum das Ergebnis am
  // BESTAND, nicht im Repo-Zwischenraum: zwei Kandidaten, beide annehmbar, am Ende zwei aktive
  // Wissensobjekte. Der Weg laeuft ueber `createImportCandidates` (das `insertIfAbsent` benutzt)
  // und `reviewImportCandidate` — dieselbe Kette, die der Reviewer bedient.
  it("P7d · Anker A und Anker B mit GLEICHER Version in EINEM Lauf → zwei Kandidaten, zwei Objekte", async () => {
    const ctx = dienst();

    const kandidaten = await ctx.library.createImportCandidates(
      [ANKER_A, ANKER_B],
      "importeur",
      TEXTGLEICHHEIT,
    );

    expect(
      kandidaten,
      "Zwei verschiedene Quellobjekte stehen als ZWEI Kandidaten in der Review-Liste — " +
        "ein stumm verschluckter zweiter waere eine Fehlmenge ohne Meldung.",
    ).toHaveLength(2);
    expect(kandidaten.map((k) => k.duplicate)).toEqual([false, false]);

    for (const kandidat of kandidaten) {
      const beschieden = await ctx.library.reviewImportCandidate(kandidat.id, "accept", "pruefer");
      expect(beschieden.koId).toEqual(expect.any(String));
    }
    expect(await bestandsZahlen(ctx)).toEqual({ aktiv: 2, papierkorb: 0 });
  });
});

describe("JOB 3081 · P6 — der Textweg wird nicht still auf Geloeschtes ausgeweitet", () => {
  it("P6 · Kandidat OHNE externalId, textgleiches Objekt im Papierkorb → `keine`, es entsteht ein neues", async () => {
    const ctx = dienst();
    const textId = await legeAnkerKoAn(ctx, {
      title: "Filter wechseln",
      statement: "Den Filter der Anlage 3 jaehrlich wechseln",
      provider: "test",
      externalId: "textweg-anker",
    });
    await ctx.koService.delete(textId, "pedi");
    ctx.create.mockClear();

    const [kandidat] = await ctx.library.createImportCandidates(
      [
        {
          title: "Filter wechseln",
          statement: "Den Filter der Anlage 3 jaehrlich wechseln",
          type: "best_practice",
          category: "Wartung",
        },
      ],
      "importeur",
      TEXTGLEICHHEIT,
    );

    expect(
      kandidat?.dublettenbefund,
      "Der Textweg vergleicht gegen den AKTIVEN Bestand — eine Textregel gegen Geloeschtes waere eine andere Regel mit eigener Schwelle.",
    ).toEqual({ ergebnis: "keine" });
    expect(kandidat?.duplicate).toBe(false);

    const beschieden = await ctx.library.reviewImportCandidate(
      kandidat?.id as string,
      "accept",
      "pruefer",
    );
    expect(beschieden.koId).toEqual(expect.any(String));
    expect(beschieden.koId).not.toBe(textId);
    expect(ctx.create).toHaveBeenCalledTimes(1);
  });
});

// ==================================================================================================
// Z0/Z1/Z2 — DAS ZUSTANDSMODELL DER EINEN NEUEN AUSSAGE.
// ==================================================================================================
describe("JOB 3081 · Z — leerer Papierkorb, und was bei einem Lesefehler gilt", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("Z0 · leerer Papierkorb → exakt wie bisher `nicht_gestellt`, keine Aussage aus einer leeren Liste", async () => {
    const ctx = dienst();

    const [kandidat] = await ctx.library.createImportCandidates(
      [ANKER_ITEM],
      "importeur",
      TEXTGLEICHHEIT,
    );

    expect(await ctx.koService.trashedSourceAnchors()).toEqual([]);
    expect(kandidat?.dublettenbefund).toEqual({ ergebnis: "nicht_gestellt" });
    expect(kandidat?.duplicate).toBe(false);
  });

  it("Z1 · die Papierkorb-Lesung wirft → `pruefung_nicht_moeglich`, der Lauf bricht NICHT ab", async () => {
    const ctx = dienst();
    vi.spyOn(ctx.koService, "trashedSourceAnchors").mockRejectedValue(
      new Error("Papierkorb nicht lesbar"),
    );

    const kandidaten = await ctx.library.createImportCandidates(
      [
        ANKER_ITEM,
        {
          title: "Eintrag ohne Anker",
          statement: "Dieser Eintrag traegt keine externalId",
          type: "best_practice",
          category: "Wartung",
        },
      ],
      "importeur",
      TEXTGLEICHHEIT,
    );

    expect(kandidaten, "Beide Eintraege werden verarbeitet.").toHaveLength(2);
    expect(
      kandidaten[0]?.dublettenbefund,
      'Ein Lesefehler wird nie als „liegt nicht im Papierkorb" gedeutet.',
    ).toEqual({ ergebnis: "pruefung_nicht_moeglich" });
    expect(
      kandidaten[1]?.dublettenbefund,
      "Der Textweg ist von der Papierkorb-Lesung unberuehrt.",
    ).toEqual({ ergebnis: "keine" });

    const beschieden = await ctx.library.reviewImportCandidate(
      kandidaten[0]?.id as string,
      "accept",
      "pruefer",
    );
    expect(
      beschieden.koId,
      "Fail-closed: ohne Entscheidung ueber den Papierkorb entsteht kein Wissensobjekt.",
    ).toBeNull();
  });

  it("Z2 · wirft die Lesung erst beim `accept`, wirft der Accept — kein halber Zustand", async () => {
    const ctx = dienst();
    const [kandidat] = await ctx.library.createImportCandidates(
      [ANKER_ITEM],
      "importeur",
      TEXTGLEICHHEIT,
    );
    expect(kandidat?.dublettenbefund).toEqual({ ergebnis: "nicht_gestellt" });
    vi.spyOn(ctx.koService, "trashedSourceAnchors").mockRejectedValue(
      new Error("Papierkorb nicht lesbar"),
    );

    await expect(
      ctx.library.reviewImportCandidate(kandidat?.id as string, "accept", "pruefer"),
    ).rejects.toThrow("Papierkorb nicht lesbar");
    expect(await bestandsZahlen(ctx), "Es ist nichts entstanden.").toEqual({
      aktiv: 0,
      papierkorb: 0,
    });
  });
});
