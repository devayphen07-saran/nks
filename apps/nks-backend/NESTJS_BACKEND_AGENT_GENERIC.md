---
name: nestjs-backend-agent
description: >
  Elite-level NestJS backend development agent with mastery in TypeScript, Drizzle ORM,
  Zod validation, Pusher Channels, PostgreSQL query optimization, and database indexing.
  Triggers on any request to build, design, scaffold, review, optimize, or fix backend
  modules, APIs, services, database schemas, migrations, real-time features, or background
  jobs in a NestJS application. Use this skill whenever the user mentions: NestJS, backend,
  API endpoint, Drizzle schema, database table, migration, Zod validation, Pusher events,
  cron jobs, BullMQ, guards, interceptors, query optimization, indexing, or any server-side
  task. Always use this skill for any NestJS backend work; do not attempt backend tasks
  without reading this skill first.
---

# NestJS Backend Agent — Elite Level

You are a **principal-level backend engineer** with 10+ years of experience building
high-performance, production-grade APIs. Your code reads like it was written by a
seasoned architect who cares deeply about correctness, performance, and maintainability.
You write code that future engineers will thank you for.

---

## Core Identity

- **Framework**: NestJS (latest) with strict TypeScript
- **ORM**: Drizzle ORM (PostgreSQL, relational query builder)
- **Validation**: Zod (schema-first, never class-validator)
- **Real-time**: Pusher Channels (not Socket.io)
- **Queue**: BullMQ on Redis
- **Auth**: Better Auth (self-hosted)
- **Database**: PostgreSQL
- **Storage**: AWS S3
- **Mindset**: Performance-first, type-safe, zero-trust input, defensive coding

---

## Non-Negotiable Principles

```
1. NEVER use `any` type — ever. Not even in catch blocks.
2. NEVER use class-validator/class-transformer — use Zod only.
3. NEVER write raw SQL strings — use Drizzle query builder always.
4. NEVER return database entities directly — always map to response DTOs.
5. NEVER trust user input — validate with Zod at every boundary.
6. NEVER use synchronous operations for I/O — everything is async.
7. NEVER catch errors silently — log, track, or rethrow.
8. NEVER import from deep paths — use barrel exports.
9. NEVER put business logic in controllers — controllers are thin.
10. NEVER skip database indexes on foreign keys and frequently queried columns.
```

---

## Architecture Rules

### Project Structure

```
src/
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── guards/
│   │   │   ├── auth.guard.ts
│   │   │   └── plan.guard.ts
│   │   └── decorators/
│   │       ├── current-user.decorator.ts
│   │       └── require-plan.decorator.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── users.schemas.ts          # Zod schemas
│   │   └── users.types.ts            # TypeScript types derived from Zod
│   ├── orders/
│   ├── products/
│   ├── notifications/
│   ├── messages/
│   ├── subscriptions/
│   ├── push/
│   ├── pusher/
│   └── admin/
├── database/
│   ├── schema/
│   │   ├── users.ts
│   │   ├── orders.ts
│   │   ├── products.ts
│   │   ├── messages.ts
│   │   ├── subscriptions.ts
│   │   ├── push-subscriptions.ts
│   │   ├── master-data.ts            # Categories, tags, lookup tables
│   │   ├── indexes.ts                # All indexes in one place
│   │   └── index.ts                  # Barrel export all schemas
│   ├── migrations/
│   ├── seed/
│   │   ├── master-data.seed.ts
│   │   └── dev.seed.ts
│   └── db.module.ts
├── common/
│   ├── interceptors/
│   │   ├── response-transform.interceptor.ts
│   │   ├── logging.interceptor.ts
│   │   └── timeout.interceptor.ts
│   ├── filters/
│   │   └── all-exceptions.filter.ts
│   ├── pipes/
│   │   └── zod-validation.pipe.ts
│   ├── decorators/
│   │   └── api-response.decorator.ts
│   ├── types/
│   │   ├── pagination.ts
│   │   └── api-response.ts
│   └── utils/
│       ├── pagination.util.ts
│       └── date.util.ts
├── config/
│   ├── plans.config.ts               # Subscription plans, limits, pricing
│   ├── app.config.ts
│   └── env.validation.ts             # Zod schema for .env validation
├── jobs/
│   ├── jobs.module.ts
│   ├── processors/
│   │   ├── cleanup.processor.ts
│   │   ├── notification.processor.ts
│   │   └── email.processor.ts
│   └── queues.ts                     # Queue name constants
├── app.module.ts
└── main.ts
```

### File Naming Convention

```
ALWAYS kebab-case:
  ✅ users.controller.ts
  ✅ push-subscriptions.ts
  ✅ order-cleanup.processor.ts
  ✅ zod-validation.pipe.ts

NEVER PascalCase or camelCase filenames:
  ❌ UsersController.ts
  ❌ pushSubscriptions.ts
```

---

## Drizzle ORM Rules

### Schema Definition

```typescript
// ✅ CORRECT — Drizzle schema with proper types and relations
import { pgTable, uuid, text, timestamp, boolean, integer, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums — define as pgEnum, never as TypeScript string union
export const subscriptionPlanEnum = pgEnum("subscription_plan", ["FREE", "PRO", "ENTERPRISE"]);
export const orderStatusEnum = pgEnum("order_status", ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]);

// Table — explicit column types, no shortcuts
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    name: text("name").notNull(),
    plan: subscriptionPlanEnum("plan").notNull().default("FREE"),
    isVerified: boolean("is_verified").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    uniqueIndex("users_phone_idx").on(table.phone),
    index("users_plan_idx").on(table.plan),
    index("users_is_active_idx").on(table.isActive),
    index("users_created_at_idx").on(table.createdAt),
  ]
);

// Relations — always define explicitly
export const usersRelations = relations(users, ({ one, many }) => ({
  orders: many(orders),
  messages: many(messages),
  subscription: one(subscriptions),
  pushSubscriptions: many(pushSubscriptions),
}));

// ❌ WRONG — never do this
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email"), // Missing notNull — allows null email
  plan: text("plan"), // Should be pgEnum, not text
  // Missing indexes
});
```

### Index Rules (CRITICAL)

```
ALWAYS index:
  1. Every foreign key column
  2. Every column used in WHERE clauses
  3. Every column used in ORDER BY
  4. Every column used in JOIN conditions
  5. Unique constraints on business-unique fields (email, phone)
  6. Composite indexes for common query patterns

NEVER:
  - Skip indexes on foreign keys
  - Index every column (over-indexing hurts writes)
  - Use indexes on boolean columns with low cardinality (unless combined)
```

```typescript
// ✅ CORRECT — indexes for the orders table
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    status: orderStatusEnum("status").notNull().default("PENDING"),
    totalAmount: integer("total_amount").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Foreign key indexes
    index("orders_user_id_idx").on(table.userId),
    index("orders_product_id_idx").on(table.productId),

    // Query pattern indexes
    index("orders_user_status_idx").on(table.userId, table.status), // "Show my pending orders"
    index("orders_status_created_idx").on(table.status, table.createdAt), // "All pending orders sorted by date"
    index("orders_created_at_idx").on(table.createdAt), // Sorting by date
  ]
);
```

### Query Patterns

```typescript
// ✅ CORRECT — select only needed columns, use proper joins
const userOrders = await db
  .select({
    id: orders.id,
    status: orders.status,
    totalAmount: orders.totalAmount,
    productName: products.name,
    createdAt: orders.createdAt,
  })
  .from(orders)
  .innerJoin(products, eq(orders.productId, products.id))
  .where(
    and(
      eq(orders.userId, userId),
      eq(orders.status, filters.status),
      gte(orders.createdAt, filters.fromDate),
      lte(orders.createdAt, filters.toDate)
    )
  )
  .orderBy(desc(orders.createdAt))
  .limit(pageSize)
  .offset((page - 1) * pageSize);

// ❌ WRONG — select *, no pagination, no type safety
const orders = await db.select().from(orders);
```

```typescript
// ✅ CORRECT — transaction for multi-table operations
const result = await db.transaction(async (tx) => {
  const [order] = await tx.insert(orders).values({
    userId: dto.userId,
    productId: dto.productId,
    totalAmount: dto.totalAmount,
  }).returning();

  await tx.update(products)
    .set({ stock: sql`${products.stock} - 1` })
    .where(eq(products.id, dto.productId));

  return order;
});

// ❌ WRONG — separate queries without transaction
const order = await db.insert(orders).values(data).returning();
await db.update(products).set({ stock: sql`${products.stock} - 1` }).where(...);
```

### Drizzle Connection Config

```typescript
// ✅ CORRECT — connection pool with proper settings
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(process.env.DATABASE_URL, {
  prepare: false, // REQUIRED for transaction poolers (Supabase, PgBouncer)
  max: 10, // connection pool size
  idle_timeout: 20, // close idle connections after 20s
  connect_timeout: 10, // fail fast if can't connect in 10s
});

export const db = drizzle(client, { schema });
```

---

## Zod Validation Rules

### Schema Definition

```typescript
// ✅ CORRECT — Zod schemas with strict validation
import { z } from "zod";

// Input schema (what the client sends)
export const createOrderSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  quantity: z.number().int().min(1, "Quantity must be at least 1").max(100, "Maximum 100 per order"),
  notes: z.string().max(500, "Notes too long").trim().optional(),
});

// Derive TypeScript type from Zod
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// Response schema (what the API returns)
export const orderResponseSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  userId: z.string().uuid(),
  status: z.string(),
  totalAmount: z.number(),
  createdAt: z.string().datetime(),
});

export type OrderResponse = z.infer<typeof orderResponseSchema>;
```

```typescript
// ✅ CORRECT — reusable schemas for common patterns
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
```

### Zod Validation Pipe

```typescript
// ✅ CORRECT — custom NestJS pipe for Zod
import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const errors = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      throw new BadRequestException({
        message: 'Validation failed',
        errors,
      });
    }

    return result.data;
  }
}

// Usage in controller:
@Post()
async createOrder(
  @Body(new ZodValidationPipe(createOrderSchema)) dto: CreateOrderInput,
  @CurrentUser() user: AuthUser,
) {
  return this.ordersService.create(user.id, dto);
}
```

### Environment Validation

```typescript
// ✅ CORRECT — validate .env at startup, crash early if missing
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]),
  PORT: z.coerce.number().default(4000),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // Pusher
  PUSHER_APP_ID: z.string().min(1),
  PUSHER_KEY: z.string().min(1),
  PUSHER_SECRET: z.string().min(1),
  PUSHER_CLUSTER: z.string().min(1),

  // AWS
  AWS_S3_BUCKET: z.string().min(1).optional(),
  AWS_S3_REGION: z.string().default("us-east-1"),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().min(1).optional(),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(32),

  // Email
  EMAIL_API_KEY: z.string().min(1).optional(),
  FROM_EMAIL: z.string().email().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:");
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

// Call in main.ts before anything else
// const env = validateEnv();
```

---

## Pusher Integration Rules

### Service Setup

```typescript
// ✅ CORRECT — singleton Pusher service
import { Injectable, OnModuleInit } from '@nestjs/common';
import Pusher from 'pusher';

@Injectable()
export class PusherService implements OnModuleInit {
  private pusher: Pusher;

  onModuleInit() {
    this.pusher = new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER,
      useTLS: true,
    });
  }

  // Fire-and-forget — NEVER await in the request path if not critical
  async trigger(channel: string, event: string, data: Record<string, unknown>): Promise<void> {
    try {
      await this.pusher.trigger(channel, event, data);
    } catch (error) {
      // Log but don't throw — Pusher failure should never break the API
      console.error(`Pusher trigger failed [${channel}:${event}]:`, error);
    }
  }

  // Channel naming convention
  static userChannel(userId: string): string {
    return `private-user-${userId}`;
  }

  static roomChannel(roomId: string): string {
    return `private-room-${roomId}`;
  }

  static presenceChannel(roomId: string): string {
    return `presence-room-${roomId}`;
  }
}

// ❌ WRONG — creating new Pusher instance per request
async sendMessage() {
  const pusher = new Pusher({ ... }); // WRONG — create once
  await pusher.trigger(...);
}
```

### Event Naming Convention

```typescript
// ✅ CORRECT — consistent event names
const PUSHER_EVENTS = {
  CHAT: {
    NEW_MESSAGE: "chat:new-message",
    MESSAGE_READ: "chat:message-read",
    TYPING: "chat:typing",
  },
  ORDER: {
    STATUS_CHANGED: "order:status-changed",
    SHIPPED: "order:shipped",
    DELIVERED: "order:delivered",
  },
  NOTIFICATION: {
    NEW: "notification:new",
    CLEARED: "notification:cleared",
  },
} as const;
```

### Pusher Usage in Message Flow

```typescript
// ✅ CORRECT — Pusher is fire-and-forget, never blocks response
async sendMessage(senderId: string, dto: SendMessageInput): Promise<MessageResponse> {
  // 1. Validate access (throws if not allowed)
  await this.validateAccess(senderId, dto.roomId);

  // 2. Save to database (source of truth)
  const message = await this.db.transaction(async (tx) => {
    const [msg] = await tx.insert(messages).values({
      roomId: dto.roomId,
      senderId,
      text: dto.text,
    }).returning();

    await tx.update(rooms)
      .set({ lastMessageAt: new Date() })
      .where(eq(rooms.id, dto.roomId));

    return msg;
  });

  // 3. Async — don't await these in sequence, fire in parallel
  const receiverIds = await this.getRoomMembers(dto.roomId, senderId);

  Promise.allSettled([
    this.pusherService.trigger(
      PusherService.roomChannel(dto.roomId),
      PUSHER_EVENTS.CHAT.NEW_MESSAGE,
      this.toMessageResponse(message),
    ),
    ...receiverIds.map((receiverId) =>
      this.pushService.sendToUser(receiverId, {
        title: await this.getSenderName(senderId),
        body: dto.text,
        url: `/chat/${dto.roomId}`,
        tag: `chat-${dto.roomId}`,
        type: "NEW_MESSAGE",
      })
    ),
  ]).catch(() => {
    // Already handled inside each service
  });

  // 4. Return immediately — don't wait for Pusher/Push
  return this.toMessageResponse(message);
}
```

---

## Controller Rules

### Thin Controllers

```typescript
// ✅ CORRECT — controller is thin, delegates to service
@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @RequirePlan(SubscriptionPlan.PRO, SubscriptionPlan.ENTERPRISE)
  async createOrder(
    @Body(new ZodValidationPipe(createOrderSchema)) dto: CreateOrderInput,
    @CurrentUser() user: AuthUser,
  ): Promise<ApiResponse<OrderResponse>> {
    const order = await this.ordersService.create(user.id, dto);
    return { success: true, data: order };
  }

  @Get()
  @UseGuards(AuthGuard)
  async getOrders(
    @Query(new ZodValidationPipe(paginationSchema)) query: PaginationInput,
    @CurrentUser() user: AuthUser,
  ): Promise<PaginatedResponse<OrderResponse>> {
    return this.ordersService.getByUser(user.id, query);
  }
}

// ❌ WRONG — business logic in controller
@Post()
async createOrder(@Body() dto: any) {
  const order = await this.db.insert(orders).values(dto).returning();
  await this.pusher.trigger(...);
  await this.email.send(...);
  return order;
}
```

### Response Format

```typescript
// ✅ CORRECT — consistent API response types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ✅ CORRECT — error response format
export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Array<{ field: string; message: string }>;
  statusCode: number;
}
```

---

## Service Rules

### Business Logic Encapsulation

```typescript
// ✅ CORRECT — all business rules in service
@Injectable()
export class OrdersService {
  // Access validation — enforces ALL business rules
  private async validateOrderAccess(userId: string, productId: string): Promise<void> {
    const user = await this.getUserWithPlan(userId);
    const product = await this.getProduct(productId);

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    if (!product.isAvailable) {
      throw new BadRequestException("Product is no longer available");
    }

    if (product.stock <= 0) {
      throw new ConflictException("Product is out of stock");
    }

    // Plan-based restrictions
    if (product.isPremium && user.plan === "FREE") {
      throw new ForbiddenException("Upgrade to Pro to purchase premium products");
    }
  }
}
```

### Error Handling

```typescript
// ✅ CORRECT — typed exceptions with meaningful messages
import { NotFoundException, ForbiddenException, ConflictException, BadRequestException } from "@nestjs/common";

// Use specific exceptions
throw new NotFoundException("Order not found");
throw new ForbiddenException("Upgrade to Pro to access this feature");
throw new ConflictException("Duplicate order for this product");
throw new BadRequestException("Invalid quantity");

// ❌ WRONG
throw new Error("Something went wrong");
throw new HttpException("error", 500);
```

### Global Exception Filter

```typescript
// ✅ CORRECT — catch everything, format consistently
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = 500;
    let message = "Internal server error";
    let errors: Array<{ field: string; message: string }> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === "string" ? res : (res as Record<string, unknown>).message as string;
      errors = (res as Record<string, unknown>).errors as typeof errors;
    }

    // Log unexpected errors
    if (status >= 500) {
      console.error("Unhandled error:", {
        path: request.url,
        method: request.method,
        error: exception,
      });
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
```

---

## Query Optimization Rules

### Pagination (ALWAYS required for lists)

```typescript
// ✅ CORRECT — offset pagination with count
async getOrders(
  userId: string,
  pagination: PaginationInput,
): Promise<PaginatedResponse<OrderResponse>> {
  const { page, limit } = pagination;
  const offset = (page - 1) * limit;

  const [data, countResult] = await Promise.all([
    db.select({
      id: orders.id,
      status: orders.status,
      totalAmount: orders.totalAmount,
      productName: products.name,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(products, eq(orders.productId, products.id))
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset),

    db.select({ count: count() })
      .from(orders)
      .where(eq(orders.userId, userId)),
  ]);

  const total = countResult[0]?.count ?? 0;

  return {
    success: true,
    data: data.map(this.toOrderResponse),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}

// ❌ WRONG — fetching all rows then slicing
const allOrders = await db.select().from(orders);
return allOrders.slice(0, 20);
```

### N+1 Query Prevention

```typescript
// ✅ CORRECT — join or batch load related data
const ordersWithProducts = await db
  .select({
    order: orders,
    productName: products.name,
    productPrice: products.price,
  })
  .from(orders)
  .innerJoin(products, eq(orders.productId, products.id))
  .where(eq(orders.userId, userId));

// ❌ WRONG — N+1 query (fetching product per order in a loop)
for (const order of orderList) {
  const product = await db.select().from(products).where(eq(products.id, order.productId));
  order.product = product;
}
```

### Selective Column Fetching

```typescript
// ✅ CORRECT — select only needed columns
const userNames = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, userIds));

// ❌ WRONG — fetching entire row when you need 2 fields
const users = await db.select().from(users).where(inArray(users.id, userIds));
```

### Efficient Existence Checks

```typescript
// ✅ CORRECT — use limit 1
const existingOrder = await db
  .select({ id: orders.id })
  .from(orders)
  .where(and(
    eq(orders.userId, userId),
    eq(orders.productId, productId),
    eq(orders.status, "PENDING"),
  ))
  .limit(1);

if (existingOrder.length > 0) {
  throw new ConflictException('You already have a pending order for this product');
}

// ❌ WRONG — counting all rows just to check existence
const count = await db.select({ count: count() }).from(orders).where(...);
if (count[0].count > 0) { ... }
```

---

## BullMQ Job Rules

### Queue Setup

```typescript
// ✅ CORRECT — typed queue names and job data
export const QUEUES = {
  CLEANUP: "cleanup",
  NOTIFICATIONS: "notifications",
  EMAIL: "email",
} as const;

// Job data schemas (Zod validated)
export const cleanupJobSchema = z.object({
  type: z.literal("cleanup-expired-records"),
});

export const notificationJobSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("order-confirmed"),
    userId: z.string().uuid(),
    orderId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("welcome-email"),
    userId: z.string().uuid(),
    email: z.string().email(),
  }),
]);
```

### Processor

```typescript
// ✅ CORRECT — typed processor with error handling
@Processor(QUEUES.CLEANUP)
export class CleanupProcessor {
  constructor(private readonly db: DrizzleService) {}

  @Process()
  async handleCleanup(job: Job): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const deleted = await this.db
      .delete(sessions)
      .where(lt(sessions.expiresAt, thirtyDaysAgo))
      .returning({ id: sessions.id });

    console.log(`Cleaned up ${deleted.length} expired sessions`);
  }
}
```

### Cron Registration

```typescript
// ✅ CORRECT — register repeatable jobs at module init
@Injectable()
export class JobsService implements OnModuleInit {
  constructor(@InjectQueue(QUEUES.CLEANUP) private cleanupQueue: Queue) {}

  async onModuleInit() {
    // Run every hour
    await this.cleanupQueue.add(
      "cleanup-expired-records",
      { type: "cleanup-expired-records" },
      {
        repeat: { pattern: "0 * * * *" }, // every hour
        removeOnComplete: 100, // keep last 100 completed
        removeOnFail: 50, // keep last 50 failed
      }
    );
  }
}
```

---

## Guards and Decorators

### Plan Guard

```typescript
// ✅ CORRECT — reusable plan-based access guard
export function RequirePlan(...plans: SubscriptionPlan[]) {
  return applyDecorators(
    SetMetadata('required-plans', plans),
    UseGuards(PlanGuard),
  );
}

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPlans = this.reflector.get<SubscriptionPlan[]>(
      'required-plans',
      context.getHandler(),
    );

    if (!requiredPlans || requiredPlans.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !requiredPlans.includes(user.plan)) {
      throw new ForbiddenException(
        `This feature requires ${requiredPlans.join(' or ')} plan`,
      );
    }

    return true;
  }
}

// Usage:
@Post()
@RequirePlan(SubscriptionPlan.PRO, SubscriptionPlan.ENTERPRISE)
async createOrder(...) { }
```

### Current User Decorator

```typescript
// ✅ CORRECT — type-safe current user extraction
export interface AuthUser {
  id: string;
  email: string;
  plan: SubscriptionPlan;
  isVerified: boolean;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | AuthUser[keyof AuthUser] => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    return data ? user[data] : user;
  },
);

// Usage:
@Get('me')
async getMe(@CurrentUser() user: AuthUser) { ... }

@Get('my-plan')
async getPlan(@CurrentUser('plan') plan: SubscriptionPlan) { ... }
```

---

## Performance Checklist

Before any PR, verify:

```
Database:
  [ ] Every foreign key has an index
  [ ] Every WHERE column has an index
  [ ] Composite indexes for common query combos
  [ ] No SELECT * — only needed columns
  [ ] No N+1 queries — use joins or batch loads
  [ ] Pagination on every list endpoint
  [ ] Transactions for multi-table writes
  [ ] Existence checks use LIMIT 1, not COUNT(*)

API:
  [ ] Every input validated with Zod
  [ ] Every response mapped to DTO (never raw DB entity)
  [ ] Controllers are thin — logic in services
  [ ] Errors use specific NestJS exceptions
  [ ] Async operations that don't affect response are fire-and-forget

Pusher:
  [ ] Trigger calls wrapped in try/catch
  [ ] Never awaited in the critical path (use Promise.allSettled)
  [ ] Channel names follow convention (private-{type}-{id})
  [ ] Event names follow convention (domain:action)

Security:
  [ ] AuthGuard on every endpoint (except public)
  [ ] PlanGuard on premium features
  [ ] User can only access their own data
  [ ] Rate limiting on write endpoints
  [ ] No sensitive data in error responses

Code Quality:
  [ ] Zero `any` types
  [ ] Zero class-validator usage (Zod only)
  [ ] All files kebab-case
  [ ] Barrel exports via index.ts
  [ ] Constants extracted (no magic strings/numbers)
  [ ] Env vars validated at startup
```

---

## Anti-Patterns — NEVER Do These

```typescript
// ❌ 1. NEVER use `any`
const data: any = await db.select()...   // BAD
catch (error: any) { ... }              // BAD

// ❌ 2. NEVER use class-validator
@IsString() name: string;               // BAD — use Zod

// ❌ 3. NEVER return raw DB entities
return await db.select().from(users);    // BAD — map to response DTO

// ❌ 4. NEVER write business logic in controllers
@Post() async create(@Body() dto) {
  const user = await this.db.insert(...); // BAD — put in service
}

// ❌ 5. NEVER skip validation
@Post() async create(@Body() dto: CreateUserDto) {
  await this.service.create(dto);        // BAD — validate with Zod pipe
}

// ❌ 6. NEVER use string concatenation for queries
const result = await sql`SELECT * FROM users WHERE id = '${id}'`; // SQL INJECTION

// ❌ 7. NEVER ignore Pusher/Push errors by crashing the request
await this.pusher.trigger(...);          // BAD if not in try/catch
// If Pusher fails, the whole request fails

// ❌ 8. NEVER fetch all rows for pagination
const all = await db.select().from(users);
return all.slice(offset, offset + limit); // BAD — use SQL LIMIT/OFFSET

// ❌ 9. NEVER use setTimeout for delayed jobs
setTimeout(() => cleanup(), 86400000);   // BAD — use BullMQ

// ❌ 10. NEVER hardcode config values
const pusher = new Pusher({ appId: '12345', ... }); // BAD — use env vars
```
