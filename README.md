# Task Board API

A Trello-like Task Board API built with NestJS, MongoDB, and Redis. Features full CRUD operations for Users, Boards, Tasks, and Comments, with data integrity validation, task history tracking, and Redis caching for optimized performance.

## 📋 Features

- **User Management** — Create, read, update, and delete users with email uniqueness validation.
- **Board Management** — Create boards with owner management. Prevents deletion if tasks exist. Load user's boards.
- **Task Management** — Full CRUD with status tracking (todo, in-progress, done), assignee and description fields.
- **Advanced Task Filtering** — Filter tasks by any combination of boardId, status, title (regex), description (regex), or assignee.
- **Mandatory Change Tracking** — All task updates require `changedByUserId` to track who made the change.
- **Comprehensive Task History** — Automatic tracking of all task field changes (title, description, status, assignee, board) with user attribution.
  - Get history for specific tasks
  - Get aggregated history for all tasks in user's boards
- **Comments** — Add, read, update, delete comments on tasks.
- **Data Integrity** — Database-level and server-side validation:
  - Cannot delete a board while tasks exist.
  - Cannot delete a user who owns boards.
  - Automatic cascade deletion of comments and history when task is deleted.
- **Redis Caching** — Caches board tasks and task comments (60s TTL) with automatic invalidation on mutations.
- **Optimized Database** — Strategic indexes on frequently queried fields:
  - Single-field indexes: email, ownerId, boardId, taskId, assigneeId
  - Compound indexes: {boardId, status}, {assigneeId, status}
- **TypeScript Enums** — TaskStatus enum for type safety.
- **Centralized Constants** — Model names centralized in constants for consistency.
- **Modular Test Suite** — 44 tests split across 6 module-specific e2e test files.

## 🚀 Prerequisites

- **Node.js** >= 20
- **MongoDB** >= 4.4 (local or cloud - MongoDB Atlas free tier supported)
- **Redis** >= 6 (local or cloud - Upstash free tier supported)

## 📦 Installation & Setup

### 1. Clone and install dependencies

```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file or set environment variables:

```env
# MongoDB (required)
MONGODB_URI=mongodb://localhost:27017/taskboard
MONGODB_DB=taskboard

# Redis (optional - gracefully degrades if unavailable)
REDIS_URL=redis://127.0.0.1:6379

# Frontend CORS (optional - comma-separated URLs)
FRONTEND_URL=http://localhost:3002,http://localhost:3001

# Port (optional)
PORT=3001
```

**Cloud Deployment Example (Render.com + MongoDB Atlas + Upstash Redis):**
```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/
MONGODB_DB=taskboard
REDIS_URL=rediss://default:<password>@<host>.upstash.io:6379
FRONTEND_URL=https://your-frontend.onrender.com
PORT=3001
```

### 3. Local Development Setup

**Option A: Using Docker Compose (Recommended)**
```bash
docker-compose up -d
npm run start:dev
```

**Option B: Manual Setup**

Start MongoDB:
```bash
# Using Docker
docker run -p 27017:27017 --name taskboard-mongo -d mongo:latest

# Or using installed MongoDB
mongod
```

Start Redis:
```bash
# Using Docker
docker run -p 6379:6379 --name taskboard-redis -d redis:7

# Or using installed Redis
redis-server
```

Run the application:
```bash
npm run start:dev
```

The API will be available at `http://localhost:3001`

## 🏗️ Project Structure

```
src/
├── modules/                # Domain modules
│   ├── users/              # User CRUD module
│   │   ├── users.service.ts
│   │   ├── users.controller.ts
│   │   ├── users.module.ts
│   │   ├── dto/
│   │   │   ├── create-user.dto.ts
│   │   │   └── update-user.dto.ts
│   │   └── schemas/
│   │       └── user.schema.ts
│   ├── boards/             # Board CRUD module
│   ├── tasks/              # Task CRUD + filtering module
│   ├── comments/           # Comment CRUD module
│   └── history/            # Task history logging + API
├── shared/                 # Shared utilities
│   ├── cache.service.ts    # Redis cache wrapper
│   ├── redis.module.ts     # Redis provider (global)
│   ├── redis.constants.ts  # Redis connection token
│   └── constants/
│       ├── model-names.constants.ts    # Centralized model names
│       └── task-status.constants.ts    # Task status enum
├── app.module.ts           # Main app module
└── main.ts                 # Application entry point

test/
├── app.e2e-spec.ts        # Basic app initialization test
└── e2e/
    ├── setup.ts               # Shared test setup utilities
    ├── users.e2e-spec.ts      # User module tests (6 tests)
    ├── boards.e2e-spec.ts     # Board module tests (8 tests)
    ├── tasks.e2e-spec.ts      # Task module tests (14 tests)
    ├── comments.e2e-spec.ts   # Comment module tests (5 tests)
    ├── history.e2e-spec.ts    # History module tests (8 tests)
    └── validations.e2e-spec.ts # Validation & workflow tests (4 tests)
```

## 📚 API Endpoints

### Users

```http
# Create a user
POST /users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}

# List all users
GET /users

# Get user by ID
GET /users/:userId

# Update user
PATCH /users/:userId
Content-Type: application/json

{
  "name": "Jane Doe"
}

# Delete user (fails if owns boards or has assigned tasks)
DELETE /users/:userId
```

### Boards

```http
# Create a board
POST /boards
Content-Type: application/json

{
  "name": "My Project",
  "ownerId": "64a1b2c3d4e5f6g7h8i9j0k1"
}

# List all boards
GET /boards

# Get boards by user (owner)
GET /boards/user/:userId

# Get board by ID
GET /boards/:boardId

# Update board
PATCH /boards/:boardId
Content-Type: application/json

{
  "name": "Updated Project Name"
}

# Delete board (fails if tasks exist)
DELETE /boards/:boardId
```

### Tasks

```http
# Create a task
POST /tasks
Content-Type: application/json

{
  "boardId": "64a1b2c3d4e5f6g7h8i9j0k1",
  "title": "Implement login",
  "description": "Add JWT authentication",
  "status": "todo",
  "assigneeId": "64a1b2c3d4e5f6g7h8i9j0k2"
}

# Get all tasks
GET /tasks

# Get tasks for a specific board
GET /tasks?boardId=64a1b2c3d4e5f6g7h8i9j0k1

# Filter by status
GET /tasks?status=in-progress

# Filter by assignee
GET /tasks?assigneeId=64a1b2c3d4e5f6g7h8i9j0k2

# Filter by title (regex search, case-insensitive)
GET /tasks?title=authentication

# Filter by description (regex search, case-insensitive)
GET /tasks?description=authentication

# Combine multiple filters
GET /tasks?boardId=xxx&status=in-progress&assigneeId=yyy

# Get task by ID
GET /tasks/:taskId

# Update task (creates history entry for each changed field)
# Note: changedByUserId is REQUIRED for all updates
PATCH /tasks/:taskId
Content-Type: application/json

{
  "title": "Updated title",
  "status": "in-progress",
  "description": "Updated description",
  "assigneeId": "64a1b2c3d4e5f6g7h8i9j0k3",
  "changedByUserId": "64a1b2c3d4e5f6g7h8i9j0k4"  // Required - user who made the change
}

# Delete task (cascades: deletes comments and history)
DELETE /tasks/:taskId
```

### Comments

```http
# Create a comment on a task
POST /comments
Content-Type: application/json

{
  "taskId": "64a1b2c3d4e5f6g7h8i9j0k1",
  "userId": "64a1b2c3d4e5f6g7h8i9j0k2",
  "text": "Great progress on this task!"
}

# List all comments
GET /comments

# List comments by task (cached)
GET /comments?taskId=64a1b2c3d4e5f6g7h8i9j0k1

# Get comment by ID
GET /comments/:commentId

# Update comment
PATCH /comments/:commentId
Content-Type: application/json

{
  "text": "Updated comment text"
}

# Delete comment
DELETE /comments/:commentId
```

### Task History

```http
# Get task history logs
GET /history?taskId=64a1b2c3d4e5f6g7h8i9j0k1

# Get all history for user's boards
GET /history/user/:userId
```

## 📊 Data Models

### User
```json
{
  "_id": "ObjectId",
  "name": "string",
  "email": "string (unique)",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Board
```json
{
  "_id": "ObjectId",
  "name": "string",
  "ownerId": "ObjectId (ref: User)",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### Task
```json
{
  "_id": "ObjectId",
  "boardId": "ObjectId (ref: Board)",
  "title": "string",
  "description": "string (optional)",
  "status": "todo | in-progress | done",
  "assigneeId": "ObjectId (ref: User, optional)",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### TaskComment
```json
{
  "_id": "ObjectId",
  "taskId": "ObjectId (ref: Task)",
  "userId": "ObjectId (ref: User)",
  "text": "string",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### TaskHistoryLog
```json
{
  "_id": "ObjectId",
  "taskId": "ObjectId (ref: Task)",
  "field": "string (title|description|status|assigneeId|boardId)",
  "oldValue": "string (optional)",
  "newValue": "string (optional)",
  "changedByUserId": "ObjectId (ref: User, required)",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

## 🗄️ Database Indexes

**Optimized for query performance:**

- **User**: `email` (unique)
- **Board**: `ownerId`
- **Task**: `boardId`, `assigneeId`, `{boardId, status}`, `{assigneeId, status}`
- **TaskComment**: `taskId`
- **TaskHistoryLog**: `taskId`

## 🔒 Data Integrity Rules

| Rule | Enforcement |
|------|-------------|
| Cannot delete board with tasks | Database-level (pre-hook) |
| Cannot delete user who owns boards | Database-level (pre-hook) |
| Email must be unique | Database index + DTO validation |
| Task status must be valid enum | DTO validation (@IsEnum) |
| MongoId fields validated | DTO validation (@IsMongoId) |
| Task history auto-created on update | Service layer |
| Comments/history auto-deleted on task delete | Database-level (cascade pre-hook) |

## ⚡ Caching Strategy

- **Board Tasks**: Cached at `board:{boardId}:tasks` (60s TTL)
  - Invalidated on task create/update/delete
- **Task Comments**: Cached at `task:{taskId}:comments` (60s TTL)
  - Invalidated on comment create/update/delete

**Graceful Degradation**: If Redis is unavailable, the API automatically falls back to direct database queries without caching.

## 🧪 Testing

```bash
# Run all tests
npm test

# Run all e2e integration tests
npm run test:e2e

# Run specific module tests
npm test -- test/e2e/users.e2e-spec.ts
npm test -- test/e2e/tasks.e2e-spec.ts

# Test coverage
npm run test:cov
```

**Test Coverage (44 tests across 6 modules):**
- ✅ **users.e2e-spec.ts** - User CRUD operations (6 tests)
- ✅ **boards.e2e-spec.ts** - Board CRUD + user boards API (8 tests)
- ✅ **tasks.e2e-spec.ts** - Task CRUD, filtering, caching (14 tests)
- ✅ **comments.e2e-spec.ts** - Comment CRUD and caching (5 tests)
- ✅ **history.e2e-spec.ts** - History logging + API (8 tests)
- ✅ **validations.e2e-spec.ts** - Data integrity + workflow (4 tests)

## 🐳 Docker Deployment

Build and run with Docker:

```bash
# Build image
docker build -t task-board-api .

# Run container
docker run -p 3001:3001 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/taskboard \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  task-board-api
```

**GitHub Actions CI/CD** is configured to:
- Run linting and build checks
- Build and push Docker images to Docker Hub on every push

## 🌐 Cloud Deployment

**Deployed on Render.com (Free Tier):**
- API: Automatically deployed from main branch
- MongoDB: MongoDB Atlas M0 Free Tier (512MB)
- Redis: Upstash Redis Free Tier (10k commands/day)

**Note**: Free tier spins down after 15 minutes of inactivity (cold start ~30s).

## 📝 Example Workflow

### 1. Create a user
```bash
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'
```

### 2. Create another user (for board ownership)
```bash
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Bob","email":"bob@example.com"}'
```

### 3. Create a board (use Bob's user ID from step 2)
```bash
curl -X POST http://localhost:3001/boards \
  -H "Content-Type: application/json" \
  -d '{"name":"Development Board","ownerId":"<user_bob_id>"}'
```

### 4. Create a task (use board ID from step 3)
```bash
curl -X POST http://localhost:3001/tasks \
  -H "Content-Type: application/json" \
  -d '{"boardId":"<board_id>","title":"Setup MongoDB","status":"todo","assigneeId":"<user_alice_id>"}'
```

### 5. Update task status (creates history log)
```bash
curl -X PATCH http://localhost:3001/tasks/<task_id> \
  -H "Content-Type: application/json" \
  -d '{"status":"in-progress","changedByUserId":"<user_alice_id>"}'
```

### 6. Add a comment
```bash
curl -X POST http://localhost:3001/comments \
  -H "Content-Type: application/json" \
  -d '{"taskId":"<task_id>","userId":"<user_bob_id>","text":"Looking good!"}'
```

### 7. Get task comments (cached on second request)
```bash
curl http://localhost:3001/comments?taskId=<task_id>
```

### 8. Get task history
```bash
curl http://localhost:3001/history?taskId=<task_id>
```

### 9. Get all history for user's boards
```bash
curl http://localhost:3001/history/user/<user_id>
```

### 10. Filter tasks by status
```bash
curl "http://localhost:3001/tasks?status=in-progress"
```

### 11. Get user's boards
```bash
curl http://localhost:3001/boards/user/<user_bob_id>
```

## 🐛 Troubleshooting

**"Cannot find module '@nestjs/mapped-types'"**
- Run `npm install @nestjs/mapped-types --save`

**"connect ECONNREFUSED 127.0.0.1:27017"**
- Ensure MongoDB is running on port 27017 or update `MONGODB_URI` in environment variables
- For Docker: `docker run -p 27017:27017 --name taskboard-mongo -d mongo:latest`

**"connect ECONNREFUSED 127.0.0.1:6379"**
- Ensure Redis is running on port 6379 or update `REDIS_URL`
- Redis is optional; app will work without it (no caching)
- For Docker: `docker run -p 6379:6379 --name taskboard-redis -d redis:7`

**"Cannot determine a type for the Task.status field"**
- Ensure `TaskStatus` enum is properly configured with `@Prop({ type: String, enum: TaskStatus })`

**"changedByUserId must be a mongodb id"**
- When updating tasks, you must include a valid `changedByUserId` in the request body
- This field is mandatory to track who made the change for audit purposes

## 🛠️ Tech Stack

- **Framework**: NestJS 11.x
- **Language**: TypeScript 5.x (strict mode)
- **Database**: MongoDB 8.x with Mongoose ODM
- **Cache**: Redis 7.x (optional, via ioredis)
- **Validation**: class-validator, class-transformer
- **Testing**: Jest 30.x + Supertest + MongoDB Memory Server
- **Code Quality**: ESLint 9.x (flat config), Prettier
- **Container**: Docker (multi-stage build)
- **CI/CD**: GitHub Actions

## 📖 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Mongoose Documentation](https://mongoosejs.com)
- [Redis Documentation](https://redis.io/documentation)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- [Upstash Redis](https://upstash.com/)
- [Render.com Deployment](https://render.com)

## 📄 License

This project is licensed under the UNLICENSED License.
