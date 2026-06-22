# KLARWERK — Technischer Anhang

*Version 1.0 · 14. Juni 2026. Datenmodell, API, Zustandslogik, Rollenmatrix, Deployment-Modelle
und Reasoner-Spezifikation. Die konkreten Strukturen stammen aus der Referenz-Implementierung und
sind als **fachliche Vorgabe** zu verstehen; Technologie/Schema-Details sind anpassbar, solange
das Verhalten erhalten bleibt.*

---

## 1. Datenmodell

### 1.1 Entitäten (Überblick)
`User` 1—* `Session`; `User` 1—* `KnowledgeObject` (als Autor); `User` 1—* `Draft`;
`KnowledgeObject` 0—1 `Conflict` (eingebettet); `KnowledgeObject` *—* `User` über `assignments`
(Validierungs-Zuweisungen, eingebettet); `Gap` (Wissenslücke) eigenständig; `Audit` append-only.

### 1.2 User
| Feld | Typ | Beschreibung |
|---|---|---|
| id | string (PK) | eindeutig |
| email | string, unique | Login-Kennung |
| name | string | Anzeigename |
| role | enum | `expert` \| `controller` \| `admin` (Legacy `teacher`=expert) |
| approved | bool/int | 1 = freigeschaltet, 0 = wartet auf Admin |
| pw_salt, pw_hash | string | PBKDF2-SHA256 (Referenz: 100k Iter., 256 bit) |
| created_at | timestamp | |

### 1.3 Session
`token (PK)`, `user_id (FK)`, `expires_at` (Referenz: 14 Tage; HttpOnly-Cookie).

### 1.4 KnowledgeObject (KO)
Persistenz in der Referenz: einige **abfragbare Spalten** (`id`, `title`, `kind`, `status`,
`author_id`, `author_name`, `updated_at`) plus **JSON-Payload** mit dem vollständigen Objekt.
Empfehlung für den Neubau: relationale Normalisierung der häufig gefilterten Felder, Rest als
JSON/Dokument.

| Feld | Typ | Beschreibung |
|---|---|---|
| id | string | |
| title | string | Aussage-Titel (keine Warum-Frage) |
| kind | enum | `intuition`\|`practice`\|`evolution`\|`tech`\|`negative` |
| category | string | freie Kategorie |
| domain | string | fachlicher Bereich |
| statement | string | Kernaussage |
| conditions[] | string[] | „Wenn" |
| actions[] | string[] | „Dann" |
| tags[] | string[] | Schlagworte |
| confidence | enum | `high`\|`medium`\|`low` |
| status | enum | `pending`\|`review`\|`validated`\|`rejected` |
| trust | int 0–99 | abgeleiteter Vertrauenswert |
| needed | int 1–5 | nötige grüne Validierungen (Std. 3) |
| ratings | {green,amber,red} | Bewertungszähler |
| version | int | Versionsnummer |
| history[] | {v,date,by,note}[] | Revisions-/Statushistorie |
| author | string | aktueller Autor (Name) |
| originalAuthor | string | ursprünglicher Autor (für Fußnote, bei Übergabe) |
| role | string | Rolle/Funktion des Autors |
| sources[] | {who,quote}[] | Quellen/Zitate |
| comments[] | {who,name,text,verdict,date,forVersion}[] | Kommentare |
| conflict | Conflict\|null | siehe 1.5 |
| assignments[] | {to,toName,by,byName,at,status,doneAt}[] | Validierungs-Zuweisungen |
| external | object\|null | externe Referenz (z. B. Wikipedia, „nicht peer-validiert") |
| helped | int | „Hat geholfen"-Zähler (Bewährung) |
| asset | object\|null | gekoppelte Anlage/Prozess (für Re-Validierung) |
| revalidate | object\|null | offene Re-Validierungs-Markierung |
| page | string (HTML) | WYSIWYG-Wissensseite |
| photos[] | {name,dataUrl}[] | Bildanhänge |
| createdAt | date | |

### 1.5 Conflict (eingebettet)
`type` (`Truth`\|`Experience`\|`Context`\|`Temporal`\|`Role`), `between[]` (beteiligte Autoren),
`description`, `impact` (Trust-Wirkung), `escalated` (bool), `resolved` (bool), optionale
`secondOpinion`/Entscheidung.

### 1.6 Draft, Gap, Audit
- **Draft:** `id`, `author`, `payload {title, raw, photos[], source}`, `updatedAt`. **Gemeinsamer
  Pool**; Autor wird beim Anlegen gesetzt und bei Updates bewahrt.
- **Gap:** `id`, `payload {question, date, status, assignee}`, `updatedAt`.
- **Audit:** `seq` (auto, append-only), `action`, `ko_id`, `ko_title`, `actor`, `at`.

---

## 2. API-Spezifikation (Referenz)

REST/JSON, Session per Cookie. Schützenswerte Endpunkte erfordern eine gültige Sitzung; Admin-
Endpunkte die Admin-Rolle. (Der Neubau kann das API-Design ändern; die **Operationen** müssen
abgedeckt sein.)

### 2.1 Auth & Status (ohne Sitzung)
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/auth/status` | `{needsSetup}` — ist Ersteinrichtung nötig? |
| GET | `/api/ai-status` | `{ai}` — ist der Reasoner (Modell) verfügbar? |
| POST | `/api/auth/setup` | erstes Admin-Konto anlegen |
| POST | `/api/auth/register` | Selbstregistrierung (gesperrt bis Freigabe) |
| POST | `/api/auth/login` | Login → Sitzung |
| GET | `/api/auth/me` | aktueller Nutzer |
| POST | `/api/auth/logout` | Logout |

### 2.2 Nutzerverwaltung (Admin)
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/users` | Liste (inkl. approved) |
| POST | `/api/users` | Nutzer anlegen (sofort freigegeben) |
| PUT | `/api/users/:id` | Rolle ändern / freigeben / Passwort-Reset |
| DELETE | `/api/users/:id` | Nutzer löschen (inkl. Sitzungen) |

### 2.3 Wissensobjekte
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/kos` | alle KOs |
| POST | `/api/kos` | KO anlegen |
| PUT | `/api/kos/:id` | KO ändern (Bewertung, Kommentar, Revision, Kategorie, Zuweisung, Konflikt, Autor-Übergabe …) — `{ko, action}` |
| DELETE | `/api/kos/:id` | KO löschen (Controller/Admin) |

### 2.4 Entwürfe, Lücken, Audit
| Methode | Pfad | Zweck |
|---|---|---|
| GET/POST | `/api/drafts` · `/api/drafts/:id` (DELETE) | Entwürfe (gemeinsamer Pool, Autor bewahrt) |
| GET/POST | `/api/gaps` · `/api/gaps/:id` (DELETE) | Wissenslücken |
| GET | `/api/audit` | Audit-Log |

### 2.5 Reasoner
| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/api/reasoner` | `{task: 'structure'\|'ask', text, context}` — serverseitige KI mit deterministischem Fallback |
| POST | `/api/claude` | (Referenz) Proxy zum Modellanbieter; Schlüssel bleibt serverseitig |

> Hinweis: In der Referenz koexistieren zwei Wege (`/api/reasoner` und ein Modell-Proxy
> `/api/claude`). Für den Neubau wird **ein** einheitlicher, modellagnostischer Reasoner-Service
> empfohlen (siehe §5).

---

## 3. Zustands- & Berechnungslogik

### 3.1 KO-Status (Zustandsautomat)
Eingang: Bewertungen `ratings{green,amber,red}`, Schwelle `needed` (Std. 3).

```
pending  ──(erste Bewertung)──▶ review
review   ──(green ≥ needed UND red = 0)──▶ validated
review   ──(red > green)──▶ rejected
validated ──(neuer Konflikt: Truth/abweichend)──▶ review   (Trust sinkt)
*        ──(Autor überarbeitet)──▶ review                   (ratings reset, Version+1)
```
- `validated` verlässt das **Validation Board** (erscheint nur noch in der Bibliothek).
- Re-Validierung markiert ein `validated`-KO als „prüfen" (Lebenszyklus), ohne den Status hart zu ändern.

### 3.2 Trust-Berechnung (Referenzformel)
```
total = green + amber + red
trust = round((green*100 + amber*55 + red*10) / total)          // 0 bei total=0
falls Konflikt: trust = max(15, trust + conflict.impact)
ergebnis = clamp(trust, 0, 99)
```

### 3.3 Konfliktarten (Referenz)
| Art | eskaliert | Trust-Wirkung | Bedeutung |
|---|---|---|---|
| Truth | **ja** | −12 | unvereinbare Faktenaussagen — genau eine kann stimmen |
| Experience | nein | −8 | unterschiedliche Erfahrungsstufen; nach Autorität gewichtet |
| Context | nein | −6 | beide gültig, aber in verschiedenen Betriebskontexten |
| Temporal | nein | −8 | zu verschiedenen Zeiten gültig; Versionierung löst auf |
| Role | nein | −5 | verschiedene Rollenziele (Qualität vs. Durchsatz) |

### 3.4 Wissensarten
`intuition` 💡 · `practice` 🏛 · `evolution` 📈 · `tech` 🔧 · `negative` ⛔.

---

## 4. Rollen- & Rechtematrix

| Aktion | Viewer | Experte | Controller | Admin |
|---|:--:|:--:|:--:|:--:|
| Wissen lesen / fragen | ✓ | ✓ | ✓ | ✓ |
| Erfassen / Entwürfe / Strukturieren | – | ✓ | ✓ | ✓ |
| Kommentieren | – | ✓ | ✓ | ✓ |
| Bewerten (✅/⚠️/❌) | – | – | ✓ | ✓ |
| Konflikt eskalieren | – | ✓ | ✓ | ✓ |
| Konflikt auflösen / entscheiden | – | – | ✓ | ✓ |
| Zuweisung zur Validierung | – | ✓ | ✓ | ✓ |
| Import/Export | – | ✓ | ✓ | ✓ |
| KO löschen | – | – | ✓ | ✓ |
| Autor-Übergabe | – | – | – | ✓ |
| Nutzerverwaltung (anlegen/freigeben/Rolle/Reset/löschen) | – | – | – | ✓ |

*Hinweis Referenz:* Fähigkeiten (capture/rate/resolve …) sind über eine PERMS-Matrix nach
Rolle gesteuert; „admin" erbt Controller-Fähigkeiten und ergänzt die Verwaltung. Für den Neubau:
echtes RBAC, serverseitig erzwungen (NFR-SEC-03).

---

## 5. Reasoner-Spezifikation & Deployment-Modelle

### 5.1 Reasoner als gekapselte Schicht
Ein einheitlicher Service mit den Aufgaben **structure / answer / interview / search-select /
second-opinion / writing-assist**. Eigenschaften:
- **Modell-/anbieteragnostisch**: konkretes Modell/Endpunkt per Konfiguration; Fachlogik bleibt
  unverändert (NFR-MNT-01).
- **Strikte JSON-Verträge** zwischen Fachlogik und Modell (z. B. Strukturierungs-Schema,
  Antwort-Schema mit `answer`/`reasoning`/`matchedId`).
- **Anti-Halluzination**: Prompts erzwingen Trennung gesichert/ungeprüft/Meinung/extern/Annahme
  und explizites „nicht bekannt".
- **Deterministischer Fallback** ohne Modell (Demo-Engine), inkl. server-echter Statusanzeige
  (`/api/ai-status`).
- **Schlüssel/Token nur serverseitig.**

### 5.2 Deployment-Modelle (Datenfluss transparent)
| | Cloud | Private AI | On-Premises |
|---|---|---|---|
| Infrastruktur | von KLARWERK in EU-Cloud betrieben | dedizierte, isolierte Instanz in der Cloud-Umgebung des Kunden (VPC) | vollständig im RZ/Netz des Kunden |
| Modellzugriff | führendes Frontier-Modell über verwaltetes Backend (Schlüssel serverseitig) | vom Kunden freigegebener Modell-Endpunkt in dessen Region (No-Training) | lokal gehostetes Open-Weight-Modell, keine externen Aufrufe |
| Datenfluss | Wissen in EU-Cloud; pro Anfrage Kontext an Modell-API. **Daten verlassen die Kunden-Infrastruktur** (Enterprise-Bedingungen, kein Training auf Kundendaten). | Wissen in der Cloud-Grenze des Kunden; Reasoning-Aufrufe nur an freigegebenen Endpunkt innerhalb der Grenze/Region. | Wissen **und** Reasoning verlassen das Firmennetz nie. **Keine Daten verlassen das Haus.** |
| Compliance | EU-Residenz, Verschlüsselung, AV-Verträge | kundenkontrollierte Schlüssel/Region, starke Isolation | maximale Kontrolle; Modellleistung/Betrieb beim Kunden |

**Verbindlich:** Die Aussage „keine Daten verlassen das Haus" gilt **ausschließlich** für
On-Premises (NFR-PRV-02). Die Architektur muss alle drei Modelle aus **einer** Codebasis
bedienen (Konfiguration, nicht Fork).

---

## 6. Architektur-Leitplanken (Empfehlung)

- **Schichten:** Web-Frontend (Desktop + responsive/PWA) · API/Domänenservice · Reasoner-Service
  (austauschbar) · Datenbank (transaktionssicher) · Audit (append-only) · Identity (lokal/SSO).
- **Mandantenfähigkeit** von Beginn an (Daten-/Konfig-Isolation pro Kunde).
- **Beobachtbarkeit**: Logs/Metriken/Tracing, KI-Kosten-/Nutzungs-Logging.
- **CI/CD** mit Unit/Integration/E2E-Tests und reproduzierbaren Deployments je Modell.
- **Migration**: JSON-Import bestehender Demo-/App-Daten (geringe Menge).

---

## 7. Referenz-Verhalten (Verifikation)

Die heutige Implementierung ist mit automatisierten Tests abgesichert (API-Tests gegen einen
DB-Mock; Render-/Smoke-Tests über alle Oberflächen). Diese Test-Szenarien eignen sich als
Vorlage für die Abnahme-Testfälle des Neubaus (Auth/Registrierung+Freigabe, Nutzerverwaltung,
KO-CRUD inkl. Status/Trust, Drafts mit Autor-Erhalt, Gaps, Reasoner-Fallback, Audit, Rollen).
