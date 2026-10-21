# FRONTEND-CODEX-ÜBERGABE AN CHATGPT – AUTH-RETRY

FRONTEND STATUS: FERTIG

Stand: 21.10.2026. Repository: `tschanni/mueller-it-mkk`.
Ausgangscommit: `58f9c142a53033ffea2c23c322e456bcfddf052b`.
Implementierungscommit: Commit dieser Datei (`git log -1 --format=%H -- docs/AUTH_RETRY_HANDOFF.md`); vollständige SHA zusätzlich in der Chat-Übergabe.
Backend: `tschanni/Gameserver_Dashboard`, Commit `a76594028fb01824d01ddf6f5a6dbae7e7802c10`.
Der vollständige Vertrag `docs/AUTH_RETRY_API_CONTRACT.md` wurde aus genau diesem Commit im separaten lokalen Backend-Repository gelesen. Der Commit war nicht im alten Vertragscheckout vorhanden und noch nicht über dessen GitHub-Remote abrufbar. Backend ist laut Auftrag noch nicht produktiv deployed.
Kein Push, keine produktiven Registrierungen, kein produktives Deployment und keine Infrastrukturänderungen durchgeführt.

## Registrierung und sichere Wiederherstellung

Die produktive Client-Implementierung verwendet jetzt ausschließlich:

```text
POST {konfigurierte API-Basis ohne /auth}/auth-recovery/registrations
GET  {konfigurierte API-Basis ohne /auth}/auth-recovery/registration
```

Beispielbasis: `https://api.example/games/api/v1`. Bestehende Auth-Origin-Konfiguration und Deployment-Präfix werden wiederverwendet, nicht die Website-Origin. Browser setzt Origin selbst. Beide Requests verwenden Cookie-Credentials, `cache: no-store`, `redirect: error`, JSON-Accept und denselben geheimen `Idempotency-Key` ausschließlich als Header. POST enthält exakt `name`, `email`, `password`; kein Callback-/Rollen-/Profilfeld.

Ein Receipt-Objekt gehört zu genau einer bewussten Registrierung. Der Schlüssel verwendet Browser-`crypto.getRandomValues` mit 32 Bytes und das Format `v1.<Unixsekunden>.<64 kleine Hexzeichen>`. Schlüssel und ursprünglicher serialisierter Body bleiben bei zulässigen Wiederaufnahmen identisch. Es gibt keine Speicherung in localStorage/sessionStorage, keine URLs, Logs oder Analytics mit Passwort/Key und keinen globalen POST-Retry.

- Höchstens sechs HTTP-Anfragen insgesamt, einschließlich späterer expliziter Statusprüfung. Staffelung 0/1/2/4/8/16 Sekunden plus 0–250 ms Jitter; maximale automatische Gesamtdauer 120 Sekunden.
- Jeder Request erhält einen eigenen AbortController und höchstens 15 Sekunden, begrenzt durch das verbleibende Gesamtbudget. Benutzerabbruch und Request-Timeout bleiben getrennt. Auch nicht kooperierende Adapter/Mocks blockieren die UI nicht unbegrenzt.
- SUCCEEDED/REGISTRATION_ACCEPTED: generischer Erfolg; keine Session erzeugen oder aus der Antwort ableiten und keine weitere Mailaktion auslösen.
- PENDING: ausschließlich Status-GETs.
- Netzwerkfehler, Timeout, unklare Antwort, allgemeine 429 oder 5xx: zuerst Status-GET, kein blinder POST-Replay.
- Nur bestätigtes REGISTRATION_NOT_FOUND oder exakt RATE_LIMITED/AUTH_RATE_LIMITED erlaubt während der automatischen Phase einen erneuten POST mit ursprünglichem Key/Body.
- `Retry-After` und `X-Retry-After` werden ausgewertet, einschließlich HTTP-Datum; die längere Vorgabe hat Vorrang. Kein Request, wenn die Wartezeit nicht ins Gesamtbudget passt. Fehlt eine Rate-Limit-Wartezeit, wird konservativ eine Minute angesetzt.
- UNCERTAIN beendet die automatische Schleife sofort. Explizite spätere Prüfung ist ausschließlich ein einzelner GET mit demselben Key; sie startet niemals einen POST und ist nur innerhalb verbleibender Versuchs-/Zeitgrenzen verfügbar. Das Frontend nutzt bewusst nicht die gesamte mögliche 24-Stunden-Receipt-Gültigkeit.
- 400/403/409/410 sind terminal und erzeugen keinen neuen Key. Servertexte und technische Codes werden nicht ungeprüft angezeigt.
- Nach möglicherweise abgesendetem POST ist ein dauerhaft unerreichbarer Server UNCERTAIN. Die UI behauptet in diesem Fall keinen sicheren Fehlschlag. Die Meldung „Anmeldeserver nicht erreichbar“ ist für einen eindeutigen Fehler ohne möglicherweise verarbeiteten POST vorgesehen; der Standardablauf verwendet keinen zusätzlichen Readiness-GET.
- Passwort/serialisierter Body werden nach Ende der automatischen Phase aus den eigenen Referenzen entfernt; Formular-Passwörter werden anschließend geleert. Unbrauchbare/terminale Schlüssel werden verworfen. Bei tatsächlich geschlossenem Fenster werden Requests abgebrochen, bei Provider-Unmount auch Receipt-Referenzen freigegeben.
- Ein erneutes Öffnen zeigt das vorhandene Ergebnis bzw. den ungeklärten Vorgang. Es startet keinen neuen Signup. Das gilt auch für Fehler-/Erfolgsabschlüsse; es gibt keine verdeckte automatische Rückkehr zu einem neuen Registrierungsvorgang.

Die bestehende Adapter-Schnittstelle bleibt für ältere lokale Testadapter kompatibel. Der konfigurierte Website-Client bietet die Recovery-Factory und verwendet für Registrierung keinen alten `/auth/sign-up/email`-Aufruf mehr. Ein direkter `signUp`-Adapteraufruf verwendet ebenfalls die neue Wiederherstellung und liefert bei unklarem Abschluss einen sicheren Ungewissheitsfehler.

## Windows-98-Dialog und Formulare

Der bestehende Fensterrahmen erhält während Übertragung und Ergebnis den Titel „Müller IT MKK – Datenübertragung“. Kein zweites Modal/Popup. Die gemeinsame `AuthTransfer`-Ansicht verwendet ein Computer-Icon links, einen pixelartigen Server rechts, kontinuierliche CSS-Datenpakete und das vorhandene Branding. Reduced Motion deaktiviert die Bewegung.

LOADING zeigt ausschließlich „Deine Registrierung wird verarbeitet …“ bzw. beim Login „Anmeldung läuft …“ und „Bitte warte einen Moment.“ Keine Versuchszahlen, Zeiten, Diagnosen, Prozentwerte oder Fortschrittsbalken. Das Formular verschwindet währenddessen; seine Werte bleiben im Arbeitsspeicher bis zum Abschluss. Ein synchroner Submit-Lock und die zentrale Operationssperre verhindern Doppelklick-/Enter-Duplikate.

SUCCESS beendet die Animation und zeigt im selben Fenster ein Briefsymbol, „Registrierung angenommen“ und exakt den konditionalen Hinweis auf eine eventuell notwendige Bestätigung einschließlich Spam-Ordner. Keine Behauptung über tatsächliche Kontoanlage oder Mailzustellung.

ERROR zeigt eine sichere fachliche Fehlermeldung; UNCERTAIN zeigt den neutralen Hinweis zum möglicherweise noch verarbeiteten Vorgang und gegebenenfalls „Status erneut prüfen“. Nach Loginfehlern kann ausdrücklich zur Anmeldung zurückgekehrt werden; dabei ist das Passwort geleert. Abbrechen/Schließen beendet Client-Wartearbeit, kann aber Backend-Mutationen nicht rückgängig machen.

## Login und unveränderte Abläufe

Login-POST genau einmal; keine automatische Wiederholung der Passwortprüfung. Bei verlorenem/unklarem Ergebnis folgen höchstens drei Session-GETs, somit maximal vier HTTP-Anfragen für diesen Login. Session-Leseanfragen haben ebenfalls einzelne 15-Sekunden-Grenzen; nur Login und Recovery verwenden das gezielt längere Operationsbudget. Andere Auth-/Profilaktionen behalten ihre bisherige 15-Sekunden-Gesamtgrenze.

Nur eine validierte, nicht abgelaufene Cookie-Session mit der erwarteten E-Mail-Adresse bestätigt den Login. Das wird auch nach einem erfolgreichen POST geprüft. Eine andere bereits bestehende Session ist kein Erfolgsnachweis. Ohne belastbaren Abschluss erscheint ein neutraler Hinweis statt einer automatischen weiteren Passwortprüfung. Fachliche Fehler/401/403/429 beenden die automatische Verarbeitung; der bestehende API-Client erzwingt Rate-Limit-Wartezeiten auch vor manuellen Wiederholungen.

Discord-OAuth, Reset, Verifikation, Resend, Kontakt-/Website-Profilbilder, Minecraft-Whitelist und Backend-Avatare wurden nicht in die neue Retry-Schleife aufgenommen. Keine Minecraft-/Avatar-Implementierungsdatei geändert; der bestehende Whitelist-Rollout-Schalter bleibt unangetastet.

## Geänderte Dateien

- `src/auth/registrationRecovery.ts`: Receipt-Lebenszyklus, Zustandsmaschine, Request-Zeitgrenzen, Backoff/Retry-Header.
- `src/auth/AuthContext.tsx`: zentrale Operation/Receipt, Ergebniszustände, Abbruch, abgesicherter Login.
- `src/auth/client.ts`: neue Recovery-Routen/Factory, sicherer Ungewissheitsfehler.
- `src/auth/AuthWindows.tsx`: Form-Locks, Passwortfreigabe, Übertragungs-/Ergebnisansicht im bestehenden Fenster.
- `src/auth/AuthTransfer.tsx`: gemeinsame visuelle Übertragung und Ergebnisdarstellung.
- `src/auth/auth.css`: Paketanimation, harte Windows-98-Kanten, Reduced Motion.
- `src/components/Window/WinWindow.tsx`: Titel desselben Fensters an den Übertragungszustand anpassen.
- `src/auth/registrationRecovery.test.ts`, `AuthRecoveryUI.test.tsx`: neue Retry-/UI-Tests.
- `src/auth/Auth.test.tsx`, `client.test.ts`, `Enhancements.test.tsx`: aktualisierte Auth-/Adapter-/Login-Regressionsprüfungen.
- `scripts/browser-auth-smoke.cjs`: neues Registrierungsschema und gezielter Offline-Modus `--auth-retry-only`.
- `docs/browser-artifacts/auth-transfer-desktop.png`: Browser-Screenshot der neuen Übertragung.
- `docs/browser-artifacts/results-auth-retry.json`: erfolgreicher gezielter Offline-Browserbericht, ohne Request-Bodies/Keys.
- `docs/AUTH_RETRY_HANDOFF.md`: diese Übergabe.

## Validierung

- Typecheck erfolgreich.
- Lint ohne Fehler/Warnungen erfolgreich.
- Vollständige Jest-Suite: **242 Tests in 14 Suites bestanden**, einschließlich Minecraft-Whitelist, Avatare, Session und Discord.
- Produktionsbuild und fünf statische Auth-Einstiegsseiten erfolgreich.
- Gezielter Offline-Browsertest `npm.cmd run test:browser -- --auth-retry-only`: erfolgreich. Sechs Browserprüfungen bestätigen ein einziges Übertragungsfenster, CSS-Pakete ohne Fortschrittsbalken, Reduced Motion, exakten Registrierungsbody, Namenserhalt und erfolgreiche Session-/Accountanzeige. Alle API-Anfragen wurden lokal abgefangen; `productionWrites: 0`.
- `git diff --check` erfolgreich.

Zusätzlicher vollständiger Desktop-Browserlauf erreichte die Auth-/Kontakt-/Session-Prüfungen, scheiterte danach jedoch an „Taschenrechner mobile window and content fit“. Dieser Befund außerhalb der Auth-Änderung wurde nicht behoben; der vollständige Desktop-Browserlauf wird daher ausdrücklich nicht als bestanden ausgewiesen. Der erste Chromium-Lauf scheiterte zudem am Debugging-Start in der Sandbox; die gezielte Browserprüfung lief anschließend erfolgreich außerhalb der Sandbox. Bestehende Browserslist-/punycode-/Fake-Timer-Hinweise bleiben bestehen.

Die Recovery-Netzwerk-/Timeout-/Rate-Limit-/Statusübergänge wurden mit kontrollierten Antworten und Timern geprüft. Keine Live-Registrierung, SMTP-Zustellung, produktive Caddy-/Tunnel-Verbindung oder Migration getestet. Screenshot/Browserbericht ersetzen keine gemeinsame Staging-Abnahme.

## Offene Backend-/Caddy-Abhängigkeiten und gemeinsames Deployment

1. Backend-Commit und additive Migration `202610210001_auth_registration_recovery/migration.sql` geprüft bereitstellen. Migrationshistorie, Offline-Backup und Probe auf Kopie beachten; keine Resets/erzwungenen Migrationen. Prisma-Client erzeugen und gemeinsame persistente Receipt-Historie für alle Replikate sicherstellen.
2. Caddy gezielt für POST `/games/api/v1/auth-recovery/registrations`, GET `/games/api/v1/auth-recovery/registration` und OPTIONS auf beiden Pfaden freigeben. Tatsächliches Deployment-Präfix erhalten; kein SPA-Fallback und keine pauschale API-Freigabe.
3. `Idempotency-Key`, Content-Type und Origin durchreichen. CORS muss den geheimen Header erlauben und beide Retry-Header für den Browser exponieren. Auch der Status-GET benötigt Cross-Origin-Preflight. Bestehende Credentials-/Trusted-Origin-Regeln erhalten.
4. Keine positiven Auth-/Receipt-Caches, keine automatischen Proxy-POST-Replays und keine Schlüssel/Passwörter/Bodies in Proxy-, Tunnel-, Analytics- oder Browserdiagnoselogs. Keine neuen Secrets im Frontend.
5. In Staging echte Preflights, verzögerte/verlorene Antworten, Statusprüfung, 429, Neustart/PENDING, Ablauf, Verifikation/Resend, Login mit erwarteter Session, Logout und Discord gemeinsam abnehmen.
6. **Frontend erst nach verfügbarer und freigegebener neuer Backend-Route veröffentlichen.** Kein stiller automatischer Rückfall auf altes Signup, wenn die neue Route fehlt. Backend-/Frontend-/Infrastrukturfreigabe koordinieren; kein Push/Deployment ohne separate Freigabe.

Offene Receipts bei einem Rollback erhalten. Ungewisse Vorgänge nicht durch neue Keys oder automatisches altes Signup reparieren. Die konkrete Ursache früherer sporadischer Produktionsverbindungsfehler bleibt ungeklärt; diese Implementierung behauptet keine Diagnose von Caddy, Playit oder SMTP.
