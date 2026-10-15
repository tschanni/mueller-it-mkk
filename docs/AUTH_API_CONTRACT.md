# Auth API contract

Verbindlicher Integrationsvertrag für das separate React-Frontend. Stand: 15.10.2026.
Implementiert mit Better Auth **1.7.10**, Prisma **6.19.0**, SQLite und NestJS **11** auf Express **5**. Die Anwendung verwendet nun ESM (`type: module`, TypeScript NodeNext); Node **22.13.0** wurde lokal geprüft. Node-Bereich des Projekts: >=22.13 <25. Keine zusätzliche Datenbank und kein Identity Provider erforderlich.

## Basis und HTTP-Konventionen

Produktion: `https://api.mueller-it-mkk.de/games/api/v1/auth`.
Hierfür `BETTER_AUTH_URL=https://api.mueller-it-mkk.de` und `URL_PATH_PREFIX=/games` setzen. Better Auth erhält den vollständigen `basePath` separat. Pfade unten sind relativ zur Auth-Basis. Die alten `/auth/login` und `/auth/me` sowie Benutzer-Bearer-JWTs entfallen.

JSON-Anfragen: `Content-Type: application/json`, Browser immer `credentials: 'include'`. Für schreibende Anfragen mit Session muss `Origin` einer konfigurierten Trusted Origin entsprechen; Browser setzen diesen Header selbst. Kein eigener CSRF-Token: Better Auth übernimmt Origin-, Fetch-Metadata-, OAuth-State- und Redirect-Prüfungen. Diese Prüfungen sind auch im Testmodus ausdrücklich aktiviert. Keine Wildcard-Origins. Auth-Antworten dürfen nicht gecacht werden (`Cache-Control: no-store`). Die offiziellen Bibliotheks-Endpunkte werden über `toNodeHandler` vor dem Express-JSON-Parser eingebunden, außerhalb von Nest-Controllern und Swagger. Nest-DTOs verändern ihre Request-Bodys nicht.

## Tatsächlich freigegebene Endpunkte

| Methode | Pfad                       | JSON-Body / Query                                                                                                                                                                                           | Erfolg                                                                                                                                     |
| ------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| POST    | `/sign-up/email`           | `{ "name": "Alex", "username": "alex_1", "email": "alex@example.com", "password": "mindestens-12-Zeichen", "callbackURL": "https://www.mueller-it-mkk.de/auth/verified" }`                                  | 200 `{ "token": null, "user": User }`; Verifikationsmail, noch keine Session                                                               |
| POST    | `/sign-in/email`           | `{ "email": "alex@example.com", "password": "…", "rememberMe": true }`; optional `callbackURL`                                                                                                              | 200 `{ "redirect": false, "token": "…", "user": User }`; bei `callbackURL` zusätzlich `url`, `redirect: true`, Location-Header             |
| POST    | `/sign-in/social`          | `{ "provider": "discord", "callbackURL": "https://www.mueller-it-mkk.de/auth/callback", "errorCallbackURL": "https://www.mueller-it-mkk.de/auth/error" }`; optional `newUserCallbackURL`, `disableRedirect` | 200 `{ "url": "https://discord.com/…", "redirect": true }`; Location-Header, OAuth-State-Cookie                                            |
| POST    | `/sign-out`                | `{}` mit Session-Cookie                                                                                                                                                                                     | 200 `{ "success": true }`; Datenbank-Session gelöscht, Cookie gelöscht                                                                     |
| GET     | `/get-session`             | kein Body                                                                                                                                                                                                   | 200 `{ "session": Session, "user": User }` oder **200 `null`**                                                                             |
| POST    | `/request-password-reset`  | `{ "email": "alex@example.com", "redirectTo": "https://www.mueller-it-mkk.de/reset-password" }`                                                                                                             | 200 `{ "status": true, "message": "If this email exists in our system, check your email for the reset link" }`, auch für unbekannte E-Mail |
| GET     | `/reset-password/:token`   | `?callbackURL=<URL-kodierte Frontend-Resetseite>`; bereits im Mail-Link enthalten                                                                                                                           | 302 zur Frontend-Resetseite mit `?token=…` oder `?error=INVALID_TOKEN`                                                                     |
| POST    | `/reset-password`          | `{ "token": "…", "newPassword": "neues-langes-Passwort" }`                                                                                                                                                  | 200 `{ "status": true }`; einmaliger Token verbraucht, alle bisherigen Sessions widerrufen                                                 |
| POST    | `/send-verification-email` | `{ "email": "alex@example.com", "callbackURL": "https://www.mueller-it-mkk.de/auth/verified" }`                                                                                                             | 200 `{ "status": true }`                                                                                                                   |
| GET     | `/verify-email`            | `?token=…&callbackURL=…` aus Mail                                                                                                                                                                           | 302 zur erlaubten Callback-URL, bei Fehler ggf. `?error=…`; ohne Callback kann die Bibliothek JSON zurückgeben                             |
| GET     | `/callback/discord`        | Discord setzt `code` und `state`, ggf. `error`                                                                                                                                                              | 302 zum erlaubten Frontend-Callback oder Fehlerziel; bei Erfolg Session-Cookie                                                             |
| POST    | `/link-social`             | `{ "provider": "discord", "callbackURL": "https://www.mueller-it-mkk.de/settings/accounts" }` mit Session                                                                                                   | 200 `{ "url": "https://discord.com/…", "redirect": true }`                                                                                 |
| GET     | `/list-accounts`           | Session-Cookie                                                                                                                                                                                              | 200 Array mit `id`, `providerId`, `accountId`, `userId`, `createdAt`, `updatedAt`, `scopes: string[]`; keine Passwörter oder OAuth-Tokens  |
| POST    | `/unlink-account`          | `{ "accountId": "<id aus list-accounts>" }` mit frischer Session                                                                                                                                            | 200 `{ "status": true }`; letztes Anmeldekonto kann nicht entfernt werden                                                                  |
| POST    | `/update-user`             | z.B. `{ "name": "Alex", "username": "alex_2" }` mit Session                                                                                                                                                 | 200 `{ "status": true }`; `role` ist nicht beschreibbar, `email` über diesen Pfad ebenfalls nicht                                          |

Alle anderen Auth-Pfade und Methodenkombinationen werden serverseitig mit 404 abgewiesen. Insbesondere keine öffentlichen Provider-Token-APIs, kein Username-Login und keine eigenen JWT-Endpunkte. OPTIONS wird von CORS beantwortet.

`name` und `username` sind bei E-Mail-Registrierung erforderlich. Username: 3–30 Zeichen, gemäß offiziellem Username-Plugin Buchstaben/Ziffern/Unterstrich/Punkt; Normalisierung auf Kleinbuchstaben, eindeutig. Passwörter: 12–128 Zeichen, Hashing ausschließlich durch Better Auth (scrypt-Standard). `role` in Registrierungsdaten gewährt keine Rechte. Die Bibliothek kann zur Verhinderung von E-Mail-Enumeration bei wiederholter Registrierung eine synthetische Erfolgsmeldung liefern; Erfolg allein beweist deshalb kein neu angelegtes Konto. Das Frontend soll stets auf den Posteingang verweisen.

## User, Session und Rollen

Beispiel für GET `/get-session` (optionale Felder können null sein oder fehlen):

```json
{
  "user": {
    "id": "…",
    "name": "Alex",
    "email": "alex@example.com",
    "emailVerified": true,
    "image": null,
    "username": "alex_1",
    "displayUsername": "alex_1",
    "role": "USER",
    "createdAt": "2026-10-15T10:00:00.000Z",
    "updatedAt": "2026-10-15T10:00:00.000Z"
  },
  "session": {
    "id": "…",
    "token": "…",
    "userId": "…",
    "expiresAt": "2026-10-22T10:00:00.000Z",
    "createdAt": "2026-10-15T10:00:00.000Z",
    "updatedAt": "2026-10-15T10:00:00.000Z",
    "ipAddress": "…",
    "userAgent": "…"
  }
}
```

Better Auth liefert in seinen Standardantworten auch Session-Tokens. Sie sind sensible Zugangsdaten: nicht loggen, nicht in localStorage/sessionStorage speichern und nicht als eigene Bearer-Authentifizierung verwenden. Das Frontend verwendet ausschließlich die Browser-Cookies. Passwortfelder, bisherige `passwordHash`-Werte und Provider-Tokens werden nicht an das Frontend ausgegeben.

Neue Benutzer erhalten `USER`, auch über Discord. Discord-only-Benutzer können `username: null` haben; nach dem ersten Login über `/update-user` einen eindeutigen Namen wählen. Rollen sind `USER` und `ADMIN`. Rollenanzeigen im Frontend dienen ausschließlich der Darstellung. Globaler `SessionGuard` prüft die Datenbank-Session; `RolesGuard` prüft die aktuelle Datenbankrolle bei jedem Aufruf. Neue administrative Nest-Handler verwenden `@Roles(Role.ADMIN)` und dürfen kein `@Public()`/`@AgentRoute()` erhalten. Schreibende geschützte Nest-Endpunkte verlangen zusätzlich eine exakt erlaubte `Origin`. Agent-Schlüssel bleiben separat; öffentliche Gameserver-REST- und SSE-Routen bleiben ohne Anmeldung erreichbar.

## Cookies und Wiederherstellung

- Entwicklung: `better-auth.session_token`; Produktion: `__Secure-better-auth.session_token`.
- HttpOnly, Path `/`, SameSite=Lax; Produktion immer Secure. Keine Domain-Einstellung: Cookie bleibt **host-only auf api.mueller-it-mkk.de**. Browser senden es bei Fetch von `www.mueller-it-mkk.de` zur API mit `credentials: 'include'`, da beide HTTPS-Hosts same-site sind. JavaScript kann das Cookie nicht lesen. Keine Freigabe an alle Subdomains erforderlich.
- Standardsession 7 Tage, rollende Erneuerung frühestens nach 1 Tag; `rememberMe: false` erzeugt ein nicht dauerhaft gespeichertes Cookie und die kürzere Bibliotheks-Session. Keine separate Refresh-Token-API. Zusätzliche kurzlebige OAuth-State-Cookies verwaltet die Bibliothek.
- Beim App-Start und nach Reload GET `/get-session`; diesen Aufruf auch zur Cookie-Erneuerung nutzen. Der Nest-Guard allein transportiert keine neuen Cookies zum Client.
- Fehlende, abgelaufene, widerrufene oder ungültige Session: `/get-session` liefert 200 `null`, geschützte Nest-Routen 401. Dann lokalen Benutzerzustand löschen und Login anbieten. Rollenwechsel wirkt unmittelbar, da Cookie-Cache deaktiviert ist.
- Logout: POST `/sign-out` mit Credentials und anschließend Benutzerzustand/Query-Caches löschen; auf Erfolg warten. Auch das bisherige Cookie kann serverseitig nicht weiterverwendet werden. Bei Netzfehlern keinen erfolgreichen serverseitigen Logout behaupten.

## Discord-Ablauf und sichere Verknüpfung

1. POST `/sign-in/social` mit `provider: 'discord'` und absoluten erlaubten Callback-URLs, immer Credentials einschließen.
2. Aus der JSON-Antwort `window.location.assign(data.url)` ausführen. Die HTTP-Antwort ist 200 mit URL/Location; ein Fetch führt keine Top-Level-Navigation zum Provider aus.
3. Discord ruft **`https://api.mueller-it-mkk.de/games/api/v1/auth/callback/discord`** auf. Diese URL exakt im Discord Developer Portal registrieren. Client Secret nur im Backend.
4. Better Auth prüft State und Provideridentität, verarbeitet den Code und setzt das Session-Cookie. Anschließend 302 zur Frontendseite; dort `/get-session` laden.
5. OAuth-Fehler über `error` (ggf. `error_description`) im Fehler-Callback behandeln, Query nicht loggen oder als HTML rendern. Bei ungültigem State leitet die Bibliothek zur festen Fehlerseite `<erste CORS_ORIGIN>/auth/error` um; das Frontend muss diese Route bereitstellen. Das Frontend muss einen erneuten Login anbieten, wenn keine Session entstanden ist.

**Keine implizite Verknüpfung anhand gleicher E-Mail.** Bei bestehendem E-Mail-Konto zuerst dort anmelden, E-Mail bestätigen und dann `/link-social` aufrufen. Die lokale Session muss vorhanden und die E-Mail verifiziert sein. Better Auth verlangt beim Verknüpfen eine passende, verifizierte Provider-E-Mail; unterschiedliche E-Mails sind nicht erlaubt. Das letzte verbleibende Anmeldekonto darf nicht entkoppelt werden. `/unlink-account` benötigt eine frische Session (Bibliotheksstandard: 1 Tag); ggf. erneut anmelden. Provider-Tokens werden in SQLite mit Better Auth verschlüsselt. Discord-Konten ohne E-Mail können nicht registriert werden; es wird keine künstliche Provider-E-Mail erzeugt.

## Fehlervertrag

Better-Auth-Fehler normalerweise `{ "code": "…", "message": "…" }`; HTTP-Status prüfen, `code` für UI-Übersetzungen nutzen. Bibliotheksvalidierungsfehler können zusätzliche Details enthalten; unbekannte Codes mit generischem Fehlertext behandeln. Keine internen Fehlermeldungen, Request-Bodys oder vollständigen Callback-URLs protokollieren.

| HTTP | Code                                                            | Englischer Bibliothekstext / Bedeutung                                                 |
| ---- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 400  | `USERNAME_REQUIRED`                                             | `Username is required`                                                                 |
| 400  | `INVALID_USERNAME` / `USERNAME_TOO_SHORT` / `USERNAME_TOO_LONG` | `Username is invalid` / `Username is too short` / `Username is too long`               |
| 400  | `USERNAME_IS_ALREADY_TAKEN`                                     | `Username is already taken. Please try another.`                                       |
| 400  | `PASSWORD_TOO_SHORT` / `PASSWORD_TOO_LONG`                      | `Password too short` / `Password too long`                                             |
| 400  | `INVALID_TOKEN` / `TOKEN_EXPIRED`                               | `Invalid token` / `Token expired`; Reset/Verifizierung erneut anfordern                |
| 400  | `FIELD_NOT_ALLOWED`                                             | `Field not allowed to be set`, etwa Rollenänderung                                     |
| 400  | `FAILED_TO_UNLINK_LAST_ACCOUNT`                                 | `You can't unlink your last account`                                                   |
| 401  | `INVALID_EMAIL_OR_PASSWORD`                                     | `Invalid email or password`                                                            |
| 401  | `SESSION_EXPIRED` / `SESSION_NOT_FRESH`                         | Session fehlt/abgelaufen bzw. erneute Anmeldung erforderlich                           |
| 403  | `EMAIL_NOT_VERIFIED`                                            | `Email not verified`                                                                   |
| 403  | `INVALID_ORIGIN` / `MISSING_OR_NULL_ORIGIN`                     | `Invalid origin` / `Missing or null Origin`                                            |
| 403  | `INVALID_CALLBACK_URL` / `INVALID_REDIRECT_URL`                 | `Invalid callbackURL` / `Invalid redirectURL`                                          |
| 404  | `PROVIDER_NOT_FOUND`                                            | `Provider not found`, Discord nicht konfiguriert                                       |
| 422  | `FAILED_TO_CREATE_USER`                                         | `Failed to create user`                                                                |
| 429  | ggf. kein `code`                                                | Rate-Limit; `X-Retry-After` (Sekunden) respektieren, keine automatische Login-Schleife |
| 400  | `INVALID_JSON`                                                  | `Invalid JSON` (HTTP-Adapter)                                                          |
| 413  | `PAYLOAD_TOO_LARGE`                                             | `Request body too large` (HTTP-Adapter)                                                |
| 500  | `AUTH_FAILED`                                                   | `Authentication request failed` (unbekannte interne Fehler einschließlich Mailversand) |

OAuth- und Mail-Link-Endpunkte melden Fehler teilweise als 302 mit Query-Parameter statt JSON. Andere Nest-Endpunkte behalten `{ "statusCode": 401, "message": "Invalid or expired session" }` bzw. 403 `Insufficient permissions` oder `Trusted Origin required`. `/get-session` ohne gültige Session ist **kein 401-Fehler**.

Rate-Limits werden durch Better Auth in SQLite gespeichert: je IP und Pfad 5/Minute für Registrierung, E-Mail-Login und Social-Login, 3/Minute für Reset-Anforderung und Verifikationsmail; sonst 60/Minute, zusätzliche Bibliotheks-Spezialregeln bleiben aktiv. Nest-Throttling schützt weiter die normalen Controller. Ein interner IP-Header wird aus Express `req.ip` überschrieben; untrusted Clientwerte werden verworfen. Caddy/Playit müssen eine vertrauenswürdige Client-IP-Kette bereitstellen, sonst teilen sich Clients möglicherweise ein Limit.

## Frontend-Konfiguration und Entwicklung

Minimal ohne zusätzliche Client-Bibliothek:

```ts
const authBase = 'https://api.mueller-it-mkk.de/games/api/v1/auth';
const response = await fetch(`${authBase}/get-session`, {
  credentials: 'include',
  cache: 'no-store',
});
const current = await response.json(); // { session, user } | null
```

Optional offizieller `better-auth/react`-Client **1.7.10** mit `baseURL: 'https://api.mueller-it-mkk.de'`, `basePath: '/games/api/v1/auth'`, `fetchOptions: { credentials: 'include' }` und `usernameClient()` aus `better-auth/client/plugins`. Der zusätzliche Rollenwert muss im Frontendtyp als `'USER' | 'ADMIN'` ergänzt werden; keine Backend-Quelldateien ins separate Frontend importieren. Die oben dokumentierten HTTP-Bodys bleiben maßgeblich. Auch E-Mail-Registrierung braucht `name` zusätzlich zu `username`.

Lokaler Vorschlag, passend zur bisherigen Frontendadresse:

```dotenv
NODE_ENV=development
PORT=3001
URL_PATH_PREFIX=
BETTER_AUTH_URL=http://localhost:3001
CORS_ORIGINS=http://localhost:3000
# BETTER_AUTH_SECRET und DATABASE_URL aus .env.example konfigurieren
```

Frontend `http://localhost:3000`, lokale Auth-Basis `http://localhost:3001/api/v1/auth`, Discord-Callback **`http://localhost:3001/api/v1/auth/callback/discord`**. Backend und Frontend können auf demselben Rechner nicht beide Port 3000 verwenden. Der lokale Beispielwert wurde deshalb auf 3001 geändert; der produktive interne Port bleibt 3000. Konfigurationsstandard ohne PORT bleibt zur Kompatibilität 3000. Bei lokalem `/games`-Prefix auch die lokale Callback-URL entsprechend ergänzen. Vite auf 5173 nur nach expliziter Änderung von `CORS_ORIGINS` verwenden. Nicht `localhost` und `127.0.0.1` mischen. Lokales HTTP und die entfernte HTTPS-API sind cross-site; hierfür SameSite nicht abschwächen, sondern ein lokales Backend oder passende HTTPS-Entwicklungsdomains verwenden.

Für Registrierung/Reset ist auch lokal ein SMTP-Testpostfach nötig, z.B. ein bereits vorhandener lokaler SMTP-Dienst; das Projekt startet keinen zusätzlichen Container. Ohne SMTP sind diese Flows nicht nutzbar. Fehlgeschlagener Mailversand kann ein bereits angelegtes unbestätigtes Konto hinterlassen; nach Behebung `/send-verification-email` verwenden. Tests ersetzen nur den Mailtransport und prüfen die echten generierten Mail-Links.

## Konfiguration und Infrastruktur

| Variable                                     | Verwendung                                                                                                                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                         | Generierter Zufallswert mit mindestens 32 Zeichen, keine Platzhalter; stabil und geschützt aufbewahren; auch Schlüssel für Provider-Tokenverschlüsselung                                                |
| `BETTER_AUTH_URL`                            | Exakte API-Origin ohne Slash/Pfad; Produktion `https://api.mueller-it-mkk.de`                                                                                                                           |
| `URL_PATH_PREFIX`                            | Produktion `/games`, lokal optional leer; Proxy erhält diesen Pfad unverändert                                                                                                                          |
| `DATABASE_URL`                               | SQLite `file:…`, bestehende Datenbank beibehalten; relativer Pfad wird von Prisma relativ zum Schema aufgelöst                                                                                          |
| `CORS_ORIGINS`                               | Kommagetrennte exakte Frontend-Origins, zugleich Trusted Origins; erste Origin bestimmt die feste OAuth-Fehlerseite `/auth/error`; Produktion `https://www.mueller-it-mkk.de`, weitere nur ausdrücklich |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Beide setzen oder beide leer lassen; leer deaktiviert Discord; Secret niemals ins Frontend                                                                                                              |
| `SMTP_HOST`, `SMTP_PORT`                     | Mailserver, Port standardmäßig 587                                                                                                                                                                      |
| `SMTP_SECURE`                                | `false` für STARTTLS/587, `true` für implizites TLS/465; Produktion verlangt TLS                                                                                                                        |
| `SMTP_USER`, `SMTP_PASSWORD`                 | Beide setzen oder bei autorisiertem Relay beide leer lassen                                                                                                                                             |
| `SMTP_FROM`                                  | Autorisierte Absenderadresse, z.B. `Gameserver Dashboard <noreply@mueller-it-mkk.de>`                                                                                                                   |
| `NODE_ENV`, `PORT`                           | Produktion `production`, interner Port 3000                                                                                                                                                             |
| `TRUST_PROXY_HOPS`                           | Nur tatsächliche vertrauenswürdige HTTP-Hops zählen; bei direkt vorgeschaltetem Caddy in der Regel 1; Playit-Headerführung vor Ort prüfen                                                               |

Produktion startet nicht ohne HTTPS-Auth-Origin, HTTPS-Frontend-Origins, gültiges Secret und SMTP_HOST/SMTP_FROM. Discord bleibt optional; für das beauftragte vollständige Produkt muss der Betreiber es konfigurieren. Keine Zugangsdaten werden mitgeliefert. `.env` ist ignoriert. DB/Backups enthalten sensible Sitzungsdaten und benötigen die bestehenden Dateirechte.

Offen vor einer freigegebenen Inbetriebnahme: SMTP-Zugang und tatsächliche Zustellung/SPF/DKIM/DMARC, Discord-App mit beiden passenden Redirect-URIs, produktive Umgebungsvariablen, verifizierte Proxy-IP-Kette, Allowlist-Erweiterung, Offline-Backup und Prüfung auf einer Kopie der echten SQLite-Datenbank. Kein Deployment wurde durchgeführt.

## Caddy-Allowlist: ausschließlich als manueller Änderungsvorschlag

Im Repository gibt es **keine ausführbare produktive Caddyfile**. README beschreibt ein generisches nginx-Beispiel; die Grafik `Game-Dashboard-API_ Caddy und Playit.gg.png` dokumentiert Playit → Caddy in LXC 104 → NestJS `192.168.178.94:3000` in LXC 103, mit gesperrtem Swagger. Eine exakte bestehende Caddy-Regel lässt sich daraus nicht rekonstruieren. Die folgenden Matcher zeigen die exakt benötigten zusätzlichen Pfade und Methoden; sie müssen nach ausdrücklicher Freigabe in die vorhandene Allowlist integriert werden, ohne öffentliche REST-/SSE-Matcher zu ersetzen.

```caddyfile
@authGet {
    method GET
    path /games/api/v1/auth/get-session /games/api/v1/auth/verify-email /games/api/v1/auth/callback/discord /games/api/v1/auth/list-accounts /games/api/v1/auth/reset-password/*
}
handle @authGet {
    reverse_proxy 192.168.178.94:3000
}
@authPost {
    method POST
    path /games/api/v1/auth/sign-up/email /games/api/v1/auth/sign-in/email /games/api/v1/auth/sign-in/social /games/api/v1/auth/sign-out /games/api/v1/auth/request-password-reset /games/api/v1/auth/reset-password /games/api/v1/auth/send-verification-email /games/api/v1/auth/link-social /games/api/v1/auth/unlink-account /games/api/v1/auth/update-user
}
handle @authPost {
    request_body {
        max_size 32KB
    }
    reverse_proxy 192.168.178.94:3000
}
@authOptions {
    method OPTIONS
    path /games/api/v1/auth/sign-up/email /games/api/v1/auth/sign-in/email /games/api/v1/auth/sign-in/social /games/api/v1/auth/sign-out /games/api/v1/auth/request-password-reset /games/api/v1/auth/reset-password /games/api/v1/auth/send-verification-email /games/api/v1/auth/link-social /games/api/v1/auth/unlink-account /games/api/v1/auth/update-user /games/api/v1/auth/get-session /games/api/v1/auth/list-accounts
}
handle @authOptions {
    reverse_proxy 192.168.178.94:3000
}
```

Matcher vor dem vorhandenen Default-Deny verwenden; `handle`, kein `handle_path`, damit `/games` erhalten bleibt. Querystrings von Verifikation/Reset/OAuth unverändert durchreichen. `Set-Cookie`, `Origin` und `Cookie` nicht entfernen, keine Auth-Caches, keine Access-Logs vollständiger Auth-URLs oder Cookie-/Authorization-Header. Body-Limit auch für chunked Requests am Proxy aktivieren. Keine pauschale `/games/api/v1/*`-Freigabe: Agent-, Health-, Swagger- und neue Admin-Pfade behalten ihre bisherigen Zugriffsregeln. Die bestehenden SSE-Einstellungen bleiben erhalten. Caddy-Konfiguration und Zertifikate wurden nicht verändert.

## Migration und Administratoren

Die neue Migration verändert keine Gameserver-, Snapshot-, Event-, Agent-, Metric- oder Player-Tabelle. `User` wird innerhalb der vom Runner verwendeten Transaktion erweitert/neu aufgebaut; IDs, vorhandene Hashes und ADMIN bleiben erhalten. Die frühere Rolle MODERATOR wird zu USER, da der neue Vertrag nur USER/ADMIN vorsieht. Legacy-Konten erhalten eine eindeutige nicht zustellbare `legacy-<hex(id)>@users.invalid`-Adresse, unbestätigt. Alte JWTs und alte Passwort-Logins werden nicht mehr akzeptiert. Vor Deployment deshalb eine mögliche Anmeldeunterbrechung einplanen.

Bestehende Identitäten kontrolliert übernehmen: Betreiber prüft Eigentum, ordnet offline über eine geprüfte Prisma-Operation eine echte eindeutige E-Mail zu (`emailVerified` bleibt zunächst false), lässt die Person `/send-verification-email` und den Mail-Link benutzen und anschließend `/request-password-reset` ausführen. Better Auth legt dabei das Credential-Konto an und erzeugt seinen eigenen Hash. Keine automatische Hash-Konvertierung, kein Teilen/Übertragen der bisherigen Klartextpasswörter. Der alte Hash bleibt nur zur verlustfreien Migration gespeichert und wird nicht zur Anmeldung benutzt; nach bestätigter Übernahme kann der Betreiber ihn gezielt auf null setzen. Ohne vorhandene ADMIN-Rolle zunächst regulär registrieren und E-Mail bestätigen, dann lokal `npm run admin:bootstrap -- <username>` bzw. `node dist/cli.js admin <username>` ausführen. Dieser Befehl befördert nur einen bereits verifizierten Benutzer und verweigert sich, wenn ein ADMIN vorhanden ist. Öffentliche Rollenvergabe ist ausgeschlossen.

Vor jeder Migration Offline-Backup erstellen und auf Kopie prüfen. Lokal `npm run db:generate`, `npm run db:migrate` (Prisma deploy); bestehender Container-Runner `node scripts/migrate.cjs` unterstützt diese einfache transaktionale Migration und überprüft Checksummen. Die Initialmigration wurde nicht verändert. Migrationstest prüft vorhandene Benutzer/Historie, wiederholten Runner-Start, Prisma migrate deploy, Schema-Diff und Fremdschlüssel. Weitere HTTP-Tests prüfen Registrierung, Verifikation, Login, Cookie-Wiederherstellung, Rollen, Ablauf, Logout, Reset, Origin/Redirect-Abweisung, Limits, Discord-State und Produktions-Cookieattribute sowie die bestehenden REST-/SSE-Funktionen. Ein echter Discord-Callback und SMTP-Zustellung erfordern die Infrastruktur und sind lokal nicht als Live-Test ausgeführt.

## Offizielle Referenzen

- [Express-Integration und ESM](https://better-auth.com/docs/integrations/express)
- [Prisma-Adapter, einschließlich Prisma 6](https://better-auth.com/docs/adapters/prisma)
- [E-Mail und Passwort](https://better-auth.com/docs/authentication/email-password)
- [Discord](https://better-auth.com/docs/authentication/discord)
- [Username-Plugin](https://better-auth.com/docs/plugins/username)
- [Caddy-Body-Limit](https://caddyserver.com/docs/caddyfile/directives/request_body)
- [Konten und Verknüpfung](https://better-auth.com/docs/concepts/users-accounts)

Die installierten Bibliothekstypen und Endpunktdefinitionen für Version 1.7.10 wurden zusätzlich direkt geprüft; spätere Versionsupdates müssen diesen Vertrag und die Tests mit aktualisieren.
