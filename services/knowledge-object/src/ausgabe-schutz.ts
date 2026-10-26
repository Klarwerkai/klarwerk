import { inSchutzdatenQuarantaene } from "./schutzdaten";
import type { KnowledgeObject } from "./types";

/** Eine freie Datei kann weder Quarantäne noch einen gebundenen Quellenleserkreis durchsetzen. */
export function darfInFreieAusgabe(ko: KnowledgeObject): boolean {
  return (
    !inSchutzdatenQuarantaene(ko) &&
    ko.quellrechte?.leser === undefined &&
    ko.quellrechte?.leserUnvollstaendig !== true &&
    !ko.sources.some(
      (s) =>
        (s.sourceRestrictions?.users.length ?? 0) > 0 ||
        (s.sourceRestrictions?.groups.length ?? 0) > 0,
    )
  );
}
