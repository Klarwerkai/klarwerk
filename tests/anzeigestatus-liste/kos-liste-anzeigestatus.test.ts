// ================================================================================================
// JOB 3043 · AUCH DIE LISTE SAGT DEN ECHTEN ZUSTAND — UND ZWAR FUER ZWEI ABFRAGEN, NICHT ZWEI JE
// EINTRAG.
// ================================================================================================
//
// WAS DIESE DATEI MISST. Seit JOB 3024 leitet `GET /api/kos/:id` den Anzeigestatus ab und weist
// aus, was er dafuer nicht erhoben hat. `GET /api/kos` tat das NICHT: die Liste sendete das rohe
// Objekt. Ein Eintrag, den der Detailabruf `abgelehnt` nennt, hiess in der Liste `validiert` —
// zwei Lesepfade, zwei Antworten ueber dasselbe Objekt. Genau das misst L1, und zwar indem es die
// beiden Antworten GEGENEINANDER stellt statt gegen einen hingeschriebenen Sollwert: ein Umbau,
// der die Liste anders ableitet als das Detail, faellt dort auf, auch wenn beide Werte plausibel
// aussehen.
//
// DER ZWEITE TEIL DES VERSPRECHENS IST DIE KOSTENZUSAGE, und sie ist gezaehlt, nicht behauptet.
// `PRIORITAETEN.md` N4 hat die Liste fuer JOB 3024 ausdruecklich ausgeklammert („N+1 ohne
// Deckel"): der naheliegende Umbau ruft `pruefstandFuer` je Zeile und kostet damit 2·N Abfragen,
// davon N Vollscans der Zuweisungstabelle. L3 zaehlt an den ECHTEN Ablagen mit und verlangt
// dieselben Zahlen fuer einen wie fuer zehn Eintraege. L4 pinnt den Deckel: oberhalb wird GAR
// NICHT gefragt, und die ganze Antwort sagt das ueber sich — kein stiller Teilstand.
//
// L5 bis L9 halten die uebrigen Zusagen: der Abfragefehler wird nie ein stilles `offen` (L5), das
// Sichtbarkeitstor steht VOR der Anreicherung und ein unsichtbares Objekt wird nicht einmal
// abgefragt (L6), eine veraltete Stimme zaehlt auch hier nicht (L7), der Lesepfad schreibt nichts
// (L8), und Mengen- und Einzelweg leiten dieselbe Pruefstandslage ab (L9).
//
// L9 (ZWEITER TEIL), L10 UND L11 KAMEN NACH DER PRUEFUNG DAZU, gegen einen benannten Befund von
// BEN an Runde 1: die Zusagen „leere Eingabe = null Abfragen" und „doppelte Kennung nur einmal ins
// SQL" waren allein an der KARTENGROESSE gemessen — und die bleibt `0` beziehungsweise `1`, auch
// wenn beide Ablagen befragt werden und `[id, id]` ins SQL geht. Beide Gegenmutationen (Early
// Return entfernen, `Set` entfernen) blieben deshalb gruen. Gemessen wird jetzt, was der Vertrag
// sagt: die Zaehler stehen VOR dem Aufruf (L9, L10), und das uebergebene Kennungsfeld wird
// abgefangen (L9). L11 nimmt dieselbe Zusage eine Ebene tiefer — am Postgres-Adapter, dessen
// Schleife ueber `listByKo` von der API aus wie eine Mengenabfrage aussaehe.
//
// BAUART UEBERNOMMEN, NICHT ERFUNDEN: Vorrichtung, Anmeldung und Rollenkonten stammen aus
// `services/app/src/routes/ko-routes-anzeigestatus.test.ts` (JOB 3024). Gefahren wird ueber den
// echten Handler → echte Fastify-App → echten `ValidationService` → echte In-Memory-Ablagen; an
// keiner entscheidenden Stelle steht eine Attrappe, die selbst ueber das Ergebnis bestimmt.
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  type AppRepos,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import { ANZEIGESTATUS_LISTE_DECKEL } from "../../services/app/src/routes/ko-routes";
// L11 misst den Postgres-Adapter an seiner Anweisung — ueber die Modulfassade, wie jeder Aufrufer.
import { PgRatingRepo } from "../../services/validation";

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

/**
 * Der erste registrierte Nutzer wird Admin und darf jedes Objekt sehen. Der zweite ist ein Experte
 * OHNE `ko.validate` und ausdruecklich NICHT Autor der Pruefobjekte — er ist der Zugewiesene in L2
 * und der Betrachter, vor dem das Tor in L6 steht.
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
    payload: { name: "Pruefer", email: "pruefer@j3043.test", password: "geheim12345" },
  });
  const pruefer = await login(app, "pruefer@j3043.test", "geheim12345");
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: pruefer,
    payload: { name: "Fremd", email: "fremd@j3043.test", password: "geheim12345", role: "experte" },
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
    fremd: await login(app, "fremd@j3043.test", "geheim12345"),
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

/** Die drei Ablagenwege, an denen der Aufwand dieses Lesepfads wirklich anfaellt. */
interface Zaehler {
  listByKos: number;
  listByKo: number;
  all: number;
}

/**
 * Legt die Zaehler um die ECHTEN Ablagenmethoden — nicht um den Dienst und nicht um eine Attrappe.
 * So faellt genau das auf, was im Betrieb kostet (Abfragen), und der Weg darueber bleibt echt.
 */
function zaehlerUm(repos: AppRepos): Zaehler {
  const zaehler: Zaehler = { listByKos: 0, listByKo: 0, all: 0 };
  const echtViele = repos.ratings.listByKos.bind(repos.ratings);
  repos.ratings.listByKos = (koIds) => {
    zaehler.listByKos += 1;
    return echtViele(koIds);
  };
  const echtEins = repos.ratings.listByKo.bind(repos.ratings);
  repos.ratings.listByKo = (koId) => {
    zaehler.listByKo += 1;
    return echtEins(koId);
  };
  const echtAlle = repos.assignments.all.bind(repos.assignments);
  repos.assignments.all = () => {
    zaehler.all += 1;
    return echtAlle();
  };
  return zaehler;
}

/**
 * Faengt die Kennungsfelder ab, die WIRKLICH an die Mengenabfrage gehen.
 *
 * Die Zahl der Aufrufe allein traegt fuer die Deduplizierung nicht: `pruefstaendeFuer` macht auch
 * mit doppelter Kennung nur EINEN Aufruf — nur reicht es dann `[id, id]` ins SQL. Was die Zusage
 * haelt, ist der INHALT des Feldes, und der steht hier.
 */
function kennungenAn(repos: AppRepos): string[][] {
  const gereicht: string[][] = [];
  const echt = repos.ratings.listByKos.bind(repos.ratings);
  repos.ratings.listByKos = (koIds) => {
    gereicht.push([...koIds]);
    return echt(koIds);
  };
  return gereicht;
}

/** Eine abgesetzte SQL-Anweisung, so wie der Adapter sie dem Pool gibt. */
interface Anweisung {
  readonly sql: string;
  readonly parameter: readonly unknown[];
}

/**
 * Ein Pool, der nur MITSCHREIBT. Er entscheidet nichts (er liefert immer null Zeilen); Gegenstand
 * ist allein, welche Anweisungen der Adapter absetzt und wie viele.
 */
function beobachteterPool(): { anweisungen: Anweisung[]; pool: Pool } {
  const anweisungen: Anweisung[] = [];
  const attrappe = {
    query: (sql: string, parameter: readonly unknown[] = []) => {
      anweisungen.push({ sql, parameter });
      return Promise.resolve({ rows: [] });
    },
  };
  // Der Adapter nutzt von `Pool` genau `query`; die volle Schnittstelle nachzubauen brauchte einen
  // echten Server und pruefte nichts zusaetzlich. Deshalb hier die enge, benannte Umdeutung.
  return { anweisungen, pool: attrappe as unknown as Pool };
}

describe("JOB 3043 · der Anzeigestatus an der Liste, mit gezaehltem Aufwand", () => {
  it("L1 · GLEICHKLANG: derselbe Eintrag heisst in Liste und Detail dasselbe — `abgelehnt`", async () => {
    const { app, services, pruefer } = await setup();
    const strittig = await anlegen(services, "Objekt mit roter Stimme und Admin-Freigabe");
    const unberuehrt = await anlegen(services, "Objekt, das niemand angesehen hat");

    // Beide Schritte ueber die ECHTEN Routen — der Pruefer ist Admin und traegt `ko.validate`.
    for (const payload of [{ action: "rate", verdict: "down" }, { action: "admin-validate" }]) {
      const res = await app.inject({
        method: "PUT",
        url: `/api/kos/${strittig.id}`,
        headers: pruefer,
        payload,
      });
      expect(res.statusCode, res.body).toBe(200);
    }
    // VORBEDINGUNG, gemessen: der Kern-Enum sagt „validiert" — genau darum hiess der Eintrag in der
    // Liste bis JOB 3043 „validiert", waehrend der Detailabruf ihn „abgelehnt" nannte.
    expect((await services.ko.get(strittig.id))?.status).toBe("validiert");

    const eintraege = await liste(app, pruefer);
    const ausListe = eintrag(eintraege, strittig.id);
    const ausDetail = await detail(app, pruefer, strittig.id);

    // DER VERGLEICH IST DER PRUEFSTEIN: beide Lesepfade ueber dasselbe Objekt, gegeneinander.
    expect(ausListe.anzeigestatus).toBe(ausDetail.anzeigestatus);
    expect(ausListe.anzeigestatusHerkunft).toEqual(ausDetail.anzeigestatusHerkunft);
    // KALIBRIERUNG: „gleich" allein truege nicht — zwei gleich falsche Werte waeren auch gleich.
    expect(ausListe.anzeigestatus).toBe("abgelehnt");
    expect(herkunftVon(ausListe).bewertungen).toBe("geprueft");
    // Der Kern-Enum bleibt daneben stehen; die Anzeigestufe tritt NEBEN ihn, nicht an seine Stelle.
    expect(ausListe.status).toBe("validiert");
    // Und das unberuehrte Gegenstueck in DERSELBEN Antwort unterscheidet sich.
    expect(eintrag(eintraege, unberuehrt.id).anzeigestatus).toBe("offen");
  });

  it("L2 · ZUWEISUNG: zugewiesen heisst `pruefung`, unberuehrt heisst `offen` — in einer Antwort", async () => {
    const { app, services, pruefer, fremdId } = await setup();
    const zugewiesen = await anlegen(services, "Objekt mit offener Zuweisung");
    const unberuehrt = await anlegen(services, "Objekt ohne jede Zuweisung");
    await services.validation.assign(zugewiesen.id, [fremdId], "u-admin");

    const eintraege = await liste(app, pruefer);
    const mit = eintrag(eintraege, zugewiesen.id);
    const ohne = eintrag(eintraege, unberuehrt.id);

    expect(mit.anzeigestatus).toBe("pruefung");
    expect(ohne.anzeigestatus).toBe("offen");
    expect(herkunftVon(mit).zuweisungen).toBe("geprueft");
    expect(herkunftVon(mit).status).toBe("geprueft");
    // Die zwei Eingaenge, die dieser Lesepfad ueberhaupt nicht erhebt, sagen es — mit Grund.
    for (const e of [mit, ohne]) {
      const h = herkunftVon(e);
      expect(h.konflikt).toBe("ungeprueft");
      expect(h.revalidierung).toBe("ungeprueft");
      expect(String(h.ungeprueft.konflikt).length).toBeGreaterThan(20);
      expect(String(h.ungeprueft.revalidierung).length).toBeGreaterThan(20);
    }
  });

  it("L3 · ZWEI ABFRAGEN, NICHT ZWEI JE EINTRAG: der Aufwand haengt nicht an der Zahl der Eintraege", async () => {
    // ============================================================================================
    // DIE ZAHL IST DER BEFUND, NICHT DIE PROSA.
    // ============================================================================================
    //
    // Der naheliegende Umbau ruft `validation.pruefstandFuer` je Zeile. Das kostet je Eintrag EINE
    // Bewertungsabfrage und EINEN Vollscan der Zuweisungstabelle — 2·N, und ohne Deckel. Genau
    // deswegen hat JOB 3024 die Liste ausgeklammert. Dieser Fall misst die Ablaesung: EINE
    // Mengenabfrage der Bewertungen, EIN Vollscan der Zuweisungen, KEINE Einzelabfrage.
    async function abfragenBeiEintraegen(anzahl: number): Promise<Zaehler> {
      const { app, repos, services, pruefer } = await setup();
      for (let i = 0; i < anzahl; i += 1) {
        await anlegen(services, `Listeneintrag ${i}`);
      }
      const zaehler = zaehlerUm(repos);
      const eintraege = await liste(app, pruefer);
      expect(eintraege, "Vorbedingung: die Liste fuehrt genau die angelegten Objekte").toHaveLength(
        anzahl,
      );
      return zaehler;
    }

    const beiZehn = await abfragenBeiEintraegen(10);
    const beiEinem = await abfragenBeiEintraegen(1);

    expect(beiZehn).toEqual({ listByKos: 1, listByKo: 0, all: 1 });
    expect(beiEinem).toEqual({ listByKos: 1, listByKo: 0, all: 1 });
  });

  it("L4 · DECKEL: oberhalb wird gar nicht gefragt, und die ganze Antwort sagt das ueber sich", async () => {
    const { app, repos, services, pruefer } = await setup();
    for (let i = 0; i < ANZEIGESTATUS_LISTE_DECKEL + 1; i += 1) {
      await anlegen(services, `Eintrag ${i} in einer Liste ueber dem Deckel`);
    }
    const zaehler = zaehlerUm(repos);
    const eintraege = await liste(app, pruefer);
    expect(eintraege).toHaveLength(ANZEIGESTATUS_LISTE_DECKEL + 1);

    // NULL zusaetzliche Abfragen — der Deckel spart die Anreicherung ganz, nicht teilweise.
    expect(zaehler).toEqual({ listByKos: 0, listByKo: 0, all: 0 });

    // KEIN STILLER TEILSTAND: JEDER Eintrag traegt ALLE VIER Eingaenge als ungeprueft, und jeder
    // Grund nennt den Deckel und die tatsaechliche Zahl.
    for (const e of eintraege) {
      const h = herkunftVon(e);
      for (const eingang of ["zuweisungen", "bewertungen", "konflikt", "revalidierung"]) {
        expect(h[eingang], `${eingang} an ${e.id}`).toBe("ungeprueft");
        expect(String(h.ungeprueft[eingang])).toContain(String(ANZEIGESTATUS_LISTE_DECKEL));
        expect(String(h.ungeprueft[eingang])).toContain(String(eintraege.length));
      }
      // Der Kern-Enum bleibt der einzige geprueft gemeldete Eingang.
      expect(h.status).toBe("geprueft");
      expect(e.anzeigestatus).toBe("offen");
    }
  });

  it("L4b · GEGENPROBE ZUM DECKEL: einer weniger, und alles wird normal erhoben", async () => {
    const { app, repos, services, pruefer } = await setup();
    for (let i = 0; i < ANZEIGESTATUS_LISTE_DECKEL - 1; i += 1) {
      await anlegen(services, `Eintrag ${i} in einer Liste unter dem Deckel`);
    }
    const zaehler = zaehlerUm(repos);
    const eintraege = await liste(app, pruefer);
    expect(eintraege).toHaveLength(ANZEIGESTATUS_LISTE_DECKEL - 1);

    expect(zaehler).toEqual({ listByKos: 1, listByKo: 0, all: 1 });
    for (const e of eintraege) {
      const h = herkunftVon(e);
      expect(h.zuweisungen).toBe("geprueft");
      expect(h.bewertungen).toBe("geprueft");
    }
  });

  it("L5 · FEHLER HEISST NICHT `offen`: 200 mit vollstaendiger Liste und ausgewiesenen Luecken", async () => {
    const { app, repos, services, pruefer, fremdId } = await setup();
    const zugewiesen = await anlegen(services, "Objekt, dessen Pruefstand gleich ausfaellt");
    const validiert = await anlegen(services, "Objekt, das durch ist");
    await services.validation.assign(zugewiesen.id, [fremdId], "u-admin");
    await services.validation.adminValidate(validiert.id, "u-admin");

    // KALIBRIERUNG ZUERST: solange die Abfrage traegt, sagt die Liste „pruefung"/„geprueft".
    const heil = await liste(app, pruefer);
    expect(eintrag(heil, zugewiesen.id).anzeigestatus).toBe("pruefung");
    expect(herkunftVon(eintrag(heil, zugewiesen.id)).bewertungen).toBe("geprueft");

    // Der Ausfall wird an der ECHTEN Datenquelle erzeugt, nicht am Dienst.
    repos.ratings.listByKos = () => Promise.reject(new Error("Bewertungsablage nicht erreichbar"));

    const kaputt = await liste(app, pruefer);
    // Die Liste bleibt vollstaendig — ein Fehler in der Anreicherung kippt den Lesepfad nicht.
    expect(kaputt).toHaveLength(heil.length);
    for (const e of kaputt) {
      const h = herkunftVon(e);
      expect(h.zuweisungen).toBe("ungeprueft");
      expect(h.bewertungen).toBe("ungeprueft");
      expect(String(h.ungeprueft.zuweisungen).length).toBeGreaterThan(20);
      expect(String(h.ungeprueft.bewertungen).length).toBeGreaterThan(20);
      expect(h.status).toBe("geprueft");
    }
    // KEINE UNMARKIERTE TATSACHENAUSSAGE: das zugewiesene Objekt faellt auf „offen" zurueck, aber
    // die Antwort sagt im selben Atemzug, dass die beiden entscheidenden Eingaenge fehlen. Und der
    // Kern-Enum bleibt unveraendert — „validiert" wird nicht zu einer neuen Behauptung umgebogen.
    expect(eintrag(kaputt, zugewiesen.id).anzeigestatus).toBe("offen");
    expect(eintrag(kaputt, zugewiesen.id).status).toBe("offen");
    expect(eintrag(kaputt, validiert.id).status).toBe("validiert");
  });

  it("L6 · DAS TOR STEHT DAVOR: ein unsichtbares Objekt wird nicht einmal abgefragt", async () => {
    const { app, services, fremd } = await setup();
    const geheim = await services.ko.create({
      title: "Vertraulicher Pruefling",
      statement: "Sensibler Kerntext, der einen fremden Pruefer nichts angeht.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-jemand-anders",
      confidentiality: "vertraulich",
    });
    const offen = await anlegen(services, "Internes Alltagswissen");

    // Das uebergebene Kennungsfeld wird abgefangen — eine Pruefstandsabfrage fuer ein unsichtbares
    // Objekt waere eine Existenzauskunft ueber den Umweg der Kosten.
    const uebergeben: string[][] = [];
    const echt = services.validation.pruefstaendeFuer.bind(services.validation);
    services.validation.pruefstaendeFuer = (kos) => {
      uebergeben.push(kos.map((k) => k.id));
      return echt(kos);
    };

    const eintraege = await liste(app, fremd);
    expect(eintraege.map((e) => e.id)).toEqual([offen.id]);
    expect(eintrag(eintraege, offen.id).anzeigestatus).toBe("offen");

    expect(uebergeben).toHaveLength(1);
    expect(uebergeben[0]).toEqual([offen.id]);
    expect(uebergeben[0]).not.toContain(geheim.id);
    // Und die Antwort selbst verraet das vertrauliche Objekt an keiner Stelle.
    expect(JSON.stringify(eintraege)).not.toContain(geheim.id);
  });

  it("L7 · VERALTETE STIMME: eine Stimme auf eine revidierte Fassung macht nicht `abgelehnt`", async () => {
    const { app, services, pruefer } = await setup();
    const revidiert = await anlegen(
      services,
      "Objekt, das nach der roten Stimme ueberarbeitet wurde",
    );
    await services.validation.rate(revidiert.id, "u-pruefer", "down");

    // KALIBRIERUNG: VOR der Revision zieht die rote Stimme auch in der Liste.
    expect(eintrag(await liste(app, pruefer), revidiert.id).anzeigestatus).toBe("abgelehnt");

    const vorher = (await services.ko.get(revidiert.id))?.version ?? 0;
    await services.ko.revise(revidiert.id, { statement: "Ueberarbeiteter Kerntext." }, "u-autor");
    const nachher = (await services.ko.get(revidiert.id))?.version ?? 0;
    expect(nachher, "Vorbedingung: die Revision hat die Fassung erhoeht").toBeGreaterThan(vorher);

    // SCRUM-507 R2: nur Stimmen der AKTUELLEN Fassung werten — dieselbe Entscheidung wie am
    // Detailabruf, und sie faellt weiterhin im Validierungsmodul, nicht an der Route.
    const nachRevision = eintrag(await liste(app, pruefer), revidiert.id);
    expect(nachRevision.anzeigestatus).not.toBe("abgelehnt");
    expect(herkunftVon(nachRevision).bewertungen).toBe("geprueft");
  });

  it("L8 · REINE LESE-SICHT: der Listenabruf schreibt nichts an den Bestand", async () => {
    const { app, repos, services, pruefer, fremdId } = await setup();
    const rot = await anlegen(services, "Objekt mit roter Bewertung");
    const zugewiesen = await anlegen(services, "Objekt mit offener Zuweisung");
    await services.validation.rate(rot.id, fremdId, "down");
    await services.validation.assign(zugewiesen.id, [fremdId], "u-admin");

    const abzug = async (): Promise<string> =>
      JSON.stringify({
        kos: [await repos.koRepo.findById(rot.id), await repos.koRepo.findById(zugewiesen.id)],
        zuweisungen: await repos.assignments.all(),
        bewertungen: [
          ...(await repos.ratings.listByKo(rot.id)),
          ...(await repos.ratings.listByKo(zugewiesen.id)),
        ],
      });

    const vorher = await abzug();
    const eintraege = await liste(app, pruefer);
    expect(eintrag(eintraege, rot.id).anzeigestatus).toBe("abgelehnt");
    expect(eintrag(eintraege, zugewiesen.id).anzeigestatus).toBe("pruefung");
    expect(await abzug()).toBe(vorher);

    // Die Anzeigestufe ist ABGELEITET und wandert nie in den Bestand.
    const gespeichert = await repos.koRepo.findById(rot.id);
    expect(Object.hasOwn(gespeichert as object, "anzeigestatus")).toBe(false);
  });

  it("L9 · KEIN ZWEITER ZAEHLWEG: Mengenweg und Einzelweg liefern dieselbe Pruefstandslage", async () => {
    const { repos, services, fremdId } = await setup();
    const zugewiesen = await anlegen(services, "Objekt mit offener Zuweisung");
    const rot = await anlegen(services, "Objekt mit roter Stimme");
    const leer = await anlegen(services, "Objekt ohne Zuweisung und ohne Stimme");
    await services.validation.assign(zugewiesen.id, [fremdId], "u-admin");
    await services.validation.rate(rot.id, fremdId, "down");

    const objekte = [];
    for (const id of [zugewiesen.id, rot.id, leer.id]) {
      const ko = await services.ko.get(id);
      if (!ko) {
        throw new Error(`Vorbedingung: ${id} liegt im Bestand`);
      }
      objekte.push({ id: ko.id, version: ko.version });
    }

    const menge = await services.validation.pruefstaendeFuer(objekte);
    for (const o of objekte) {
      expect(menge.get(o.id)).toEqual(await services.validation.pruefstandFuer(o.id, o.version));
    }

    // JEDE uebergebene Kennung bekommt einen Eintrag — auch das Objekt ohne Zuweisung und ohne
    // Stimme. Ein fehlender Eintrag duerfte fuer einen Aufrufer nie „nichts erhoben" heissen.
    expect([...menge.keys()].sort()).toEqual(objekte.map((o) => o.id).sort());
    expect(menge.get(leer.id)).toEqual({
      assignments: [],
      votes: { up: 0, warn: 0, down: 0 },
      staleVotes: 0,
    });
    expect(menge.get(zugewiesen.id)?.assignments).toEqual([fremdId]);
    expect(menge.get(rot.id)?.votes.down).toBe(1);

    // LEERE EINGABE: KEINE Abfrage, leere Antwort — die Grundlage der Zusage aus §9 („erfolgreich
    // leer" kostet nichts und sagt nichts ueber unsichtbare Objekte).
    //
    // DIE ZAEHLER STEHEN VOR DEM AUFRUF, nicht die Kartengroesse dahinter. Runde 1 hat hier nur
    // `size === 0` geprueft — und eine leere Karte kommt auch dann heraus, wenn vorher beide
    // Ablagen befragt wurden. Der Vertrag heisst „null Abfragen", also wird genau das gemessen.
    const leerZaehler = zaehlerUm(repos);
    const leereEingabe = await services.validation.pruefstaendeFuer([]);
    expect(leereEingabe.size).toBe(0);
    expect(leerZaehler).toEqual({ listByKos: 0, listByKo: 0, all: 0 });

    // DOPPELTE KENNUNG: einmal ABGEFRAGT, einmal beantwortet. Auch hier trug die Kartengroesse
    // allein nichts — eine Karte hat je Kennung ohnehin nur einen Platz, ganz gleich, wie oft die
    // Kennung ins SQL gereicht wurde. Gemessen wird deshalb das uebergebene Kennungsfeld.
    const erstes = objekte[0];
    if (!erstes) {
      throw new Error("Vorbedingung: die Objektliste ist nicht leer");
    }
    const gereicht = kennungenAn(repos);
    const doppelt = await services.validation.pruefstaendeFuer([erstes, erstes]);
    expect(doppelt.size).toBe(1);
    expect(gereicht).toEqual([[erstes.id]]);
  });

  it("L10 · LEERE LISTE AM DRAHT: `[]` kostet keine einzige zusaetzliche Abfrage", async () => {
    const { app, repos, pruefer } = await setup();
    // Kein einziges Wissensobjekt im Bestand — der Fall „erfolgreich leer" aus §9.
    const zaehler = zaehlerUm(repos);
    const eintraege = await liste(app, pruefer);

    expect(eintraege).toEqual([]);
    // Die Anreicherung fragt nichts, wenn es nichts anzureichern gibt. Ohne diese Zusage zoege eine
    // leere Antwort die ganze Zuweisungstabelle in den Speicher.
    expect(zaehler).toEqual({ listByKos: 0, listByKo: 0, all: 0 });
  });

  it("L11 · POSTGRES: leer ohne Anweisung, zwei Kennungen als EINE `= ANY`-Anweisung", async () => {
    // ============================================================================================
    // DIE ANWEISUNG SELBST IST DER GEGENSTAND — deshalb steht hier ein beobachteter Pool.
    // ============================================================================================
    //
    // Ein echter Postgres-Lauf steht in dieser Abnahme nicht zur Verfuegung (Integrationstests
    // laufen getrennt ueber Testcontainers). Was sich OHNE Server pruefen laesst, ist genau das,
    // was die Kostenzusage traegt: WIE VIELE Anweisungen der Adapter absetzt und WELCHE. Der Pool
    // ist dabei die beobachtete GRENZE, nicht die entscheidende Stelle — er beantwortet nichts,
    // er schreibt nur mit. Eine Schleife ueber `listByKo` (das N+1 im Adapter, das von aussen wie
    // eine Mengenabfrage aussaehe) faellt hier auf, an der API-Ebene dagegen nicht.
    const { anweisungen, pool } = beobachteterPool();
    const repo = new PgRatingRepo(pool);

    expect(await repo.listByKos([])).toEqual([]);
    expect(anweisungen, "leere Kennungsliste geht gar nicht erst ans SQL").toEqual([]);

    await repo.listByKos(["ko-1", "ko-2"]);
    expect(anweisungen).toHaveLength(1);
    expect(anweisungen[0]?.sql).toBe("SELECT data FROM ratings WHERE ko_id = ANY($1)");
    expect(anweisungen[0]?.parameter).toEqual([["ko-1", "ko-2"]]);
  });
});
