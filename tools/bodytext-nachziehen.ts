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
  // Dynamische Importe: der Testlauf importiert nur die Funktionen oben und zieht damit weder den
  // Postgres-Treiber noch die App-Kompositionswurzel.
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
  void main();
}
