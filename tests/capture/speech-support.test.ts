import { describe, expect, it } from "vitest";
import { hasSpeechRecognition } from "../../apps/web/src/lib/speechSupport";

describe("SCRUM-236: hasSpeechRecognition", () => {
  it("erkennt Standard-SpeechRecognition", () => {
    expect(hasSpeechRecognition({ SpeechRecognition: class {} })).toBe(true);
  });

  it("erkennt webkitSpeechRecognition (Safari/Chrome-Präfix)", () => {
    expect(hasSpeechRecognition({ webkitSpeechRecognition: class {} })).toBe(true);
  });

  it("ohne Sprach-API → false (ehrlicher Negativzustand)", () => {
    expect(hasSpeechRecognition({})).toBe(false);
    expect(hasSpeechRecognition({ SpeechRecognition: undefined })).toBe(false);
  });

  it("null/undefined window → false (kein Crash)", () => {
    expect(hasSpeechRecognition(null)).toBe(false);
    expect(hasSpeechRecognition(undefined)).toBe(false);
  });
});
