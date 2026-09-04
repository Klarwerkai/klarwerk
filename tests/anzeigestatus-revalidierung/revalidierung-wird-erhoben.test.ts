// ================================================================================================
// JOB 3054 · „RE-VALIDIERUNG" WIRD ERHOBEN — AN BEIDEN LESEROUTEN, OHNE EINEN EINZIGEN SCHREIBVORGANG.
// ================================================================================================
//
// WAS DIESE DATEI MISST. Pedis Zeile verlangt sieben Zustaende je Eintrag; sechs lieferte der
// Lesepfad, `revalidierung` nicht. Ein Objekt, fuer das eine Anlagenaenderung ein „Stimmt das
// noch?" gesetzt hat, hiess an BEIDEN Leserouten weiter `validiert`, und die Antwort sagte dazu
// ehrlich „hier wurde nicht nachgesehen". Ab JOB 3054 wird nachgesehen: R-1 (Detail) und R-2
// (Liste) verlangen `revalidierung`, R-3 verlangt, dass auch die ABWESENHEIT erhoben ist — erst
// dann darf `validiert` „nicht faellig" heissen.
//
// DER GRUND, WARUM ES NICHT LAENGST SO WAR, IST DER TEURE TEIL DIESER DATEI. Das vorhandene Signal
// `LifecycleService.pendingRevalidation()` laedt die GESAMTE Merkerliste, prueft je Merker ein
// Objekt und ENTFERNT tote Merker (`lifecycle/src/service.ts:46-57`, SCRUM-420) — ein Schreibweg,
// und auf einem Lesepfad damit doppelt falsch. R-4 pinnt genau das: ein Merker auf ein nicht mehr
// vorhandenes Objekt UEBERLEBT beide Leserouten. Wer den bequemen Weg nimmt, wird dort rot.
//
// R-5 UND R-7 SIND DIE KOSTENZUSAGE, gezaehlt und nicht behauptet — eine Merkerabfrage fuer die
// ganze Liste (Muster: JOB 3043, Fall L3), und ueber dem Deckel gar keine. R-6 haelt die beiden
// Ausfaelle AUSEINANDER: die Pruefstandsabfrage und die Merkerabfrage duerfen einander nicht
// mitreissen, und keiner der beiden Ausfaelle wird je ein stilles „nicht faellig".
//
// BAUART UEBERNOMMEN, NICHT ERFUNDEN: Vorrichtung, Anmeldung und Rollenkonten stammen aus
// `tests/anzeigestatus-liste/kos-liste-anzeigestatus.test.ts` (JOB 3043). Gefahren wird ueber den
// echten Handler → echte Fastify-App → echte Dienste → echte In-Memory-Ablagen; der Merker wird
// ueber den ECHTEN Nutzerweg gesetzt (Anlage koppeln → Anlage geaendert), nicht am Repo vorbei.
import { describe, expect, it } from "vitest";
import {
  type AppRepos,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import { ANZEIGESTATUS_LISTE_DECKEL } from "../../services/app/src/routes/ko-routes";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };
type Herkunft = Record<string, unknown> & { ungeprueft: Record<string, string> };
type Antwort = Record<string, unknown> & {
  id?: string;
  status?: string;
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

async function setup(): Promise<{
  app: App;
  repos: AppRepos;
  services: ReturnType<typeof assembleServices>;
  pruefer: Auth;
}> {
  const repos = inMemoryRepos();
  const services = assembleServices(repos);
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pruefer", email: "pruefer@j3054.test", password: "geheim12345" },
  });
  return { app, repos, services, pruefer: await login(app, "pruefer@j3054.test", "geheim12345") };
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

/**
 * Ein validiertes Objekt — der einzige Ausgangszustand, an dem `revalidierung` ueberhaupt entstehen
 * kann (`display-status.ts:41-43`: der Zweig haengt an `status === "validiert"`).
 */
async function validiertesKo(
  services: ReturnType<typeof assembleServices>,
  titel: string,
): Promise<{ id: string }> {
  const ko = await anlegen(services, titel);
  await services.validation.adminValidate(ko.id, "u-admin");
  if ((await services.ko.get(ko.id))?.status !== "validiert") {
    throw new Error(`Vorbedingung: ${titel} steht auf „validiert"`);
  }
  return ko;
}

/**
 * Der Merker kommt ueber den ECHTEN Weg: eine Anlage wird gekoppelt, die Anlage aendert sich, und
 * FR-LIF-01 setzt das „Stimmt das noch?". Ein direktes `repo.markPending` wuerde denselben Zustand
 * erzeugen, aber nicht belegen, dass der Zustand im Betrieb ueberhaupt entsteht.
 */
async function anlagenaenderungMerkt(
  services: ReturnType<typeof assembleServices>,
  koId: string,
  anlage: string,
): Promise<void> {
  await services.lifecycle.couple(anlage, koId);
  const gemerkt = await services.lifecycle.assetChanged(anlage);
  if (!gemerkt.includes(koId)) {
    throw new Error(`Vorbedingung: die Anlagenaenderung hat ${koId} gemerkt (${gemerkt.join()})`);
  }
}

async function liste(app: App, wer: Auth): Promise<Antwort[]> {
  const res = await app.inject({ method: "GET", url: "/api/kos", headers: wer });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Antwort[];
}

async function detail(app: App, wer: Auth, id: string): Promise<Antwort> {
  const res = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: wer });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Antwort;
}

function eintrag(eintraege: readonly Antwort[], id: string): Antwort {
  const treffer = eintraege.find((e) => e.id === id);
  if (!treffer) {
    throw new Error(`Die Liste fuehrt ${id} nicht: ${eintraege.map((e) => e.id).join(", ")}`);
  }
  return treffer;
}

function herkunftVon(voll: Antwort): Herkunft {
  const h = voll.anzeigestatusHerkunft;
  if (!h) {
    throw new Error(`Die Antwort traegt keine Herkunft: ${JSON.stringify(voll).slice(0, 400)}`);
  }
  return h;
}

/** Die Ablagenwege, an denen der Aufwand dieses Lesepfads wirklich anfaellt. */
interface Zaehler {
  /** Die NEUE, schreibfreie Mengenabfrage der Merker (JOB 3054). */
  pendingFor: number;
  /** Der Merkerbestand als GANZES — der teure, schreibende Weg, den der Lesepfad nie nimmt. */
  pending: number;
  clearPending: number;
  /** Die zwei Abfragen aus JOB 3043, damit die neue Zusage die alte nicht verdeckt. */
  listByKos: number;
  all: number;
  /** Die Kennungsfelder, die wirklich an die Merkerabfrage gehen. */
  gereicht: string[][];
}

function zaehlerUm(repos: AppRepos): Zaehler {
  const zaehler: Zaehler = {
    pendingFor: 0,
    pending: 0,
    clearPending: 0,
    listByKos: 0,
    all: 0,
    gereicht: [],
  };
  const echtFuer = repos.lifecycleRepo.pendingFor.bind(repos.lifecycleRepo);
  repos.lifecycleRepo.pendingFor = (koIds) => {
    zaehler.pendingFor += 1;
    zaehler.gereicht.push([...koIds]);
    return echtFuer(koIds);
  };
  const echtPending = repos.lifecycleRepo.pending.bind(repos.lifecycleRepo);
  repos.lifecycleRepo.pending = () => {
    zaehler.pending += 1;
    return echtPending();
  };
  const echtClear = repos.lifecycleRepo.clearPending.bind(repos.lifecycleRepo);
  repos.lifecycleRepo.clearPending = (koId) => {
    zaehler.clearPending += 1;
    return echtClear(koId);
  };
  const echtViele = repos.ratings.listByKos.bind(repos.ratings);
  repos.ratings.listByKos = (koIds) => {
    zaehler.listByKos += 1;
    return echtViele(koIds);
  };
  const echtAlle = repos.assignments.all.bind(repos.assignments);
  repos.assignments.all = () => {
    zaehler.all += 1;
    return echtAlle();
  };
  return zaehler;
}

describe("JOB 3054 · die Re-Validierung wird an beiden Leserouten erhoben, schreibfrei", () => {
  it("R-1 · DETAIL: ein gemerktes validiertes Objekt heisst `revalidierung`, mit Herkunft `geprueft`", async () => {
    const { app, services, pruefer } = await setup();
    const gemerkt = await validiertesKo(services, "Objekt, dessen Anlage sich geaendert hat");
    const unberuehrt = await validiertesKo(services, "Objekt, dessen Anlage steht");
    await anlagenaenderungMerkt(services, gemerkt.id, "anlage-pumpe-7");

    // KALIBRIERUNG ZUERST: ohne das ungemerkte Gegenstueck bewiese die Zeile darunter nichts — ein
    // Feld, das pauschal „revalidierung" saegt, kaeme sonst durch.
    const ohne = await detail(app, pruefer, unberuehrt.id);
    expect(ohne.anzeigestatus).toBe("validiert");

    const voll = await detail(app, pruefer, gemerkt.id);
    expect(voll.anzeigestatus).toBe("revalidierung");
    expect(herkunftVon(voll).revalidierung).toBe("geprueft");
    // Der Kern-Enum bleibt daneben unveraendert stehen — die Anzeigestufe tritt NEBEN ihn.
    expect(voll.status).toBe("validiert");
  });

  it("R-2 · LISTE: derselbe Eintrag heisst auch in der Liste `revalidierung` — keine Zweitwahrheit", async () => {
    const { app, services, pruefer } = await setup();
    const gemerkt = await validiertesKo(services, "Objekt, dessen Anlage sich geaendert hat");
    const unberuehrt = await validiertesKo(services, "Objekt, dessen Anlage steht");
    await anlagenaenderungMerkt(services, gemerkt.id, "anlage-pumpe-7");

    const eintraege = await liste(app, pruefer);
    const ausListe = eintrag(eintraege, gemerkt.id);
    const ausDetail = await detail(app, pruefer, gemerkt.id);

    // DER VERGLEICH IST DER PRUEFSTEIN — der Grund fuer JOB 3043 darf nicht neu entstehen.
    expect(ausListe.anzeigestatus).toBe(ausDetail.anzeigestatus);
    expect(ausListe.anzeigestatusHerkunft).toEqual(ausDetail.anzeigestatusHerkunft);
    // KALIBRIERUNG: „gleich" allein truege nicht — zwei gleich falsche Werte waeren auch gleich.
    expect(ausListe.anzeigestatus).toBe("revalidierung");
    expect(herkunftVon(ausListe).revalidierung).toBe("geprueft");
    // Und das ungemerkte Gegenstueck in DERSELBEN Antwort unterscheidet sich.
    expect(eintrag(eintraege, unberuehrt.id).anzeigestatus).toBe("validiert");
  });

  it("R-3 · DIE ABWESENHEIT WIRD BEHAUPTET, WEIL SIE ERHOBEN IST: kein Merker → `validiert`, `geprueft`", async () => {
    const { app, services, pruefer } = await setup();
    const ohneMerker = await validiertesKo(services, "Objekt ohne jede Anlagenkopplung");

    for (const voll of [
      await detail(app, pruefer, ohneMerker.id),
      eintrag(await liste(app, pruefer), ohneMerker.id),
    ]) {
      const h = herkunftVon(voll);
      expect(voll.anzeigestatus).toBe("validiert");
      expect(h.revalidierung).toBe("geprueft");
      // KEIN RESTGRUND: „geprueft" und ein Enthaltungsgrund im selben Atemzug waeren zwei Aussagen
      // ueber denselben Eingang. Der Schluessel ist weg, nicht leer.
      expect(Object.keys(h.ungeprueft)).not.toContain("revalidierung");
      // `konflikt` bleibt unveraendert ungeprueft — dieser Auftrag hat ihn ausdruecklich nicht.
      expect(h.konflikt).toBe("ungeprueft");
      expect(String(h.ungeprueft.konflikt).length).toBeGreaterThan(20);
    }
  });

  it("R-4 · SCHREIBFREI: ein Merker ohne Objekt ueberlebt Detail- UND Listenabruf unveraendert", async () => {
    // ============================================================================================
    // DER HAERTESTE FALL DIESER DATEI.
    // ============================================================================================
    //
    // `pendingRevalidation()` ist der bequeme Weg zur Merkerlage — und er ist ein SCHREIBWEG: er
    // entfernt Merker, deren Objekt nicht mehr existiert (SCRUM-420, Selbstheilung im
    // Arbeitsbereich). Auf einem Lesepfad ist das falsch, und es ist unsichtbar falsch: die Antwort
    // saehe richtig aus, waehrend im Bestand still etwas verschwindet. Dieser Fall macht es
    // sichtbar — nimmt jemand den bequemen Weg, ist der Geistermerker nach dem Abruf weg.
    const { app, repos, services, pruefer } = await setup();
    const gemerkt = await validiertesKo(services, "Objekt, dessen Anlage sich geaendert hat");
    await anlagenaenderungMerkt(services, gemerkt.id, "anlage-pumpe-7");
    // Ein Merker auf ein Objekt, das es nicht (mehr) gibt — genau der Fall, den die Selbstheilung
    // aufraeumt und den ein LESER nie anfassen darf.
    await repos.lifecycleRepo.markPending("ko-laengst-geloescht");

    const vorher = [...(await repos.lifecycleRepo.pending())].sort();
    expect(vorher).toEqual([gemerkt.id, "ko-laengst-geloescht"].sort());

    const zaehler = zaehlerUm(repos);
    expect((await detail(app, pruefer, gemerkt.id)).anzeigestatus).toBe("revalidierung");
    expect(eintrag(await liste(app, pruefer), gemerkt.id).anzeigestatus).toBe("revalidierung");
    // ABGELESEN VOR DER NACHSCHAU: der Abzug unten ist selbst ein `pending()`-Aufruf und wuerde die
    // Zaehler sonst mit dem verfaelschen, was der Test tut statt was die Route tut.
    const waehrendDerAbrufe = { pending: zaehler.pending, clearPending: zaehler.clearPending };

    // Der Bestand ist Wort fuer Wort derselbe …
    expect([...(await repos.lifecycleRepo.pending())].sort()).toEqual(vorher);
    // … und der Lesepfad hat den schreibenden Weg gar nicht erst betreten.
    expect(waehrendDerAbrufe).toEqual({ pending: 0, clearPending: 0 });
  });

  it("R-5 · MENGENUNABHAENGIG: 50 sichtbare Eintraege kosten GENAU EINE Merkerabfrage", async () => {
    // Der naheliegende Umbau fragt je Eintrag — N+1, genau der Aufwand, wegen dessen die Liste aus
    // JOB 3024 herausblieb. Gemessen wird an der ECHTEN Ablage, nicht am Dienst (Muster: L3).
    async function abfragenBeiEintraegen(anzahl: number): Promise<Zaehler> {
      const { app, repos, services, pruefer } = await setup();
      for (let i = 0; i < anzahl; i += 1) {
        await validiertesKo(services, `Listeneintrag ${i}`);
      }
      const zaehler = zaehlerUm(repos);
      const eintraege = await liste(app, pruefer);
      expect(eintraege, "Vorbedingung: die Liste fuehrt genau die angelegten Objekte").toHaveLength(
        anzahl,
      );
      return zaehler;
    }

    const beiFuenfzig = await abfragenBeiEintraegen(50);
    const beiEinem = await abfragenBeiEintraegen(1);

    expect(beiFuenfzig.pendingFor).toBe(1);
    expect(beiEinem.pendingFor).toBe(1);
    // Die Kosten aus JOB 3043 bleiben, wie sie waren — die neue Abfrage tritt NEBEN sie.
    expect(beiFuenfzig.listByKos).toBe(1);
    expect(beiFuenfzig.all).toBe(1);
    // Und gefragt wird genau nach der sichtbaren Menge, nicht nach dem ganzen Bestand.
    expect(beiFuenfzig.gereicht).toHaveLength(1);
    expect(beiFuenfzig.gereicht[0]).toHaveLength(50);
    expect(beiFuenfzig.pending).toBe(0);
  });

  it("R-5b · LEERE LISTE: `[]` kostet keine Merkerabfrage", async () => {
    const { app, repos, pruefer } = await setup();
    const zaehler = zaehlerUm(repos);
    expect(await liste(app, pruefer)).toEqual([]);
    expect(zaehler.pendingFor).toBe(0);
  });

  it("R-6a · MERKERABFRAGE FAELLT AUS: nur `revalidierung` ist ungeprueft, mit benanntem Grund", async () => {
    const { app, repos, services, pruefer } = await setup();
    const gemerkt = await validiertesKo(services, "Objekt, dessen Merkerablage gleich ausfaellt");
    await anlagenaenderungMerkt(services, gemerkt.id, "anlage-pumpe-7");

    // KALIBRIERUNG ZUERST: solange die Abfrage traegt, sagt die Route „revalidierung"/„geprueft".
    expect((await detail(app, pruefer, gemerkt.id)).anzeigestatus).toBe("revalidierung");

    // Der Ausfall wird an der ECHTEN Datenquelle erzeugt, nicht am Dienst.
    repos.lifecycleRepo.pendingFor = () =>
      Promise.reject(new Error("Merkerablage nicht erreichbar"));

    for (const voll of [
      await detail(app, pruefer, gemerkt.id),
      eintrag(await liste(app, pruefer), gemerkt.id),
    ]) {
      const h = herkunftVon(voll);
      expect(h.revalidierung).toBe("ungeprueft");
      expect(String(h.ungeprueft.revalidierung).length).toBeGreaterThan(20);
      // DER GRUND IST EIN FEHLERGRUND, KEINE ENTHALTUNG. Bis JOB 3054 stand hier „ist hier nicht
      // erhoben. ‚validiert‘ heisst … nicht ‚nicht faellig‘" — ein Normalfall. Bliebe dieser
      // Wortlaut stehen, behauptete die Antwort etwas Falsches: erhoben WIRD, nur diesmal ist die
      // Abfrage gescheitert, und genau das muss dastehen.
      expect(String(h.ungeprueft.revalidierung)).toContain("fehlgeschlagen");
      expect(String(h.ungeprueft.revalidierung)).not.toContain("nicht faellig");
      // DIE AUSFAELLE REISSEN EINANDER NICHT MIT: die Pruefstandslage bleibt erhoben.
      expect(h.zuweisungen).toBe("geprueft");
      expect(h.bewertungen).toBe("geprueft");
      // KEINE UNMARKIERTE TATSACHENAUSSAGE: die Stufe faellt auf „validiert" zurueck, aber die
      // Antwort sagt im selben Atemzug, dass der entscheidende Eingang fehlt.
      expect(voll.anzeigestatus).toBe("validiert");
      expect(voll.status).toBe("validiert");
    }
  });

  it("R-6b · PRUEFSTANDSABFRAGE FAELLT AUS: `revalidierung` bleibt davon unberuehrt erhoben", async () => {
    const { app, repos, services, pruefer } = await setup();
    const gemerkt = await validiertesKo(services, "Objekt, dessen Pruefstand gleich ausfaellt");
    await anlagenaenderungMerkt(services, gemerkt.id, "anlage-pumpe-7");

    // Der Ausfall trifft BEIDE Lesewege der Pruefstandslage (Detail: `listByKo`, Liste:
    // `listByKos`) — und keinen von beiden darf die Merkerabfrage mitreissen.
    repos.ratings.listByKo = () => Promise.reject(new Error("Bewertungsablage nicht erreichbar"));
    repos.ratings.listByKos = () => Promise.reject(new Error("Bewertungsablage nicht erreichbar"));

    for (const voll of [
      await detail(app, pruefer, gemerkt.id),
      eintrag(await liste(app, pruefer), gemerkt.id),
    ]) {
      const h = herkunftVon(voll);
      expect(h.zuweisungen).toBe("ungeprueft");
      expect(h.bewertungen).toBe("ungeprueft");
      expect(h.revalidierung).toBe("geprueft");
      expect(Object.keys(h.ungeprueft)).not.toContain("revalidierung");
      // Der Merker traegt weiter: die Stufe bleibt `revalidierung`, obwohl der Pruefstand fehlt.
      expect(voll.anzeigestatus).toBe("revalidierung");
      expect(h.status).toBe("geprueft");
    }
  });

  it("R-7 · DECKEL: oberhalb wird auch der Merker nicht gefragt — ungeprueft mit Deckelgrund", async () => {
    const { app, repos, services, pruefer } = await setup();
    for (let i = 0; i < ANZEIGESTATUS_LISTE_DECKEL + 1; i += 1) {
      await validiertesKo(services, `Eintrag ${i} in einer Liste ueber dem Deckel`);
    }
    const zaehler = zaehlerUm(repos);
    const eintraege = await liste(app, pruefer);
    expect(eintraege).toHaveLength(ANZEIGESTATUS_LISTE_DECKEL + 1);

    // NULL Merkerabfragen — der Deckel spart die Anreicherung ganz, nicht teilweise.
    expect(zaehler.pendingFor).toBe(0);
    for (const e of eintraege) {
      const h = herkunftVon(e);
      expect(h.revalidierung, `revalidierung an ${e.id}`).toBe("ungeprueft");
      // Der Deckelgrund nennt den Deckel UND die tatsaechliche Zahl.
      expect(String(h.ungeprueft.revalidierung)).toContain(String(ANZEIGESTATUS_LISTE_DECKEL));
      expect(String(h.ungeprueft.revalidierung)).toContain(String(eintraege.length));
    }
  });

  it("R-7b · GEGENPROBE ZUM DECKEL: einer weniger, und der Merker wird ganz normal erhoben", async () => {
    const { app, repos, services, pruefer } = await setup();
    for (let i = 0; i < ANZEIGESTATUS_LISTE_DECKEL - 1; i += 1) {
      await validiertesKo(services, `Eintrag ${i} in einer Liste unter dem Deckel`);
    }
    const zaehler = zaehlerUm(repos);
    const eintraege = await liste(app, pruefer);
    expect(eintraege).toHaveLength(ANZEIGESTATUS_LISTE_DECKEL - 1);

    expect(zaehler.pendingFor).toBe(1);
    for (const e of eintraege) {
      expect(herkunftVon(e).revalidierung).toBe("geprueft");
    }
  });

  it("R-9 · DIE SELBSTHEILUNG BLEIBT: `pendingRevalidation()` raeumt weiter auf", async () => {
    // Die Schreibfreiheit des LESEwegs darf den Arbeitsbereichsweg nicht mit abschaffen (SCRUM-420).
    // Ohne diesen Fall waere R-4 auch mit einer stillgelegten Selbstheilung zu bestehen.
    const { repos, services } = await setup();
    const lebt = await validiertesKo(services, "Objekt, das es noch gibt");
    await anlagenaenderungMerkt(services, lebt.id, "anlage-pumpe-7");
    await repos.lifecycleRepo.markPending("ko-laengst-geloescht");

    expect(await services.lifecycle.pendingRevalidation()).toEqual([lebt.id]);
    expect(await repos.lifecycleRepo.pending()).toEqual([lebt.id]);
  });

  it("R-10 · DIE DIENSTGRENZE SELBST: sie antwortet nur auf uebergebene Kennungen und schreibt nicht", async () => {
    const { repos, services } = await setup();
    const gemerkt = await validiertesKo(services, "Gemerktes Objekt");
    const ohne = await validiertesKo(services, "Ungemerktes Objekt");
    await anlagenaenderungMerkt(services, gemerkt.id, "anlage-pumpe-7");
    await repos.lifecycleRepo.markPending("ko-laengst-geloescht");

    const zaehler = zaehlerUm(repos);
    const anstehend = await services.lifecycle.revalidierungAnstehtFuer([gemerkt.id, ohne.id]);
    expect([...anstehend]).toEqual([gemerkt.id]);
    // KEINE GEISTERKARTEN: der Merker ohne Objekt kann in der Antwort gar nicht vorkommen — sie
    // beantwortet ausschliesslich Kennungen, die der Lesepfad ohnehin geladen hat.
    expect([...anstehend]).not.toContain("ko-laengst-geloescht");
    expect(zaehler).toMatchObject({ pendingFor: 1, pending: 0, clearPending: 0 });

    // LEERE EINGABE: KEINE Abfrage, leere Antwort. Der Zaehler steht VOR dem Aufruf — eine leere
    // Antwort kaeme auch dann heraus, wenn die Ablage vorher befragt wurde (JOB 3043 R1, BEN).
    const leerZaehler = zaehlerUm(repos);
    expect([...(await services.lifecycle.revalidierungAnstehtFuer([]))]).toEqual([]);
    expect(leerZaehler.pendingFor).toBe(0);
  });
});
