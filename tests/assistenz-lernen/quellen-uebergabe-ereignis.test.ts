// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · EQF-06-K02 / K05 / K06 (Nacharbeit 51)
// — BERICHT AUS ZWEI QUELLEN, AUSLÖSER „BEI EREIGNIS“, DREI ÜBERGABEARTEN.
// ================================================================================================
//
// Am ECHTEN Server (`buildApp(buildServices())`, In-Memory), fiktive Konten und Daten, kein Modell:
//   Q1 Zwei Vorführungen lesen dieselben zwei Wissensobjekte als Quellen (`GET /api/kos/:id`, vom
//      Server beobachtet) und legen je einen Bericht an. Die Vorschau nennt die Originalereignisse
//      mit Fassung; die Routine trägt nur die Kennungen. Nach einer Überarbeitung von Quelle 1 legt
//      ein Folgelauf über den Aktionskern einen NEUEN Bericht mit der aktuellen Fassung und
//      Kernaussage beider Quellen an.
//   Q2 Eine Quelle ist inzwischen nicht mehr sichtbar (gelöscht): der Lauf legt nichts an.
//   E1 „Bei einem Ereignis“: unklare Worte → gezielte Rückfrage mit Katalog (422); eindeutige Worte
//      → gespeicherte Wahl. Der Takt der vorhandenen Zeitsteuerung führt je eigenem Ereignis genau
//      einen Lauf aus; das Ereignis eines anderen Kontos löst nichts aus.
//   U1 Selbstständig (Vorgabe): ein Planschritt, nach dem Anlegen abgeschlossen.
//   U2 Ergebnis zur Prüfung: zweiter Planschritt „Ergebnis öffnen“, erst danach abgeschlossen.
//   U3 Gemeinsam schrittweise: kein Zeitplan; der Takt führt nichts aus.
// Nacharbeit 52 (Ben zu c52b0e61):
//   S1 Schutzklasse rein: nur ausdrücklich `intern` mit Herkunft `ko` ist frei; fehlend, `null`,
//      unbekannter Wert oder unbekannte Herkunft → geschützte Klärung; vertraulich → gesperrt.
//   Q3 Eine nie eingestufte Quelle am Server: Klärung, kein Bericht (Positivkontrolle ist Q1).
//   E2 Rückstand über eine Seite hinaus (51 Ereignisse, dazu neue während der Abarbeitung und ein
//      Neustart der App): jedes eigene Ereignis läuft genau einmal, auch das älteste.
//   E3 Pause und Rechteentzug: Ereignisse einer Pause laufen nicht, der Rückstand von davor geht
//      nicht verloren; ohne Anlagerecht wird abgelehnt, nichts entsteht, der Fortschritt rückt vor.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiCheckWorker } from "../../services/app/src/ai-check-worker";
import type { FunktionsSchritt } from "../../services/app/src/assistenz-lernen";
import type { ZeitplanLaufErgebnis } from "../../services/app/src/assistenz-lernen-zeitsteuerung";
import {
  assembleServices,
  buildApp,
  type buildServices,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import type { KlaraAuftrag } from "../../services/app/src/klara-auftrag";
import { quellSchutz } from "../../services/app/src/klara-ausfuehrung";

type App = ReturnType<typeof buildApp>;
type Methode = "GET" | "POST" | "PUT" | "DELETE";
type Konto = { id: string; token: string };
type Vorschau = {
  stand: string;
  ableitung?: {
    parameter: { name: string }[];
    schritte: FunktionsSchritt[];
    erklaerung: { ueberschrift: string; zeilen: string[] }[];
  };
};
type RoutineSicht = {
  id: string;
  fassung: number;
  ausfuehrung: string;
  zeitplan: unknown;
  ableitung: { schritte: FunktionsSchritt[] } | null;
};
type Entwurf = { id: string; payload: { title?: string; bodyHtml?: string } };

let app: App;
let repos: ReturnType<typeof inMemoryRepos>;
let services: ReturnType<typeof buildServices>;
let takt: (jetzt?: number) => Promise<ZeitplanLaufErgebnis[]> = async () => [];
let admin: Konto;
let erik: Konto;

const VORMACHEN = "/api/me/vormachen";
const WEB = "http://localhost/wissen";
const ERFASSEN = "http://localhost/erfassen";

function stillerPruefjob(): AiCheckWorker {
  const eingereiht = new Set<string>();
  return {
    enqueue: vi.fn((koId: string) => {
      eingereiht.add(koId);
    }),
    has: (koId) => eingereiht.has(koId),
    laeuft: () => false,
    queuedCount: () => 0,
    idle: async () => undefined,
  };
}

const auf = (wer: string, methode: Methode, url: string, payload?: unknown, herkunft?: string) =>
  app.inject({
    method: methode,
    url,
    headers: {
      authorization: `Bearer ${wer}`,
      ...(herkunft ? { referer: herkunft } : {}),
    },
    ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
  });

async function anmelden(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode, login.body).toBe(200);
  return (login.json() as { token: string }).token;
}

/**
 * Ein fiktives Wissensobjekt der Person — Fassung 1, ausdrücklich `intern` eingestuft. Mit
 * `eingestuft: false` danach ohne jede Stufe im Bestand: „nie eingestuft“ — der Leseweg gibt
 * `confidentiality: null` mit `confidentialityProvenance: "unknown"` aus.
 */
async function wissensobjekt(
  wer: Konto,
  titel: string,
  aussage: string,
  eingestuft = true,
): Promise<string> {
  const r = await auf(wer.token, "POST", "/api/kos", {
    confidentiality: "intern",
    title: titel,
    statement: aussage,
    type: "best_practice",
    category: "Bericht",
  });
  expect(r.statusCode, r.body).toBe(201);
  const id = (r.json() as { id: string }).id;
  if (!eingestuft) {
    // Synthetischer Altbestand: der öffentliche Schreibweg verlangt zu Recht eine Einstufung
    // (400 `MISSING_CONFIDENTIALITY`). Ein nie eingestuftes Objekt gibt es nur noch aus der Zeit vor
    // der Stufenpflicht — hergestellt direkt in der Ablage, wie in `tests/pruefablauf/`.
    const ko = await repos.koRepo.findById(id);
    if (!ko) {
      throw new Error("Synthetische Quelle fehlt");
    }
    const { confidentiality: _stufe, ...ohneStufe } = ko;
    await repos.koRepo.update(ohneStufe);
  }
  return id;
}

/** Eine Vorführung: beide Quellen lesen (die erste zweimal, wie beim Neuladen), Bericht anlegen. */
async function vorfuehrung(quellen: readonly string[], titel: string, aussage: string) {
  const [erste] = quellen;
  for (const id of erste ? [erste, ...quellen] : quellen) {
    const r = await auf(erik.token, "GET", `/api/kos/${id}`, undefined, WEB);
    expect(r.statusCode, r.body).toBe(200);
  }
  const entwurf = { title: titel, statement: aussage, type: "best_practice", category: "Bericht" };
  const r = await auf(erik.token, "POST", "/api/drafts", entwurf, ERFASSEN);
  expect(r.statusCode, r.body).toBeLessThan(300);
}

/** Zwei Vorführungen mit denselben zwei Quellen, bestätigt — die Routine. */
async function routineAusQuellen(quellen: readonly string[]): Promise<RoutineSicht> {
  const start = await auf(erik.token, "POST", VORMACHEN, {
    host: "klarwerk_web",
    vorgaenge: ["quelle_lesen", "entwurf_anlegen"],
    zweck: "Wochenbericht aus zwei Quellen",
  });
  expect(start.statusCode, start.body).toBe(201);
  const sitzung = (start.json() as { sitzung: { id: string } }).sitzung.id;
  await auf(erik.token, "GET", `${VORMACHEN}?anzeige=klarwerk_web`);
  await vorfuehrung(quellen, "Wochenbericht KW40", "Lage stabil");
  await vorfuehrung(quellen, "Wochenbericht KW41", "Lage leicht besser");
  const v = await auf(erik.token, "GET", `${VORMACHEN}/${sitzung}/vorschau`);
  expect(v.statusCode, v.body).toBe(200);
  const vorschau = (v.json() as { vorschau: Vorschau }).vorschau;
  const b = await auf(erik.token, "POST", `${VORMACHEN}/${sitzung}/bestaetigung`, {
    stand: vorschau.stand,
  });
  expect(b.statusCode, b.body).toBe(201);
  const id = (b.json() as { routine: { id: string } }).routine.id;
  return routineSicht(id);
}

async function routineSicht(id: string): Promise<RoutineSicht> {
  const liste = await auf(erik.token, "GET", VORMACHEN);
  const routine = (liste.json() as { routinen: RoutineSicht[] }).routinen.find((r) => r.id === id);
  if (!routine) {
    throw new Error("Routine fehlt");
  }
  return routine;
}

async function gespraech(): Promise<string> {
  const bezug = { pfad: "/profil", seitenName: "Meine Funktionen", objekt: "Wochenbericht" };
  const r = await auf(erik.token, "POST", "/api/me/klara/gespraeche", { objektbezug: bezug });
  expect(r.statusCode, r.body).toBe(201);
  return (r.json() as { gespraech: { id: string } }).gespraech.id;
}

async function lauf(routine: RoutineSicht, gid: string, kennung: string, titel: string) {
  return auf(erik.token, "POST", `${VORMACHEN}/routinen/${routine.id}/lauf`, {
    gespraech: gid,
    lauf: kennung,
    fassung: routine.fassung,
    eingaben: { titel, inhalt: "Kurzfassung der Woche" },
  });
}

function schritte(gid: string, auftrag: string, schluessel: string): string {
  return `/api/me/klara/gespraeche/${gid}/auftraege/${auftrag}/schritte/${schluessel}`;
}

async function fuehreAus(gid: string, a: KlaraAuftrag, schluessel: string, nr: number) {
  const r = await auf(erik.token, "POST", `${schritte(gid, a.id, schluessel)}/ausfuehrung`, {
    nr,
    auftragFassung: a.fassung,
  });
  expect(r.statusCode, r.body).toBeLessThan(300);
  return r.json() as { auftrag: KlaraAuftrag; schritt: KlaraAuftrag["schritte"][number] };
}

async function entwuerfe(titel: string): Promise<Entwurf[]> {
  const r = await auf(erik.token, "GET", "/api/drafts");
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as Entwurf[]).filter((d) => d.payload?.title === titel);
}

async function entwurf(id: string): Promise<Entwurf> {
  const r = await auf(erik.token, "GET", `/api/drafts/${encodeURIComponent(id)}`);
  expect(r.statusCode, r.body).toBe(200);
  return r.json() as Entwurf;
}

/** Der Körper als Klartext — wie ihn das Nachlesen prüft. */
function klartext(html: string | undefined): string {
  return (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&middot;/g, "·")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

beforeEach(async () => {
  repos = inMemoryRepos();
  services = assembleServices(repos);
  services.aiCheckWorker = stillerPruefjob();
  app = buildApp(services, {
    routinenZeitsteuerung: (l) => {
      takt = l;
    },
  });
  await app.ready();
  const registriert = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Fiktiv Admin", email: "admin@eqf06-quellen.test", password: "secret123" },
  });
  expect(registriert.statusCode, registriert.body).toBe(201);
  admin = {
    id: (registriert.json() as { id: string }).id,
    token: await anmelden("admin@eqf06-quellen.test"),
  };
  const r = await auf(admin.token, "POST", "/api/users", {
    name: "Fiktiv Erik",
    email: "erik@eqf06-quellen.test",
    password: "secret123",
    role: "experte",
  });
  expect(r.statusCode, r.body).toBe(201);
  erik = { id: (r.json() as { id: string }).id, token: await anmelden("erik@eqf06-quellen.test") };
});

describe("EQF-06-K02 · ein Bericht aus zwei Quellen — Vorführung und Folgelauf", () => {
  it("Q1 · Originalereignisse mit Fassung; Folgelauf liest die aktuelle Fassung beider Quellen", async () => {
    const umsatz = await wissensobjekt(erik, "Umsatz Region Nord", "Umsatz Q3: 1,0 Mio (fiktiv).");
    const projekt = await wissensobjekt(erik, "Projektstand Nord", "Meilenstein 2 erreicht.");

    const start = await auf(erik.token, "POST", VORMACHEN, {
      host: "klarwerk_web",
      vorgaenge: ["quelle_lesen", "entwurf_anlegen"],
      zweck: "Wochenbericht aus zwei Quellen",
    });
    expect(start.statusCode, start.body).toBe(201);
    const sitzung = (start.json() as { sitzung: { id: string } }).sitzung.id;
    await auf(erik.token, "GET", `${VORMACHEN}?anzeige=klarwerk_web`);
    await vorfuehrung([umsatz, projekt], "Wochenbericht KW40", "Lage stabil");
    await vorfuehrung([umsatz, projekt], "Wochenbericht KW41", "Lage leicht besser");

    const v = await auf(erik.token, "GET", `${VORMACHEN}/${sitzung}/vorschau`);
    const vorschau = (v.json() as { vorschau: Vorschau }).vorschau;
    const ableitung = vorschau.ableitung;
    if (!ableitung) {
      throw new Error("Ableitung fehlt");
    }
    // Die gelesenen Quellen sind feste Schritte mit Kennung — gleich in beiden Vorführungen; das
    // zweite Lesen derselben Quelle ist kein eigener Schritt.
    const quellSchritte = ableitung.schritte.filter((s) => s.art === "oeffnen");
    expect(quellSchritte.map((s) => [s.ziel?.name, s.wert])).toEqual([
      ["Quelle 1", { konstante: umsatz }],
      ["Quelle 2", { konstante: projekt }],
    ]);
    // Originalereignisse mit Fassung in der Erklärung — Kennung und Fassung, kein Inhalt.
    const quellen = ableitung.erklaerung.find((a) => a.ueberschrift === "Gelesene Quellen");
    expect(quellen?.zeilen).toEqual([
      `Vorführung 1, Quelle 1: Wissensobjekt ${umsatz} in Fassung 1.`,
      `Vorführung 1, Quelle 2: Wissensobjekt ${projekt} in Fassung 1.`,
      `Vorführung 2, Quelle 1: Wissensobjekt ${umsatz} in Fassung 1.`,
      `Vorführung 2, Quelle 2: Wissensobjekt ${projekt} in Fassung 1.`,
    ]);
    expect(JSON.stringify(ableitung)).not.toContain("1,0 Mio");

    const b = await auf(erik.token, "POST", `${VORMACHEN}/${sitzung}/bestaetigung`, {
      stand: vorschau.stand,
    });
    expect(b.statusCode, b.body).toBe(201);
    const routine = await routineSicht((b.json() as { routine: { id: string } }).routine.id);
    expect(JSON.stringify(routine)).not.toContain("Umsatz Q3");

    // Die Quelle ändert sich: Fassung 2 mit neuer Kernaussage.
    const aenderung = { statement: "Umsatz Q3: 1,2 Mio (fiktiv)." };
    expect((await services.ko.revise(umsatz, aenderung, erik.id)).version).toBe(2);

    const gid = await gespraech();
    const l = await lauf(routine, gid, "lauf-q1", "Wochenbericht KW42");
    expect(l.statusCode, l.body).toBe(201);
    const auftrag = (l.json() as { auftrag: KlaraAuftrag }).auftrag;
    expect(auftrag.plan?.[0]?.quellen).toEqual([umsatz, projekt]);
    expect(auftrag.erlaubteQuellen).toEqual(
      expect.arrayContaining([`Wissensobjekt ${umsatz}`, `Wissensobjekt ${projekt}`]),
    );
    const s = await fuehreAus(gid, auftrag, "bericht-1", 1);
    expect(s.schritt.stand, JSON.stringify(s.schritt)).toBe("gespeichert");
    const id = s.schritt.ergebnis?.id ?? "";
    const text = klartext((await entwurf(id)).payload.bodyHtml);
    expect(text).toContain("Kurzfassung der Woche");
    expect(text).not.toContain("Lage leicht besser");
    // Ergebnisbezug: Titel, AKTUELLE Fassung, Ort und Kernaussage beider Quellen.
    expect(text).toContain(`Quelle 1: Umsatz Region Nord · Fassung 2 · /wissen/${umsatz}`);
    expect(text).toContain("Umsatz Q3: 1,2 Mio (fiktiv).");
    expect(text).not.toContain("1,0 Mio");
    expect(text).toContain(`Quelle 2: Projektstand Nord · Fassung 1 · /wissen/${projekt}`);
    expect(text).toContain("Meilenstein 2 erreicht.");
    // Ein neues Ergebnis, nicht die Vorführung kopiert.
    expect(await entwuerfe("Wochenbericht KW42")).toHaveLength(1);
  });

  it("Q2 · eine nicht mehr sichtbare Quelle: der Lauf legt nichts an", async () => {
    const umsatz = await wissensobjekt(erik, "Umsatz Region Süd", "Umsatz Q3: 0,8 Mio (fiktiv).");
    const projekt = await wissensobjekt(erik, "Projektstand Süd", "Meilenstein 1 offen.");
    const routine = await routineAusQuellen([umsatz, projekt]);
    const weg = await auf(erik.token, "DELETE", `/api/kos/${projekt}`);
    expect(weg.statusCode, weg.body).toBe(204);

    const gid = await gespraech();
    const l = await lauf(routine, gid, "lauf-q2", "Wochenbericht KW43");
    expect(l.statusCode, l.body).toBe(201);
    const auftrag = (l.json() as { auftrag: KlaraAuftrag }).auftrag;
    const s = await fuehreAus(gid, auftrag, "bericht-1", 1);
    expect(s.schritt.stand).toBe("fehlgeschlagen");
    expect(s.schritt.fehlerCode).toBe("nichtGefunden");
    expect(await entwuerfe("Wochenbericht KW43")).toHaveLength(0);
  });

  it("Q3 · eine nie eingestufte Quelle: geschützte Klärung, kein Bericht", async () => {
    const umsatz = await wissensobjekt(erik, "Umsatz Region Nordost", "Umsatz Q3: 0,6 Mio.");
    const offen = await wissensobjekt(erik, "Projektstand Nordost", "Meilenstein 4 offen.", false);
    const gelesen = await auf(erik.token, "GET", `/api/kos/${offen}`);
    expect(gelesen.json()).toMatchObject({
      confidentiality: null,
      confidentialityProvenance: "unknown",
    });
    const routine = await routineAusQuellen([umsatz, offen]);

    const gid = await gespraech();
    const l = await lauf(routine, gid, "lauf-q3", "Wochenbericht KW44");
    expect(l.statusCode, l.body).toBe(201);
    const auftrag = (l.json() as { auftrag: KlaraAuftrag }).auftrag;
    const s = await fuehreAus(gid, auftrag, "bericht-1", 1);
    expect(s.schritt.stand).toBe("fehlgeschlagen");
    expect(s.schritt.fehlerCode).toBe("schutzstufeUngeklaert");
    expect(s.schritt.grund).toContain("nicht eingestuft");
    expect(await entwuerfe("Wochenbericht KW44")).toHaveLength(0);
  });
});

describe("H-1 / G05 · keine freie Kopie aus gebundenen Quellen", () => {
  it.each(["quellleser", "space"] as const)(
    "H1 · ausdrücklich intern mit %s: vor Kopie stoppen, nach Entzug kein geschützter Inhalt im eigenen Entwurf",
    async (bindung) => {
      const offen = await wissensobjekt(erik, "H1 freie Quelle", "Eigene freie Testaussage.");
      const titel = `H1 geschützte Testquelle ${bindung}`;
      const aussage = `H1 ausschließlich fiktiver gebundener Quelltext ${bindung}.`;
      const quelle = await wissensobjekt(erik, titel, aussage);
      let space: { id: string; version: number } | null = null;
      if (bindung === "quellleser") {
        await services.ko.setQuellrechte(
          quelle,
          { stufe: "intern", leser: [erik.id], version: 1 },
          admin.id,
        );
      } else {
        const angelegt = await auf(admin.token, "POST", "/api/spaces", {
          name: "H1 eigener geschlossener Testraum",
          zweck: "Nur fiktive H1-Quellen für den Kopierschutz.",
          verantwortlich: admin.id,
          zugang: "mitglieder",
          mitglieder: [{ nutzer: erik.id, recht: "schreiben" }],
          ansichten: [],
        });
        expect(angelegt.statusCode, angelegt.body).toBe(201);
        space = angelegt.json() as { id: string; version: number };
        const v = await auf(erik.token, "POST", "/api/spaces/verschiebung/vorschau", {
          koId: quelle,
          zielSpaceId: space.id,
        });
        expect(v.statusCode, v.body).toBe(200);
        const grundlage = v.json() as {
          quelle: { id: string; version: number } | null;
          ziel: { id: string; version: number } | null;
          grundlage: string;
        };
        const verschoben = await auf(erik.token, "POST", "/api/spaces/verschiebung", {
          koId: quelle,
          zielSpaceId: space.id,
          basis: {
            quelleId: grundlage.quelle?.id ?? null,
            quelleVersion: grundlage.quelle?.version ?? null,
            zielId: grundlage.ziel?.id ?? null,
            zielVersion: grundlage.ziel?.version ?? null,
            grundlage: grundlage.grundlage,
          },
        });
        expect(verschoben.statusCode, verschoben.body).toBe(200);
      }
      const davor = await auf(erik.token, "GET", `/api/kos/${quelle}`);
      expect(davor.statusCode, davor.body).toBe(200);
      expect(davor.json()).toMatchObject({
        confidentiality: "intern",
        confidentialityProvenance: "ko",
      });
      if (bindung === "quellleser") expect(davor.json().quellrechte.leser).toEqual([erik.id]);
      else expect(davor.json().spaceId).toBe(space?.id);

      // Die Vorführungen dürfen die Quelle lesen; diese Kenntnis gibt keine Kopierbefugnis.
      const routine = await routineAusQuellen([offen, quelle]);
      const bestand = await auf(erik.token, "GET", "/api/drafts");
      expect(bestand.statusCode, bestand.body).toBe(200);
      const alteIds = (bestand.json() as Entwurf[]).map((d) => d.id).sort();
      const gid = await gespraech();
      const l = await lauf(routine, gid, `h1-${bindung}`, `H1 freier Folgebericht ${bindung}`);
      expect(l.statusCode, l.body).toBe(201);
      const a = (l.json() as { auftrag: KlaraAuftrag }).auftrag;
      const aus = await fuehreAus(gid, a, "bericht-1", 1);

      if (bindung === "quellleser") {
        await services.ko.setQuellrechte(
          quelle,
          { stufe: "intern", leser: [admin.id], version: 2 },
          admin.id,
        );
      } else {
        if (!space) throw new Error("Eigener Testraum fehlt");
        const entzogen = await auf(admin.token, "PUT", `/api/spaces/${space.id}`, {
          version: space.version,
          name: "H1 eigener geschlossener Testraum",
          zweck: "Nur fiktive H1-Quellen für den Kopierschutz.",
          verantwortlich: admin.id,
          zugang: "mitglieder",
          mitglieder: [],
          ansichten: [],
        });
        expect(entzogen.statusCode, entzogen.body).toBe(200);
      }
      const entzug = await auf(erik.token, "GET", `/api/kos/${quelle}`);
      expect(entzug.statusCode, entzug.body).toBe(404);
      const nachher = await auf(erik.token, "GET", "/api/drafts");
      expect(nachher.statusCode, nachher.body).toBe(200);
      const eigene = nachher.json() as Entwurf[];
      const nachlesungen = await Promise.all(
        eigene.map((d) => auf(erik.token, "GET", `/api/drafts/${d.id}`)),
      );
      console.info(
        JSON.stringify({
          fall: `H1-${bindung}`,
          quelleVorher: davor.statusCode,
          ausdruecklichIntern: true,
          laufstand: aus.schritt.stand,
          quelleNachEntzug: entzug.statusCode,
          neueEntwuerfe: eigene.length - alteIds.length,
          geschuetzterTextNachEntzugLesbar: nachlesungen.some(
            (r) => r.statusCode === 200 && (r.body.includes(aussage) || r.body.includes(titel)),
          ),
        }),
      );
      expect(aus.schritt.stand).toBe("fehlgeschlagen");
      expect(aus.schritt.fehlerCode).toBe("quellbindung");
      expect(aus.schritt.ergebnis).toBeNull();
      expect(eigene.map((d) => d.id).sort()).toEqual(alteIds);
      expect(nachher.body).not.toContain(aussage);
      expect(nachher.body).not.toContain(titel);
      for (const r of nachlesungen) {
        // Die eigenen neutralen Vorführentwürfe bleiben lesbar; keiner enthält eine Quellkopie.
        expect(r.statusCode, r.body).toBe(200);
        expect(r.body).not.toContain(aussage);
        expect(r.body).not.toContain(titel);
      }
    },
  );
});

describe("EQF-06-K02 / G05 · Schutzklasse einer Quelle (Nacharbeit 52)", () => {
  it("S1 · nur ausdrücklich intern ist frei; fehlend, null, unbekannt → Klärung", () => {
    const ko = "ko" as const;
    expect(quellSchutz({ confidentiality: "intern", confidentialityProvenance: ko })).toBe("frei");
    for (const d of [
      {},
      { confidentiality: null, confidentialityProvenance: "unknown" },
      { confidentiality: "unbekannt", confidentialityProvenance: ko },
      { confidentiality: 3 },
      { confidentiality: "intern" },
      { confidentiality: "intern", confidentialityProvenance: "unknown" },
    ]) {
      expect(quellSchutz(d), JSON.stringify(d)).toBe("schutzstufeUngeklaert");
    }
    for (const stufe of ["vertraulich", "streng_vertraulich"]) {
      const d = { confidentiality: stufe, confidentialityProvenance: ko };
      expect(quellSchutz(d), stufe).toBe("schutzstufe");
    }
  });
});

describe("EQF-06-K05 · Auslöser „bei einem Ereignis“ über die vorhandene Zeitsteuerung", () => {
  it("E1 · unklar → Rückfrage; Wahl gespeichert; je eigenem Ereignis genau ein Lauf", async () => {
    const umsatz = await wissensobjekt(erik, "Umsatz Region West", "Umsatz Q3: 0,5 Mio (fiktiv).");
    const projekt = await wissensobjekt(erik, "Projektstand West", "Meilenstein 3 geplant.");
    const routine = await routineAusQuellen([umsatz, projekt]);
    const pfad = `${VORMACHEN}/routinen/${routine.id}/zeitplan`;
    const eingaben = { titel: "Änderungsbericht West", inhalt: "Automatisch nach Überarbeitung" };

    // Unklare Ereignisquelle: gezielte Rückfrage mit genau dem Katalog, nichts gespeichert.
    const unklar = await auf(erik.token, "PUT", pfad, {
      zeitplan: { art: "bei_ereignis", beschreibung: "wenn ich mit etwas fertig bin" },
      eingaben,
    });
    expect(unklar.statusCode, unklar.body).toBe(422);
    expect(unklar.json()).toMatchObject({
      grund: "klaerung",
      optionen: [{ ereignis: "wissen_angelegt" }, { ereignis: "wissen_ueberarbeitet" }],
    });
    expect((await routineSicht(routine.id)).zeitplan).toBeNull();

    // Eindeutige Worte: die Wahl steht im Funktionsvertrag.
    const klar = await auf(erik.token, "PUT", pfad, {
      zeitplan: { art: "bei_ereignis", beschreibung: "wenn ich ein Wissensobjekt überarbeite" },
      eingaben,
    });
    expect(klar.statusCode, klar.body).toBe(200);
    expect((await routineSicht(routine.id)).zeitplan).toEqual({
      art: "bei_ereignis",
      ereignis: "wissen_ueberarbeitet",
    });

    // Ohne Ereignis kein Lauf; das Ereignis eines anderen Kontos löst nichts aus.
    expect(await takt()).toEqual([]);
    await services.ko.revise(umsatz, { statement: "Fremde Änderung (fiktiv)." }, admin.id);
    expect(await takt()).toEqual([]);

    // Die eigene Überarbeitung: genau ein Lauf, dann keiner mehr.
    await services.ko.revise(projekt, { statement: "Meilenstein 3 erreicht (fiktiv)." }, erik.id);
    const [e, ...rest] = await takt();
    expect(rest).toEqual([]);
    expect(e).toMatchObject({ routineId: routine.id, stand: "ausgefuehrt" });
    expect(e?.termin).toMatch(/^zeitplan-e-\d+$/);
    expect(klartext((await entwurf(e?.ergebnisId ?? "")).payload.bodyHtml)).toContain(
      "Meilenstein 3 erreicht (fiktiv).",
    );
    expect(await takt()).toEqual([]);
    expect(await entwuerfe("Änderungsbericht West")).toHaveLength(1);
  });
});

/** Zeitplan „bei Überarbeitung eines eigenen Wissensobjekts“ mit diesem Berichtstitel. */
async function beiUeberarbeitung(routineId: string, titel: string): Promise<void> {
  const r = await auf(erik.token, "PUT", `${VORMACHEN}/routinen/${routineId}/zeitplan`, {
    zeitplan: { art: "bei_ereignis", ereignis: "wissen_ueberarbeitet" },
    eingaben: { titel, inhalt: "Automatisch nach Überarbeitung" },
  });
  expect(r.statusCode, r.body).toBe(200);
}

/** Die eigenen Überarbeitungen als Laufkennungen, älteste zuerst. */
async function eigeneUeberarbeitungen(): Promise<string[]> {
  const eintraege = await services.audit.list({ actor: erik.id, action: "ko.revised" });
  return [...eintraege].sort((a, b) => a.seq - b.seq).map((e) => `zeitplan-e-${e.seq}`);
}

const kurz = (ms: number) => new Promise((fertig) => setTimeout(fertig, ms));

describe("EQF-06-K05/K09 · Ereignisse vollständig abarbeiten (Nacharbeit 52)", () => {
  it("E2 · Rückstand über eine Seite hinaus und Neustart: jedes Ereignis genau einmal", async () => {
    const umsatz = await wissensobjekt(erik, "Umsatz Region Rand", "Umsatz Q3: 0,4 Mio (fiktiv).");
    const projekt = await wissensobjekt(erik, "Projektstand Rand", "Meilenstein 0.");
    const routine = await routineAusQuellen([umsatz, projekt]);
    await beiUeberarbeitung(routine.id, "Rückstandsbericht");
    // 51 eigene Ereignisse — mehr als eine Seite (50) — bevor überhaupt ein Takt läuft.
    for (let i = 1; i <= 51; i += 1) {
      await services.ko.revise(projekt, { statement: `Stand ${i} (fiktiv).` }, erik.id);
    }
    const termine: string[] = [];
    for (let i = 0; i < 20; i += 1) {
      const [e, ...rest] = await takt();
      expect(rest).toEqual([]);
      expect(e).toMatchObject({ routineId: routine.id, stand: "ausgefuehrt" });
      termine.push(e?.termin ?? "");
    }
    // Das älteste Ereignis lief zuerst — nicht nur die jüngste Seite.
    expect(termine[0]).toBe((await eigeneUeberarbeitungen())[0]);

    // Neustart: eine neue App mit neuer Zeitsteuerung über denselben dauerhaften Diensten.
    await app.close();
    app = buildApp(services, {
      routinenZeitsteuerung: (l) => {
        takt = l;
      },
    });
    await app.ready();
    // Neue Ereignisse während der Abarbeitung des Rückstands.
    for (let i = 52; i <= 55; i += 1) {
      await services.ko.revise(projekt, { statement: `Stand ${i} (fiktiv).` }, erik.id);
    }
    for (let runde = 0; runde < 60; runde += 1) {
      const ergebnisse = await takt();
      if (ergebnisse.length === 0) {
        break;
      }
      expect(ergebnisse).toHaveLength(1);
      expect(ergebnisse[0]).toMatchObject({ stand: "ausgefuehrt" });
      termine.push(ergebnisse[0]?.termin ?? "");
    }

    const erwartet = await eigeneUeberarbeitungen();
    expect(erwartet).toHaveLength(55);
    // Keine Lücke, keine Dublette, in der Reihenfolge des Geschehens.
    expect(termine).toEqual(erwartet);
    expect(await takt()).toEqual([]);
    expect(await entwuerfe("Rückstandsbericht")).toHaveLength(55);
  }, 120_000);

  it("E3 · Pause und Rechteentzug: kein Lauf, kein Verlust, der Fortschritt rückt vor", async () => {
    const umsatz = await wissensobjekt(erik, "Umsatz Region Tal", "Umsatz Q3: 0,3 Mio (fiktiv).");
    const projekt = await wissensobjekt(erik, "Projektstand Tal", "Meilenstein 0.");
    const routine = await routineAusQuellen([umsatz, projekt]);
    await beiUeberarbeitung(routine.id, "Pausenbericht");
    const zustand = (z: string) =>
      auf(erik.token, "PUT", `${VORMACHEN}/routinen/${routine.id}/zustand`, { zustand: z });
    const ueberarbeite = (text: string) =>
      services.ko.revise(projekt, { statement: `${text} (fiktiv).` }, erik.id);

    // Rückstand von vor der Pause: zwei Ereignisse, eines läuft vor der Pause.
    await ueberarbeite("vor 1");
    await ueberarbeite("vor 2");
    const [erstes] = await takt();
    expect(erstes).toMatchObject({ stand: "ausgefuehrt" });
    await kurz(5);
    expect((await zustand("pausiert")).statusCode).toBe(200);
    await ueberarbeite("während 1");
    await ueberarbeite("während 2");
    expect(await takt()).toEqual([]);
    await kurz(5);
    expect((await zustand("aktiv")).statusCode).toBe(200);
    await ueberarbeite("nach 1");

    const zweites = await takt();
    const drittes = await takt();
    expect(await takt()).toEqual([]);
    const [vor1, vor2, , , nach1] = await eigeneUeberarbeitungen();
    // Der Rückstand von vor der Pause und das Ereignis danach laufen; die der Pause nicht.
    expect([erstes, ...zweites, ...drittes].map((e) => e?.termin)).toEqual([vor1, vor2, nach1]);
    expect(await entwuerfe("Pausenbericht")).toHaveLength(3);

    // Rechteentzug: das Ereignis wird abgelehnt, nichts entsteht, und es kehrt nicht wieder.
    const rolle = await auf(admin.token, "PUT", `/api/users/${erik.id}`, { role: "viewer" });
    expect(rolle.statusCode, rolle.body).toBe(200);
    await ueberarbeite("ohne Recht");
    const [abgelehnt, ...rest] = await takt();
    expect(rest).toEqual([]);
    expect(abgelehnt).toMatchObject({ stand: "abgelehnt", status: 403 });
    expect(await takt()).toEqual([]);
    // Mit wiederhergestelltem Recht läuft das abgelehnte Ereignis nicht nachträglich.
    const zurueck = await auf(admin.token, "PUT", `/api/users/${erik.id}`, { role: "experte" });
    expect(zurueck.statusCode, zurueck.body).toBe(200);
    erik = { ...erik, token: await anmelden("erik@eqf06-quellen.test") };
    expect(await takt()).toEqual([]);
    expect(await entwuerfe("Pausenbericht")).toHaveLength(3);
  });
});

describe("EQF-06-K06 · drei Übergabearten, im Aktionskern unterschieden", () => {
  it("U1/U2 · selbstständig: ein Schritt; Ergebnis zur Prüfung: abgeschlossen erst nach dem Öffnen", async () => {
    const umsatz = await wissensobjekt(erik, "Umsatz Region Ost", "Umsatz Q3: 0,9 Mio (fiktiv).");
    const projekt = await wissensobjekt(erik, "Projektstand Ost", "Meilenstein 1 erreicht.");
    let routine = await routineAusQuellen([umsatz, projekt]);
    expect(routine.ausfuehrung).toBe("selbststaendig");
    const gid = await gespraech();

    const eins = await lauf(routine, gid, "lauf-u1", "Bericht selbstständig");
    const a1 = (eins.json() as { auftrag: KlaraAuftrag }).auftrag;
    expect(a1.geplanteSchritte).toBe(1);
    expect((await fuehreAus(gid, a1, "bericht-1", 1)).auftrag.stand).toBe("abgeschlossen");

    const art = await auf(erik.token, "PUT", `${VORMACHEN}/routinen/${routine.id}/ausfuehrung`, {
      ausfuehrung: "zur_pruefung",
    });
    expect(art.statusCode, art.body).toBe(200);
    routine = await routineSicht(routine.id);
    expect(routine.ausfuehrung).toBe("zur_pruefung");
    const ereignisse = await services.audit.list({ action: "bpa06.routine.ausfuehrung" });
    expect(ereignisse.map((x) => x.payload)).toEqual([{ ausfuehrung: "zur_pruefung" }]);

    const zwei = await lauf(routine, gid, "lauf-u2", "Bericht zur Prüfung");
    expect(zwei.statusCode, zwei.body).toBe(201);
    const a2 = (zwei.json() as { auftrag: KlaraAuftrag }).auftrag;
    expect(a2.geplanteSchritte).toBe(2);
    expect(a2.plan?.[1]).toMatchObject({ aktion: "oeffnen", ausSchritt: 1 });
    const angelegt = await fuehreAus(gid, a2, "bericht-1", 1);
    expect(angelegt.schritt.stand).toBe("gespeichert");
    // Der Bericht steht da, der Auftrag wartet auf die Prüfung durch die Person.
    expect(angelegt.auftrag.stand).toBe("laeuft");
    const pruefen = await fuehreAus(gid, a2, "pruefen-2", 2);
    expect(pruefen.schritt.geprueft?.id).toBe(angelegt.schritt.ergebnis?.id);
    const offen = await auf(erik.token, "PUT", schritte(gid, a2.id, "pruefen-2"), {
      nr: 2,
      aktion: "oeffnen",
      ziel: pruefen.schritt.ziel,
      auftragFassung: a2.fassung,
      stand: "abgeschlossen",
    });
    expect(offen.statusCode, offen.body).toBe(200);
    expect((offen.json() as { auftrag: KlaraAuftrag }).auftrag.stand).toBe("abgeschlossen");
  });

  it("U3 · gemeinsam schrittweise: kein Zeitplan, kein Hintergrundlauf; ungültige Art abgewiesen", async () => {
    const umsatz = await wissensobjekt(erik, "Umsatz Region Mitte", "Umsatz Q3: 0,7 Mio (fiktiv).");
    const projekt = await wissensobjekt(erik, "Projektstand Mitte", "Meilenstein 2 offen.");
    const routine = await routineAusQuellen([umsatz, projekt]);
    const pfad = `${VORMACHEN}/routinen/${routine.id}`;

    const falsch = await auf(erik.token, "PUT", `${pfad}/ausfuehrung`, {
      ausfuehrung: "irgendwie",
    });
    expect(falsch.statusCode, falsch.body).toBe(400);

    // Mit Zeitplan geht „schrittweise“ nicht — und umgekehrt.
    const woche = {
      art: "woechentlich",
      wochentag: 1,
      uhrzeit: "08:00",
      zeitzone: "Europe/Berlin",
      nachholen: "auslassen",
    };
    const plan = await auf(erik.token, "PUT", `${pfad}/zeitplan`, {
      zeitplan: woche,
      eingaben: { titel: "Bericht", inhalt: "Kurz" },
    });
    expect(plan.statusCode, plan.body).toBe(200);
    const mitPlan = await auf(erik.token, "PUT", `${pfad}/ausfuehrung`, {
      ausfuehrung: "schrittweise",
    });
    expect(mitPlan.statusCode, mitPlan.body).toBe(409);
    expect(mitPlan.json()).toMatchObject({ grund: "schrittweise" });
    await auf(erik.token, "PUT", `${pfad}/zeitplan`, { zeitplan: null });
    const ohnePlan = await auf(erik.token, "PUT", `${pfad}/ausfuehrung`, {
      ausfuehrung: "schrittweise",
    });
    expect(ohnePlan.statusCode, ohnePlan.body).toBe(200);
    const sofort = await auf(erik.token, "PUT", `${pfad}/zeitplan`, {
      zeitplan: { art: "sofort" },
      eingaben: { titel: "Bericht", inhalt: "Kurz" },
    });
    expect(sofort.statusCode, sofort.body).toBe(409);
    expect(await takt()).toEqual([]);

    // Von Hand: der Auftrag hat beide Schritte; ausgeführt wird erst auf den Schritt der Person.
    const gid = await gespraech();
    const l = await lauf(await routineSicht(routine.id), gid, "lauf-u3", "Bericht gemeinsam");
    expect(l.statusCode, l.body).toBe(201);
    const a = (l.json() as { auftrag: KlaraAuftrag }).auftrag;
    expect(a.geplanteSchritte).toBe(2);
    expect(a.schritte).toEqual([]);
    expect(await entwuerfe("Bericht gemeinsam")).toHaveLength(0);
    expect((await fuehreAus(gid, a, "bericht-1", 1)).schritt.stand).toBe("gespeichert");
    expect(await entwuerfe("Bericht gemeinsam")).toHaveLength(1);
  });
});
