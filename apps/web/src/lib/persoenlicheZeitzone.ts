import { useSession } from "../app/AuthContext";
import { assistenzStand, useAssistenzStand } from "./assistenzProfil";

function gueltig(zone: string | undefined): string | null {
  if (!zone) return null;
  try {
    new Intl.DateTimeFormat("de", { timeZone: zone }).format();
    return zone;
  } catch {
    return null;
  }
}
export function vorgabeZeitzone(): string {
  const stand = assistenzStand();
  return (
    gueltig(stand.status === "bereit" ? stand.antwort?.profil?.einfuehrung?.zeitzone : undefined) ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    "UTC"
  );
}
export function usePersoenlicheZeitzone(): string {
  const { user } = useSession();
  const stand = useAssistenzStand();
  return (
    gueltig(
      stand.status === "bereit" && stand.kontoId === user?.id
        ? stand.antwort?.profil?.einfuehrung?.zeitzone
        : undefined,
    ) ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    "UTC"
  );
}
