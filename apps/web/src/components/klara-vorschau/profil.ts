// ================================================================================================
// ASSISTENZ IM PRODUKT · NAME UND AVATAR — gelesen, nie verwaltet.
// ================================================================================================
//
// Name und Avatar der persönlichen Assistenz gehören den beiden verknüpften PoC-Aufträgen
// (Personalisierung, Zustandsmotive). Diese Datei ist nur der LESEEINSTIEG dafür: Liegt ein Profil
// vor, zeigt die Assistenz dessen Namen und Avatar; ohne Profil heisst sie neutral „Deine
// Assistenz“ und trägt die gelieferte Figur. Hier wird nichts eingerichtet, gespeichert oder
// überschrieben — `setzeAssistenzProfil` ist der Anschluss für die kontobezogene Auswahl, die jene
// Aufträge liefern.
//
// Ein Avatar wird nur über eine RELATIVE Adresse der eigenen Anwendung geladen (wie `avatar.ts`);
// alles andere fällt auf die gelieferte Figur zurück.
import { useSyncExternalStore } from "react";
import { klaraAvatarUrl } from "./avatar";

export interface AssistenzProfil {
  /** Der gewählte Name — sichtbar an Figur und Gespräch. */
  name: string;
  /** Relative Adresse des gewählten Avatars, sonst `null` (gelieferte Figur). */
  avatarUrl: string | null;
}

export interface AssistenzAuftritt {
  /** `null` = kein Profil, die Oberfläche zeigt die neutrale Bezeichnung. */
  name: string | null;
  avatarUrl: string;
}

const NAME_MAX = 40;

function bereinigeName(roh: unknown): string | null {
  if (typeof roh !== "string") {
    return null;
  }
  const name = roh.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
  return name.length > 0 ? name : null;
}

function bereinigeAvatar(roh: unknown): string | null {
  if (typeof roh !== "string") {
    return null;
  }
  // Nur ein Pfad der eigenen Anwendung: beginnt mit genau einem „/“, kein Schema, keine Wirtsangabe.
  return /^\/(?![/\\])[^\s:]*$/.test(roh) ? roh : null;
}

let profil: AssistenzProfil | null = null;
const hoerer = new Set<() => void>();

/** Anschluss für die kontobezogene Auswahl (PoC-Aufträge). `null` = kein Profil. */
export function setzeAssistenzProfil(neu: AssistenzProfil | null): void {
  const name = neu ? bereinigeName(neu.name) : null;
  profil = name ? { name, avatarUrl: bereinigeAvatar(neu?.avatarUrl) } : null;
  for (const h of hoerer) {
    h();
  }
}

function abonnieren(h: () => void): () => void {
  hoerer.add(h);
  return () => hoerer.delete(h);
}

const lesen = (): AssistenzProfil | null => profil;

export function auftrittAus(p: AssistenzProfil | null): AssistenzAuftritt {
  return {
    name: p?.name ?? null,
    avatarUrl: p?.avatarUrl ?? klaraAvatarUrl(),
  };
}

export function useAssistenzProfil(): AssistenzProfil | null {
  return useSyncExternalStore(abonnieren, lesen, lesen);
}
