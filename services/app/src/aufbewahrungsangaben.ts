// P10: Betriebsangaben am vorhandenen Verzeichnis, kein Policy- oder Logbestand.
import {
  GEDAECHTNIS_FRISTEN_TAGE,
  GEDAECHTNIS_STANDARD_FRIST_TAGE,
} from "./interaktionsgedaechtnis";
import { PROTOKOLL_FRIST_ENV, leseProtokollFristTage } from "./protokoll-frist-parameter";
export interface Aufbewahrungsangabe {
  zweck: "diagnose" | "sicherheit" | "audit" | "privatverlauf";
  beschreibung: string;
  verantwortlich: string | null;
  regel: string;
  fristTage: number | null;
  begruendung: string | null;
  fachlicheFestlegungOffen: boolean;
}
function angabe(env: Record<string, string | undefined>, key: string): string | null {
  const wert = env[key]?.trim();
  if (!wert) return null;
  if (
    wert.length > 500 ||
    [...wert].some((z) => (z.codePointAt(0) ?? 0) < 32 || z.codePointAt(0) === 127)
  )
    throw new Error("Ungültige Aufbewahrungs-Betriebsangabe.");
  return wert;
}
export function aufbewahrungsangabenAusEnv(
  env: Record<string, string | undefined>,
): Aufbewahrungsangabe[] {
  // Die bestehende Hashkette hat keinen sicheren Lösch-/Archivweg. Eine Zahl darf keinen
  // wirksamen solchen Weg behaupten oder unbemerkt Diagnosepflege auf Nachweise anwenden.
  for (const key of ["KLARWERK_SICHERHEIT_FRIST_TAGE", "KLARWERK_AUDIT_FRIST_TAGE"]) {
    if (env[key]?.trim())
      throw new Error(
        "Für Sicherheits-/Auditfristen ist zuerst eine passende Regel der bestehenden Nachweiskette erforderlich.",
      );
  }
  return [
    {
      zweck: "diagnose",
      beschreibung: "Betriebsdiagnose ohne Inhaltsvolltexte",
      verantwortlich: angabe(env, "KLARWERK_DIAGNOSE_VERANTWORTLICH"),
      regel: "Vorhandene Datei-/Dockerpflege; fremde Nachweise bleiben außerhalb der Auswahl.",
      fristTage: leseProtokollFristTage(env[PROTOKOLL_FRIST_ENV]),
      begruendung: angabe(env, "KLARWERK_DIAGNOSE_BEGRUENDUNG"),
      fachlicheFestlegungOffen: false,
    },
    ...(["sicherheit", "audit"] as const).map((zweck) => ({
      zweck,
      beschreibung:
        zweck === "sicherheit"
          ? "Zugangs- und Sicherheitsnachweise"
          : "Integrität und fachliche Nachvollziehbarkeit",
      verantwortlich: angabe(env, `KLARWERK_${zweck.toUpperCase()}_VERANTWORTLICH`),
      regel:
        "Bestehende append-only Hashkette; keine automatische Löschung und keine Übernahme der Diagnosefrist.",
      fristTage: null,
      begruendung: angabe(env, `KLARWERK_${zweck.toUpperCase()}_BEGRUENDUNG`),
      fachlicheFestlegungOffen: true,
    })),
    {
      zweck: "privatverlauf",
      beschreibung: "Bewusst gespeicherte persönliche Gedächtniseinträge",
      verantwortlich: "Authentifizierter Kontoinhaber des jeweiligen Eintrags",
      regel: `Je Eintrag ${GEDAECHTNIS_FRISTEN_TAGE.join("/")} Tage; begründete befristete Ausnahme am selben Eintrag; Einzel-/Gesamtlöschung jederzeit.`,
      fristTage: GEDAECHTNIS_STANDARD_FRIST_TAGE,
      begruendung: null,
      fachlicheFestlegungOffen: false,
    },
  ];
}
