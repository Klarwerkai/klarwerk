import type { KlaraRufe } from "./klara-ausfuehrung";
import { KlaraGespraechFehler } from "./klara-gespraech";

/** Herkunft des tatsächlich berechtigt gelesenen Originals, kein zweiter Quellenbestand. */
export interface KlaraAuftragsnotiz {
  readonly id: string;
  readonly fassung: number;
  readonly titel: string;
  readonly gespraechId: string;
  readonly nachrichtId: string;
}

/** Ausschließlich die normale authentifizierte Notiztür entscheidet über Eigentum/Quellrecht. */
export async function liesAuftragsnotiz(
  quelle: Pick<KlaraAuftragsnotiz, "id" | "fassung"> & Partial<KlaraAuftragsnotiz>,
  rufe: KlaraRufe,
  beimAnlegen = false,
): Promise<KlaraAuftragsnotiz> {
  const r = await rufe("GET", `/api/me/klara/notizen/${encodeURIComponent(quelle.id)}`);
  const n = (
    r.daten as {
      notiz?: {
        id?: unknown;
        fassung?: unknown;
        titel?: unknown;
        weg?: unknown;
        quelle?: { gespraechId?: unknown; nachrichtId?: unknown };
      };
    } | null
  )?.notiz;
  if (
    r.status !== 200 ||
    !n ||
    n.id !== quelle.id ||
    n.weg !== "gespraech" ||
    typeof n.titel !== "string" ||
    typeof n.quelle?.gespraechId !== "string" ||
    typeof n.quelle.nachrichtId !== "string"
  ) {
    throw new KlaraGespraechFehler(
      beimAnlegen ? 404 : 409,
      "quelle_unbekannt",
      "Die eigene gespeicherte Gesprächsnotiz ist nicht verfügbar oder nicht mehr berechtigt. Keine abhängige Änderung begonnen; fertige Ergebnisse bleiben erhalten.",
    );
  }
  if (
    n.fassung !== quelle.fassung ||
    (quelle.gespraechId !== undefined && n.quelle.gespraechId !== quelle.gespraechId) ||
    (quelle.nachrichtId !== undefined && n.quelle.nachrichtId !== quelle.nachrichtId)
  ) {
    throw new KlaraGespraechFehler(
      409,
      "quelle_geaendert",
      "Die Gesprächsnotiz hat sich seit dem Auftrag geändert. Bitte die neue Fassung lesen und einen passenden Auftrag geben. Bereits fertige Ergebnisse bleiben erhalten.",
    );
  }
  return {
    id: quelle.id,
    fassung: quelle.fassung,
    titel: n.titel,
    gespraechId: n.quelle.gespraechId,
    nachrichtId: n.quelle.nachrichtId,
  };
}

/** Vor dem Speichern die angegebene Quelle selbst lesen; Clientherkunft ist kein Beleg. */
export async function bindeAuftragsnotizen(
  eingabe: Record<string, unknown>,
  rufe: KlaraRufe,
): Promise<Record<string, unknown>> {
  if (!Array.isArray(eingabe.plan)) return eingabe;
  const plan: unknown[] = [];
  for (const roh of eingabe.plan) {
    if (!roh || typeof roh !== "object" || !("notizQuelle" in roh) || roh.notizQuelle == null) {
      plan.push(roh);
      continue;
    }
    const p = roh as Record<string, unknown>;
    const q = p.notizQuelle as Partial<KlaraAuftragsnotiz> | null;
    if (
      p.aktion !== "persoenliche_aufgabe_anlegen" ||
      !q ||
      typeof q.id !== "string" ||
      !q.id.trim() ||
      q.id.length > 200 ||
      typeof q.fassung !== "number" ||
      !Number.isSafeInteger(q.fassung) ||
      q.fassung < 1
    ) {
      throw new KlaraGespraechFehler(
        400,
        "eingabe",
        "Eine Notizquelle braucht ihre tatsächliche Kennung und gesehene Fassung am persönlichen Aufgabenschritt.",
      );
    }
    const quelle = await liesAuftragsnotiz({ id: q.id, fassung: q.fassung }, rufe, true);
    plan.push({ ...p, notizQuelle: quelle });
  }
  return { ...eingabe, plan };
}
