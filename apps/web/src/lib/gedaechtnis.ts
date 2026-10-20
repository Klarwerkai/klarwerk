import { useQuery } from "@tanstack/react-query";
import { gedaechtnisApi } from "../api/gedaechtnis";
import { useSession } from "../app/AuthContext";

export const gedaechtnisSchluessel = (kontoId: string | null) =>
  ["persoenliches-gedaechtnis", kontoId] as const;
/** Keine lokale Dauerablage. Der vorhandene Query-Cache wird bei Abmeldung geleert. */
export function useGedaechtnis() {
  const { user } = useSession();
  return useQuery({
    queryKey: gedaechtnisSchluessel(user?.id ?? null),
    queryFn: gedaechtnisApi.lesen,
    enabled: Boolean(user),
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
}
export function useKurzeAntworten(): boolean {
  const q = useGedaechtnis();
  if (!q.isSuccess) return false;
  const jetzt = Date.now();
  const e = q.data.eintraege
    .filter((e) => e.darstellung && Date.parse(e.verfallAm) > jetzt)
    .sort((a, b) => b.geaendertAm.localeCompare(a.geaendertAm) || b.id.localeCompare(a.id))[0];
  return e?.darstellung === "kurz";
}
