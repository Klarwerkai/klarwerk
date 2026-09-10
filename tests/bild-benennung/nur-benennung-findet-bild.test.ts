// ================================================================================================
// JOB 3111 · B1b — EIN BILD, DAS NUR SEINE BENENNUNG TRÄGT, IST AUFFINDBAR
// ================================================================================================
//
// DIE ZUSAGE, gemessen am HTTP-Weg, den die Fläche geht: Wer „schraubenzeichnung" sucht, findet
// das Bild auch dann, wenn dieser Name NUR im `alt` des eingebetteten Bildes steht — der Bericht
// ringsum nennt das Wort nirgends, es gibt keine Bildunterschrift und keinen Anhang.
//
// DAS WAR DIE LETZTE BENANNTE GRENZE aus JOB 3095 (dort als R12 ausdrücklich festgenagelt:
// „nicht auffindbar"). Sie fällt hier, und zwar am selben Muster wie die Fußnoten: ein
// ABGELEITETES, additives Suchfeld im JSONB-Dokument (`imageNames`), beim Schreiben gesetzt und
// für Altbestand über den Wartungslauf nachgezogen. Keine Migration, keine Oberflächenänderung.
//
// WAS DIESE DATEI ABSICHTLICH NICHT TUT: `searchImageNames` als Funktion prüfen. Der Nutzen
// entsteht erst, wenn Persistenz, Dienst, Kandidatenfilter und Route zusammenspielen — deshalb
// läuft jeder Fall über `GET /api/library/images`.
import { describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import {
  InMemoryKoRepo,
  type KnowledgeObject,
  type KoRepo,
  KoService,
} from "../../services/knowledge-object";
import { MAX_CAPTIONS_PER_KO, MAX_CAPTION_TEXT_LENGTH } from "../../services/structure";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

interface Treffer {
  imageId: string;
  koId: string;
  koTitel: string;
  version: number;
  pruefstand: string;
  caption: string;
  name: string | null;
  gefundenUeber: ("beschreibung" | "name")[];
  thumbnailUrl: string;
}
interface Antwort {
  treffer: Treffer[];
  geprueft: string;
  gedeckelt: boolean;
}

/** Das Bild des Auftrags: eine Benennung, KEINE Bildunterschrift, kein Anhang. */
const NAME = "schraubenzeichnung-v3.png";
const SUCHWORT = "schraubenzeichnung";

function nurBenanntesBild(id: string, name: string): string {
  return `<figure data-image-id="${id}"><img data-image-id="${id}" src="/api/objects/${id}/raw" alt="${name}"></figure>`;
}

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

/**
 * Der Aufbau — wahlweise mit einem instrumentierten KO-Repo, das die VOLLLADUNGEN zählt.
 *
 * Er geht bewusst über `inMemoryRepos()` + `assembleServices()` statt über `buildServices()`:
 * nur so lässt sich derselbe App-Aufbau mit einem gezählten Repo fahren, und die Kostenaussage
 * („kein zweiter Rumpf-Ladevorgang") wird eine Messung statt einer Behauptung.
 */
async function setup(koRepoHuelle?: (inner: InMemoryKoRepo) => KoRepo) {
  const repos = inMemoryRepos();
  const inner = repos.koRepo as InMemoryKoRepo;
  const services: AppServices = assembleServices(
    koRepoHuelle ? { ...repos, koRepo: koRepoHuelle(inner) } : repos,
  );
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@benennung.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@benennung.test", "geheim12345");
  for (const email of ["autor@benennung.test", "fremd@benennung.test"]) {
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
    services,
    inner,
    admin,
    autor: await login(app, "autor@benennung.test", "geheim12345"),
    fremd: await login(app, "fremd@benennung.test", "geheim12345"),
  };
}

async function anlegen(app: App, headers: Auth, payload: Record<string, unknown>): Promise<string> {
  // JOB 3429 (Q3 c): der Schreibweg verlangt die Stufe. Vorgabe hier, vom Aufrufer überschreibbar.
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: { confidentiality: "intern", ...payload },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Anlage fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return res.json().id as string;
}

async function bildsuche(
  app: App,
  headers: Auth,
  q: string,
): Promise<{ status: number; body: string; json: Antwort }> {
  const res = await app.inject({
    method: "GET",
    url: `/api/library/images?q=${encodeURIComponent(q)}`,
    headers,
  });
  return {
    status: res.statusCode,
    body: res.body,
    json:
      res.statusCode === 200
        ? (res.json() as Antwort)
        : { treffer: [], geprueft: "", gedeckelt: false },
  };
}

/** Ein KO, wie es VOR dieser Regel im Bestand lag: bodyHtml da, captionTexts da, imageNames FEHLT. */
function legacyKo(id: string, bodyHtml: string, captionTexts: string[]): KnowledgeObject {
  return {
    id,
    title: `Altbestand ${id}`,
    statement: "Kurzfassung ohne das Suchwort.",
    bodyHtml,
    captionTexts,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    rowVersion: 3,
    originalAuthor: "autor@benennung.test",
    author: "autor@benennung.test",
    neededValidations: 1,
    assignments: [],
    history: [],
  } as unknown as KnowledgeObject;
}

describe("JOB 3111 · B1b — die Benennung eines Bildes ist ein persistiertes Suchfeld", () => {
  // ROT VOR DIESER RUNDE: 0 Treffer. Das Objekt wurde über `captionTexts` (leer), Anhangsnamen
  // (keine) und die Bibliothekssuche (das Wort steht nirgends im Text) NICHT Kandidat, und ohne
  // Kandidat wurde sein Rumpf nie gelesen — der Name im `alt` war unerreichbar.
  it("F1 · ein Name NUR im alt, sonst kein Treffer im Objekt → GENAU ein Bildtreffer, Fundstelle „name“", async () => {
    const { app, autor } = await setup();
    const ko = await anlegen(app, autor, {
      title: "Wartungsplan",
      statement: "Kurzfassung ohne das Suchwort.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml: `<p>Der Plan nennt das Wort nirgends.</p>${nurBenanntesBild("b1", NAME)}`,
    });

    const res = await bildsuche(app, autor, SUCHWORT);
    expect(res.status, res.body).toBe(200);
    expect(res.json.treffer).toHaveLength(1);
    expect(res.json.treffer[0]).toEqual({
      imageId: "b1",
      koId: ko,
      koTitel: "Wartungsplan",
      version: 1,
      pruefstand: "offen",
      caption: "",
      name: NAME,
      gefundenUeber: ["name"],
      thumbnailUrl: "/api/objects/b1/raw",
    });
    // Das persistierte Suchfeld ist wirklich da (nicht nur der Rumpf-Scan der Route).
    const gespeichert = await app
      .inject({ method: "GET", url: `/api/kos/${ko}`, headers: autor })
      .then((r) => r.json() as { imageNames?: string[] });
    expect(gespeichert.imageNames).toEqual([NAME]);
  });

  // §8.6 (a) — DIE PRÜFLÜCKE, DIE AM TEUERSTEN WÄRE: die Bildnamen dürfen NICHT in die allgemeine
  // Bibliothekssuche einfließen (ausdrücklich nicht Teil des Auftrags). Ein Dateiname ist kein
  // Wissensinhalt; eine Textsuche, die plötzlich Dateinamen trifft, wäre eine stille Ausweitung.
  it("F2 · /api/library/search bleibt vom neuen Feld unberührt — 0 Treffer für dasselbe Wort", async () => {
    const { app, autor } = await setup();
    await anlegen(app, autor, {
      title: "Wartungsplan",
      statement: "Kurzfassung ohne das Suchwort.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml: nurBenanntesBild("b1", NAME),
    });
    const res = await app.inject({
      method: "GET",
      url: `/api/library/search?q=${SUCHWORT}`,
      headers: autor,
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toEqual([]);
  });

  // §8.6 (b) — EIN NEUES SUCHFELD DARF KEINE ZEILE SICHTBAR MACHEN, DIE VORHER UNSICHTBAR WAR.
  it("F3 · ein fremdes vertrauliches Objekt bleibt unsichtbar, auch wenn sein Bild so heißt", async () => {
    const { app, autor, fremd } = await setup();
    const geheim = await anlegen(app, autor, {
      title: "Geheimanlage",
      statement: "Kurzfassung ohne das Suchwort.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml: nurBenanntesBild("g1", NAME),
    });
    const hoch = await app.inject({
      method: "PUT",
      url: `/api/kos/${geheim}`,
      headers: autor,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(hoch.statusCode, hoch.body).toBe(200);

    // Kalibrierung: der Autor selbst findet es …
    expect((await bildsuche(app, autor, SUCHWORT)).json.treffer).toHaveLength(1);
    // … der Fremde nicht — und erfährt auch sonst nichts über das Objekt.
    const fremde = await bildsuche(app, fremd, SUCHWORT);
    expect(fremde.status, fremde.body).toBe(200);
    expect(fremde.json.treffer).toEqual([]);
    expect(fremde.body).not.toContain("Geheimanlage");
    expect(fremde.body).not.toContain(NAME);
  });

  // LIEFERPUNKT 6 — DIE HERKUNFTSAUSKUNFT BLEIBT WAHR. Das Feld entscheidet über den KANDIDATEN,
  // nie über den TREFFER: die Entscheidung je Bild bleibt am Rumpf.
  it("F4 · Kandidat über die Benennung, aber nur das passende Bild wird Treffer", async () => {
    const { app, autor } = await setup();
    await anlegen(app, autor, {
      title: "Wartungsplan",
      statement: "Kurzfassung ohne das Suchwort.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml: `${nurBenanntesBild("b1", NAME)}${nurBenanntesBild("b2", "ventil-links.png")}`,
    });
    const res = await bildsuche(app, autor, SUCHWORT);
    expect(res.json.treffer.map((t) => t.imageId)).toEqual(["b1"]);
    expect(res.json.treffer[0]?.gefundenUeber).toEqual(["name"]);
  });

  // NICHTS WIRD ERFUNDEN: ein Bild ohne `alt` hat keine Benennung, ein Alt-Platzhalter ist keine.
  it("F5 · ohne alt und beim Platzhaltertext bleibt die Benennung leer — kein Treffer, kein geratener Name", async () => {
    const { app, autor } = await setup();
    const ko = await anlegen(app, autor, {
      title: "Wartungsplan",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml:
        '<figure data-image-id="o1"><img data-image-id="o1" src="/api/objects/o1/raw"></figure>' +
        '<figure data-image-id="p1"><img data-image-id="p1" src="/api/objects/p1/raw" ' +
        'alt="Noch keine Bildbeschreibung"></figure>',
    });
    const gespeichert = await app
      .inject({ method: "GET", url: `/api/kos/${ko}`, headers: autor })
      .then((r) => r.json() as { imageNames?: string[] });
    expect(gespeichert.imageNames).toEqual([]);
    expect((await bildsuche(app, autor, "Bildbeschreibung")).json.treffer).toEqual([]);
  });
});

// ================================================================================================
// DER ALTBESTAND — DER BESTAND DER VORFÜHRUNG
// ================================================================================================
//
// Die naheliegende Halbheit wäre „nur neu gespeicherte Objekte finden". Ein KO, das VOR dieser
// Regel geschrieben wurde, trägt `captionTexts`, aber kein `imageNames`. Es bleibt deshalb
// Kandidat (fehlendes Feld heißt „unbekannt", nicht „keine Namen") und wird über seinen Rumpf
// gefunden — und der Wartungslauf zieht das Feld in DERSELBEN einen Vollladung nach, aus der auch
// Fußnoten und Projektion entstehen (G27). Danach kostet die Suche wieder das, was sie kosten soll.
//
// KEIN SUCHWEG STÖSST DEN NACHZUG AN — das ist Entscheidung 04 §5 / G27 R1 und bleibt so.
describe("JOB 3111 · B1b — Altbestand ohne imageNames", () => {
  function zaehlendesRepo(inner: InMemoryKoRepo) {
    const vollladungen = new Map<string, number>();
    const repo: KoRepo = {
      insert: (ko) => inner.insert(ko),
      update: (ko) => inner.update(ko),
      delete: (id, tx) => inner.delete(id, tx),
      bumpTrust: (id, step, maxTrust, tx) => inner.bumpTrust(id, step, maxTrust, tx),
      list: (filter) => inner.list(filter),
      listForSearch: (filter, trim) => inner.listForSearch(filter, trim),
      listByIds: (ids) => inner.listByIds(ids),
      findByImportCandidateId: (candidateId) => inner.findByImportCandidateId(candidateId),
      findByCreateOperation: (opId, actor) => inner.findByCreateOperation(opId, actor),
      findCandidates: (query) => inner.findCandidates(query),
      setCaptionTexts: (id, captionTexts) => inner.setCaptionTexts(id, captionTexts),
      setImageNames: (id, imageNames) => inner.setImageNames(id, imageNames),
      // Die Arbeitsliste reicht NUR Kennungen — sie darf die Vollladungszählung nicht bewegen.
      missingImageNames: (limit) => inner.missingImageNames(limit),
      setAiCheck: (id, aiCheck) => inner.setAiCheck(id, aiCheck),
      resolveAiCheck: (id, patch, expectedKoVersion) =>
        inner.resolveAiCheck(id, patch, expectedKoVersion),
      findById: (id) => {
        vollladungen.set(id, (vollladungen.get(id) ?? 0) + 1);
        return inner.findById(id);
      },
    };
    return { repo, vollladungen };
  }

  // ================================================================================================
  // DER ALTBESTAND, WIE ER WIRKLICH AUSSIEHT — UND DER WARTUNGSEINSTIEG, DEN ES WIRKLICH GIBT.
  // ================================================================================================
  //
  // BENS R1-ROT, wörtlich: „Den bestehenden Wartungsweg auch auf Objekte mit vorhandener
  // Suchprojektion und fehlendem `imageNames` anwenden." Genau das ist der reale Altbestand: jedes
  // Objekt, das nach G27 (Suchprojektion) und vor B1b geschrieben wurde, hat Projektion,
  // Metadatenzeile und `captionTexts` — und KEINE Benennungen. Die alte Arbeitsliste
  // (`missingActive`) sieht solche Objekte per Konstruktion nie; der Nachzug erreichte sie nicht.
  //
  // Deshalb baut dieser Fall die Fixture NICHT von Hand zusammen, sondern über den echten
  // Schreibweg (`POST /api/kos`) und nimmt danach AUSSCHLIESSLICH `imageNames` wieder heraus. Und
  // er läuft über `reconcileSearchProjections()` — den Wartungseinstieg, den das Produkt wirklich
  // benutzt (tools/bodytext-nachziehen.ts) —, nicht über einen direkten `ensure*`-Aufruf.
  it("F6 · Altbestand MIT Projektion, ohne Benennungen: der echte Wartungslauf zieht sie nach — eine Vollladung je Objekt, danach ist der fremde Rumpf aus dem Spiel", async () => {
    let gezaehlt!: ReturnType<typeof zaehlendesRepo>;
    const { app, services, inner, autor } = await setup((i) => {
      gezaehlt = zaehlendesRepo(i);
      return gezaehlt.repo;
    });
    const treffer = await anlegen(app, autor, {
      title: "Wartungsplan",
      statement: "Kurzfassung ohne das Suchwort.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml: nurBenanntesBild("a1", NAME),
    });
    const fremd = await anlegen(app, autor, {
      title: "Dichtungsplan",
      statement: "Kurzfassung ohne das Suchwort.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml: nurBenanntesBild("a2", "dichtring.png"),
    });

    // PRÄMISSE DER FIXTURE, gemessen statt behauptet: der Bestand ist VOLLSTÄNDIG nachgezogen.
    expect(await services.ko.reconcileSearchProjections()).toEqual({
      offenVorher: 0,
      nachgezogen: 0,
      differenz: 0,
    });

    // … und jetzt der Legacy-Zustand: NUR `imageNames` fällt weg. Projektion, Metadatenzeile und
    // `captionTexts` bleiben unangetastet — das ist der Bestand zwischen G27 und B1b.
    for (const id of [treffer, fremd]) {
      const ko = await inner.findById(id);
      const { imageNames: _weg, ...ohneBenennungen } = ko as KnowledgeObject;
      await inner.update(ohneBenennungen as KnowledgeObject);
      const legacy = await inner.findById(id);
      expect(legacy?.imageNames).toBeUndefined();
      expect(legacy?.captionTexts).toBeDefined();
    }
    const nachAufbau = new Map(gezaehlt.vollladungen);
    const seitAufbau = (id: string) =>
      (gezaehlt.vollladungen.get(id) ?? 0) - (nachAufbau.get(id) ?? 0);

    // Die Suche findet ihn weiterhin — über den Rumpf, denn ohne Feld ist JEDES Objekt Kandidat.
    const erste = await bildsuche(app, autor, SUCHWORT);
    expect(erste.status, erste.body).toBe(200);
    expect(erste.json.treffer.map((t) => t.koId)).toEqual([treffer]);
    expect(seitAufbau(treffer)).toBe(1);
    expect(seitAufbau(fremd)).toBe(1);

    // DER WARTUNGSEINSTIEG DES PRODUKTS. Er sieht die Arbeit jetzt (offenVorher = 2), erledigt sie
    // und meldet die Differenz null — vor dieser Runde meldete er über demselben Bestand
    // {offenVorher: 0, nachgezogen: 0, differenz: 0} und schrieb nichts.
    expect(await services.ko.reconcileSearchProjections()).toEqual({
      offenVorher: 2,
      nachgezogen: 2,
      differenz: 0,
    });
    expect((await inner.findById(treffer))?.imageNames).toEqual([NAME]);
    expect((await inner.findById(fremd))?.imageNames).toEqual(["dichtring.png"]);
    // EINE Vollladung je Objekt — der Nachzug teilt sie mit Projektion und Fußnoten (G27).
    expect(seitAufbau(treffer)).toBe(2);
    expect(seitAufbau(fremd)).toBe(2);

    // Ein zweiter Lauf ist ein echtes No-op: keine Arbeit, keine Vollladung.
    expect(await services.ko.reconcileSearchProjections()).toEqual({
      offenVorher: 0,
      nachgezogen: 0,
      differenz: 0,
    });
    expect(seitAufbau(treffer)).toBe(2);
    expect(seitAufbau(fremd)).toBe(2);

    const zweite = await bildsuche(app, autor, SUCHWORT);
    expect(zweite.json.treffer.map((t) => t.koId)).toEqual([treffer]);
    // Der Treffer braucht seinen Rumpf weiterhin (die Entscheidung je Bild fällt dort) — das
    // FREMDE Objekt aber nicht mehr: es ist kein Kandidat mehr, sein Rumpf bleibt liegen.
    expect(seitAufbau(treffer)).toBe(3);
    expect(seitAufbau(fremd)).toBe(2);
  });

  it("F7 · setImageNames überschreibt NIE — der nebenläufige Voll-Write gewinnt (Vertrag repo.ts)", async () => {
    const repo = new InMemoryKoRepo();
    await repo.insert(legacyKo("race", nurBenanntesBild("a1", NAME), []));
    expect(await repo.setImageNames("race", [NAME])).toBe(true);
    expect((await repo.findById("race"))?.imageNames).toEqual([NAME]);
    // Ein spät ankommender Nachzug mit ALTEM Scan darf die frischen Namen nicht clobbern.
    expect(await repo.setImageNames("race", ["veralteter-scan.png"])).toBe(false);
    expect((await repo.findById("race"))?.imageNames).toEqual([NAME]);
    // Reiner Cache-Write: keine Version, kein Status, keine Historie bewegt sich.
    const stand = await repo.findById("race");
    expect(stand?.rowVersion).toBe(3);
    expect(stand?.version).toBe(1);
    expect(stand?.history).toEqual([]);
  });

  it("F8 · der Deckel gilt auch für Benennungen: 200 Bilder → höchstens MAX_CAPTIONS_PER_KO Namen", async () => {
    const { app, autor } = await setup();
    const body = Array.from({ length: 200 }, (_, i) =>
      nurBenanntesBild(`d${i}`, `bild-${i}.png`),
    ).join("");
    const ko = await anlegen(app, autor, {
      title: "Bilderflut",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml: body,
    });
    const gespeichert = await app
      .inject({ method: "GET", url: `/api/kos/${ko}`, headers: autor })
      .then((r) => r.json() as { imageNames?: string[] });
    expect(gespeichert.imageNames?.length).toBe(MAX_CAPTIONS_PER_KO);
    expect(gespeichert.imageNames?.[0]).toBe("bild-0.png");
    expect(gespeichert.imageNames?.[MAX_CAPTIONS_PER_KO - 1]).toBe(
      `bild-${MAX_CAPTIONS_PER_KO - 1}.png`,
    );
  });

  // BENS R1-PRÜFLÜCKE 6a: F7 misst zwei Repo-Writes hintereinander — den Race des DIENSTES misst es
  // nicht. Hier steckt der nebenläufige Voll-Write genau im Fenster zwischen Scan und bedingtem
  // Write: der Nachzug no-opt, und der Dienst muss die FRISCHEN Werte nachladen statt seinen alten
  // Scan zurückzugeben. Der Preis dafür ist gedeckelt: GENAU EIN zusätzlicher Read.
  it("F9 · Dienst-Race: Voll-Write zwischen Scan und Write → ensureImageNames liefert die FRISCHEN Namen, mit genau einem Nachladen", async () => {
    const inner = new InMemoryKoRepo();
    // captionTexts sind bereits gesetzt — offen ist nur die Benennung (der Zustand nach G27).
    await inner.insert(legacyKo("dienst-race", nurBenanntesBild("a1", NAME), ["Ventil am Kopf"]));
    let oeffne!: () => void;
    const tor = new Promise<void>((r) => {
      oeffne = r;
    });
    let vollladungen = 0;
    const repo: KoRepo = {
      insert: (ko) => inner.insert(ko),
      update: (ko) => inner.update(ko),
      delete: (id, tx) => inner.delete(id, tx),
      bumpTrust: (id, step, maxTrust, tx) => inner.bumpTrust(id, step, maxTrust, tx),
      list: (filter) => inner.list(filter),
      listForSearch: (filter, trim) => inner.listForSearch(filter, trim),
      listByIds: (ids) => inner.listByIds(ids),
      findByImportCandidateId: (candidateId) => inner.findByImportCandidateId(candidateId),
      findByCreateOperation: (opId, actor) => inner.findByCreateOperation(opId, actor),
      findCandidates: (query) => inner.findCandidates(query),
      setCaptionTexts: (id, captionTexts) => inner.setCaptionTexts(id, captionTexts),
      missingImageNames: (limit) => inner.missingImageNames(limit),
      setAiCheck: (id, aiCheck) => inner.setAiCheck(id, aiCheck),
      resolveAiCheck: (id, patch, expectedKoVersion) =>
        inner.resolveAiCheck(id, patch, expectedKoVersion),
      findById: (id) => {
        vollladungen += 1;
        return inner.findById(id);
      },
      setImageNames: async (id, imageNames) => {
        await tor;
        return inner.setImageNames(id, imageNames);
      },
    };
    const dienst = new KoService({ repo });
    const laufend = dienst.ensureImageNames("dienst-race");
    await new Promise((r) => setTimeout(r, 10));
    // Der nebenläufige Voll-Write (revise) persistiert FRISCHE Benennungen …
    const stand = await inner.findById("dienst-race");
    await inner.update({ ...(stand as KnowledgeObject), imageNames: ["frische-benennung.png"] });
    oeffne();
    // … der bedingte Nachzug no-opt (inserted false) → der Aufrufer bekommt die NACHGELADENEN
    // Werte, nie den alten Scan.
    expect(await laufend).toEqual(["frische-benennung.png"]);
    expect((await inner.findById("dienst-race"))?.imageNames).toEqual(["frische-benennung.png"]);
    // Der Nachzug selbst hat GENAU zweimal geladen: der eine Rumpf-Read und das eine Nachladen.
    expect(vollladungen).toBe(2);
  });

  // BENS R1-PRÜFLÜCKE 6b: die beiden Kanten des Scanners, gemessen am Persistenzpfad (nicht an der
  // Funktion allein) — zwanzigmal dasselbe Logo ist EIN Name, und ein überlanger `alt` wird hart
  // geschnitten statt den Index zu fluten.
  it("F10 · Duplikate zählen einmal, ein 600-Zeichen-Name wird auf MAX_CAPTION_TEXT_LENGTH geschnitten", async () => {
    const { app, autor } = await setup();
    const lang = `${"x".repeat(592)}ZIELWORT`; // exakt 600 Zeichen
    const ko = await anlegen(app, autor, {
      title: "Wartungsplan",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      bodyHtml:
        nurBenanntesBild("w1", "logo.png") +
        nurBenanntesBild("w2", "logo.png") +
        nurBenanntesBild("w3", "logo.png") +
        nurBenanntesBild("w4", lang),
    });
    const gespeichert = await app
      .inject({ method: "GET", url: `/api/kos/${ko}`, headers: autor })
      .then((r) => r.json() as { imageNames?: string[] });
    expect(gespeichert.imageNames?.length).toBe(2);
    expect(gespeichert.imageNames?.[0]).toBe("logo.png");
    expect(gespeichert.imageNames?.[1]?.length).toBe(MAX_CAPTION_TEXT_LENGTH);
    // Ehrlicher Schnitt: kein Ellipsis-Fake im Index — und das abgeschnittene Wort ist wirklich weg.
    expect(gespeichert.imageNames?.[1]).toBe("x".repeat(MAX_CAPTION_TEXT_LENGTH));
    expect((await bildsuche(app, autor, "ZIELWORT")).json.treffer).toEqual([]);
  });

  // DIE GEFAHR, DIE DIE NEUE ARBEITSLISTE SELBST MITBRINGT: ein getrashtes Objekt ohne Benennungen
  // darf nicht in ihr hängen bleiben. Der Nachzug rührt Papierkorb-Objekte nicht an — stünden sie
  // in der Liste, bliebe die Differenz des Reconcile für immer > 0, und damit gäbe es NIE wieder
  // eine Projektionsfreigabe. Deshalb trägt das Prädikat denselben Papierkorbfilter wie
  // `missingActive` (In-Memory hier, in SQL `NOT (data ? 'deletedAt')`).
  it("F11 · Papierkorb hängt nicht in der Arbeitsliste — der Reconcile kommt auf null", async () => {
    const repo = new InMemoryKoRepo();
    await repo.insert(legacyKo("papierkorb", nurBenanntesBild("a1", NAME), []));
    expect(await repo.missingImageNames(10)).toEqual(["papierkorb"]);
    const ko = await repo.findById("papierkorb");
    await repo.update({ ...(ko as KnowledgeObject), deletedAt: new Date().toISOString() });
    expect(await repo.missingImageNames(10)).toEqual([]);
    expect(await new KoService({ repo }).reconcileSearchProjections()).toEqual({
      offenVorher: 0,
      nachgezogen: 0,
      differenz: 0,
    });
  });
});
