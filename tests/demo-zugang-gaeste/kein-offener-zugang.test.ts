// ================================================================================================
// JOB 3656 · DEMO-ZUGANG-GAESTE — „KEIN OFFENER ZUGANG", an der ROUTE nachgewiesen.
// ================================================================================================
//
// WOHER DIESE DATEI KOMMT. Aus Messvorschrift (e) des Auftrags, wörtlich:
//
//   „Gegenprobe: es gibt keinen Aufruf, der ohne angemeldetes Konto Demoinhalte liefert — weise das
//    an der Route nach, nicht an der Flaeche."
//
// WARUM SIE KEIN ZWEITER WEG NEBEN DEM VORHANDENEN IST. Der Hausbestand deckt die Nachbarfragen,
// aber nicht diese:
//   · `tests/security/route-guard-audit.test.ts` vergleicht die Schutzart JE ROUTE gegen
//     `ROUTE_GUARD_MATRIX` und verlangt für jede öffentliche Route eine Begründung. Es beantwortet
//     „trägt diese Route das erwartete Recht?" — nicht „tritt geladener Demobestand irgendwo ohne
//     Anmeldung nach außen?". Eine NEUE öffentliche Route mit Begründung bliebe dort grün.
//   · `tests/security/g26-matrix-laufzeit.test.ts` misst drei rollenimplizite Lesewege am Draht,
//     aber gegen ein VERTRAULICHES Objekt und mit angemeldeten Identitäten. Der unangemeldete
//     Aufruf gegen den DEMObestand kommt dort nicht vor.
// Diese Datei leiht sich deshalb beide Werkzeuge, statt eigene zu bauen: den Routenscanner aus
// `routeGuardAudit.ts` (kein zweiter Scanner) und die echte Komposition `buildApp(buildServices())`
// mit `app.inject` wie g26 (kein zweiter Aufbau).
//
// WAS SIE NICHT BEHAUPTET. Dieser Job hat weder eine Gastrolle noch ein Gastkonto gebaut — die
// dafür nötigen Produktdateien liegen ausserhalb seiner Zielpfade (siehe RUECKGABE.md). Gemessen
// wird hier ausschliesslich Lieferpunkt 4: dass es keinen unangemeldeten Weg an Demoinhalte gibt,
// und wo die EINE verbleibende öffentliche Tür sitzt (D3 — die Ersteinrichtung einer leeren
// Instanz, die JOB 3655 gerade zum Normalfall gemacht hat).
//
// ================================================================================================
// JOB 3852 · WOHER DER ZULAUF KOMMT — CODEX' BESTELLUNG AUS DEM URTEIL ZU JOB 3656.
// ================================================================================================
//
// `archiv/3656/runde-1/ben.md:26`, Prüfpunkt 6, wörtlich:
//
//   „D2b verwendet eine ungültige Kennung und untersucht nur gescannte öffentliche GET-Routen
//    (`kein-offener-zugang.test.ts:142`). Ergänzen: gültige Demo-IDs, aktivierte optionale Routen
//    und unangemeldete Aufrufe sämtlicher relevanter Lesewege. D2c prüft nach DELETE lediglich
//    `present:true` (`:185`); ergänzend vollständigen Bestand vorher/nachher vergleichen, um
//    Teilverlust zu erkennen."
//
// DER ALTE STAND WAR AUS ZWEI GRÜNDEN BLIND, und beide sind strukturell, nicht bloss knapp:
//   (1) ERFUNDENE KENNUNG. D2b besetzte JEDEN Platzhalter mit `"id-das-es-nicht-gibt"`. Eine Route,
//       die nur für ein EXISTIERENDES Objekt etwas herausgibt, konnte damit gar nichts lecken: sie
//       antwortete 404, der Rumpf trug keinen Demotitel, der Fall war grün. Der Wert bleibt unten
//       als EIGENER Fall (D2b-alt) erhalten — die 404-Achse ist auch etwas wert —, ist aber nicht
//       mehr der einzige: D2f klopft mit Kennungen aus dem LAUF.
//   (2) NICHT REGISTRIERTE OPTIONALE ROUTEN. `scanAllRoutes()` liest den QUELLTEXT und findet auch
//       Routen, die zur Laufzeit nur hinter einem Schalter existieren. Die Testinstanz wurde ohne
//       diese Schalter gebaut — für jede solche Route lief D2b in den 404 einer nicht eingebauten
//       Tür. Es wurde geklopft, wo nichts war. D2g baut deshalb eine zweite Instanz MIT Schalter
//       und belegt vor der Messung, dass die Tür jetzt wirklich eingebaut ist.
// Dazu die dritte Bestellung: D2c mass nach dem unangemeldeten DELETE ein Ja/Nein (`present`), das
// einen TEILVERLUST nicht sehen kann. Es misst jetzt Anzahl UND Titelmenge vorher gegen nachher.
//
// ================================================================================================
// JOB 3852 · RUNDE 2 — ZWEI KORREKTUREN AUS CODEX' URTEIL, BEIDE AM EIGENEN PRÜFWERKZEUG.
// ================================================================================================
//
// (A) ZURÜCKGENOMMENER BEFUND — DIE SONDE WAR KAPUTT, NICHT DAS PRODUKT. Runde 1 meldete hier als
//     Befund, `POST /api/auth/reset` antworte unangemeldet mit `500 INTERNAL` statt mit einer
//     Ablehnung. DAS WAR FALSCH, und die Ursache lag in dieser Datei: die Sonde schickte das Feld
//     `password`, der Handler nimmt aber `newPassword` (`services/auth/src/routes.ts:441`
//     `Body: { token: string; newPassword: string }`, eingelöst `:459`). Das fehlende Feld lief als
//     `undefined` in `newPassword.length` (`services/auth/src/service.ts:910`) und warf dort, BEVOR
//     die Tokenprüfung (`:913-935`) überhaupt erreicht war — der 500 war der Absturz an der eigenen
//     Nutzlast. Mit dem vertragsgemässen Feld antwortet der Weg gemessen
//     `401 {"error":"INVALID_CREDENTIALS","message":"Reset-Token ungültig oder abgelaufen."}`, also
//     sauber ablehnend. Es gibt an dieser Stelle KEINEN Produktbefund. Die Lehre steht als Regel in
//     `NUTZLAST_JE_WEG`: jede Nutzlast wird aus dem tatsächlichen HTTP-Vertrag abgeleitet.
//
// (B) EIN 5xx IST KEIN BESTANDENER NACHWEIS. Bis Runde 1 prüften D2f und D2g ausschliesslich, ob ein
//     Demotitel im Antwortkörper steht. Eine Route, die unangemeldet mit `503` abstürzt, trägt
//     keinen Titel — und war damit still grün, obwohl über die Leckfrage nichts gesagt war: ein
//     Aufruf, der den Handler gar nicht erreicht, kann auch nicht belegen, dass der Handler dicht
//     ist. Codex hat das mit einem erzwungenen 503 auf `/health` nachgewiesen; alle Fälle blieben
//     grün. `istServerfehler()` unten macht daraus ab jetzt ein Rot mit Methode, URL, Datei und
//     gemessenem Status. (D2c war davon nie betroffen: `istAblehnung()` kennt nur 401/403/404 und
//     ist bei 5xx immer schon rot gewesen.)
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { scanAllRoutes } from "../security/routeGuardAudit";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const ADMIN = { name: "Demo-Admin", email: "admin@job3656.test", password: "geheim12345" };

/** Eine Antwort gilt als Ablehnung, wenn sie abweist UND nichts vom Bestand mitgibt. */
function istAblehnung(status: number): boolean {
  return status === 401 || status === 403 || status === 404;
}

/**
 * Die echte Komposition mit Bootstrap-Admin (erstes Konto = Admin, `service.ts:172`) und
 * GELADENEM Demobestand. Die Instanz ist davor leer — nach dem Seed ist deshalb JEDER vorhandene
 * Titel ein Demoinhalt, und genau diese Titel sind unten die Suchmuster.
 */
async function aufbauMitDemobestand(): Promise<{
  app: App;
  admin: Auth;
  demoTitel: string[];
  geladen: number;
  /** ECHTE Wissensobjekt-Kennungen aus DIESEM Lauf — nicht aus einer Fixture (s. Titel unten). */
  koIds: string[];
  /** ECHTE Demopaket-Kennungen aus DIESEM Lauf, für die Wege, die ein Paket meinen. */
  paketIds: string[];
}> {
  const app = buildApp(buildServices());
  const angelegt = await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  if (angelegt.statusCode !== 201) {
    throw new Error(`Bootstrap-Admin nicht angelegt: ${angelegt.statusCode} ${angelegt.body}`);
  }
  const anmeldung = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ADMIN.email, password: ADMIN.password },
  });
  if (anmeldung.statusCode !== 200) {
    throw new Error(`Bootstrap-Admin nicht angemeldet: ${anmeldung.statusCode} ${anmeldung.body}`);
  }
  const admin: Auth = { authorization: `Bearer ${anmeldung.json().token}` };

  const seed = await app.inject({
    method: "POST",
    url: "/api/admin/demo-seed",
    headers: admin,
    payload: { force: true, locale: "de" },
  });
  if (seed.statusCode !== 200) {
    throw new Error(`Demo-Seed fehlgeschlagen: ${seed.statusCode} ${seed.body}`);
  }

  const bestand = await app.inject({ method: "GET", url: "/api/kos", headers: admin });
  if (bestand.statusCode !== 200) {
    throw new Error(`Bestand nicht lesbar: ${bestand.statusCode} ${bestand.body}`);
  }
  const rohe: unknown = bestand.json();
  const zeilen: { title?: unknown; id?: unknown }[] = Array.isArray(rohe)
    ? rohe
    : ((rohe as { items?: { title?: unknown; id?: unknown }[] }).items ?? []);
  // Lange, unterscheidbare Titel: ein Wort wie „Technik" stünde auch in einem Sprachstring und
  // würde einen Fehlalarm erzeugen. Die Titel kommen aus dem LAUF, nicht aus einer Fixture.
  const demoTitel = zeilen
    .map((z) => (typeof z.title === "string" ? z.title : ""))
    .filter((t) => t.length >= 12)
    .slice(0, 12);
  // JOB 3852 · Lieferung 2: dieselbe Herkunft wie die Titel — die Kennungen kommen aus DIESEM Lauf.
  const koIds = zeilen
    .map((z) => (typeof z.id === "string" ? z.id : ""))
    .filter((id) => id.length > 0);

  const pakete = await app.inject({
    method: "GET",
    url: "/api/admin/demo-packages",
    headers: admin,
  });
  if (pakete.statusCode !== 200) {
    throw new Error(`Demopakete nicht lesbar: ${pakete.statusCode} ${pakete.body}`);
  }
  const paketIds = ((pakete.json() as { packages?: { id?: unknown }[] }).packages ?? [])
    .map((p) => (typeof p.id === "string" ? p.id : ""))
    .filter((id) => id.length > 0);

  return { app, admin, demoTitel, geladen: zeilen.length, koIds, paketIds };
}

type Umgebung = Awaited<ReturnType<typeof aufbauMitDemobestand>>;

/**
 * JOB 3852 · Lieferung 5: der VOLLSTÄNDIGE Stand, nicht das Ja/Nein.
 *
 * `GET /api/admin/demo-seed` trägt gemessen genau zwei Felder (`{"present":true,"count":26}`,
 * admin-routes.ts:94) — `present` ist ein Flag und `count` eine Zahl. Wer einen TEILVERLUST sehen
 * will, braucht ausserdem die MENGE: deshalb kommen die Titel aus `GET /api/kos`. Hier steht
 * bewusst KEIN Längenfilter (anders als bei den Suchmustern oben): für den Vorher/Nachher-Vergleich
 * zählt jede Zeile, auch die mit kurzem Titel.
 */
async function standAufnehmen(
  app: App,
  admin: Auth,
): Promise<{ anzahl: number; titel: string[]; present: unknown; count: unknown }> {
  const bestand = await app.inject({ method: "GET", url: "/api/kos", headers: admin });
  if (bestand.statusCode !== 200) {
    throw new Error(`Bestand nicht lesbar: ${bestand.statusCode} ${bestand.body}`);
  }
  const rohe: unknown = bestand.json();
  const zeilen: { title?: unknown }[] = Array.isArray(rohe)
    ? rohe
    : ((rohe as { items?: { title?: unknown }[] }).items ?? []);
  const stand = await app.inject({ method: "GET", url: "/api/admin/demo-seed", headers: admin });
  if (stand.statusCode !== 200) {
    throw new Error(`Demostand nicht lesbar: ${stand.statusCode} ${stand.body}`);
  }
  const gemeldet = stand.json() as { present?: unknown; count?: unknown };
  return {
    anzahl: zeilen.length,
    titel: zeilen.map((z) => (typeof z.title === "string" ? z.title : "")).sort(),
    present: gemeldet.present,
    count: gemeldet.count,
  };
}

/**
 * Platzhalter in einer gescannten URL mit echten Werten besetzen — sonst misst der Aufruf nichts.
 *
 * JOB 3852: `kennung` ist ab hier ein WIRKLICH VORHANDENER Wert aus dem Lauf. Welcher, entscheidet
 * `kennungFuer()`: ein Weg unter `/api/admin/demo-packages/…` meint ein Demopaket, jeder andere
 * Platzhalter ein Wissensobjekt. Die drei benannten Ersetzungen darüber bleiben unverändert.
 */
function urlBesetzen(url: string, kennung: string): string {
  return url
    .replace(":locale", "de")
    .replace(":lang", "de")
    .replace(":key", "app.title")
    .replace(/:[A-Za-z]+/g, kennung);
}

/** Die zur URL passende ECHTE Kennung: Paketkennung für Paketwege, sonst Objektkennung. */
function kennungFuer(url: string, u: Pick<Umgebung, "koIds" | "paketIds">): string {
  return url.includes("/demo-packages/") ? (u.paketIds[0] ?? "") : (u.koIds[0] ?? "");
}

/**
 * JOB 3852 · Lieferung 3: Fastifys Antwort auf eine Route, die es GAR NICHT GIBT.
 *
 * Gemessen am 13.09.2026: `{"message":"Route GET:/addin not found","error":"Not Found",
 * "statusCode":404}` — unterscheidbar vom 404 einer eingebauten Tür, die das Objekt nicht findet
 * (`{"error":"NOT_FOUND","message":"Nicht gefunden."}`). Genau diese Unterscheidung ist der Grund,
 * aus dem der alte D2b nichts messen konnte: er sah beides als „nichts durchgekommen".
 */
function istUnregistriert(status: number, body: string): boolean {
  return status === 404 && /"message"\s*:\s*"Route [A-Z]+:[^"]* not found"/.test(body);
}

/**
 * JOB 3852 · RUNDE 2, Korrekturpflicht 2 — DIE EINE AUSNAHME VOM SATZ „5xx IST ROT", benannt.
 *
 * Gemessen am 13.09.2026 antworten von 16 öffentlichen Wegen GENAU ZWEI mit einem 5xx, und beide mit
 * demselben, ausdrücklich abgeschalteten Dienst:
 *   `GET /api/auth/oidc/start` → 501 {"error":"OIDC_DISABLED","message":"SSO ist nicht konfiguriert."}
 *   `POST /api/auth/oidc`      → 501 {"error":"OIDC_DISABLED","message":"SSO ist nicht konfiguriert."}
 * Das ist kein Absturz, sondern die bewusste Antwort einer nicht konfigurierten Funktion
 * (`services/auth/src/routes.ts:473-476` `if (!options.oidc)`), und die Testinstanz konfiguriert SSO
 * nicht. Die Ausnahme ist deshalb GESCHLOSSEN geführt: sie gilt nur für diese zwei Schlüssel, nur bei
 * genau 501 und nur mit `OIDC_DISABLED` im Rumpf. Ein 500/502/503/504 ist IMMER rot, auch hier.
 */
const AUSGESCHALTET_501: readonly string[] = ["GET /api/auth/oidc/start", "POST /api/auth/oidc"];

/**
 * Ein Serverfehler ist kein bestandener Lecknachweis: der Aufruf hat den Handler nicht durchlaufen,
 * über die Dichtheit des Handlers ist damit NICHTS gesagt. Ein titelfreier 5xx darf deshalb nicht
 * als „nichts durchgekommen" gelten (Codex, Promptverbesserung zu Runde 1).
 */
function istServerfehler(e: Klopfergebnis): boolean {
  if (e.status < 500) {
    return false;
  }
  return !(
    e.status === 501 &&
    AUSGESCHALTET_501.includes(`${e.method} ${e.url}`) &&
    e.body.includes('"OIDC_DISABLED"')
  );
}

/** Die Meldung, die Codex bestellt hat: Methode, URL, Datei, gemessener Status, Anfang des Rumpfes. */
function serverfehlerZeile(e: Klopfergebnis): string {
  return `${e.method} ${e.aufgerufen} (${e.datei}) antwortete unangemeldet mit Status ${e.status} — ${e.body.slice(0, 160)}`;
}

// ================================================================================================
// JOB 3852 · Lieferung 3 — DIE METHODEN STEHEN NAMENTLICH DA, NICHT ALS „ALLE ANDEREN".
// ================================================================================================
// Gemessen am 13.09.2026 über `scanAllRoutes()`: 16 öffentliche Routen, davon 9 GET und 7 POST.
// KEIN öffentliches PUT, PATCH oder DELETE. Die Liste ist deshalb GESCHLOSSEN geführt und wird in
// BEIDE Richtungen geprüft (D2f): verschwindet ein Zweig, ist der Test rot statt still schmaler —
// taucht ein Zweig auf, der hier nicht steht, ebenfalls.
const OEFFENTLICHE_METHODEN = ["GET", "POST"] as const;

/**
 * Nutzlasten für die HEUTE öffentlichen Nicht-GET-Wege (alle sieben aus
 * `services/auth/src/routes.ts`). Ein leerer Rumpf `{}` erreicht die Leckfläche gar nicht erst —
 * gemessen: `POST /api/auth/login` mit `{}` endet in einem 500, `POST /api/auth/forgot` ebenso.
 * Eine Sonde, die schon am Rumpfparser scheitert, prüft nichts.
 *
 * JOB 3852 · RUNDE 2 — DIE REGEL, AN DER DIESE TABELLE IN RUNDE 1 GESCHEITERT IST: jedes Feld wird
 * aus dem TATSÄCHLICHEN HTTP-Vertrag des Handlers abgelesen (die `Body:`-Signatur am `app.post`),
 * nie aus dem, was plausibel klingt. `reset` hiess deshalb fälschlich `password` statt `newPassword`
 * und stürzte vor der Tokenprüfung ab (s. Kopf (A)). Gegenprobe gegen genau diesen Fehler ist
 * `istServerfehler()`: eine Sonde, die den Prüfpfad nicht erreicht, endet im 5xx und ist ab jetzt
 * rot, statt sich als bestandener Lecknachweis auszugeben.
 *
 * GEMESSENE STATUS (13.09.2026, unangemeldet, mit genau diesen Rümpfen): register 201 · login 403
 * NOT_APPROVED · logout 204 · forgot 204 · reset 401 INVALID_CREDENTIALS · oidc 501 OIDC_DISABLED ·
 * setup 409 ALREADY_SETUP. Jeder Weg erreicht damit seinen Handler.
 */
const NUTZLAST_JE_WEG: Record<string, Record<string, unknown>> = {
  "POST /api/auth/register": {
    name: "Unangemeldete Sonde",
    email: "sonde@job3852.test",
    password: "geheim12345",
  },
  "POST /api/auth/login": { email: "sonde@job3852.test", password: "geheim12345" },
  "POST /api/auth/logout": {},
  "POST /api/auth/forgot": { email: "sonde@job3852.test" },
  "POST /api/auth/reset": { token: "kein-echtes-token", newPassword: "geheim12345" },
  "POST /api/auth/oidc": { code: "kein-echter-code", state: "kein-echter-state" },
  "POST /api/auth/setup": {
    name: "Unangemeldete Sonde",
    email: "sonde2@job3852.test",
    password: "geheim12345",
  },
};

/**
 * Der Rumpf für JEDEN nicht namentlich geführten öffentlichen Nicht-GET-Weg — also für jede Route,
 * die künftig öffentlich WIRD. Er trägt die ECHTE Objektkennung in allen gebräuchlichen Feldnamen
 * und einen Suchtext.
 *
 * WARUM DER SUCHTEXT EIN ANGESCHNITTENER TITEL IST UND KEIN GANZER. Ein vollständiger Demotitel im
 * ANFRAGERUMPF würde von jeder Route, die ihre Eingabe zurückspiegelt, als „Leck" gemeldet — ein
 * Fehlalarm, den der Test selbst erzeugt. Die Sonde ist deshalb auf 11 Zeichen gekürzt und damit
 * kürzer als das kürzeste Suchmuster (`demoTitel` filtert auf `>= 12`); sie kann keinen Titel
 * enthalten, aber eine Suche findet mit ihr den ganzen. D2f prüft diese Zusage ausdrücklich nach,
 * statt sie zu behaupten.
 */
function generischeNutzlast(u: Pick<Umgebung, "koIds" | "demoTitel">): Record<string, unknown> {
  const koId = u.koIds[0] ?? "";
  const sonde = (u.demoTitel[0] ?? "").slice(0, 11);
  return {
    text: sonde,
    question: sonde,
    query: sonde,
    q: sonde,
    mode: "retrieval-only",
    id: koId,
    koId,
    ids: [koId],
    sources: [koId],
    sourceIds: [koId],
  };
}

function nutzlastFuer(
  method: string,
  url: string,
  u: Pick<Umgebung, "koIds" | "demoTitel">,
): Record<string, unknown> | undefined {
  if (method === "GET") {
    return undefined;
  }
  return NUTZLAST_JE_WEG[`${method} ${url}`] ?? generischeNutzlast(u);
}

interface Klopfergebnis {
  method: string;
  url: string;
  datei: string;
  aufgerufen: string;
  status: number;
  body: string;
  unregistriert: boolean;
}

/** Jede öffentliche Route EINMAL unangemeldet anklopfen — mit echten Kennungen im Pfad und im Rumpf. */
async function oeffentlicheWegeKlopfen(u: Umgebung): Promise<Klopfergebnis[]> {
  const ergebnisse: Klopfergebnis[] = [];
  for (const route of scanAllRoutes().filter((r) => r.protection === "public")) {
    const aufgerufen = urlBesetzen(route.url, kennungFuer(route.url, u));
    const payload = nutzlastFuer(route.method, route.url, u);
    const antwort = await u.app.inject({
      method: route.method as "GET",
      url: aufgerufen,
      ...(payload ? { payload } : {}),
    });
    ergebnisse.push({
      method: route.method,
      url: route.url,
      datei: route.file,
      aufgerufen,
      status: antwort.statusCode,
      body: antwort.body,
      unregistriert: istUnregistriert(antwort.statusCode, antwort.body),
    });
  }
  return ergebnisse;
}

/** Kein Suchmuster darf in einem Anfragerumpf stehen — sonst meldet der Test seinen eigenen Text. */
function nutzlastenSindTitelfrei(u: Umgebung): string[] {
  const verstoesse: string[] = [];
  for (const route of scanAllRoutes().filter((r) => r.protection === "public")) {
    const payload = nutzlastFuer(route.method, route.url, u);
    if (!payload) {
      continue;
    }
    const roh = JSON.stringify(payload);
    for (const titel of u.demoTitel) {
      if (roh.includes(titel)) {
        verstoesse.push(`${route.method} ${route.url} trägt „${titel}" im Anfragerumpf`);
      }
    }
  }
  return verstoesse;
}

/**
 * JOB 3852 · Lieferung 4 — die öffentlichen Routen, die es erst mit gesetztem Schalter GIBT.
 *
 * Gemessen am 13.09.2026 (alle 16 öffentlichen Routen einzeln unangemeldet angeklopft): GENAU EINE
 * antwortet mit Fastifys „Route … not found", ist also gar nicht eingebaut — `GET /addin`.
 * Schalter: `KLARWERK_ADDON_API` (`services/app/src/addon-api.ts:6-9`, gelesen in
 * `services/app/src/build-app.ts:1639` `if (addonApiEnabled())`, Registrierung `:1751`
 * `app.register(addinStaticRoutes())`).
 *
 * DER REGISTRIERUNGSBELEG IST HIER NICHT „STATUS ≠ 404", und das ist gemessen, nicht bequem:
 * `GET /addin` antwortet AUCH EINGEBAUT mit 404 — der Add-in-Namensraum hat bewusst kein
 * Auto-Index (`addin-static-routes.ts:197` → `staticNotFound`). Belegt wird deshalb doppelt:
 * (a) der Rumpf ist nicht mehr Fastifys „Route … not found", sondern der statische Fehlerkörper des
 * Plugins, und (b) eine wirklich ausgelieferte Datei desselben Namensraums antwortet 200.
 */
const SCHALTBARE_OEFFENTLICHE_WEGE = [
  {
    schluessel: "GET /addin",
    variable: "KLARWERK_ADDON_API",
    wert: "1",
    lebendbeleg: "/addin/taskpane.html",
  },
] as const;

describe("JOB 3656 · D1 · Demoinhalte sind im Quelltext nie öffentlich", () => {
  it("D1 · jede Route, die Demobestand liefert oder ändert, trägt `users.manage`", () => {
    const demoRouten = scanAllRoutes().filter((r) => r.url.includes("demo"));
    // KALIBRIERUNG: ohne Treffer würde der Test unten nichts prüfen und wäre trivial grün.
    expect(
      demoRouten.length,
      "der Scanner findet keine Demo-Routen — Filter oder Pfade kaputt",
    ).toBeGreaterThanOrEqual(8);
    for (const route of demoRouten) {
      expect(
        route.protection,
        `${route.method} ${route.url} (${route.file}) ist nicht admin-geschützt`,
      ).toBe("users.manage");
    }
  });
});

describe("JOB 3656 · D2 · geladener Demobestand tritt durch KEINE öffentliche Route nach außen", () => {
  let umgebung: Umgebung;

  beforeAll(async () => {
    umgebung = await aufbauMitDemobestand();
  });

  it("D2a · KALIBRIERUNG: es liegt wirklich Demobestand mit unterscheidbaren Titeln da", () => {
    expect(
      umgebung.geladen,
      "kein Bestand geladen — D2b/D2c könnten nichts lecken",
    ).toBeGreaterThan(0);
    expect(
      umgebung.demoTitel.length,
      "keine ausreichend langen Titel — die Suchmuster unten wären leer",
    ).toBeGreaterThan(0);
  });

  // JOB 3852: DIESER FALL BLEIBT WÖRTLICH ERHALTEN — als die 404-ACHSE, nicht als der Beweis.
  // Er klopft mit einer Kennung, die es nicht gibt. Das ist die schwächere Aussage („auch eine
  // ins Leere zeigende Kennung holt nichts heraus") und sie ist etwas wert; sie ist nur nicht mehr
  // die einzige. Der Beweis über die STARKE Aussage steht in D2f — und genau der Unterschied
  // zwischen beiden Fällen ist die Gegenprobe V1: eine Leseroute, die öffentlich wird, lässt diesen
  // Fall hier GRÜN und macht D2f ROT.
  it("D2b-alt · jede öffentliche GET-Route ohne Anmeldung, mit einer Kennung, die es NICHT gibt", async () => {
    const { app, demoTitel } = umgebung;
    const demoId = "id-das-es-nicht-gibt";
    const oeffentlich = scanAllRoutes().filter(
      (r) => r.protection === "public" && r.method === "GET",
    );
    // KALIBRIERUNG: die öffentliche Fläche ist nicht leer (sonst prüft die Schleife nichts).
    expect(oeffentlich.length, "keine öffentlichen GET-Routen gefunden").toBeGreaterThanOrEqual(5);

    for (const route of oeffentlich) {
      const url = urlBesetzen(route.url, demoId);
      const antwort = await app.inject({ method: "GET", url });
      for (const titel of demoTitel) {
        expect(
          antwort.body,
          `${route.method} ${url} (${route.file}) gibt ohne Anmeldung den Demotitel „${titel}" heraus`,
        ).not.toContain(titel);
      }
    }
  });

  // ==============================================================================================
  // JOB 3852 · Lieferung 2 — DIE KALIBRIERUNG, DIE BEWEIST, DASS DIE KENNUNGEN ECHT SIND.
  // ==============================================================================================
  // Ohne sie wäre der neue D2f genauso blind wie der alte D2b, nur mit anderem Text: eine Kennung,
  // die nicht auflöst, macht jede Route, die nur für vorhandene Objekte etwas herausgibt, trivial
  // grün. Der Fall ist deshalb rot MIT NENNUNG DER KENNUNG, nicht bloss mit „ungleich".
  it("D2e · KALIBRIERUNG: jede benutzte Kennung löst mit angemeldetem Admin wirklich auf", async () => {
    const { app, admin, koIds, paketIds, demoTitel } = umgebung;
    const koId = koIds[0] ?? "";
    const paketId = paketIds[0] ?? "";
    expect(
      koId,
      "keine Wissensobjekt-Kennung aus dem Lauf — D2f klopfte wieder ins Leere",
    ).not.toBe("");
    expect(
      paketId,
      "keine Demopaket-Kennung aus dem Lauf — die Paketwege blieben ungeprüft",
    ).not.toBe("");

    const objekt = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers: admin });
    expect(
      objekt.statusCode,
      `die Objektkennung „${koId}" löst nicht auf: ${objekt.statusCode} ${objekt.body.slice(0, 200)}`,
    ).toBe(200);
    expect(
      demoTitel.some((t) => objekt.body.includes(t)),
      `die Objektkennung „${koId}" löst auf, trägt aber keinen der Suchtitel — dann wäre ein Leck über sie nicht erkennbar`,
    ).toBe(true);

    const paket = await app.inject({
      method: "GET",
      url: `/api/admin/demo-packages/${paketId}/preview?aktion=zuruecksetzen`,
      headers: admin,
    });
    expect(
      paket.statusCode,
      `die Paketkennung „${paketId}" löst nicht auf: ${paket.statusCode} ${paket.body.slice(0, 200)}`,
    ).toBe(200);
  });

  it("D2d · KALIBRIERUNG: mit `users.manage` liefert derselbe Weg den Stand — sonst wäre D2c trivial", async () => {
    const { app, admin } = umgebung;
    const stand = await app.inject({ method: "GET", url: "/api/admin/demo-seed", headers: admin });
    expect(stand.statusCode).toBe(200);
    expect(stand.json().count, "der Admin sieht keinen Demobestand").toBeGreaterThan(0);
  });
});

// ==================================================================================================
// JOB 3852 · Lieferung 3 — SÄMTLICHE ÖFFENTLICHEN LESEWEGE, MIT ECHTEN KENNUNGEN.
// ==================================================================================================
// EIGENE INSTANZ, und der Grund ist gemessen: die Sonde ruft `POST /api/auth/register` und
// `POST /api/auth/setup` auf und legt damit Konten an. Auf der geteilten `beforeAll`-Instanz würde
// sie den Zustand verändern, den D2a/D2d/D2e beschreiben — und ein Vorher/Nachher-Vergleich auf
// einer Instanz, die ein Nachbarfall mitbenutzt, misst nicht, was er behauptet.
describe("JOB 3852 · D2f · jeder öffentliche Weg JEDER Methode, unangemeldet, mit echten Kennungen", () => {
  let umgebung: Umgebung;
  let ergebnisse: Klopfergebnis[];
  let vorher: Awaited<ReturnType<typeof standAufnehmen>>;
  let nachher: Awaited<ReturnType<typeof standAufnehmen>>;

  beforeAll(async () => {
    umgebung = await aufbauMitDemobestand();
    vorher = await standAufnehmen(umgebung.app, umgebung.admin);
    ergebnisse = await oeffentlicheWegeKlopfen(umgebung);
    nachher = await standAufnehmen(umgebung.app, umgebung.admin);
  });

  it("D2f-1 · KALIBRIERUNG: jede namentlich geführte Methode hat mindestens einen geprüften Weg", () => {
    for (const methode of OEFFENTLICHE_METHODEN) {
      expect(
        ergebnisse.filter((e) => e.method === methode).length,
        `kein öffentlicher ${methode}-Weg mehr gefunden — der Methodenzweig ist aus der Prüfung verschwunden, statt geprüft zu werden`,
      ).toBeGreaterThanOrEqual(1);
    }
    const fremde = ergebnisse.filter(
      (e) => !(OEFFENTLICHE_METHODEN as readonly string[]).includes(e.method),
    );
    expect(
      fremde.map((e) => `${e.method} ${e.url} (${e.datei})`),
      "ein öffentlicher Methodenzweig steht nicht in OEFFENTLICHE_METHODEN — er wäre still ungeprüft geblieben",
    ).toEqual([]);
  });

  it("D2f-2 · KALIBRIERUNG: keine Sonde trägt selbst einen Demotitel im Anfragerumpf", () => {
    expect(
      nutzlastenSindTitelfrei(umgebung),
      "eine Sonde trägt ihren eigenen Suchtext — ein Treffer unten wäre ein selbstgemachter Fehlalarm",
    ).toEqual([]);
  });

  it("D2f-3 · kein Demotitel tritt durch einen dieser Wege nach außen", () => {
    for (const e of ergebnisse) {
      for (const titel of umgebung.demoTitel) {
        expect(
          e.body,
          `${e.method} ${e.aufgerufen} (${e.datei}) gibt ohne Anmeldung den Demotitel „${titel}" heraus — Status ${e.status}`,
        ).not.toContain(titel);
      }
    }
  });

  // JOB 3852 · RUNDE 2: OHNE DIESEN FALL IST D2f-3 NUR HALB WAHR. „Kein Titel im Rumpf" heisst bei
  // einem abgestürzten Aufruf nur, dass der Handler nie gelaufen ist — nicht, dass er dicht ist.
  it("D2f-5 · kein öffentlicher Weg endet unangemeldet in einem Serverfehler", () => {
    expect(
      ergebnisse.filter(istServerfehler).map(serverfehlerZeile),
      "ein öffentlicher Weg antwortet unangemeldet mit 5xx — der Aufruf hat den Handler nicht durchlaufen, D2f-3 sagt über diesen Weg deshalb NICHTS aus (ein titelfreier 5xx ist kein bestandener Lecknachweis)",
    ).toEqual([]);
  });

  it("D2f-6 · KALIBRIERUNG: die 501-Ausnahme deckt genau die zwei abgeschalteten SSO-Wege, keinen weiteren", () => {
    expect(
      ergebnisse
        .filter((e) => e.status === 501)
        .map((e) => `${e.method} ${e.url}`)
        .sort(),
      "die Menge der mit 501 antwortenden öffentlichen Wege weicht von AUSGESCHALTET_501 ab — entweder ist ein neuer Weg still in die Ausnahme gerutscht, oder ein geführter antwortet nicht mehr so; beides macht die Ausnahme unbelegt",
    ).toEqual([...AUSGESCHALTET_501].sort());
  });

  it("D2f-4 · und der Bestand bleibt: gleiche Anzahl, gleiche Titelmenge", () => {
    expect(
      nachher.anzahl,
      `die unangemeldeten Aufrufe haben den Bestand verändert: vorher ${vorher.anzahl}, nachher ${nachher.anzahl}`,
    ).toBe(vorher.anzahl);
    expect(
      nachher.titel,
      `die Titelmenge hat sich verändert — fehlend: ${JSON.stringify(vorher.titel.filter((t) => !nachher.titel.includes(t)))}, neu: ${JSON.stringify(nachher.titel.filter((t) => !vorher.titel.includes(t)))}`,
    ).toEqual(vorher.titel);
  });
});

// ==================================================================================================
// JOB 3852 · Lieferung 4 — DIE OPTIONALEN ROUTEN, EINGESCHALTET GEPRÜFT.
// ==================================================================================================
describe("JOB 3852 · D2g · öffentliche Wege hinter einem Schalter: eingebaut und trotzdem dicht", () => {
  let ohneSchalter: Klopfergebnis[];

  beforeAll(async () => {
    ohneSchalter = await oeffentlicheWegeKlopfen(await aufbauMitDemobestand());
  });

  it("D2g-1 · KALIBRIERUNG: genau die geführten Wege fehlen ohne Schalter, kein weiterer", () => {
    const fehlend = ohneSchalter.filter((e) => e.unregistriert).map((e) => `${e.method} ${e.url}`);
    expect(
      fehlend.sort(),
      "die Menge der ohne Schalter fehlenden öffentlichen Wege weicht von SCHALTBARE_OEFFENTLICHE_WEGE ab — ein neuer Weg wäre ungeprüft geblieben (es wird geklopft, wo keine Tür ist)",
    ).toEqual(SCHALTBARE_OEFFENTLICHE_WEGE.map((w) => w.schluessel).sort());
  });

  for (const weg of SCHALTBARE_OEFFENTLICHE_WEGE) {
    it(`D2g-2 · ${weg.schluessel} mit ${weg.variable}: erst eingebaut, dann unangemeldet gemessen`, async () => {
      const alt = process.env[weg.variable];
      process.env[weg.variable] = weg.wert;
      try {
        const u = await aufbauMitDemobestand();
        const vorher = await standAufnehmen(u.app, u.admin);

        // GEGENPROBE GEGEN DIE TRIVIALE GRÜNFÄRBUNG (a): der Weg ist jetzt wirklich eingebaut.
        const [methode, pfad] = weg.schluessel.split(" ") as [string, string];
        const tuer = await u.app.inject({ method: methode as "GET", url: pfad });
        expect(
          istUnregistriert(tuer.statusCode, tuer.body),
          `${weg.schluessel} ist mit ${weg.variable}=${weg.wert} weiter nicht registriert (${tuer.statusCode} ${tuer.body.slice(0, 160)}) — die Messung unten klopfte an eine Tür, die es nicht gibt`,
        ).toBe(false);
        // (b) und der Namensraum liefert wirklich aus — 404 allein wäre kein Lebenszeichen.
        const lebt = await u.app.inject({ method: "GET", url: weg.lebendbeleg });
        expect(
          lebt.statusCode,
          `${weg.lebendbeleg} antwortet ${lebt.statusCode} statt 200 — der Schalter hat nichts eingebaut`,
        ).toBe(200);

        const ergebnisse = await oeffentlicheWegeKlopfen(u);
        expect(
          ergebnisse.filter((e) => e.unregistriert).map((e) => `${e.method} ${e.url}`),
          `mit ${weg.variable}=${weg.wert} fehlt weiterhin ein öffentlicher Weg`,
        ).toEqual([]);
        // JOB 3852 · RUNDE 2: derselbe Riegel wie D2f-5 — auch die EINGESCHALTETE Fläche darf sich
        // nicht mit einem titelfreien Absturz aus der Leckfrage stehlen.
        expect(
          ergebnisse.filter(istServerfehler).map(serverfehlerZeile),
          `mit ${weg.variable}=${weg.wert} antwortet ein öffentlicher Weg unangemeldet mit 5xx — der Aufruf hat den Handler nicht durchlaufen, die Titelprüfung unten sagt über diesen Weg deshalb NICHTS aus`,
        ).toEqual([]);
        for (const e of ergebnisse) {
          for (const titel of u.demoTitel) {
            expect(
              e.body,
              `${e.method} ${e.aufgerufen} (${e.datei}) gibt mit ${weg.variable}=${weg.wert} ohne Anmeldung den Demotitel „${titel}" heraus — Status ${e.status}`,
            ).not.toContain(titel);
          }
        }

        const nachher = await standAufnehmen(u.app, u.admin);
        expect(
          nachher.anzahl,
          `der Bestand hat sich verändert: vorher ${vorher.anzahl}, nachher ${nachher.anzahl}`,
        ).toBe(vorher.anzahl);
        expect(nachher.titel, "die Titelmenge hat sich verändert").toEqual(vorher.titel);
      } finally {
        if (alt === undefined) {
          delete process.env[weg.variable];
        } else {
          process.env[weg.variable] = alt;
        }
      }
    });
  }
});

// ==================================================================================================
// JOB 3852 · Lieferung 5 — D2c MISST DEN BESTAND, NICHT DAS FLAG.
// ==================================================================================================
// VORHER stand hier EIN `expect(stand.json().present).toBe(true)`. `present` ist ein Ja/Nein: hätte
// der unangemeldete DELETE die HÄLFTE des Bestandes entfernt, wäre `present` weiter `true` und der
// Fall grün. Gemessen werden ab jetzt Anzahl UND Titelmenge, jede mit eigener Meldung, und die
// Meldung nennt den TATSÄCHLICHEN Vorher- und Nachherwert. `present` bleibt als zusätzliche Zusage
// stehen — es ist nicht mehr der Beweis.
//
// EIGENE INSTANZ, aus demselben Grund wie bei D2f: auf der geteilten `beforeAll`-Instanz könnte ein
// Nachbarfall den Bestand verändern, und der Vergleich mässe dann dessen Wirkung statt der des
// DELETE.
describe("JOB 3656/3852 · D2c · die Demo-Routen ohne Anmeldung: Ablehnung, kein Inhalt, Bestand vollständig", () => {
  let umgebung: Umgebung;
  let vorher: Awaited<ReturnType<typeof standAufnehmen>>;
  let nachher: Awaited<ReturnType<typeof standAufnehmen>>;
  let antworten: { method: string; url: string; status: number; body: string }[];

  beforeAll(async () => {
    umgebung = await aufbauMitDemobestand();
    vorher = await standAufnehmen(umgebung.app, umgebung.admin);
    const wege = [
      { method: "GET" as const, url: "/api/admin/demo-seed" },
      { method: "POST" as const, url: "/api/admin/demo-seed" },
      { method: "DELETE" as const, url: "/api/admin/demo-seed" },
      { method: "GET" as const, url: "/api/admin/demo-packages" },
    ];
    antworten = [];
    for (const weg of wege) {
      const antwort = await umgebung.app.inject({
        method: weg.method,
        url: weg.url,
        payload: {},
      });
      antworten.push({ ...weg, status: antwort.statusCode, body: antwort.body });
    }
    nachher = await standAufnehmen(umgebung.app, umgebung.admin);
  });

  it("D2c-1 · jeder der vier Wege weist ab und trägt keinen Demotitel", () => {
    for (const a of antworten) {
      expect(istAblehnung(a.status), `${a.method} ${a.url}: unerwarteter Status ${a.status}`).toBe(
        true,
      );
      for (const titel of umgebung.demoTitel) {
        expect(
          a.body,
          `${a.method} ${a.url} trägt den Demotitel „${titel}" in der Ablehnung`,
        ).not.toContain(titel);
      }
    }
  });

  it("D2c-2 · nach dem unangemeldeten DELETE ist die ANZAHL unverändert", () => {
    expect(
      nachher.anzahl,
      `der unangemeldete DELETE hat Bestand entfernt: vorher ${vorher.anzahl} Wissensobjekte, nachher ${nachher.anzahl}`,
    ).toBe(vorher.anzahl);
  });

  it("D2c-3 · und die TITELMENGE ist dieselbe — ein Teilverlust wäre hier sichtbar", () => {
    const fehlend = vorher.titel.filter((t) => !nachher.titel.includes(t));
    const neu = nachher.titel.filter((t) => !vorher.titel.includes(t));
    expect(
      nachher.titel,
      `der unangemeldete DELETE hat die Titelmenge verändert — fehlend (${fehlend.length}): ${JSON.stringify(fehlend)}, neu (${neu.length}): ${JSON.stringify(neu)}`,
    ).toEqual(vorher.titel);
  });

  it("D2c-4 · ZUSÄTZLICH, nicht als Beweis: `present` meldet weiter geladenen Bestand", () => {
    expect(
      nachher.present,
      `der Demostand meldet nach dem unangemeldeten DELETE present=${String(nachher.present)}, count=${String(nachher.count)}`,
    ).toBe(true);
  });
});

describe("JOB 3656 · D3 · die öffentliche Kontotür ist genau so lange offen, wie die Instanz leer ist", () => {
  // DER BEFUND, ehrlich benannt statt verschwiegen: `needsSetup()` und der Bootstrap-Zweig der
  // Registrierung hängen BEIDE an `users.count() === 0` (`service.ts:141`, `:172`). Auf einer leeren
  // Instanz — also genau dem Startzustand, den JOB 3655 zum Normalfall gemacht hat — macht der
  // ERSTE unangemeldete Aufruf seinen Urheber zum freigegebenen Admin. Danach ist die Tür dauerhaft
  // zu. Dieser Test pinnt BEIDE Hälften: dass sie zugeht (D3b/D3c) und dass sie vorher offen war
  // (D3a) — ohne D3a wäre D3b auch von einer Instanz erfüllt, in der gar nichts registrierbar ist.
  it("D3a · leere Instanz: die Ersteinrichtung steht ohne Anmeldung offen", async () => {
    const app = buildApp(buildServices());
    const status = await app.inject({ method: "GET", url: "/api/auth/status" });
    expect(status.statusCode).toBe(200);
    expect(status.json().needsSetup, "eine frische Instanz meldet keinen Einrichtungsbedarf").toBe(
      true,
    );

    const setup = await app.inject({ method: "POST", url: "/api/auth/setup", payload: ADMIN });
    expect(setup.statusCode, `Ersteinrichtung fehlgeschlagen: ${setup.body}`).toBe(201);
    expect(setup.json().user.role, "die Ersteinrichtung legt keinen Admin an").toBe("admin");
  });

  it("D3b · danach ist die Ersteinrichtung dauerhaft zu", async () => {
    const app = buildApp(buildServices());
    await app.inject({ method: "POST", url: "/api/auth/setup", payload: ADMIN });

    const status = await app.inject({ method: "GET", url: "/api/auth/status" });
    expect(status.json().needsSetup, "die Instanz meldet weiter Einrichtungsbedarf").toBe(false);

    const zweiter = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { name: "Fremder", email: "fremd@job3656.test", password: "geheim12345" },
    });
    expect(zweiter.statusCode, "eine zweite Ersteinrichtung ging durch").toBe(409);
    expect(zweiter.json().error).toBe("ALREADY_SETUP");
  });

  it("D3c · Selbstregistrierung ist danach kein Zugang: Konto ja, Anmeldung nein", async () => {
    const app = buildApp(buildServices());
    await app.inject({ method: "POST", url: "/api/auth/setup", payload: ADMIN });

    const angelegt = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Gast ohne Abnahme", email: "gast@job3656.test", password: "geheim12345" },
    });
    expect(angelegt.statusCode, `Registrierung unerwartet: ${angelegt.body}`).toBe(201);
    expect(angelegt.json().approved, "ein selbstregistriertes Konto ist freigegeben").toBe(false);

    const anmeldung = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "gast@job3656.test", password: "geheim12345" },
    });
    expect(
      istAblehnung(anmeldung.statusCode),
      `ein selbstregistriertes Konto kam herein: ${anmeldung.statusCode} ${anmeldung.body}`,
    ).toBe(true);
    expect(anmeldung.json().error).toBe("NOT_APPROVED");
  });

  it("D3d · und ein so entstandenes Konto sieht auch ohne Anmeldung keinen Demobestand", async () => {
    const { app, demoTitel } = await aufbauMitDemobestand();
    const antwort = await app.inject({ method: "GET", url: "/api/kos" });
    expect(
      istAblehnung(antwort.statusCode),
      `GET /api/kos ohne Anmeldung: ${antwort.statusCode}`,
    ).toBe(true);
    for (const titel of demoTitel) {
      expect(antwort.body, `GET /api/kos gibt unangemeldet „${titel}" heraus`).not.toContain(titel);
    }
  });
});
