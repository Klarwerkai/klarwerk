// ================================================================================================
// R-0846 / L6 und R-1437 / I10 — DER BETREIBERWEG FÜR DATENBANKPRÜFUNG UND BESTANDSBEREINIGUNG.
// ================================================================================================
//
// AUFRUF (Verbindungsdaten NUR aus der Umgebung, kein Wert im Code):
//
//   Bericht, nur lesend:        KLARWERK_DB_URL='postgres://…' npx tsx tools/datenintegritaet.ts
//   Bereinigung, Trockenlauf:   … tools/datenintegritaet.ts --bereinigen
//   Bereinigung, ausführen:     … tools/datenintegritaet.ts --bereinigen --ausfuehren
//
// DER BERICHT läuft über `begrenztePruefung` (services/db-tx): zuerst die Regel nach einem Abbruch
// (hängt eine Sitzung `idle in transaction`, beginnt nichts — Exit 3, mit Befund und den fertigen
// Befehlen zum Beenden, die ein Mensch absetzt), dann eine nur lesende Klammer mit Zeitgrenzen, die
// immer zurückgerollt wird. Es gibt auf diesem Weg keine offene, interaktive Transaktion.
//
// DIE BEREINIGUNG schreibt nur mit `--ausfuehren`, in EINER Transaktion über die Reset-Sperre
// (`gatedPool`), und hinterlässt im selben Commit den Prüfspureintrag `datenintegritaet.bereinigt`.
// Der Trockenlauf zeigt den Bericht und was die Bereinigung davon anfassen würde.
//
// EXIT: 0 = kein Befund · 1 = Befund vorhanden (Bericht) · 2 = nicht angefangen (keine Verbindung,
// Startvertrag) · 3 = Prüfung nicht begonnen, weil eine Sitzung offen hängt.
import { pathToFileURL } from "node:url";
import {
  type Integritaetsbefund,
  bereinigeBestand,
  erhebeIntegritaet,
} from "../services/app/src/datenintegritaet";
import { pruefeStartvertrag } from "../services/app/src/start-vertrag";
import {
  HaengendeSitzungError,
  begrenztePruefung,
  gatedPool,
  pgQueryable,
  pruefbefehl,
  withPgTx,
} from "../services/db-tx";

/**
 * Hat der Bericht etwas zu melden? Jeder der vier L6-Befunde zählt, auch als Altbestand: ein
 * ungeprüfter Schlüssel ebenso wie eine geschlossene Lücke ohne Objektbezug (Nacharbeit 4 — sie
 * fehlte hier, und der Bericht endete trotz Befund mit Exit 0). Neue Lücken können ohne Bezug nicht
 * mehr geschlossen werden (`AskService.closeGap`); die alten bleiben sichtbar, bis jemand sie mit
 * Bezug versieht.
 */
export function hatBefund(b: Integritaetsbefund): boolean {
  return (
    b.fremdschluessel.some((s) => s.zustand !== "gueltig") ||
    b.fassungenOhneObjekt > 0 ||
    b.belegeOhneObjekt > 0 ||
    b.luecken.geschlossenOhneBezug > 0 ||
    b.luecken.bezugOhneObjekt.length > 0 ||
    b.pruefspur.ohneLoeschbeleg.length > 0 ||
    b.waisen.length > 0
  );
}

function spurZeile(p: { ziel: string; eintraege: number }): string {
  return `Prüfspur ohne Löschbeleg: Ziel ${p.ziel} (${p.eintraege} Einträge)`;
}

/** Der Bericht als Textzeilen — ohne Inhalte, nur Kennungen und Zahlen. */
export function berichtZeilen(b: Integritaetsbefund): string[] {
  return [
    ...b.fremdschluessel.map((s) => `Fremdschlüssel ${s.name}: ${s.zustand}`),
    `Fassungen ohne Objekt: ${b.fassungenOhneObjekt}`,
    `Belege ohne Objekt: ${b.belegeOhneObjekt}`,
    `Geschlossene Lücken ohne Objektbezug: ${b.luecken.geschlossenOhneBezug}`,
    ...b.luecken.bezugOhneObjekt.map((l) => `Lücke ${l.gapId}: Bezug ${l.koId} ohne Objekt`),
    `Prüfspur auf endgelöschte Objekte, belegt: ${b.pruefspur.endgeloeschtBelegt}`,
    ...b.pruefspur.ohneLoeschbeleg.map(spurZeile),
    `Waisen im Object-Store: ${b.waisen.length}`,
    ...b.waisen.map((w) => `Waise ${w.id} (${w.zweck}${w.transient ? ", transient" : ""})`),
  ];
}

async function main(): Promise<void> {
  // Derselbe Einstieg wie `tools/bodytext-nachziehen.ts`: der Startvertrag zuerst, weil die
  // Bereinigung die Kompositionswurzel zusammensetzt.
  pruefeStartvertrag(process.env);
  const url = process.env.KLARWERK_DB_URL ?? process.env.DATABASE_URL;
  if (!url) {
    process.stderr.write("Kein Verbindungs-String: KLARWERK_DB_URL (oder DATABASE_URL) setzen.\n");
    process.exitCode = 2;
    return;
  }
  const bereinigen = process.argv.includes("--bereinigen");
  const ausfuehren = process.argv.includes("--ausfuehren");
  const { createPool } = await import("../services/app/src/db");
  const pool = createPool(url);
  try {
    const { ergebnis } = await begrenztePruefung(pool, (q) => erhebeIntegritaet(q, Date.now()));
    for (const zeile of berichtZeilen(ergebnis)) {
      process.stdout.write(`${zeile}\n`);
    }
    if (!bereinigen) {
      process.exitCode = hatBefund(ergebnis) ? 1 : 0;
      return;
    }
    if (!ausfuehren) {
      process.stdout.write(
        "Trockenlauf: die Bereinigung entfernt Fassungen/Belege ohne Objekt und die Waisen oben mit UUID-Kennung (mit Grabstein und Verweisschutz), behält die übrigen und validiert die Fremdschlüssel. Ausführen mit --ausfuehren.\n",
      );
      return;
    }
    const { buildPgServices } = await import("../services/app/src/build-app");
    const services = buildPgServices(pool);
    const gesamt = await withPgTx(gatedPool(pool), async (tx) => {
      const ergebnisBereinigung = await bereinigeBestand(pgQueryable(tx), Date.now());
      await services.audit.record(
        {
          actor: "system:datenintegritaet",
          action: "datenintegritaet.bereinigt",
          target: "bestand",
          payload: { ...ergebnisBereinigung },
        },
        tx,
      );
      return ergebnisBereinigung;
    });
    process.stdout.write(
      `Bereinigt: ${gesamt.fassungenEntfernt} Fassungen, ${gesamt.belegeEntfernt} Belege, ${gesamt.waisenEntfernt.length} Waisen (${gesamt.waisenBehalten.length} ohne Verweisschutz behalten); validiert: ${gesamt.validiert.join(", ") || "keiner"}.\n`,
    );
  } catch (fehler) {
    if (fehler instanceof HaengendeSitzungError) {
      process.stderr.write(`${fehler.befund.begruendung}\n`);
      process.stderr.write(`Prüfbefehl: ${pruefbefehl()}\n`);
      for (const befehl of fehler.befund.befehle) {
        process.stderr.write(`Zum Beenden (von Hand, protokollieren): ${befehl}\n`);
      }
      process.exitCode = 3;
      return;
    }
    throw fehler;
  } finally {
    await pool.end();
  }
}

// Nur bei DIREKTEM Aufruf ausführen — beim Import (Testlauf) passiert nichts.
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((fehler: unknown) => {
    process.stderr.write(`[datenintegritaet] Abbruch: ${String(fehler)}\n`);
    process.exitCode = 2;
  });
}
