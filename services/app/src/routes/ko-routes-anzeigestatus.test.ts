// ================================================================================================
// JOB 3024 · DER LESEPFAD SAGT DEN ECHTEN ZUSTAND — UND WAS ER DAFUER NICHT GEPRUEFT HAT.
// ================================================================================================
//
// WAS DIESE DATEI MISST. `GET /api/kos/:id` gab bis JOB 3024 den Kern-Enum `offen|validiert`
// unveraendert heraus. Ein Objekt, das ein Peer ROT bewertet hat, war an dieser Route von einem
// Objekt, das noch niemand angesehen hat, nicht zu unterscheiden — beide hiessen „offen"
// (`services/validation/src/trust.ts:46`: `down` haelt den Status auf „offen"). Genau diese
// Verwechslung ist der Kern des Auftrags.
//
// DER KERNFALL IST B, und er ist als KALIBRIERUNG gebaut: derselbe Testfall legt ZWEI Objekte an,
// eines rot bewertet, eines unberuehrt, und verlangt, dass sich die Antworten UNTERSCHEIDEN. Ein
// Feld, das pauschal einen Wert liefert, faellt daran durch — anders als bei einer Einzelzusage.
//
// A/C/D pinnen die drei anderen Zusagen: die offene Zuweisung (`pruefung`), das validierte Objekt
// ohne anstehende Re-Validierung (seit JOB 3054 ein ERHOBENER Eingang, s. Fall C) und den Konflikt
// als ausdruecklich UNGEPRUEFTEN. E haelt fest, dass `entwurf` an dieser Route nicht entstehen
// KANN, F das Tor vor der Anreicherung, G die Lese-Sicht ohne Schreibweg.
//
// H, I, J UND K KAMEN NACH DER PRUEFUNG DAZU, jeder gegen einen benannten roten Befund:
//   H  Der ECHTE Nutzerweg `rate:down → admin-validate → GET`, ueber die Routen gefahren. Die
//      fruehere Fassung holte die Stimmen ueber `board()` und uebersprang sie damit fuer alles, was
//      nicht offen ist — die rote Stimme verschwand hinter „validiert", obwohl `displayStatus`
//      `rejected` VOR `validiert` prueft und ein Admin-Override keine Bewertung loescht. H misst am
//      Bestand nach, dass die Stimme da ist, und verlangt `abgelehnt` mit `bewertungen: geprueft`.
//   I  Die Gegenrichtung: eine rote Stimme auf eine INZWISCHEN REVIDIERTE Fassung darf das Objekt
//      nicht weiter „abgelehnt" nennen (SCRUM-507 R2). Ohne I waere H mit „zaehle jede Stimme" zu
//      bestehen.
//   J  Der Abfragefehler, dauerhaft gepinnt: faellt die Bewertungsablage aus, sagt die Antwort
//      „ungeprueft" mit Grund — nie eine unmarkierte Tatsachenaussage.
//   K  Der Aufwand als MESSUNG statt als Prosa: ein Detailabruf kostet GENAU EINE Bewertungsabfrage,
//      auch wenn neun gleichartige Fremdobjekte danebenliegen. Der `board()`-Weg kostete zehn.
//
// BAUART UEBERNOMMEN, NICHT ERFUNDEN: Vorrichtung, Anmeldung und Rollenkonten sind die aus
// `ko-routes-stufenauskunft.test.ts` (JOB 3009). Die Dienste entstehen ueber
// `assembleServices(inMemoryRepos())`, weil Zuweisungen und Bewertungen ueber die Dienste gesetzt
// werden muessen — ueber die Routen ginge es nur mit Rollen, die den Fall verwaessern.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type AppRepos, assembleServices, buildApp, inMemoryRepos } from "../build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };
type Herkunft = Record<string, unknown> & { ungeprueft: Record<string, string> };
type Antwort = Record<string, unknown> & {
  anzeigestatus?: string;
  anzeigestatusHerkunft?: Herkunft;
};

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
 * Der erste registrierte Nutzer wird Admin (und darf jedes Objekt oeffnen). Der zweite ist ein
 * Experte OHNE `ko.validate` und ausdruecklich NICHT Autor der Pruefobjekte — er ist der Zugewiesene
 * in A, der Bewertende in B und die Gegenprobe fuer das Tor in F.
 */
async function setup(): Promise<{
  app: App;
  repos: AppRepos;
  services: ReturnType<typeof assembleServices>;
  pruefer: Auth;
  fremd: Auth;
  fremdId: string;
}> {
  const repos = inMemoryRepos();
  const services = assembleServices(repos);
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pruefer", email: "pruefer@j3024.test", password: "geheim12345" },
  });
  const pruefer = await login(app, "pruefer@j3024.test", "geheim12345");
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: pruefer,
    payload: {
      name: "Fremd",
      email: "fremd@j3024.test",
      password: "geheim12345",
      role: "experte",
    },
  });
  if (angelegt.statusCode !== 201) {
    throw new Error(`Konto fremd nicht angelegt: ${angelegt.statusCode} ${angelegt.body}`);
  }
  const fremdId = String((angelegt.json() as { id?: unknown }).id ?? "");
  if (!fremdId) {
    throw new Error(`Vorbedingung: das angelegte Konto traegt eine Kennung (${angelegt.body}).`);
  }
  return {
    app,
    repos,
    services,
    pruefer,
    fremd: await login(app, "fremd@j3024.test", "geheim12345"),
    fremdId,
  };
}

async function anlegen(
  services: ReturnType<typeof assembleServices>,
  titel: string,
): Promise<{ id: string }> {
  return services.ko.create({
    title: titel,
    statement: `Kerntext zu ${titel}.`,
    type: "best_practice",
    category: "Anlage 1",
    author: "u-autor",
  });
}

async function detail(app: App, wer: Auth, id: string): Promise<Antwort> {
  const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: wer });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Antwort;
}

/**
 * Die gespeicherten Peer-Stimmen eines Objekts — gelesen an der Ablage, nicht an einem Dienst.
 *
 * Der Weg geht bewusst ueber die Vorrichtung (`AppRepos.ratings`) und nicht ueber die Route: der
 * Test muss den BESTAND kennen, um zu belegen, dass eine Stimme wirklich da ist, waehrend die Route
 * sie nicht sieht. Genau diese Differenz ist der Gegenstand von Fall H.
 */
async function repoStimmen(repos: AppRepos, koId: string): Promise<string[]> {
  return (await repos.ratings.listByKo(koId)).map((r) => r.verdict);
}

function herkunftVon(voll: Antwort): Herkunft {
  const h = voll.anzeigestatusHerkunft;
  if (!h) {
    throw new Error(`Die Antwort traegt keine Herkunft: ${JSON.stringify(voll).slice(0, 400)}`);
  }
  return h;
}

describe("JOB 3024 · der Anzeigestatus am Detailabruf, mit ausgewiesener Herkunft", () => {
  it("A · ZUWEISUNG: ein offenes Objekt mit offener Zuweisung heisst `pruefung`, nicht `offen`", async () => {
    const { app, services, pruefer, fremdId } = await setup();
    const zugewiesen = await anlegen(services, "Objekt mit offener Zuweisung");
    const unberuehrt = await anlegen(services, "Objekt ohne jede Zuweisung");
    await services.validation.assign(zugewiesen.id, [fremdId], "u-admin");

    // KALIBRIERUNG ZUERST: ohne das unberuehrte Gegenstueck bewiese die Zeile darunter nichts —
    // ein Feld, das immer „pruefung" saegt, kaeme sonst durch.
    const ohne = await detail(app, pruefer, unberuehrt.id);
    expect(ohne.anzeigestatus).toBe("offen");

    const mit = await detail(app, pruefer, zugewiesen.id);
    expect(mit.anzeigestatus).toBe("pruefung");
    // Der Kern-Enum bleibt unangetastet — die Anzeigestufe tritt NEBEN ihn, nicht an seine Stelle.
    expect(mit.status).toBe("offen");
    expect(herkunftVon(mit).zuweisungen).toBe("geprueft");
    expect(herkunftVon(mit).status).toBe("geprueft");
  });

  it("B · KERNFALL: ein rot bewertetes Objekt heisst `abgelehnt` und ist vom unberuehrten unterscheidbar", async () => {
    const { app, services, pruefer, fremdId } = await setup();
    const rot = await anlegen(services, "Objekt mit roter Peer-Bewertung");
    const unberuehrt = await anlegen(services, "Objekt, das niemand angesehen hat");
    await services.validation.rate(rot.id, fremdId, "down");

    // VORBEDINGUNG, gemessen und nicht vermutet: der Kern-Enum sagt fuer BEIDE dasselbe. Genau
    // deshalb war der Unterschied an dieser Route bis JOB 3024 nicht sichtbar.
    const rohRot = await services.ko.get(rot.id);
    const rohOhne = await services.ko.get(unberuehrt.id);
    expect(rohRot?.status).toBe("offen");
    expect(rohOhne?.status).toBe("offen");

    const mitRot = await detail(app, pruefer, rot.id);
    const ohne = await detail(app, pruefer, unberuehrt.id);

    expect(mitRot.anzeigestatus).toBe("abgelehnt");
    expect(ohne.anzeigestatus).toBe("offen");
    expect(mitRot.anzeigestatus).not.toBe(ohne.anzeigestatus);
    expect(herkunftVon(mitRot).bewertungen).toBe("geprueft");
    expect(herkunftVon(ohne).bewertungen).toBe("geprueft");
  });

  it("C · VALIDIERT: die Antwort sagt `validiert`, NACHDEM sie nach der Re-Validierung gesehen hat", async () => {
    const { app, services, pruefer } = await setup();
    const fertig = await anlegen(services, "Objekt, das durch ist");
    await services.validation.adminValidate(fertig.id, "u-admin");
    expect((await services.ko.get(fertig.id))?.status).toBe("validiert");

    const voll = await detail(app, pruefer, fertig.id);
    expect(voll.anzeigestatus).toBe("validiert");

    // ============================================================================================
    // JOB 3054 HAT DIESEN FALL UMGEDREHT — und das ist die Ablösung, nicht ein gelockerter Test.
    // ============================================================================================
    //
    // Bis JOB 3054 stand hier `revalidierung: "ungeprueft"` mit einem benannten Grund: der einzige
    // Weg zur Merkerlage war `pendingRevalidation()`, ein SCHREIBweg (SCRUM-420). „validiert" hiess
    // deshalb ausdruecklich nicht „nicht faellig". Seit der schreibfreien Mengenabfrage
    // (`LifecycleService.revalidierungAnstehtFuer`) wird nachgesehen — und erst DANACH darf die
    // Abwesenheit behauptet werden. Der volle Zustandssatz steht in
    // `tests/anzeigestatus-revalidierung/revalidierung-wird-erhoben.test.ts` (R-1 bis R-8).
    const h = herkunftVon(voll);
    expect(h.revalidierung).toBe("geprueft");
    // KEIN RESTGRUND: „geprueft" und ein Enthaltungsgrund im selben Atemzug waeren zwei Aussagen
    // ueber denselben Eingang.
    expect(Object.keys(h.ungeprueft)).not.toContain("revalidierung");
    expect(voll.anzeigestatus).not.toBe("revalidierung");

    // ABER: die Stimmenlage IST erhoben, auch an einem nicht offenen Objekt. Genau daran hing der
    // tragende Fehler der frueheren Fassung, die die Abfrage fuer alles ausser „offen" uebersprang
    // (s. Fall H). „validiert" steht hier also, WEIL nachgesehen wurde und keine rote Stimme
    // vorliegt — nicht, weil niemand hingesehen hat.
    expect(h.bewertungen).toBe("geprueft");
    expect(h.zuweisungen).toBe("geprueft");
  });

  it("H · ECHTER NUTZERWEG: rate:down → admin-validate → GET meldet `abgelehnt`, nicht `validiert`", async () => {
    const { app, repos, services, pruefer } = await setup();
    const strittig = await anlegen(services, "Objekt mit roter Stimme und Admin-Freigabe");

    // Beide Schritte ueber die ECHTEN Routen — nicht ueber die Dienste. Der Pruefer ist Admin und
    // traegt damit `ko.validate` wie `users.manage`.
    const bewertet = await app.inject({
      method: "PUT",
      url: `/api/kos/${strittig.id}`,
      headers: pruefer,
      payload: { action: "rate", verdict: "down" },
    });
    expect(bewertet.statusCode, bewertet.body).toBe(200);
    const freigegeben = await app.inject({
      method: "PUT",
      url: `/api/kos/${strittig.id}`,
      headers: pruefer,
      payload: { action: "admin-validate" },
    });
    expect(freigegeben.statusCode, freigegeben.body).toBe(200);

    // VORBEDINGUNG, gemessen: der Kern-Enum steht auf „validiert", und die rote Stimme ist NICHT
    // verschwunden — ein Admin-Override loescht keine Peer-Bewertung.
    expect((await services.ko.get(strittig.id))?.status).toBe("validiert");
    const stimmen = await repoStimmen(repos, strittig.id);
    expect(stimmen.filter((v) => v === "down")).toHaveLength(1);

    const voll = await detail(app, pruefer, strittig.id);
    const h = herkunftVon(voll);

    // ============================================================================================
    // DER VERTRAG VON `displayStatus`: `rejected` STEHT VOR `validiert`.
    // ============================================================================================
    //
    // display-status.ts:38-43 prueft `rejected` VOR `validiert`, und `adminValidate` loescht keine
    // Peer-Bewertung — der Bestand oben belegt, dass die rote Stimme noch da ist. Die richtige
    // Stufe ist deshalb „abgelehnt", nicht „validiert".
    //
    // GENAU HIER LAG DER TRAGENDE FEHLER: Solange der Detailabruf die Stimmen ueber `board()` holte,
    // blieben sie fuer ein nicht offenes Objekt ungefragt, und die Antwort meldete „validiert" —
    // ein Herkunftstext haette den falschen Anzeigestatus nicht berichtigt. Seit die Route
    // `validation.pruefstandFuer` ohne Statusvorbehalt ruft, kommt die Stimme an.
    expect(voll.anzeigestatus).toBe("abgelehnt");
    expect(h.bewertungen).toBe("geprueft");
    expect(h.zuweisungen).toBe("geprueft");
    // Der Kern-Enum bleibt daneben unveraendert stehen — die Anzeigestufe tritt NEBEN ihn.
    expect(voll.status).toBe("validiert");
  });

  it("I · VERALTETE STIMME: eine rote Stimme auf eine revidierte Fassung macht nicht `abgelehnt`", async () => {
    const { app, services, pruefer } = await setup();
    const revidiert = await anlegen(
      services,
      "Objekt, das nach der roten Stimme ueberarbeitet wurde",
    );
    await services.validation.rate(revidiert.id, "u-pruefer", "down");

    // KALIBRIERUNG: VOR der Revision zieht die rote Stimme — sonst bewiese die Zeile danach nichts.
    expect((await detail(app, pruefer, revidiert.id)).anzeigestatus).toBe("abgelehnt");

    const vorher = (await services.ko.get(revidiert.id))?.version ?? 0;
    await services.ko.revise(revidiert.id, { statement: "Ueberarbeiteter Kerntext." }, "u-autor");
    const nachher = (await services.ko.get(revidiert.id))?.version ?? 0;
    expect(nachher, "Vorbedingung: die Revision hat die Fassung erhoeht").toBeGreaterThan(vorher);

    // SCRUM-507 R2: nur Stimmen der AKTUELLEN Fassung werten. Die alte Stimme bleibt als Historie
    // erhalten, darf das ueberarbeitete Objekt aber nicht weiter „abgelehnt" nennen.
    const voll = await detail(app, pruefer, revidiert.id);
    expect(voll.anzeigestatus).not.toBe("abgelehnt");
    expect(herkunftVon(voll).bewertungen).toBe("geprueft");
  });

  it("J · ABFRAGEFEHLER: Zuweisungen und Bewertungen werden ungeprueft gemeldet, nie still `offen`", async () => {
    const { app, repos, services, pruefer, fremdId } = await setup();
    const zugewiesen = await anlegen(services, "Objekt, dessen Pruefstand nicht erreichbar ist");
    await services.validation.assign(zugewiesen.id, [fremdId], "u-admin");

    // KALIBRIERUNG ZUERST: solange die Abfrage traegt, sagt die Route „pruefung"/„geprueft".
    const heil = await detail(app, pruefer, zugewiesen.id);
    expect(heil.anzeigestatus).toBe("pruefung");
    expect(herkunftVon(heil).bewertungen).toBe("geprueft");

    // Der Ausfall wird an der ECHTEN Datenquelle erzeugt, nicht am Dienst — so faellt genau das aus,
    // was im Betrieb ausfaellt (Verbindung, Abfrage), und der Weg darueber bleibt unangetastet.
    repos.ratings.listByKo = () => Promise.reject(new Error("Bewertungsablage nicht erreichbar"));

    const kaputt = await detail(app, pruefer, zugewiesen.id);
    const h = herkunftVon(kaputt);
    expect(h.bewertungen).toBe("ungeprueft");
    expect(h.zuweisungen).toBe("ungeprueft");
    expect(String(h.ungeprueft.bewertungen).length).toBeGreaterThan(20);
    expect(String(h.ungeprueft.zuweisungen).length).toBeGreaterThan(20);
    // KEINE UNMARKIERTE TATSACHENAUSSAGE: die Stufe faellt zwar auf „offen" zurueck, aber die
    // Antwort sagt im selben Atemzug, dass die beiden entscheidenden Eingaenge nicht erhoben wurden.
    // `status` bleibt der einzige geprueft gemeldete Eingang.
    expect(h.status).toBe("geprueft");
    expect(kaputt.status).toBe("offen");
  });

  it("K · GEZIELT: ein Detailabruf fragt GENAU EINE Bewertungslage ab — unabhaengig von Fremdobjekten", async () => {
    // ============================================================================================
    // DIE ZAHL IST DER BEFUND, NICHT DIE PROSA.
    // ============================================================================================
    //
    // Vor JOB 3024 holte der Detailabruf die Stimmen ueber `board()`. Das laedt die Vollmenge der
    // passenden offenen Objekte und fragt JE ZEILE die Bewertungen ab: mit neun gleichartigen
    // Fremdobjekten waren es zehn Abfragen statt einer — gemessen, nicht geschaetzt. Dieselbe
    // Bauart, die §10 des Auftrags fuer die Liste ausdruecklich verwirft („N+1 ohne Deckel"), auf
    // dem heisseren Lesepfad.
    //
    // SEIT `validation.pruefstandFuer` ist der Aufwand vom Bestand ENTKOPPELT. Dieser Fall misst
    // genau das: die Zahl der `listByKo`-Abfragen darf sich nicht aendern, wenn neun voellig
    // unbeteiligte Objekte danebenliegen. Faellt der Weg auf einen Vollscan zurueck, wird er rot.
    async function abfragenBeimDetailabruf(fremdobjekte: number): Promise<number> {
      const { app, repos, services, pruefer } = await setup();
      const ziel = await anlegen(services, "Zielobjekt des Detailabrufs");
      // Gleiche Kategorie UND gleicher Typ wie das Ziel — genau die Menge, die `board()` laedt.
      for (let i = 0; i < fremdobjekte; i += 1) {
        await anlegen(services, `Fremdobjekt ${i}, geht diesen Abruf nichts an`);
      }
      let abfragen = 0;
      const echt = repos.ratings.listByKo.bind(repos.ratings);
      repos.ratings.listByKo = (koId: string) => {
        abfragen += 1;
        return echt(koId);
      };
      await detail(app, pruefer, ziel.id);
      return abfragen;
    }

    const allein = await abfragenBeimDetailabruf(0);
    const mitNeunFremden = await abfragenBeimDetailabruf(9);

    // GENAU EINE Abfrage — und dieselbe Zahl, wenn neun Fremdobjekte danebenliegen.
    expect(allein).toBe(1);
    expect(mitNeunFremden).toBe(1);
  });

  it("D · KONFLIKT: ausdruecklich ungeprueft — die Antwort behauptet nirgends `kein Konflikt`", async () => {
    const { app, services, pruefer } = await setup();
    const irgendeins = await anlegen(services, "Objekt ohne Konfliktauskunft");

    const voll = await detail(app, pruefer, irgendeins.id);
    const h = herkunftVon(voll);
    expect(h.konflikt).toBe("ungeprueft");
    expect(typeof h.ungeprueft.konflikt).toBe("string");
    expect(String(h.ungeprueft.konflikt).length).toBeGreaterThan(20);

    // KEINE GEGENBEHAUPTUNG: die Antwort traegt kein Feld, das die Konfliktfrage mit einem Wert
    // beantwortet. Ein `konflikte: 0` oder `hasConflict: false` waere genau die Unwahrheit, die
    // dieser Fall ausschliesst — der Lesepfad hat nicht nachgesehen.
    for (const verboten of ["konflikt", "konflikte", "conflicts", "hasConflict", "conflictFree"]) {
      expect(Object.keys(voll)).not.toContain(verboten);
    }
    expect(voll.anzeigestatus).not.toBe("konflikt");
  });

  it("E · `entwurf` ist an dieser Route unerreichbar — die Ableitung kennt keinen solchen Zweig", async () => {
    const { app, services, pruefer, fremdId } = await setup();

    // STRUKTURPIN: `displayStatus` fuehrt „entwurf" in der Aufzaehlung, gibt es aber in KEINEM
    // Zweig zurueck. Entwuerfe sind capture-Entitaeten und erreichen `/api/kos` nie.
    const quelle = readFileSync(
      join(__dirname, "../../../knowledge-object/src/display-status.ts"),
      "utf8",
    );
    expect(quelle).toContain('| "entwurf"');
    expect(quelle).not.toMatch(/return\s+"entwurf"/);

    // UND AM ECHTEN LESEPFAD: ueber alle Stufen, die hier ueberhaupt entstehen koennen.
    const offen = await anlegen(services, "offen");
    const inPruefung = await anlegen(services, "in Pruefung");
    const rot = await anlegen(services, "rot bewertet");
    const fertig = await anlegen(services, "validiert");
    await services.validation.assign(inPruefung.id, [fremdId], "u-admin");
    await services.validation.rate(rot.id, fremdId, "down");
    await services.validation.adminValidate(fertig.id, "u-admin");

    const stufen: string[] = [];
    for (const id of [offen.id, inPruefung.id, rot.id, fertig.id]) {
      stufen.push(String((await detail(app, pruefer, id)).anzeigestatus));
    }
    expect(stufen).toEqual(["offen", "pruefung", "abgelehnt", "validiert"]);
    expect(stufen).not.toContain("entwurf");
  });

  it("F · DAS TOR STEHT DAVOR: ein unsichtbares Objekt bleibt 404, ohne jede Anzeigestufe", async () => {
    const { app, services, pruefer, fremd } = await setup();
    const geheim = await services.ko.create({
      title: "Vertraulicher Pruefling",
      statement: "Sensibler Kerntext, der einen fremden Pruefer nichts angeht.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-jemand-anders",
      confidentiality: "vertraulich",
    });
    const offen = await anlegen(services, "Internes Alltagswissen");

    // KALIBRIERUNG: derselbe fremde Pruefer bekommt das offene Objekt samt Anzeigestufe.
    const erlaubt = await detail(app, fremd, offen.id);
    expect(erlaubt.anzeigestatus).toBe("offen");

    const verwehrt = await app.inject({
      method: "GET",
      url: `/api/kos/${geheim.id}`,
      headers: fremd,
    });
    expect(verwehrt.statusCode, verwehrt.body).toBe(404);
    expect(verwehrt.body).not.toContain("anzeigestatus");
    expect(verwehrt.body).not.toContain("Vertraulicher Pruefling");

    // Und die Gegenprobe: der Kurator oeffnet es sehr wohl, samt Stufe.
    expect((await detail(app, pruefer, geheim.id)).anzeigestatus).toBe("offen");
  });

  it("G · REINE LESE-SICHT: der Abruf schreibt nichts an den Bestand", async () => {
    const { app, repos, services, pruefer, fremdId } = await setup();
    const rot = await anlegen(services, "Objekt mit roter Bewertung");
    await services.validation.rate(rot.id, fremdId, "down");
    const vorher = JSON.stringify(await repos.koRepo.findById(rot.id));

    expect((await detail(app, pruefer, rot.id)).anzeigestatus).toBe("abgelehnt");

    const nachher = await repos.koRepo.findById(rot.id);
    expect(JSON.stringify(nachher)).toBe(vorher);
    // Die Anzeigestufe ist ABGELEITET und wandert nie in den Bestand — kein neuer Status, kein
    // Backfill, keine zweite Ablage.
    expect(Object.hasOwn(nachher as object, "anzeigestatus")).toBe(false);
    expect((nachher as { assignments: string[] }).assignments).toEqual([]);
  });
});
