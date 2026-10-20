import type { KlaraRufe } from "./klara-ausfuehrung";
import type { KlaraBeschaffungsziel } from "./klara-beschaffungsziel";
import { KlaraGespraechFehler } from "./klara-gespraech";
/** Nur der normale heutige Wissensleseweg, keine erfundene Freigabe aus Zeitstempeln oder Quelltext. */
export async function pruefeBeschaffungsquellen(b: KlaraBeschaffungsziel, rufe: KlaraRufe) {
  for (const q of b.quellen) {
    const r = await rufe("GET", `/api/kos/${encodeURIComponent(q.id)}`);
    const k = r.daten as { id?: unknown; version?: unknown; status?: unknown } | null;
    if (r.status !== 200 || k?.id !== q.id)
      throw new KlaraGespraechFehler(
        409,
        "quelle_unbekannt",
        "Eine gebundene Beschaffungsquelle ist nicht mehr verfügbar oder berechtigt. Fertige Entwürfe bleiben erhalten.",
      );
    if (k.version !== q.fassung || k.status !== q.status)
      throw new KlaraGespraechFehler(
        409,
        "quelle_geaendert",
        "Fassung oder Status der Beschaffungsquelle wurde geändert. Keine abhängige neue Änderung begonnen.",
      );
  }
}
export async function bindeBeschaffungsquellen(
  e: Record<string, unknown>,
  rufe: KlaraRufe,
): Promise<Record<string, unknown>> {
  if (!e.beschaffung || typeof e.beschaffung !== "object") return e;
  const b = e.beschaffung as Record<string, unknown>;
  if (!Array.isArray(b.quellen)) return e;
  const quellen = [];
  for (const roh of b.quellen) {
    const q = roh as { id?: unknown; fassung?: unknown };
    if (typeof q?.id !== "string" || !q.id || q.id.length > 200)
      throw new KlaraGespraechFehler(400, "eingabe", "Quellkennung fehlt.");
    const r = await rufe("GET", `/api/kos/${encodeURIComponent(q.id)}`);
    const k = r.daten as { id?: unknown; version?: unknown; status?: unknown } | null;
    if (r.status !== 200 || k?.id !== q.id)
      throw new KlaraGespraechFehler(
        404,
        "quelle_unbekannt",
        "Beschaffungsquelle nicht verfügbar.",
      );
    if (k.version !== q.fassung || typeof k.status !== "string")
      throw new KlaraGespraechFehler(
        409,
        "quelle_geaendert",
        "Beschaffungsquelle zuerst in ihrer heutigen Fassung lesen.",
      );
    quellen.push({ id: q.id, fassung: q.fassung, status: k.status });
  }
  return { ...e, beschaffung: { ...b, quellen } };
}
