# Windows-98-Anmeldung

> Aktualisierung 16.10.2026: Der folgende Text beschreibt den bisherigen Stand.
> Für den aktuellen Umbau gelten [CENTRAL-USER-MODEL.md](CENTRAL-USER-MODEL.md)
> und [BROWSER-ACCEPTANCE.md](BROWSER-ACCEPTANCE.md). Die Registrierung ist bis zum
> aktualisierten Backend-Vertrag samt Commit-ID gesperrt; die frühere
> Benutzername-Bearbeitung wurde entfernt.

## Stand und Grundlage

Die Frontend-Anbindung ist gemäß dem bereitgestellten
[AUTH_API_CONTRACT.md](AUTH_API_CONTRACT.md) vom 15.10.2026 implementiert.
Vertragsversion: Better Auth 1.7.10, NestJS 11, Prisma 6.19.0.
Die bereitgestellte Vertragsdatei ist unverändert übernommen; Backend-Code und
produktive Konfiguration wurden nicht verändert. Kein Deployment wurde ausgeführt.

Der produktive Standard ist
`https://api.mueller-it-mkk.de/games/api/v1/auth`. Unter `npm start` auf localhost
wird standardmäßig `http://localhost:3001/api/v1/auth` verwendet. Abweichende
Auth-Basis über `REACT_APP_AUTH_API_BASE_URL` in `.env.local` konfigurieren und
neu starten/bauen. `.env.example` enthält Beispiele ohne Secrets. HTTP wird nur
in der Entwicklung für Loopback-Adressen akzeptiert; Produktions-URLs müssen
HTTPS verwenden. Ein ungültiger Konfigurationswert deaktiviert die Anmeldung,
während der öffentliche Desktop weiter funktioniert.

Der Adapter verwendet die im Vertrag ausdrücklich unterstützte Fetch-Variante.
Dadurch benötigt die bestehende CRA-/TypeScript-4.9-Konfiguration weder eine neue
Runtime-Abhängigkeit noch eine Umstellung ihrer Modulauflösung. Better Auth 1.7.10
wurde mit Abhängigkeiten in einem isolierten temporären Prüfprojekt installiert.
Ein Compiler-Test mit dem vorhandenen TypeScript 4.9.5, `createAuthClient` aus
`better-auth/react` und `usernameClient()` scheitert selbst mit `skipLibCheck` an
Syntaxfehlern: unter anderem TS1139 bei `const`-Typparametern in
`@better-auth/core/dist/utils/error-codes.d.mts`,
`better-auth/dist/plugins/access/access.d.mts` und Zod-4-Deklarationen.
Die erste Modulauflösungsprobe war unvollständig; entscheidend ist der vollständige
Compiler-Test. Das SDK ist damit in dieser Toolchain nicht direkt verwendbar.
Projektabhängigkeiten und Compiler bleiben unverändert. OAuth, Passwort-Hashing,
Cookies und Sessions übernimmt weiterhin ausschließlich Better Auth im Backend.

## Vorhandene Architektur

React 19, TypeScript 4.9, Create React App und 98.css. Die Fenster nutzen
`WindowManagerContext`, `WinWindow`, `WindowArea` und die vorhandene Taskleiste.
Es gibt keinen zusätzlichen Router und kein zweites UI-System. Das Startmenü
unterstützt Maus, Tastatur, Escape und Fokusbehandlung.

Öffentliche Gameserver-Anfragen behalten `credentials: omit`; die öffentliche
SSE-Verbindung bleibt unabhängig vom Auth-State. Auch bei einer nicht erreichbaren
Auth-API sind Desktop und Gameserver-Manager nutzbar.

## Implementierte Abläufe

Das Desktop-Symbol „Anmelden“ öffnet die Mueller IT MKK Welt Anmeldung mit einem Klick,
unabhängig von der Erreichbarkeit des Backends. Nach erfolgreicher Anmeldung heißt
es „Mein Konto“ und öffnet das Kontofenster. Der Zugang über das Startmenü bleibt
ebenfalls verfügbar. Änderungen sind erst nach lokalem Neuladen beziehungsweise
einem separat freigegebenen Frontend-Deployment auf der Website sichtbar.

Das Startmenü enthält keinen „Windows 98“-Schriftzug. Anmelden, Registrieren,
Mein Konto und Abmelden verwenden klassische Icons.

- **Mueller IT MKK Welt Anmeldung:** E-Mail/Passwort mit `rememberMe: true`; anschließend
  separate Prüfung der Cookie-Session. Anmeldung allein erzeugt keinen lokalen
  Benutzerzustand aus dem Login-Response.
- **Registrierung:** Name und Benutzername werden separat erfasst und als
  `name` und `username` übertragen; `username` wird kleingeschrieben.
  Validierung: Name erforderlich, Benutzername 3–30 Buchstaben/Ziffern/Unterstriche/Punkte,
  Passwort 12–128 Zeichen und Bestätigung. Die Rückmeldung verweist immer auf
  den Posteingang und behauptet keine neue Kontoanlage: Better Auth kann zur
  Verhinderung von Enumeration auch synthetische Erfolge liefern.
- **Verifikationsmail:** erneute Anforderung aus dem Anmeldefenster. Die Rückkehr
  nach `/auth/verified` öffnet eine neutrale Erfolgsmeldung und die Anmeldung;
  dokumentierte Linkfehler führen zu einer Meldung und einer erneuten Anforderung.
- **Discord:** POST `/sign-in/social`, danach geprüfte Top-Level-Weiterleitung
  ausschließlich zu `https://discord.com`. Erfolg kommt nach `/auth/callback`,
  Fehler nach `/auth/error`. Nach der Rückkehr wird die Cookie-Session geprüft.
  Ohne entstandene Session wird die Anmeldung erneut angeboten. Keine automatische
  Verknüpfung vorhandener E-Mail-Konten durch das Frontend.
- **Passwort vergessen:** neutrale Bestätigung der Reset-Anforderung.
  `/reset-password?token=…` öffnet das Fenster für ein neues Passwort.
  Token und Query werden nach Übernahme aus der Adresszeile entfernt. Der Token
  bleibt nur im Arbeitsspeicher, geht ausschließlich im Reset-POST an die API und
  wird nach Erfolg verworfen. Ungültige/abgelaufene Links führen zur Anmeldung.
  Nach erfolgreichem Reset wird der lokale Benutzerzustand gelöscht, da das Backend
  sämtliche bisherigen Sessions widerruft.
- **Mein Konto:** Name, E-Mail, Verifizierungsstatus, Benutzername und Rolle.
  Alle Benutzer können ihren Benutzernamen über `/update-user` ändern;
  Discord-Benutzer ohne `username` erhalten zusätzlich einen Hinweis.
  Kein Bearbeiten von Rollen oder E-Mail über diesen Aufruf.
- **Profilbild:** HTTPS-Bildadresse unter „Mein Konto“ speichern. Der vorhandene
  `/update-user`-Aufruf sendet ausschließlich `{ image: "https://…" }`; anschließend
  wird die bestätigte Session neu geladen. Das Bild erscheint im Kontofenster und
  im Startmenü, mit einem Standardsymbol für fehlende/fehlerhafte Bilder.
  Andere Protokolle und eingebettete Zugangsdaten werden abgelehnt; Bildanfragen
  senden keinen Referer. Diese Erweiterung verwendet das offizielle Better-Auth-
  Standardfeld `image`, das auch im Session-Beispiel des Vertrags enthalten ist.
  Eine etwaige zusätzliche Backend-Feldfilterung muss `image` zulassen; die reale
  Persistenz ist im Browser-Integrationstest zu prüfen. Ein Datei-Upload-Endpunkt
  oder eigener Bildspeicher ist im Backend-Vertrag nicht definiert und wird nicht
  vorausgesetzt. Referenz: [Better Auth: Benutzerinformationen ändern](https://better-auth.com/docs/concepts/users-accounts#update-user-information).
- **Verknüpfte Konten:** `/list-accounts` lädt die Anmeldekonten ausschließlich
  bei geöffnetem Kontofenster. Nach Bestätigung der lokalen E-Mail kann Discord
  explizit über `/link-social` verknüpft werden; Rückkehr nach `/settings/accounts`.
  Ein bestehendes Discord-Konto kann nach Bestätigung über `/unlink-account`
  entfernt werden, sofern ein weiteres Anmeldekonto vorhanden ist. Übermittelt
  wird die Zeilen-ID aus der Kontenliste, kein Provider-Token. Das Backend prüft
  zusätzlich E-Mail-Zuordnung und frische Session. Verlangt es eine neue Anmeldung,
  öffnet sich das Anmeldefenster; Entfernung oder Logout werden nicht vorgetäuscht.
  Kontenlisten werden bei Logout/Sessionverlust verworfen und nach erfolgreicher
  Entfernung neu geladen. Fehler sind mit einer erneuten Ladeaktion behandelbar.
- **Abmelden:** erst nach erfolgreichem POST `/sign-out` wird der Benutzerzustand
  gelöscht. Bei Netzfehlern wird keine erfolgreiche Abmeldung behauptet.

Es gibt keine automatische Kontenverknüpfung anhand gleicher E-Mail-Adressen.

## Session und Fehlerbehandlung

Der Auth-Adapter sendet `credentials: include`, `cache: no-store` und für POST
JSON mit `Content-Type: application/json`. Er setzt weder Bearer-Header noch
eigene CSRF-Tokens oder einen künstlichen Origin-Header. Better Auth prüft Origin,
Fetch-Metadata und OAuth-State gemäß Backend-Vertrag.

`/get-session` liefert 200 mit Session oder 200 `null`. Benutzer, Rolle und
Ablaufzeit werden auf ein minimales Frontend-Modell abgebildet. Token, IP-Adresse,
User-Agent und andere Session-Interna gelangen nicht in den React-Kontext oder
Speicher. Unbekannte Rollen erhalten für die Oberfläche USER; keine automatische
ADMIN-Vergabe. Die eigentliche Berechtigungsprüfung erfolgt im Backend.

Session-Prüfung beim Start, beim Fensterfokus, bei erneut sichtbarer Seite und alle
60 Sekunden während die Seite sichtbar ist. Diese Aufrufe erlauben die rollende
Cookie-Erneuerung durch Better Auth. Die bekannte Ablaufzeit entfernt den lokalen
Benutzerzustand und zeigt eine Windows-98-Meldung. Fehlgeschlagene Prüfungen
entfernen zuvor bestätigte Benutzerdaten. Späte Antworten nach Logout oder einer
neueren Auth-Aktion werden verworfen. Parallele Formularaktionen sind gesperrt,
Anfragen haben begrenzte Wartezeiten und werden bei Unmount abgebrochen.

Fehlermeldungen verwenden ausschließlich bekannte Codes und feste deutsche Texte.
Unbekannte Backend-Texte, OAuth-Beschreibungen oder Callback-URLs werden weder
angezeigt noch protokolliert. Bei 429 werden `X-Retry-After` sowie alternativ
der Standardheader `Retry-After` (Sekunden oder HTTP-Datum) berücksichtigt und der
jeweilige Request lokal bis zum Ablauf gesperrt; ohne lesbaren Header gelten
60 Sekunden. Keine automatischen Login-Wiederholungen.

## Direkte Callback-Seiten auf GitHub Pages

`npm run build` führt `scripts/build-auth-pages.cjs` als `postbuild` aus und
erzeugt Desktop-Einstiegspunkte für:

- `/auth/callback` und `/auth/error`
- `/auth/verified`
- `/reset-password`
- `/settings/accounts`

Die Kopien verwenden einen Basis-Pfad für die gebauten Assets und benötigen keine
generische SPA-404-Weiterleitung. Callback-Pfade mit und ohne abschließenden Slash
werden erkannt. Nach dem Erfassen der Rückkehrdaten setzt React die Adresse auf
`/` zurück. Ein globales `Referrer-Policy`-Meta-Tag `no-referrer` verhindert, dass
Mail-Link-Queries über nachgeladene Ressourcen als Referer weitergereicht werden.
Die produktive Konfiguration ist auf die im Vertrag genannte Root-Domain ausgelegt.
Der vorhandene Pages-Workflow nutzt bereits `npm run build` und übernimmt somit
auch diese Dateien; keine Änderung oder Ausführung eines Deployments nötig.

## Infrastruktur vor Inbetriebnahme

Frontend-Code ersetzt keine Backend-/Proxy-Konfiguration. Der Betreiber muss
gemäß Vertrag vor einem freigegebenen Deployment prüfen:

1. Backend-Version, Migration und Offline-Backup auf einer Kopie der SQLite-DB.
2. Caddy-Allowlist für die dokumentierten Auth-Methoden und OPTIONS; `/games`
   erhalten, `Cookie`, `Set-Cookie` und `Origin` durchreichen, keine Auth-Caches.
3. Exakte CORS-/Trusted-Origins, primär `https://www.mueller-it-mkk.de`, Credentials
   und keine Wildcards. Für browserlesbares `X-Retry-After` muss CORS diesen Header
   exponieren; sonst greift im Frontend der konservative 60-Sekunden-Fallback.
4. Hostgebundene HttpOnly-/Secure-/SameSite=Lax-Cookies auf der API-Domain.
   HTTPS-Frontend und HTTPS-API sind same-site; HTTP-localhost gegen die produktive
   API ist es nicht. Für lokale Tests beide Dienste mit localhost verwenden.
5. SMTP und Zustellung der Bestätigungs-/Reset-Mails. Discord-App und exakte
   Backend-Callback-URL, Client-ID und Secret ausschließlich serverseitig.
6. UI-Rollen ersetzen keine serverseitigen 401-/403-Prüfungen.
7. Keine vollständigen Auth-/Reset-/Verifikations-URLs oder Cookies in Proxy-Logs.

## Prüfung

Jest/Testing Library prüft Request-Pfade und Bodies gegen den Vertrag,
Cookie-Fetchoptionen, Token-Redaktion, sichere Fehlercodes, Rate-Limit-Sperre,
Registrierung, Verifikation, Anmeldung, Logout, Discord, Mail-Rückkehr,
Passwort-Reset, getrennte Namensfelder, Benutzernamenänderung, Kontenverknüpfung,
Entfernung einschließlich Bestätigung/letztem Konto/frischer Session,
Session-Wiederherstellung/Ablauf und Rennen mit
verspäteten Antworten. Die vorhandenen Minecraft-/Terraria- und SSE-Tests laufen
weiterhin. TypeScript, ESLint und Produktionsbuild werden ebenfalls geprüft.

Diese Tests verwenden kontrollierte HTTP-Antworten und Test-Adapter, keinen
Produktiv-Mock. Reale Cookie-/CORS-Prüfung in Browsern, SMTP-Zustellung und der echte
Discord-Callback benötigen die konfigurierte Test-/Produktivumgebung. Keine echten
Konten werden für Tests angelegt und keine Produktionsanmeldung ausgelöst.

Lesende Produktionsprüfung am 15.10.2026, ohne Cookies/Zugangsdaten:

| Prüfung | Ergebnis |
| --- | --- |
| GET `/games/api/v1/auth/get-session`, Origin `https://www.mueller-it-mkk.de` | 404, keine CORS-Header |
| GET derselben Route, Origin `http://localhost:3000` | 404, keine CORS-Header |
| OPTIONS `/games/api/v1/auth/sign-in/email`, produktive Origin, POST/JSON-Preflight | 404, keine CORS-Header |
| GET `/games/api/v1/public/servers`, produktive Origin | 200, passende `Access-Control-Allow-Origin` |

Die neuen Auth-Routen sind am öffentlichen Produktionszugang somit noch nicht
nutzbar. Ob Backend-Stand oder Proxy-Allowlist die Ursache sind, lässt sich durch
diese Antworten nicht unterscheiden. Freigabe/Deployment und anschließende
Browserprüfung bleiben Betreiberaufgaben; die öffentliche API funktioniert weiter.
