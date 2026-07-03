// SCRUM-432 (Pedi 03.07., VIP-Investor): DOM-freie Liste der Sicherheits-/Datenschutz-Aussagen
// für den „Vertrauen & Sicherheit"-Auszug im Admin. Nur i18n-Schlüssel — eine Quelle für
// Komponente + Test, damit die Aussagen in DE und EN geprüft bleiben. Jede Aussage ist eine
// architektonische Tatsache des Systems, kein Marketing.
export interface SecurityPoint {
  id: string;
  titleKey: string;
  bodyKey: string;
}

export const SECURITY_POINTS: readonly SecurityPoint[] = [
  // Schlüssel liegen nur serverseitig / im Schlüsselbund — nie im Browser, Code, Repo.
  { id: "keys", titleKey: "adm.sich.keys.t", bodyKey: "adm.sich.keys.b" },
  // Eigener/lokaler LLM möglich; lokale KI nur über privaten Tunnel, nie öffentlich.
  { id: "localAi", titleKey: "adm.sich.localAi.t", bodyKey: "adm.sich.localAi.b" },
  // Externe Wissensabfrage admin-gesteuert, standardmäßig eingeschränkt.
  { id: "external", titleKey: "adm.sich.external.t", bodyKey: "adm.sich.external.b" },
  // Prüfprotokoll append-only + hash-verkettet (manipulationssicher).
  { id: "audit", titleKey: "adm.sich.audit.t", bodyKey: "adm.sich.audit.b" },
  // Löschen mit Papierkorb + verzögerter Endlöschung (kein stiller Datenverlust).
  { id: "trash", titleKey: "adm.sich.trash.t", bodyKey: "adm.sich.trash.b" },
  // Vier Rollen, jede Aktion prüft serverseitig das nötige Recht.
  { id: "roles", titleKey: "adm.sich.roles.t", bodyKey: "adm.sich.roles.b" },
  // Keine echten Kundendaten in Tests/Evals.
  {
    id: "noCustomerData",
    titleKey: "adm.sich.noCustomerData.t",
    bodyKey: "adm.sich.noCustomerData.b",
  },
] as const;
