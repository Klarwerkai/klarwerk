import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { teamassistenten } from "../../api/teamassistenten";
import { useSession } from "../../app/AuthContext";
import { anfrageEpoche, aufRechtekontextwechsel } from "../../lib/rechtekontext";

export function useTeamKontext() {
  const { user } = useSession();
  const epoche = useSyncExternalStore(aufRechtekontextwechsel, anfrageEpoche, anfrageEpoche);
  return user ? JSON.stringify([user.id, epoche]) : "";
}

export const teamListeKey = (kontext: string) => ["teamassistenten", kontext, "liste"] as const;
export const teamDetailKey = (kontext: string, id: string) =>
  ["teamassistenten", kontext, "detail", id] as const;

export function useTeamListe(kontext: string) {
  return useQuery({
    queryKey: teamListeKey(kontext),
    queryFn: teamassistenten.liste,
    enabled: Boolean(kontext),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: "always",
  });
}

export const eingabestil =
  "w-full rounded-input border border-hairline bg-surface px-3 py-2 text-sm text-text";
export const kartenstil = "space-y-4 rounded-card border border-hairline bg-surface p-5";
