/** R-1648: Installationsbindung, keine Anmeldung und keine zusätzliche Leseberechtigung. */
export interface KioskProfil {
  id: string;
  revision: number;
  /** Ausschließlich bestehende Sitzung; ein anonymes Betriebsprofil ist noch nicht belegt. */
  zugang: "sitzung";
  leserId: string;
  freigabebeleg: string;
  gueltigBis: string;
  quellen: readonly { koId: string; fassung: number }[];
}

/** Nur die Installation liefert diese Fähigkeit. Kein HTTP-Schreibweg, keine Env-Selbstfreigabe. */
export type KioskProfilQuelle = () => Promise<KioskProfil | null>;

export async function leseKioskProfil(quelle?: KioskProfilQuelle): Promise<KioskProfil | null> {
  try {
    const p = await quelle?.();
    if (
      !p ||
      p.zugang !== "sitzung" ||
      !p.id?.trim() ||
      !p.leserId?.trim() ||
      !p.freigabebeleg?.trim() ||
      !Number.isSafeInteger(p.revision) ||
      p.revision < 1 ||
      !Number.isFinite(Date.parse(p.gueltigBis)) ||
      Date.parse(p.gueltigBis) <= Date.now() ||
      !Array.isArray(p.quellen) ||
      p.quellen.length === 0 ||
      p.quellen.length > 100 ||
      p.quellen.some((q) => !q.koId?.trim() || !Number.isSafeInteger(q.fassung) || q.fassung < 1) ||
      new Set(p.quellen.map((q) => q.koId)).size !== p.quellen.length
    ) {
      return null;
    }
    // Keine nachträgliche Mutation eines bereits laufenden Profils durch den Aufrufer.
    return structuredClone(p);
  } catch {
    return null;
  }
}

export function kioskBindung(p: KioskProfil): string {
  return JSON.stringify([
    p.id,
    p.revision,
    p.zugang,
    p.leserId,
    p.freigabebeleg,
    p.gueltigBis,
    [...p.quellen].sort((a, b) => a.koId.localeCompare(b.koId)),
  ]);
}
