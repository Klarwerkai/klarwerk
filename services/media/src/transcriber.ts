import { type Transcriber, TranscriberConfidentialError } from "./types";

// SCRUM-502 R7/R8: der Transkriptions-Chokepoint. `rejectsConfidential` ist PFLICHT (kein Default) —
// der Aufrufer MUSS die Egress-Politik explizit setzen und kann den Wächter nicht durch Weglassen
// umgehen. `true` (Cloud, build-app): wirft bei confidential=true, BEVOR die Rohbytes gesendet werden —
// fail-safe by construction, analog cappedModelClient des Reasoners. `false` (späterer on-prem
// Transkriber): bedient vertrauliche Medien weiter.
//
// Auftrag gesamt-ki-freigaberegeln (Ben Nacharbeit 2): `vertraulichFreigegeben` ist die zentrale
// Adminfreigabe für Vertrauliches (`Reasoner.vertraulicheAusleitungFreigegeben`), je Aufruf frisch
// gefragt. Nur ihr `true` lässt ein vertrauliches Medium durch; fehlt sie oder wirft sie, bleibt es
// gesperrt. Die Einstufung reist unverändert weiter.
export function cappedTranscriber(
  inner: Transcriber,
  opts: { rejectsConfidential: boolean; vertraulichFreigegeben?: (() => boolean) | undefined },
): Transcriber {
  const freigegeben = (): boolean => {
    try {
      return opts.vertraulichFreigegeben?.() === true;
    } catch {
      return false;
    }
  };
  return {
    name: inner.name,
    // R-0181: die Auskunft „bestätigt lokal" reist durch den Wächter — der Dienst entscheidet daran,
    // ob eine Freigabe für ÖFFENTLICHE KI überhaupt gefragt ist.
    ...(inner.lokal === true ? { lokal: true } : {}),
    transcribe: (bytes, mime, locale, confidential) => {
      if (opts.rejectsConfidential && confidential && !freigegeben()) {
        return Promise.reject(new TranscriberConfidentialError());
      }
      return inner.transcribe(bytes, mime, locale, confidential);
    },
  };
}

// F-0121 (JOB 2955 D1): DIE FORMATANGABE DES UPLOADS.
//
// Die Transkriptions-API bestimmt das Format der Aufnahme über die DATEIENDUNG des hochgeladenen
// Feldes; ihre Fehlermeldung zählt ausschließlich Endungen auf (flac, mp3, mp4, mpeg, mpga, m4a,
// ogg, wav, webm). Bis hierher hing `transcribe` die Aufnahme unter dem extensionslosen Namen
// "media" an und warf damit bei JEDEM Aufruf die einzige Formatangabe weg, die vorliegt — obwohl
// der MIME-Typ als Parameter hereinkommt.
//
// Abgebildet sind genau die von der API unterstützten Formate. Ein unbekannter Typ bekommt
// BEWUSST KEINE Endung: eine geratene Endung wäre eine Falschangabe über den Inhalt, und die
// ehrliche Ablehnung durch die API ist besser als ein falsch deklarierter Upload.
const MEDIA_DATEIENDUNGEN: Readonly<Record<string, string>> = {
  "audio/flac": "flac",
  "audio/mp3": "mp3",
  "audio/mpeg": "mp3",
  "audio/mpga": "mpga",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/oga": "oga",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/webm": "webm",
  "video/mp4": "mp4",
  "video/mpeg": "mpeg",
  "video/webm": "webm",
};

// Der Browser-Rekorder liefert den Typ mit Parametern ("audio/webm;codecs=opus"); genau solche
// Aufnahmen entstehen im Produkt. Deshalb wird vor dem Nachschlagen am Semikolon abgeschnitten
// und normalisiert.
function uploadDateiname(mime: string): string {
  const typ = (mime.split(";")[0] ?? "").trim().toLowerCase();
  const endung = MEDIA_DATEIENDUNGEN[typ];
  return endung ? `media.${endung}` : "media";
}

// Anbieter-Client für Sprache→Text. Der Schlüssel bleibt ausschließlich serverseitig
// (G-7) und wird nie geloggt oder an den Client gegeben. `fetchFn` injizierbar → testbar ohne Netz.
export interface WhisperConfig {
  apiKey: string;
  model?: string | undefined;
  baseUrl?: string | undefined;
  fetchFn?: typeof fetch | undefined;
}

export function whisperClient(config: WhisperConfig): Transcriber {
  const fetchFn = config.fetchFn ?? fetch;
  const baseUrl = config.baseUrl ?? "https://api.openai.com";
  const model = config.model ?? "whisper-1";
  return {
    name: `openai:${model}`,
    // SCRUM-502 R7: `confidential` ist Interface-Pflicht; der Egress-Wächter sitzt im Cloud-Wrapper
    // (cappedTranscriber). Der rohe Client reicht den Aufruf nur durch (kein externer Egress bei
    // confidential, weil der Wrapper vorher wirft).
    async transcribe(
      bytes: Buffer,
      mime: string,
      locale: "de" | "en",
      _confidential: boolean,
    ): Promise<string> {
      const form = new FormData();
      form.append("model", model);
      form.append("language", locale);
      form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), uploadDateiname(mime));
      const res = await fetchFn(`${baseUrl}/v1/audio/transcriptions`, {
        method: "POST",
        headers: { authorization: `Bearer ${config.apiKey}` },
        body: form,
      });
      if (!res.ok) {
        throw new Error(`Transkriptions-API antwortete mit ${res.status}`);
      }
      const data = (await res.json()) as { text?: string };
      return data.text ?? "";
    },
  };
}

// ================================================================================================
// Aufnahme `gesamt-ocr` · R-0181 — VERSCHRIFTLICHUNG AUF DEM EIGENEN RECHNER, OHNE CLOUD.
// ================================================================================================
//
// Bis hierher gab es nur den Cloud-Client oben; „später on-prem" stand allein als Kommentar am
// Wächter. Jetzt gibt es den lokalen Weg über DENSELBEN Transcriber-Vertrag: ein Sprach-zu-Text-
// Dienst auf dem eigenen Rechner mit der verbreiteten OpenAI-kompatiblen Schnittstelle
// (`POST <basis>/audio/transcriptions`, multipart: model, language, file) — so sprechen z. B.
// faster-whisper-server/Speaches und der whisper.cpp-Server. WELCHER Dienst dort läuft, legt
// dieses Modul nicht fest; es spricht nur die Schnittstelle.
//
// EINGERICHTET über die Umgebung, wie der lokale Sprachdienst des Reasoners (KLARWERK_LOCAL_LLM_*):
//   KLARWERK_LOCAL_TRANSCRIBE_URL              z. B. http://127.0.0.1:8000/v1
//   KLARWERK_LOCAL_TRANSCRIBE_MODEL            optional, Modellname des lokalen Dienstes
//   KLARWERK_LOCAL_TRANSCRIBE_ALLOWED_ORIGINS  optional, kommagetrennte private Origins
//
// „LOKAL" IST TECHNISCH BEGRENZT, NICHT NUR EIN NAME — dieselbe Regel wie
// `isConfirmedLocalOrigin` des Reasoners (`services/reasoner/src/model-client.ts`), hier ohne
// Modulkopplung nachgebildet: bestätigt lokal ist nur eine Loopback-Adresse (localhost,
// 127.0.0.0/8, ::1) oder eine ausdrücklich freigegebene Origin. Nur dann trägt der Transkriber
// `lokal: true` — der Ton verlässt den Rechner nicht, und vertrauliche Medien dürfen bedient
// werden (`rejectsConfidential: false`, die am Wächter oben seit SCRUM-502 vorgesehene Stellung).
// Eine andere Adresse wird wie ein EXTERNER Dienst behandelt: Wächter scharf, alle Freigaben gelten.
export function istBestaetigtLokaleAdresse(
  basisUrl: string,
  freigegebeneOrigins?: string,
): boolean {
  let url: URL;
  try {
    url = new URL(basisUrl);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  const loopback =
    host === "localhost" ||
    host === "::1" ||
    host === "[::1]" ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
  if (loopback) {
    return true;
  }
  return (freigegebeneOrigins ?? "")
    .split(",")
    .map((eintrag) => eintrag.trim())
    .filter((eintrag) => eintrag.length > 0)
    .some((eintrag) => {
      try {
        return new URL(eintrag).origin === url.origin;
      } catch {
        return false;
      }
    });
}

export interface LokalerTranskriberConfig {
  /** Basisadresse der Schnittstelle, z. B. `http://127.0.0.1:8000/v1`. */
  basisUrl: string;
  model?: string | undefined;
  /** Ergebnis von `istBestaetigtLokaleAdresse` — nur `true` macht den Weg zum lokalen. */
  lokal: boolean;
  fetchFn?: typeof fetch | undefined;
}

/** Der Client für einen Sprach-zu-Text-Dienst auf dem eigenen Rechner (kein Schlüssel). */
export function lokalerTranskriber(config: LokalerTranskriberConfig): Transcriber {
  const fetchFn = config.fetchFn ?? fetch;
  const basis = config.basisUrl.replace(/\/+$/, "");
  const model = config.model?.trim() || "whisper-1";
  return {
    name: `local:${model}`,
    ...(config.lokal ? { lokal: true } : {}),
    async transcribe(
      bytes: Buffer,
      mime: string,
      locale: "de" | "en",
      _confidential: boolean,
    ): Promise<string> {
      const form = new FormData();
      form.append("model", model);
      form.append("language", locale);
      form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), uploadDateiname(mime));
      const res = await fetchFn(`${basis}/audio/transcriptions`, { method: "POST", body: form });
      if (!res.ok) {
        throw new Error(`Lokaler Transkriptionsdienst antwortete mit ${res.status}`);
      }
      const data = (await res.json()) as { text?: string };
      return data.text ?? "";
    },
  };
}

// Aus der Umgebung: KLARWERK_LOCAL_TRANSCRIBE_URL. Ohne Eintrag → undefined (kein lokaler Weg).
function createLocalTranscriberFromEnv(
  env: Record<string, string | undefined>,
): Transcriber | undefined {
  const basisUrl = env.KLARWERK_LOCAL_TRANSCRIBE_URL?.trim();
  if (!basisUrl) {
    return undefined;
  }
  return lokalerTranskriber({
    basisUrl,
    model: env.KLARWERK_LOCAL_TRANSCRIBE_MODEL,
    lokal: istBestaetigtLokaleAdresse(basisUrl, env.KLARWERK_LOCAL_TRANSCRIBE_ALLOWED_ORIGINS),
  });
}

// Aus der Umgebung: MEDIA_TRANSCRIBE_API_KEY (dediziert) oder OPENAI_API_KEY.
// Ohne Schlüssel → undefined → ehrlicher Inaktiv-Zustand (kein Fake-Transkript).
export function createTranscriberFromEnv(
  env: Record<string, string | undefined> = process.env,
): Transcriber | undefined {
  const apiKey = env.MEDIA_TRANSCRIBE_API_KEY ?? env.OPENAI_API_KEY;
  if (!apiKey) {
    return undefined;
  }
  return whisperClient({ apiKey, model: env.MEDIA_TRANSCRIBE_MODEL });
}

// SCRUM-502 R8 (Encapsulation + Credential-Gating): der EINZIGE Weg, von außerhalb dieses Moduls an
// einen Transkriber zu kommen. Der rohe whisperClient und der Credential-Zugriff (MEDIA_TRANSCRIBE_
// API_KEY/OPENAI_API_KEY) bleiben modul-intern und werden NICHT re-exportiert; nach außen wird
// ausschließlich der GECAPPTE Cloud-Transkriber gereicht — mit zwingendem Egress-Wächter
// (rejectsConfidential=true). Ohne Schlüssel → undefined (ehrlicher Inaktiv-Zustand, kein Fake).
//
// Aufnahme `gesamt-ocr` · R-0181: ist ein lokaler Dienst eingerichtet, GEWINNT er — wer ihn
// einrichtet, will, dass der Ton im Haus bleibt; ein zusätzlich hinterlegter Cloudschlüssel wird
// dann nicht benutzt. Auch der lokale Weg läuft durch den Wächter: bestätigt lokal ohne Sperre für
// Vertrauliches, sonst wie ein externer Dienst.
export function createCappedTranscriberFromEnv(
  env: Record<string, string | undefined> = process.env,
  freigabe: { vertraulichFreigegeben?: (() => boolean) | undefined } = {},
): Transcriber | undefined {
  const lokal = createLocalTranscriberFromEnv(env);
  if (lokal) {
    return cappedTranscriber(lokal, {
      rejectsConfidential: lokal.lokal !== true,
      vertraulichFreigegeben: freigabe.vertraulichFreigegeben,
    });
  }
  const raw = createTranscriberFromEnv(env);
  return raw
    ? cappedTranscriber(raw, {
        rejectsConfidential: true,
        vertraulichFreigegeben: freigabe.vertraulichFreigegeben,
      })
    : undefined;
}
