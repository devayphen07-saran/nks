# Real-Time Notification Flow

## Stack

| Layer | Technology |
|-------|-----------|
| Backend transport | NestJS + Socket.IO (`@nestjs/websockets`) |
| Push delivery | Expo Push API (`expo-server-sdk`) |
| Client transport | `socket.io-client` in Expo React Native app |

---

## Architecture Overview

```
Backend Event (user action / status change / cron job)
        │
        ▼
  Save to DB (notifications table)
        │
        ▼
   notifyUser()  ◄── called once per event
   ┌─────┴──────┐
   │            │
   ▼            ▼
socket.emit()  expo.sendPushNotificationsAsync()
  (WebSocket)       (Expo Push → FCM / APNs)
   │            │
   ▼            ▼
App OPEN     App BACKGROUND or CLOSED
In-app       OS system notification
banner       banner
```

---

## Delivery Scenarios

| App State | Channel Used | Result |
|-----------|-------------|--------|
| Open (foreground) | WebSocket | In-app banner rendered by custom UI |
| Background | Expo Push (FCM / APNs) | OS notification banner at top of screen |
| Closed | Expo Push (FCM / APNs) | OS notification banner; tap opens the app |

Both channels always fire simultaneously. The OS deduplicates silently — if the app is open and the WebSocket fires, the Expo Push still arrives but is handled by the foreground notification handler (which you can suppress or customize).

---

## Registration Flow (one-time on app launch)

```
Expo App
  │
  ├─ Notifications.getExpoPushTokenAsync()   ← asks OS for device token
  │
  └─ POST /notifications/register  { pushToken }
         │
         ▼
  NestJS saves { userId, pushToken } to users.fcm_token column
```

- Runs once after login, or whenever the token rotates.
- Token is stored on the `users` table in the `fcm_token` column (already exists).

---

## WebSocket Connection Flow (while app is open)

```
Expo App mounts
  │
  ├─ connect to Socket.IO  ws://api/notifications?token=<JWT>
  │       │
  │       └─ NestJS validates JWT in handleConnection()
  │             └─ joins room `user:<userId>`
  │
  ├─ listen on 'notification' event
  │       └─ show in-app banner
  │
  └─ disconnect on unmount / logout
          └─ NestJS handleDisconnect() cleans up room
```

Reconnection is handled automatically by `socket.io-client` with exponential back-off. No manual polling.

---

## `notifyUser()` — backend core function

Called by any service that needs to notify a user.

```typescript
async notifyUser(userId: number, payload: {
  type:  string;       // 'ORDER_UPDATE' | 'INVITE' | 'SYSTEM' | 'PROMO'
  title: string;
  body:  string;
  data?: Record<string, unknown>;  // deep-link params { screen, id, … }
}) {
  // 1. Persist to DB
  const notification = await this.notificationsRepo.create({ userFk: userId, ...payload });

  // 2. Real-time via WebSocket (if app is open)
  this.notificationsGateway.emitToUser(userId, notification);

  // 3. Push via Expo (always — OS handles deduplication)
  const user = await this.usersRepo.findById(userId);
  if (user?.fcmToken) {
    await this.pushService.send(user.fcmToken, payload.title, payload.body, payload.data);
  }
}
```

---

## Battery & Background Usage

| Concern | Answer |
|---------|--------|
| Does the WebSocket drain battery? | No — it only lives while the app is open (foreground). Socket closes on app backgrounding. |
| Does Expo Push drain battery? | No — it uses the OS-managed FCM (Android) / APNs (iOS) socket. Your app code does not run in the background. |
| Does this poll anything? | Never. Push is event-driven. WebSocket is persistent-but-idle. |
| What wakes the app? | The OS wakes the app only when a notification is tapped. |

---

## Packages Required

### NestJS Backend

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io expo-server-sdk
```

| Package | Purpose |
|---------|---------|
| `@nestjs/websockets` | NestJS WebSocket decorators (`@WebSocketGateway`, `@SubscribeMessage`) |
| `@nestjs/platform-socket.io` | Socket.IO adapter for NestJS |
| `socket.io` | Socket.IO server |
| `expo-server-sdk` | Expo Push API client (validates tokens, sends pushes, handles receipts) |

### Expo Mobile App

```bash
npm install socket.io-client expo-notifications
```

| Package | Purpose |
|---------|---------|
| `socket.io-client` | WebSocket client, auto-reconnect, room support |
| `expo-notifications` | Request OS permission, get push token, foreground notification handler |

---

## Notification Types

| Type | Triggered By | Example |
|------|-------------|---------|
| `ORDER_UPDATE` | Order status change | "Your order #123 has been shipped" |
| `INVITE` | Staff invite created | "You've been invited to join NKS Store" |
| `SYSTEM` | Admin broadcast | "Scheduled maintenance on Sunday 2am" |
| `PROMO` | Marketing campaign | "Flash sale — 30% off today only" |

---

## Data Payload (deep links)

The `data` field on each notification carries navigation params so a tap opens the right screen:

```json
// ORDER_UPDATE
{ "screen": "/(store)/orders/[id]", "orderId": 42 }

// INVITE
{ "screen": "/(auth)/accept-invite", "token": "abc123" }

// SYSTEM
{ "screen": "/(workspace)/home" }
```

---

## File Structure

```
apps/nks-backend/src/
├── core/database/schema/notifications/
│   ├── notifications.table.ts       ← DB table definition
│   └── index.ts
└── modules/notifications/
    ├── notifications.module.ts      ← NestJS module
    ├── notifications.gateway.ts     ← Socket.IO gateway (WebSocket)
    ├── notifications.service.ts     ← notifyUser() lives here
    ├── notifications.repository.ts  ← DB queries
    ├── push.service.ts              ← Expo Push API wrapper
    └── dto/
        └── notification.dto.ts

apps/nks-mobile/
└── modules/notifications/
    ├── hooks/
    │   └── useNotifications.ts      ← token registration + WS listener
    └── components/
        └── NotificationBell.tsx     ← unread badge + list trigger
```
