// ================================================================================================
// Aufnahme `gesamt-ocr` (R-0121, Nacharbeit 6) — DER GEMELDETE STAND DES TRANSKRIPTIONSDIENSTES.
// ================================================================================================
//
// Die Transkript-Kachel der Dateigalerien sagte fest „nicht konfiguriert" — auch bei eingerichtetem
// Dienst. Jetzt hängt sie am Stand, den der Server meldet (`GET /api/media/status`).
//
// Dieselbe Bauform wie `UploadLimitsHint`: die Galerien werden auch OHNE Abfrage-Kontext gerendert
// (SSR-Fixture der Import-Erklärseite, isolierte Bauteiltests). Ohne Kontext wird nichts abgefragt
// und `null` gereicht — die Kachel bleibt dann bei „nicht konfiguriert", statt den Host abstürzen zu
// lassen oder eine Zusage zu machen, die der Dienst nicht bestätigt hat.
import { QueryClientContext } from "@tanstack/react-query";
import { useContext } from "react";
import { useMediaStatus } from "../api/hooks";
import type { MediendienstZustand } from "../lib/importSourceGallery";

type Darstellung = (zustand: MediendienstZustand | null) => JSX.Element;

export function MitMediendienst({ darstellen }: { darstellen: Darstellung }): JSX.Element {
  const mitAbfrage = useContext(QueryClientContext) !== undefined;
  return mitAbfrage ? <Abgefragt darstellen={darstellen} /> : darstellen(null);
}

function Abgefragt({ darstellen }: { darstellen: Darstellung }): JSX.Element {
  const daten = useMediaStatus().data;
  return darstellen(daten ? { active: daten.active === true } : null);
}
