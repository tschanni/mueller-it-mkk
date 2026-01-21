# 🚀 Quick Start Guide - Mueller IT Backend

## ⚡ Schnellstart (Lokal testen)

### 1. MongoDB installieren

**Windows:**
```powershell
# Über Chocolatey
choco install mongodb

# Oder Download von:
# https://www.mongodb.com/try/download/community
```

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community
```

**Linux (Ubuntu):**
```bash
sudo apt-get install -y mongodb
```

### 2. MongoDB starten

```bash
# Windows
net start MongoDB

# macOS/Linux
sudo systemctl start mongodb
# oder
mongod
```

### 3. Backend Dependencies installieren

```bash
cd backend
npm install
```

### 4. Environment konfigurieren

```bash
# .env erstellen (bereits vorhanden, Secrets anpassen!)
# Ändere JWT_SECRET und JWT_REFRESH_SECRET zu sicheren Werten!
```

**Wichtig:** Generiere sichere Secrets:
```bash
# In PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### 5. Backend starten

```bash
# Development Mode (mit Auto-Reload)
npm run start:dev

# Production Build
npm run build
npm run start:prod
```

### 6. API Testen

**Swagger Docs öffnen:**
```
http://localhost:3000/api
```

**Erster Test - User registrieren:**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@mueller-it.de",
    "password": "SecurePass123!",
    "firmenname": "Mueller IT"
  }'
```

**Response:**
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG...",
  "role": "user",
  "username": "admin"
}
```

### 7. User zu Admin machen

```bash
# MongoDB Shell öffnen
mongosh

# Datenbank wählen
use mueller-it-backend

# User zu Admin machen
db.users.updateOne(
  { username: "admin" },
  { $set: { role: "admin" } }
)
```

### 8. Mit JWT authentifizieren

In Swagger:
1. Klicke auf **"Authorize"** Button (oben rechts)
2. Gib ein: `Bearer <dein-accessToken>`
3. Teste geschützte Endpoints

---

## 📋 Wichtige API Endpoints

### Public (ohne Auth)

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| POST | `/auth/register` | Neuen User registrieren |
| POST | `/auth/login` | User anmelden |
| POST | `/auth/refresh` | Access Token erneuern |

### Authenticated (mit JWT)

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| POST | `/auth/logout` | User abmelden |
| POST | `/tickets` | Neues Ticket erstellen |
| GET | `/tickets` | Eigene Tickets anzeigen |
| GET | `/tickets/:id` | Ticket-Details |
| POST | `/tickets/:id/messages` | Nachricht senden |
| PATCH | `/tickets/:id/status` | Status ändern |

### Admin Only

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/admin/tickets` | Alle Tickets anzeigen |
| GET | `/admin/tickets/:id` | Ticket-Details |
| POST | `/admin/tickets/:id/messages` | Admin-Antwort |
| PATCH | `/admin/tickets/:id/status` | Status ändern |

---

## 🔧 Troubleshooting

### MongoDB Connection Error

```
MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017
```

**Lösung:**
```bash
# Prüfe ob MongoDB läuft
# Windows:
net start MongoDB

# Linux/Mac:
sudo systemctl status mongodb
```

### Port 3000 bereits belegt

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Lösung:** Ändere `PORT` in `.env`:
```env
PORT=3001
```

### JWT Fehler: "No auth token"

**Lösung:** Stelle sicher, dass du den Token im Header sendest:
```
Authorization: Bearer <dein-token>
```

### Validierungsfehler

```json
{
  "statusCode": 400,
  "message": ["password must be longer than or equal to 8 characters"],
  "error": "Bad Request"
}
```

**Lösung:** Prüfe die DTO-Anforderungen in Swagger Docs.

---

## 🧪 Beispiel-Workflow

### 1. User registrieren
```http
POST /auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "firmenname": "Doe Consulting"
}
```

### 2. Login
```http
POST /auth/login
Content-Type: application/json

{
  "usernameOrEmail": "johndoe",
  "password": "SecurePass123!"
}
```

Response: `{ accessToken: "...", refreshToken: "..." }`

### 3. Ticket erstellen (mit Token)
```http
POST /tickets
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "title": "Login Problem",
  "initialMessage": "Ich kann mich nicht mehr einloggen..."
}
```

### 4. Nachricht hinzufügen
```http
POST /tickets/<ticket-id>/messages
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "content": "Danke für die Rückmeldung!"
}
```

### 5. Admin antwortet
```http
POST /admin/tickets/<ticket-id>/messages
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "content": "Hallo, bitte versuchen Sie Ihr Passwort zurückzusetzen."
}
```

---

## 📦 Production Deployment

Siehe [ARCHITECTURE.md](./ARCHITECTURE.md) Sektion "Deployment auf IONOS VPS"

**Kurzfassung:**
1. VPS mit Ubuntu/Debian aufsetzen
2. Node.js + MongoDB installieren
3. Git Repo klonen
4. `.env` anpassen (sichere Secrets!)
5. `npm install && npm run build`
6. PM2 starten: `pm2 start dist/main.js`
7. Nginx als Reverse Proxy

---

## 📞 Support

- **API Docs:** http://localhost:3000/api
- **Repository Issues:** [GitHub Issues]
- **Architektur-Docs:** [ARCHITECTURE.md](./ARCHITECTURE.md)
- **UML Diagramme:** [UML-DIAGRAMS.md](./UML-DIAGRAMS.md)

---

**Happy Coding! 🚀**
