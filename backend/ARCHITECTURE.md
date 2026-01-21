# 🏗️ Backend Architektur - Mueller IT

## 📊 Überblick

Das Backend basiert auf **NestJS** (Node.js Framework) und folgt einer **modularen, layered Architecture** mit klarer Trennung von Verantwortlichkeiten.

---

## 🎯 Architektur-Prinzipien

### 1. **Modularer Aufbau**
Jede Feature-Domain hat ein eigenes Modul:
- `AuthModule` - Authentication & Authorization
- `UsersModule` - User-Verwaltung
- `TicketsModule` - Ticket/Chat System
- `AdminModule` - Admin-Funktionen

### 2. **Layered Architecture**

```
┌─────────────────────────────────────────┐
│           PRESENTATION LAYER            │
│  Controllers (HTTP Endpoints)           │
│  DTOs (Data Transfer Objects)           │
│  Swagger Documentation                  │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│          APPLICATION LAYER              │
│  Services (Business Logic)              │
│  Guards (Authorization)                 │
│  Decorators (@CurrentUser, @Roles)      │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│            DATA LAYER                   │
│  Mongoose Schemas (Database Models)     │
│  MongoDB Connection                     │
└─────────────────────────────────────────┘
```

### 3. **Dependency Injection**
NestJS nutzt DI (Dependency Injection) für lose Kopplung und einfaches Testing.

---

## 🗂️ Modul-Struktur

### **AuthModule**
**Verantwortung:** User-Authentifizierung, JWT-Verwaltung, Session-Handling

**Komponenten:**
- `AuthController` - Endpoints (register, login, refresh, logout)
- `AuthService` - Business Logic (Password-Hashing, Token-Generierung)
- `JwtStrategy` - Passport JWT-Strategie für Token-Validierung
- `JwtAuthGuard` - Schutz von Endpoints
- `RolesGuard` - Rollen-basierte Zugriffskontrolle

**DTOs:**
- `RegisterDto` - Registrierungsdaten
- `LoginDto` - Login-Credentials
- `RefreshTokenDto` - Refresh Token
- `AuthResponseDto` - Token-Response

**Security:**
- Passwort-Hashing mit **argon2**
- JWT Access Token (15 Min Lebensdauer)
- JWT Refresh Token (7 Tage, in DB gespeichert)
- Rate Limiting gegen Brute Force

---

### **UsersModule**
**Verantwortung:** User-Datenbank-Schema

**Komponenten:**
- `User Schema` (Mongoose Model)
  - `username` (unique)
  - `email` (unique)
  - `password` (hashed)
  - `firmenname` (optional)
  - `role` (admin/user/guest)
  - `refreshToken`
  - `isActive`

---

### **TicketsModule**
**Verantwortung:** Ticket/Chat-System

**Komponenten:**
- `TicketsController` - User-Endpoints für Tickets
- `TicketsService` - CRUD-Logik für Tickets & Messages

**Schemas:**
- `Ticket Schema`
  - `userId` (Referenz zu User)
  - `title`
  - `status` (open, in_progress, waiting_for_user, waiting_for_admin, closed)
  - `lastMessageAt`
  - `timestamps`
  
- `Message Schema`
  - `ticketId` (Referenz zu Ticket)
  - `senderId` (Referenz zu User)
  - `content`
  - `isAdminMessage`
  - `isRead`
  - `timestamps`

**DTOs:**
- `CreateTicketDto` - Neues Ticket
- `CreateMessageDto` - Neue Nachricht
- `UpdateTicketStatusDto` - Status-Update
- `TicketResponseDto` - Ticket mit Message-Count

**Business Rules:**
- User kann nur eigene Tickets sehen
- Jede Nachricht aktualisiert `lastMessageAt`
- Status-Historie nachvollziehbar

---

### **AdminModule**
**Verantwortung:** Admin-spezifische Funktionen

**Komponenten:**
- `AdminController` - Admin-Endpoints
  - Alle Tickets anzeigen
  - Auf Tickets antworten
  - Status ändern

**Security:**
- Nur für User mit `role: admin`
- Geschützt durch `RolesGuard`

---

## 🔐 Security-Konzept

### **1. Authentication Flow**

```
┌──────────┐                  ┌──────────┐                  ┌──────────┐
│  Client  │                  │  Backend │                  │ Database │
└────┬─────┘                  └────┬─────┘                  └────┬─────┘
     │                             │                             │
     │ POST /auth/register         │                             │
     ├────────────────────────────>│                             │
     │                             │ Hash Password (argon2)      │
     │                             │                             │
     │                             │ Save User                   │
     │                             ├────────────────────────────>│
     │                             │                             │
     │ Access + Refresh Token      │                             │
     │<────────────────────────────┤                             │
     │                             │                             │
     │ POST /tickets (+ JWT)       │                             │
     ├────────────────────────────>│                             │
     │                             │ Verify JWT                  │
     │                             │                             │
     │                             │ Check User in DB            │
     │                             ├────────────────────────────>│
     │                             │                             │
     │ Ticket Created              │                             │
     │<────────────────────────────┤                             │
```

### **2. Password Security**
- **argon2** Hashing (Memory-hard, resistant gegen GPU-Angriffe)
- Keine Klartext-Speicherung
- Automatische Salt-Generierung

### **3. JWT Security**
- **Access Token:** Kurze Lebensdauer (15 Min)
- **Refresh Token:** In DB gespeichert, kann invalidiert werden
- Secrets in `.env` (nicht im Code)
- Token-Validierung bei jedem Request

### **4. API Security**
- **Helmet**: Security-Headers (XSS, Content-Type, etc.)
- **CORS**: Nur definierte Origins erlaubt
- **Rate Limiting**: Max. 10 Requests/Minute
- **Validation Pipes**: Automatische DTO-Validierung (verhindert Injection)

### **5. Authorization**
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
async adminOnlyEndpoint() { ... }
```

---

## 📡 Datenfluss

### **Beispiel: Ticket erstellen**

```
1. Client sendet POST /tickets mit JWT in Header
   ├─> Body: { title: "...", initialMessage: "..." }
   └─> Header: Authorization: Bearer <JWT>

2. JwtAuthGuard validiert Token
   ├─> JWT-Signatur prüfen
   ├─> User aus DB laden
   └─> User-Objekt in Request injizieren

3. Controller empfängt Request
   ├─> ValidationPipe prüft CreateTicketDto
   └─> Service-Methode aufrufen

4. TicketsService
   ├─> Ticket in DB erstellen
   ├─> Erste Message erstellen
   └─> Ticket + Messages zurückgeben

5. Response an Client
   └─> JSON mit Ticket-Details
```

---

## 📦 Database Schema

### **Collections in MongoDB**

```
users
├── _id: ObjectId
├── username: String (unique)
├── email: String (unique)
├── password: String (hashed)
├── firmenname: String?
├── role: Enum('admin', 'user', 'guest')
├── refreshToken: String?
├── isActive: Boolean
├── createdAt: Date
└── updatedAt: Date

tickets
├── _id: ObjectId
├── userId: ObjectId → users._id
├── title: String
├── status: Enum('open', 'in_progress', ...)
├── lastMessageAt: Date
├── isClosedByUser: Boolean
├── isClosedByAdmin: Boolean
├── createdAt: Date
└── updatedAt: Date

messages
├── _id: ObjectId
├── ticketId: ObjectId → tickets._id
├── senderId: ObjectId → users._id
├── content: String
├── isAdminMessage: Boolean
├── isRead: Boolean
├── createdAt: Date
└── updatedAt: Date
```

**Relationen:**
- User ← Ticket (1:N) - Ein User kann mehrere Tickets haben
- Ticket ← Message (1:N) - Ein Ticket kann mehrere Messages haben
- User ← Message (1:N) - Ein User kann mehrere Messages senden

---

## 🚀 Skalierungs-Konzept

### **Horizontal Skalierung**

**Stateless Design:**
- JWT-basierte Auth (kein Session-Store erforderlich)
- Refresh Tokens in DB (shared state)

**Load Balancing:**
```
            ┌──────────────┐
            │ Load Balancer│
            │   (Nginx)    │
            └──────┬───────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
   ┌────▼───┐ ┌───▼────┐ ┌───▼────┐
   │ Node 1 │ │ Node 2 │ │ Node 3 │
   └────┬───┘ └───┬────┘ └───┬────┘
        │         │          │
        └─────────┼──────────┘
                  │
            ┌─────▼─────┐
            │  MongoDB  │
            │ (Replica) │
            └───────────┘
```

### **Microservice-Vorbereitung**

Jedes Modul ist bereits isoliert und kann später extrahiert werden:

```
Monolith (jetzt)              Microservices (später)
┌───────────────┐            ┌──────────┐  ┌──────────┐
│   NestJS App  │            │   Auth   │  │ Tickets  │
│  ├─ Auth      │   ────>    │ Service  │  │ Service  │
│  ├─ Tickets   │            └────┬─────┘  └────┬─────┘
│  └─ Admin     │                 │             │
└───────┬───────┘                 └──────┬──────┘
        │                                │
   ┌────▼─────┐                    ┌────▼─────┐
   │ MongoDB  │                    │ Message  │
   └──────────┘                    │  Queue   │
                                   └──────────┘
```

**Migration Steps:**
1. Event-Bus einführen (z.B. RabbitMQ)
2. Shared Database aufteilen (Database per Service)
3. API Gateway einführen
4. Services isolieren

---

## 🔧 Erweiterungskonzept

### **Geplante Features (einfach erweiterbar)**

**1. File Uploads**
```typescript
// In TicketsModule
@Post(':id/attachments')
@UseInterceptors(FileInterceptor('file'))
async uploadFile(@UploadedFile() file: Express.Multer.File) {
  // S3 oder lokaler Storage
}
```

**2. Email-Benachrichtigungen**
```typescript
// Neues NotificationModule
@Injectable()
export class NotificationService {
  async sendTicketUpdate(user: User, ticket: Ticket) {
    // SendGrid, Nodemailer, etc.
  }
}
```

**3. WebSockets (Real-time Chat)**
```typescript
// In TicketsModule
@WebSocketGateway()
export class TicketGateway {
  @SubscribeMessage('sendMessage')
  handleMessage(client: Socket, payload: any) {
    // Broadcast to room
  }
}
```

**4. Audit Log**
```typescript
// Neues AuditModule
@Injectable()
export class AuditInterceptor {
  async intercept(context: ExecutionContext) {
    // Log alle Admin-Aktionen
  }
}
```

**5. Search & Filter**
```typescript
// In TicketsService
async searchTickets(query: SearchDto) {
  return this.ticketModel.find({
    $text: { $search: query.keyword }
  });
}
```

---

## 📈 Performance-Optimierung

### **Aktuelle Optimierungen**
- ✅ Mongoose Lean Queries (kein Hydration Overhead)
- ✅ Index auf `username` und `email`
- ✅ JWT stateless (kein DB-Lookup pro Request)

### **Zukünftige Optimierungen**
- [ ] Redis Caching für häufige Queries
- [ ] Database Indexes für Ticket-Queries
- [ ] GraphQL statt REST (weniger Overfetching)
- [ ] CDN für statische Assets

---

## 🧪 Testing-Strategie

```
Unit Tests (Services)
├── AuthService
│   ├── register() - User erstellen
│   ├── login() - Token generieren
│   └── refreshToken() - Token erneuern
└── TicketsService
    ├── createTicket()
    └── addMessage()

Integration Tests (E2E)
├── POST /auth/register
├── POST /auth/login
├── POST /tickets (mit JWT)
└── GET /admin/tickets (mit Admin-Role)
```

---

## 📚 Technologie-Stack

| Layer          | Technologie              | Zweck                          |
|----------------|--------------------------|--------------------------------|
| Framework      | NestJS 11                | Backend-Framework              |
| Runtime        | Node.js 18+              | JavaScript Runtime             |
| Language       | TypeScript               | Type Safety                    |
| Database       | MongoDB                  | NoSQL Datenbank                |
| ODM            | Mongoose                 | MongoDB Object Modeling        |
| Auth           | JWT (jsonwebtoken)       | Stateless Authentication       |
| Hashing        | argon2                   | Password Hashing               |
| Validation     | class-validator          | DTO Validation                 |
| Docs           | Swagger/OpenAPI          | API Dokumentation              |
| Security       | Helmet, CORS, Throttler  | Web Security                   |
| Process Mgmt   | PM2                      | Production Process Manager     |

---

## 🎯 Best Practices

### **1. Environment Variables**
```typescript
// ❌ Schlecht
const secret = 'hardcoded-secret';

// ✅ Gut
const secret = this.configService.get('JWT_SECRET');
```

### **2. Error Handling**
```typescript
// ❌ Schlecht
throw new Error('User not found');

// ✅ Gut
throw new NotFoundException('User nicht gefunden');
```

### **3. DTOs verwenden**
```typescript
// ❌ Schlecht
@Post()
create(@Body() body: any) { }

// ✅ Gut
@Post()
create(@Body() createDto: CreateTicketDto) { }
```

### **4. Guards kombinieren**
```typescript
// Erst Auth, dann Roles
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
```

---

## 📞 Kontakt & Support

Bei Fragen zur Architektur: **[Kontakt einfügen]**

---

**Dokument-Version:** 1.0  
**Letzte Aktualisierung:** 21.01.2026  
**Autor:** Backend-Architekt für Mueller IT
