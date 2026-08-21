import type { Pool } from "pg";
import {
  type BestandsresetBefund,
  SQL_ABSCHLUSS_SETZEN,
  SQL_COMMITMERKMAL_SETZEN,
  SQL_LAUF_ANLEGEN,
  loeseBestandsresetAuf,
} from "./bestandsreset-audit";
import { SQL_SPERRE_EXKLUSIV } from "./reset-lock";

// ================================================================================================
// JOB 596 · D8 — DER AUFRUFBARE BESTANDSRESET.
// ================================================================================================
//
// Bis D7 gab es die drei Bausteine — Sperre, Kapselung, Auditautomat — und nichts, was sie
// benutzt. BEN D7, Auflage 4, wörtlich: „Den aufrufbaren Reset-Orchestrator mit Löschgraph und
// dauerhafter Auditauflösung schließen." Das ist diese Datei.
//
// ------------------------------------------------------------------------------------------------
// DREI TRANSAKTIONEN, UND JEDE EINZELNE HAT IHREN GRUND.
// ------------------------------------------------------------------------------------------------
//
//   T1  Lauf anlegen (RUNNING) und COMMITTEN.
//       Eigene, abgeschlossene Transaktion — nicht aus Bequemlichkeit, sondern weil sie einen
//       Absturz überleben MUSS. Läge sie in derselben Transaktion wie die Löschungen, verschwände
//       sie bei deren Rollback zusammen mit ihnen: Der Wiederanlauf fände keinen Lauf und könnte
//       über einen abgestürzten Reset nichts sagen. Die Spur muss älter sein als das, wovon sie
//       spricht.
//
//   T2  Exklusive Sperre → Löschungen → COMMITMERKMAL → COMMIT.
//       Das Merkmal ist die LETZTE Anweisung IN der Transaktion. Diese Stellung ist der ganze
//       Auditvertrag (s. bestandsreset-audit.ts): Es committet mit den Löschungen zusammen oder
//       gar nicht, und deshalb gibt es keinen Zwischenzustand, in dem „Daten weg" und „Merkmal
//       fehlt" gleichzeitig wahr wären.
//
//   T3  Abschluss schreiben (OK bzw. ROLLED_BACK).
//       Bewusst NACH dem Commit und damit bewusst verlierbar. Fällt der Prozess zwischen T2 und
//       T3, bleibt der Lauf auf RUNNING mit gesetztem Merkmal — und genau diesen Fall löst der
//       Auditautomat als `COMMITTED_AUDIT_MISSING` auf: Daten weg, Erfolg NICHT meldbar. Der
//       Verlust ist eingeplant, nicht übersehen.
//
// ------------------------------------------------------------------------------------------------
// DER ROHE POOL, NICHT DER GEKAPSELTE.
// ------------------------------------------------------------------------------------------------
//
// Der Reset läuft über `rohPool` und nicht über `gatedPool(...)`. Andernfalls nähme er die
// GETEILTE Sperre seiner eigenen Kapselung und stünde sich mit der EXKLUSIVEN selbst im Weg — ein
// Vorgang, der sich zuverlässig selbst abweist. Der Fall `R1` in `gated-pool.test.ts` hält fest,
// dass der rohe Pool unbeschränkt bleibt; hier ist der Aufrufer, für den das gebaut wurde.

/** Der Reset konnte nicht beginnen, weil bereits einer läuft. */
export class BestandsresetGesperrtError extends Error {
  readonly code = "BESTANDSRESET_GESPERRT";

  constructor() {
    super("Es läuft bereits ein Bestandsreset. Ein zweiter kann nicht gleichzeitig beginnen.");
    this.name = "BestandsresetGesperrtError";
  }
}

// ================================================================================================
// DER LÖSCHGRAPH — VORSCHLAG, NICHT ENTSCHEIDUNG (s. Rückgabe D8, Vorschlag V-1).
// ================================================================================================
//
// WAS GEMESSEN IST, und es ist die angenehme Überraschung dieses Durchgangs: Über alle
// Schema-Definitionen des Standes `60b951b8` gibt es GENAU EINEN Fremdschlüssel —
// `import_run_item_refs → import_runs`. Der „Löschgraph" ist also kein Baum, sondern eine Liste
// mit einem einzigen Ordnungszwang. Das ist der Grund, warum diese Liste flach sein DARF und nicht
// aus Nachlässigkeit flach IST.
//
//     grep -rhn "REFERENCES [a-z_]*" services  →  1 Treffer: import_runs
//
// WELCHE TABELLEN ZUM BESTAND GEHÖREN, ist dagegen eine Produktfrage, keine technische. Die
// Ownerentscheidung zu JOB 596 bindet Sperrrichtung und Auditmerkmal; über den Inhalt des
// Löschgraphen sagt sie nichts. Die Liste unten ist deshalb ein begründeter VORSCHLAG und ein
// überschreibbarer Vorgabewert — nicht eine stille Annahme.
//
// DIE TRENNLINIE DES VORSCHLAGS: Gelöscht wird das WISSEN. Erhalten bleiben (a) die Zugänge,
// sonst könnte sich nach dem Reset niemand mehr anmelden; (b) die Einstellungen, sonst wäre ein
// Bestandsreset zugleich eine Werksrückstellung, die niemand bestellt hat; (c) das Audit,
// einschließlich der Laufakte des Resets selbst — ein Vorgang, der seine eigene Spur mitlöscht,
// ist nicht nachweisbar, und die Nachweisbarkeit ist der ganze Zweck von JOB 596.
export const BESTANDSRESET_LOESCHGRAPH: readonly string[] = [
  // Der eine echte Ordnungszwang: das Kind vor dem Elternteil.
  "import_run_item_refs",
  "import_runs",
  "import_candidates",
  "external_source_records",
  // Projektionen und Ableitungen vor ihren Quellen — nicht erzwungen, aber die ehrliche Reihenfolge.
  "ko_search_projections",
  "ko_metadata_projections",
  "ko_projection_control",
  "ko_overlaps",
  "ko_evidence",
  "ko_versions",
  "conflicts",
  "answer_snapshots",
  "answer_records",
  "gaps",
  "ratings",
  "assignments",
  "lifecycle_progress",
  "lifecycle_pending",
  "lifecycle_paths",
  "lifecycle_couplings",
  "klara_session_consents",
  "klara_sessions",
  "model_runs",
  "notification_seen",
  "drafts",
  "objects",
  "kos",
];

/**
 * Führt einen Bestandsreset aus und gibt den belastbaren Abschlusszustand zurück.
 *
 * WIRFT statt zu behaupten: Jeder Weg, der nicht bis zum committeten Merkmal führt, endet in einem
 * Fehler — und VORHER im geschriebenen Abschluss `ROLLED_BACK`. Ein Rückgabewert entsteht nur,
 * wenn die Nutzdatentransaktion wirklich committet hat. Es gibt keinen Pfad, auf dem diese
 * Funktion einen Erfolg meldet, den sie nicht belegen kann.
 */
export async function fuehreBestandsresetAus(
  rohPool: Pool,
  laufId: string,
  loeschgraph: readonly string[] = BESTANDSRESET_LOESCHGRAPH,
): Promise<BestandsresetBefund> {
  const client = await rohPool.connect();
  try {
    // ---- T1: die Spur, die den Absturz überlebt -------------------------------------------------
    await client.query("BEGIN");
    await client.query(SQL_LAUF_ANLEGEN, [laufId]);
    await client.query("COMMIT");

    // ---- T2: Sperre, Löschungen, Merkmal ---------------------------------------------------------
    try {
      await client.query("BEGIN");
      const sperre = await client.query<{ erworben: boolean }>(SQL_SPERRE_EXKLUSIV);
      if (!sperre.rows[0]?.erworben) {
        throw new BestandsresetGesperrtError();
      }
      for (const tabelle of loeschgraph) {
        // Die Tabellennamen stammen aus einer Konstante dieses Moduls, nie aus einer Eingabe —
        // deshalb ist die Interpolation hier zulässig. Ein Bezeichner kann ohnehin nicht als
        // Parameter gebunden werden.
        await client.query(`DELETE FROM ${tabelle}`);
      }
      // DIE LETZTE ANWEISUNG. Ihre Stellung ist der Auditvertrag.
      await client.query(SQL_COMMITMERKMAL_SETZEN, [laufId]);
      await client.query("COMMIT");
    } catch (fehler) {
      await client.query("ROLLBACK").catch(() => undefined);
      // Der Abschluss wird geschrieben, BEVOR der Fehler den Aufrufer erreicht. Sonst bliebe ein
      // sauber zurückgerollter Lauf als RUNNING stehen und wäre vom Absturz nicht zu unterscheiden.
      await client.query(SQL_ABSCHLUSS_SETZEN, [laufId, "ROLLED_BACK"]).catch(() => undefined);
      throw fehler;
    }

    // ---- T3: der Abschluss ------------------------------------------------------------------------
    await client.query(SQL_ABSCHLUSS_SETZEN, [laufId, "OK"]);

    // Der zurückgegebene Befund entsteht über DENSELBEN Automaten, den auch der Wiederanlauf
    // benutzt — nicht über eine zweite, hier hingeschriebene Wahrheit. Die Sperre ist zu diesem
    // Zeitpunkt frei: T2 ist committet, und eine transaktionsgebundene Sperre endet mit ihrer
    // Transaktion.
    return loeseBestandsresetAuf(
      { id: laufId, status: "OK", payloadCommittedAt: new Date() },
      false,
    );
  } finally {
    client.release();
  }
}
