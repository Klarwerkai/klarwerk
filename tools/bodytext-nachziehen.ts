// JOB 2614 D3 — BESTANDSREPARATUR SUCHTEXT: Aufrufer für den VORHANDENEN Nachzug, keine zweite
// Extraktion.
//
// REGEL-4-BELEG (warum dieses Werkzeug klein ist): Die HTML-zu-Text-Extraktion existiert und ist
// angeschlossen — `visibleTextFromBodyHtml` (services/knowledge-object/src/search-projection.ts:480)
// speist `bodyText` in `buildSearchProjection` (:637), und jeder Neuanlage-Weg schreibt die
// Projektion sofort (`persistSearchProjection`, service.ts). Was dem Bestand fehlt, ist der NACHZUG:
// Zeilen der Projektionsfassung 1 tragen `body_text = ''` als Schema-Default (Kommentar
// search-projection-repo-pg.ts:62-67) und wurden vom gedrosselten Neben-Backfill nie erreicht.
// Ein zweites Extraktionswerkzeug wäre eine zweite Wahrheit — dieses Werkzeug ruft deshalb
// AUSSCHLIESSLICH die benannten Produktwege: `reconcileSearchProjections` (Nachzug bis leer, mit
// Fortschrittswächter) bzw. `rebuildSearchProjections` (voller Neuaufbau, Eskalationsstufe).
//
// HARTE GRENZEN (Auftrag §6: „Nicht gegen die Live-Datenbank ausführen"):
//   - TROCKENLAUF IST DER DEFAULT: ohne `--ausfuehren` wird gelesen und gezählt, nie geschrieben.
//   - Ein Lauf mit `--ausfuehren` gegen die Live-Datenbank geschieht NUR auf Pedis ausdrückliche
//     Freigabe — dieses Werkzeug wird nicht beim Start ausgeführt und ist nicht Teil von tools/check.
//   - Verbindungsdaten NUR aus der Umgebung (KLARWERK_DB_URL bzw. DATABASE_URL), kein String im Code.
//   - Kein Schemaeingriff: `migrate()` gehört dem Server; dieses Werkzeug setzt keine Migration ab.
//
// Aufruf (Pedi):
//   Trockenlauf (Zahl betroffener KOs):  KLARWERK_DB_URL='postgres://…' tools/bodytext-nachziehen.sh
//   Nachzug ausführen:                   … tools/bodytext-nachziehen.sh --ausfuehren
//   Voller Neuaufbau (Eskalation):       … tools/bodytext-nachziehen.sh --ausfuehren --rebuild
//
// Der Testlauf gegen Testdaten steht in tests/app/job2614-bodytext-kette.test.ts (K2/K3) — er fährt
// GENAU diese Funktionen gegen einen präparierten Fassung-1-Bestand und misst die Zahlen.

import { pathToFileURL } from "node:url";
// JOB 3797: der Startvertrag — DIE VORHANDENE Prüfung, nicht eine zweite. Warum STATISCH, obwohl
// die zwei Importe in `main()` dynamisch sind: der Kopfkommentar dort begründet sie damit, dass der
// Testlauf „weder den Postgres-Treiber noch die App-Kompositionswurzel" zieht. Gemessen am
// Basisstand 56d2995 mit einem Loader-Haken über die echten Modulauflösungen:
// `tests/app/job2614-bodytext-kette.test.ts` lädt 359 Module, darunter `build-app` (1×) und
// `start-vertrag` (1×) — es importiert `build-app` nämlich SELBST (:24-29), und `build-app.ts:259`
// zieht `start-vertrag` mit. Ein statischer Import hier fügt dem Testlauf also GENAU NULL Module
// hinzu (359 vorher, 359 nachher); der Postgres-Treiber bleibt in beiden Fällen draussen (0×).
// Die Zusage wird damit nicht verletzt, und dynamisch wäre der Import nur umständlicher.
import { pruefeStartvertrag } from "../services/app/src/start-vertrag";
import { type KoService, SEARCH_PROJECTION_VERSION } from "../services/knowledge-object";

// Die Zählung nennt die Betroffenen nach Sorte — jede der drei braucht den Nachzug, aber aus
// verschiedenen Gründen, und ein Bericht, der sie zusammenwürfe, wäre bei der Nachkontrolle wertlos:
//   ohneProjektionszeile — das Objekt hat gar keine aktive Projektionszeile (nie projiziert),
//   fassung1             — die Zeile trägt eine veraltete `projection_version` (Pedis BAADER-Lage:
//                          `body_text` bleibt dort als Schema-Default leer),
//   leerTrotzBodyHtml    — die Zeile ist in geltender Fassung, aber `bodyText` ist leer, obwohl das
//                          Objekt `bodyHtml` trägt (nur der Rebuild ersetzt solche Zeilen).
export interface NachziehZaehlung {
  kos: number;
  ohneProjektionszeile: number;
  fassung1: number;
  leerTrotzBodyHtml: number;
  betroffen: number;
}

export interface NachziehBericht {
  geltendeFassung: number;
  inventur: { projectionVersion: number; count: number }[];
  offenV1: number;
  vorher: NachziehZaehlung;
  ausgefuehrt: boolean;
  rebuild: boolean;
  reconcile?: Awaited<ReturnType<KoService["reconcileSearchProjections"]>>;
  rebuildBilanz?: Awaited<ReturnType<KoService["rebuildSearchProjections"]>>;
  nachher?: NachziehZaehlung;
}

export async function zaehleBetroffene(ko: KoService): Promise<NachziehZaehlung> {
  // `list({})` ohne Sichtbarkeitstrim: die Reparatur betrifft den ganzen Bestand, nicht die Sicht
  // eines Betrachters. Gelöschte Objekte fallen im Repo heraus, wie überall sonst.
  const alle = await ko.list({});
  let ohneProjektionszeile = 0;
  let fassung1 = 0;
  let leerTrotzBodyHtml = 0;
  for (const objekt of alle) {
    const zeile = await ko.searchProjectionOf(objekt.id);
    if (!zeile) {
      ohneProjektionszeile += 1;
    } else if (zeile.projectionVersion !== SEARCH_PROJECTION_VERSION) {
      fassung1 += 1;
    } else if ((objekt.bodyHtml ?? "").trim() !== "" && zeile.bodyText.trim() === "") {
      leerTrotzBodyHtml += 1;
    }
  }
  return {
    kos: alle.length,
    ohneProjektionszeile,
    fassung1,
    leerTrotzBodyHtml,
    betroffen: ohneProjektionszeile + fassung1 + leerTrotzBodyHtml,
  };
}

export async function bodytextNachziehen(
  ko: KoService,
  opts: { ausfuehren: boolean; rebuild?: boolean },
): Promise<NachziehBericht> {
  const versionen = await ko.searchProjectionVersions();
  const bericht: NachziehBericht = {
    geltendeFassung: versionen.geltendeFassung,
    inventur: versionen.zeilen,
    offenV1: versionen.offenV1,
    vorher: await zaehleBetroffene(ko),
    ausgefuehrt: opts.ausfuehren,
    rebuild: opts.rebuild === true,
  };
  if (!opts.ausfuehren) {
    return bericht;
  }
  if (opts.rebuild === true) {
    // Eskalationsstufe für Zeilen, die der Nachzug nicht erfasst (geltende Fassung, aber leerer
    // Text): der Rebuild ist die EINE benannte Operation, die bestehende Projektionen ersetzen darf.
    bericht.rebuildBilanz = await ko.rebuildSearchProjections();
  } else {
    // Der Normalweg: Reconcile arbeitet die Arbeitsliste (fehlende Zeilen UND Fassung ≠ geltend,
    // s. `missingActive`) in Schwüngen ab, bis sie leer ist oder kein Fortschritt mehr entsteht,
    // und meldet die verbleibende Differenz — genau die Zusage, die eine Bestandsreparatur braucht.
    bericht.reconcile = await ko.reconcileSearchProjections();
  }
  bericht.nachher = await zaehleBetroffene(ko);
  return bericht;
}

function berichtAusgeben(bericht: NachziehBericht): void {
  const z = bericht.vorher;
  const zeilen = [
    `Geltende Projektionsfassung: ${bericht.geltendeFassung}`,
    `Inventur: ${bericht.inventur.map((i) => `Fassung ${i.projectionVersion}: ${i.count}`).join(" · ") || "keine Zeilen"}`,
    `BETROFFENE KOs: ${z.betroffen} von ${z.kos} (ohne Zeile: ${z.ohneProjektionszeile} · Fassung alt: ${z.fassung1} · leer trotz bodyHtml: ${z.leerTrotzBodyHtml})`,
  ];
  if (!bericht.ausgefuehrt) {
    zeilen.push(
      "TROCKENLAUF — nichts geschrieben. Ausführen nur mit --ausfuehren (Live: nur auf Pedis Freigabe).",
    );
  } else if (bericht.rebuildBilanz) {
    zeilen.push(`REBUILD: ${JSON.stringify(bericht.rebuildBilanz)}`);
  } else if (bericht.reconcile) {
    zeilen.push(
      `NACHZUG: offen vorher ${bericht.reconcile.offenVorher} · nachgezogen ${bericht.reconcile.nachgezogen} · Rest-Differenz ${bericht.reconcile.differenz}`,
    );
  }
  if (bericht.nachher) {
    zeilen.push(
      `NACHHER betroffen: ${bericht.nachher.betroffen} (ohne Zeile: ${bericht.nachher.ohneProjektionszeile} · Fassung alt: ${bericht.nachher.fassung1} · leer trotz bodyHtml: ${bericht.nachher.leerTrotzBodyHtml})`,
    );
  }
  process.stdout.write(`${zeilen.join("\n")}\n\n${JSON.stringify(bericht, null, 2)}\n`);
}

async function main(): Promise<void> {
  // ==============================================================================================
  // JOB 3797 — DER STARTVERTRAG STEHT VOR ALLEM ANDEREN, AUCH VOR DER EIGENEN MELDUNG.
  // ==============================================================================================
  //
  // WARUM ZUERST. Dieses Werkzeug ist der VIERTE Einstiegspunkt, der die App-Kompositionswurzel
  // lädt (JOB 3776, Lieferpunkt 1 und ABWEICHUNG 2). Der Vertrag nennt ALLE fehlenden Pflichtwerte
  // in EINER Meldung; die eigene Meldung unten nennt EINEN. Stünde sie davor, erführe der Betreiber
  // der Vorführ-Instanz `KLARWERK_DB_URL`, trüge es nach, startete neu — und erführe dann erst
  // `APP_BASE_URL`. Genau diesen Weg soll der Vertrag beenden. Gemessen am Basisstand 56d2995:
  // Produktion ohne alles gab hier Exit 2 mit der eigenen Meldung, und `APP_BASE_URL` kam im ganzen
  // Ausgabetext nicht vor.
  //
  // WARUM DIE EIGENE MELDUNG TROTZDEM BLEIBT — das ist keine zweite Wahrheit, sondern eine andere
  // Frage: der Vertrag prüft AUSSCHLIESSLICH in Produktion (`start-vertrag.ts:906`). In
  // Entwicklung und im Testlauf verlangt er nichts, und ohne die Meldung unten stünde dort ein
  // Absturz im Treiber statt eines Satzes. Sie deckt ausserdem `KLARWERK_DB_URL`, das im Katalog
  // mit Absicht NICHT steht: es ist ein reiner Werkzeugwert (nur dieses Werkzeug und
  // `tools/bodytext-zaehlung.ts` lesen ihn), und `start-vertrag.ts:868-871` schliesst solche Werte
  // ausdrücklich aus.
  //
  // FOLGE, die gewollt ist und hier stehen soll: in Produktion verlangt der Vertrag `DATABASE_URL`
  // auch dann, wenn `KLARWERK_DB_URL` gesetzt ist und dieses Werkzeug damit zufrieden wäre. Wer in
  // Produktion `buildPgServices` ruft, setzt eine Instanz zusammen und muss deren Ausstattung
  // haben — eine halb ausgestattete Komposition ist genau das, was der Vertrag verhindert.
  pruefeStartvertrag(process.env);
  const url = process.env.KLARWERK_DB_URL ?? process.env.DATABASE_URL;
  if (!url) {
    process.stderr.write(
      "Kein Verbindungs-String: KLARWERK_DB_URL (oder DATABASE_URL) setzen. Kein Wert steht im Code.\n",
    );
    process.exitCode = 2;
    return;
  }
  const ausfuehren = process.argv.includes("--ausfuehren");
  const rebuild = process.argv.includes("--rebuild");
  // Dynamische Importe: der Testlauf importiert nur die Funktionen oben und zieht damit den
  // Postgres-Treiber nicht mit.
  // BERICHTIGT AM 12.09.2026 (JOB 3797), weil hier bis dahin auch „noch die App-Kompositionswurzel"
  // stand: das stimmt nicht mehr. `tests/app/job2614-bodytext-kette.test.ts:24-29` importiert
  // `services/app/src/build-app` inzwischen SELBST. Gemessen mit einem Loader-Haken über die echten
  // Modulauflösungen: dieses Modul allein zieht 37 Module und darunter weder `build-app` noch
  // `start-vertrag` noch `pg`; der Testlauf zieht 359, darunter `build-app` (1×), aber `pg` (0×).
  // Die dynamischen Importe halten also weiterhin genau EINE Zusage — den Treiber — und die gilt.
  const { createPool } = await import("../services/app/src/db");
  const { buildPgServices } = await import("../services/app/src/build-app");
  const pool = createPool(url);
  try {
    const services = buildPgServices(pool);
    berichtAusgeben(await bodytextNachziehen(services.ko, { ausfuehren, rebuild }));
  } finally {
    await pool.end();
  }
}

// Nur bei DIREKTEM Aufruf ausführen — beim Import (Testlauf) passiert nichts.
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  // JOB 3797 — DER FÄNGER. `void main()` machte aus jedem Wurf in `main()` eine unbehandelte
  // Zurückweisung: gemessen am Basisstand 56d2995 zwölf Zeilen Stapelspur, erste Zeile ein
  // Quelltextpfad, darin `at ModuleJob.run`. Hausmuster ist `seed.ts` (`runSeed().catch(...)`,
  // Präfix `[seed:demo] Abbruch: …`, JOB 3776 ABWEICHUNG 3).
  //
  // EXIT 2 UND NICHT EINE NEUE ZAHL: die eigene Meldung oben setzt seit JOB 2614 `2` für „gar
  // nicht angefangen — nichts gelesen, nichts geschrieben". Der Vertragsabbruch ist derselbe
  // Sachverhalt; zwei Zahlen für eine Lage zwängen ein Aufrufskript zu einer Unterscheidung, die
  // es nicht gibt. Wichtig ist nur, dass es nicht 0 ist.
  //
  // Zeilenumbrüche werden zusammengezogen, damit die Zusage „EINE lesbare Zeile" auch für einen
  // mehrzeiligen fremden Fehlertext gilt — der Text geht dabei nicht verloren, nur der Umbruch.
  main().catch((fehler: unknown) => {
    const text = fehler instanceof Error ? `${fehler.name}: ${fehler.message}` : String(fehler);
    process.stderr.write(`[bodytext-nachziehen] Abbruch: ${text.replace(/\s*\n\s*/g, " · ")}\n`);
    process.exitCode = 2;
  });
}
