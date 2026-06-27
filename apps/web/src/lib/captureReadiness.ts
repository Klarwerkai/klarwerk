// SCRUM-248: DOM-freie Speicher-Bereitschaft („Readiness") des Capture-Entwurfs. Macht ehrlich
// sichtbar, was aus dem Rohinput im KO landet und was vor dem Speichern noch fehlt — KEINE
// Auto-Erkennung, KEINE KI-Klassifikation, nur die echten Entwurfsfelder. Reine Funktion, testbar.
import { isEmptyHtml } from "./richText";

export type CaptureCheckKey = "title" | "content" | "category" | "type" | "attachments";

export interface CaptureCheck {
  key: CaptureCheckKey;
  ok: boolean;
  required: boolean;
}

export interface CaptureReadiness {
  checks: CaptureCheck[];
  canSave: boolean; // alle Pflicht-Checks erfüllt
  missingRequired: CaptureCheckKey[]; // welche Pflichtfelder noch fehlen
}

export interface CaptureDraftInput {
  title: string;
  statement: string;
  bodyHtml: string;
  category: string;
  type: string;
  attachmentCount: number;
}

// Inhalt ist vorhanden, wenn die Aussage Text trägt ODER der WYSIWYG-Body echten Inhalt hat
// (das Backend leitet die Aussage bei leerem statement aus dem bodyHtml ab — gleiche Logik).
function hasContent(statement: string, bodyHtml: string): boolean {
  return statement.trim().length > 0 || !isEmptyHtml(bodyHtml);
}

export function captureReadiness(input: CaptureDraftInput): CaptureReadiness {
  const checks: CaptureCheck[] = [
    { key: "title", ok: input.title.trim().length > 0, required: true },
    { key: "content", ok: hasContent(input.statement, input.bodyHtml), required: true },
    // Kategorie ist optional — fehlt sie, greift serverseitig der Default „Allgemein".
    { key: "category", ok: input.category.trim().length > 0, required: false },
    // Wissensart ist immer gesetzt (Auswahl mit Default), daher informativ.
    { key: "type", ok: input.type.trim().length > 0, required: false },
    // Anhänge sind optional — der Hinweis macht nur sichtbar, was mitgenommen wird.
    { key: "attachments", ok: input.attachmentCount > 0, required: false },
  ];
  const missingRequired = checks.filter((c) => c.required && !c.ok).map((c) => c.key);
  return { checks, canSave: missingRequired.length === 0, missingRequired };
}
