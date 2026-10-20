import { type KlaraWissensAuftragsbindung, wissensZielFuerAuftrag } from "./klara-auftrag";
import type { KlaraRufe } from "./klara-ausfuehrung";
import { KlaraGespraechFehler } from "./klara-gespraech";

/** Nur der vorhandene bewusste F08-Port entscheidet über private Quelle und gewähltes Ziel. */
export async function pruefeAuftragswissen(
  w: KlaraWissensAuftragsbindung,
  rufe: KlaraRufe,
  beimAnlegen = false,
) {
  const r = await rufe(
    "POST",
    `/api/me/klara/notizen/${encodeURIComponent(w.notizId)}/wissen/vorschau`,
    { fassung: w.fassung, ziel: w.ziel },
  );
  const v = r.daten as {
    notizId?: unknown;
    fassung?: unknown;
    stempel?: unknown;
    input?: { title?: unknown };
  } | null;
  if (
    r.status !== 200 ||
    v?.notizId !== w.notizId ||
    v.fassung !== w.fassung ||
    v.stempel !== w.stempel
  ) {
    throw new KlaraGespraechFehler(
      beimAnlegen && [403, 404].includes(r.status) ? 404 : 409,
      [403, 404].includes(r.status) ? "quelle_unbekannt" : "quelle_geaendert",
      "Die bewusst gewählte private Quelle oder Zielvorschau ist nicht mehr gültig. Neu lesen und bewusst wählen; fertige Ergebnisse bleiben erhalten.",
    );
  }
  return v;
}
export async function bindeAuftragswissen(
  eingabe: Record<string, unknown>,
  rufe: KlaraRufe,
): Promise<Record<string, unknown>> {
  if (!Array.isArray(eingabe.plan)) return eingabe;
  for (const roh of eingabe.plan) {
    if (!roh || typeof roh !== "object" || roh.aktion !== "wissen_uebernehmen") continue;
    const w = roh.wissen as Partial<KlaraWissensAuftragsbindung> | null;
    if (
      !w ||
      typeof w.notizId !== "string" ||
      !w.notizId.trim() ||
      w.notizId.length > 200 ||
      typeof w.fassung !== "number" ||
      !Number.isSafeInteger(w.fassung) ||
      w.fassung < 1 ||
      typeof w.stempel !== "string" ||
      !w.stempel ||
      w.stempel.length > 200 ||
      w.bewusst !== true
    )
      throw new KlaraGespraechFehler(
        400,
        "eingabe",
        "Gesehene eigene private Quelle/Fassung, Zielvorschau und bewusste Übernahme fehlen.",
      );
    let ziel: KlaraWissensAuftragsbindung["ziel"];
    try {
      ziel = wissensZielFuerAuftrag(w.ziel);
    } catch (e) {
      throw new KlaraGespraechFehler(
        400,
        "eingabe",
        e instanceof Error ? e.message : "Ungültiges Wissensziel.",
      );
    }
    await pruefeAuftragswissen(
      {
        notizId: w.notizId,
        fassung: w.fassung,
        stempel: w.stempel,
        bewusst: true,
        ziel,
      },
      rufe,
      true,
    );
  }
  return eingabe;
}
