# Task Board API

A Trello-like Task Board API built with NestJS, MongoDB, and Redis. Features full CRUD operations for Users, Boards, Tasks, and Comments, with data integrity validation, task history tracking, and Redis caching for optimized performance.

## 📋 Features

- **User Management** — Create, read, update, and delete users with email uniqueness validation.
- **Board Management** — Create boards with owner and member management. Prevents deletion if tasks exist.
- **Task Management** — Full CRUD with status tracking (todo, in-progress, done), optional assignee assignment.
- **Task History** — Automatic tracking of all task field changes (title, status, assignee, board).
- **Comments** — Add, read, update, delete comments on tasks.
- **Data Integrity** — Database-level and server-side validation:
  - Cannot delete a board while tasks exist.
  - Cannot delete a user who owns boards.
  - Automatic cleanup of comments and history when task is deleted.
- **Redis Caching** — Caches board tasks, board list, and task comments (60s TTL) with automatic invalidation on mutations.
- **Normalized Schema** — Proper Mongoose schemas with indexes and ObjectId references.
- **TypeScript Enums** — TaskStatus enum for type safety.
- **Centralized Constants** — Model names centralized in constants for consistency.

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
│   ├── tasks/              # Task CRUD + history module
│   │   ├── constants/
│   │   │   └── task-status.constants.ts
│   │   └── ...
│   ├── comments/           # Comment CRUD module
│   └── history/            # Task history logging
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
    └── integration.e2e-spec.ts  # Comprehensive integration tests (35 tests)
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
  "ownerId": "64a1b2c3d4e5f6g7h8i9j0k1",
  "memberIds": ["64a1b2c3d4e5f6g7h8i9j0k2"]
}

# List all boards
GET /boards

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
  "status": "todo",
  "assigneeId": "64a1b2c3d4e5f6g7h8i9j0k2"
}

# List all tasks
GET /tasks

# List tasks by board (cached)
GET /tasks?boardId=64a1b2c3d4e5f6g7h8i9j0k1

# Get task by ID
GET /tasks/:taskId

# Update task (creates history entry for each changed field)
PATCH /tasks/:taskId
Content-Type: application/json

{
  "status": "in-progress",
  "assigneeId": "64a1b2c3d4e5f6g7h8i9j0k3",
  "changedByUserId": "64a1b2c3d4e5f6g7h8i9j0k4"
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
  "memberIds": ["ObjectId (ref: User)"],
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
  "status": "enum: TaskStatus.TODO | TaskStatus.IN_PROGRESS | TaskStatus.DONE",
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
  "field": "string (e.g. 'status', 'title', 'assigneeId')",
  "oldValue": "string (optional)",
  "newValue": "string (optional)",
  "changedByUserId": "ObjectId (ref: User, optional)",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

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

- **All Boards**: Cached at `all_boards` (60s TTL)
  - Invalidated on board create/update/delete
- **Board Tasks**: Cached at `board:{boardId}:tasks` (60s TTL)
  - Invalidated on task create/update/delete
- **Task Comments**: Cached at `task:{taskId}:comments` (60s TTL)
  - Invalidated on comment create/update/delete

**Graceful Degradation**: If Redis is unavailable, the API automatically falls back to direct database queries without caching.

## 🧪 Testing

```bash
# Run all tests
npm test

# Run e2e integration tests (35 test cases)
npm run test:e2e

# Test coverage
npm run test:cov
```

**Test Coverage Includes:**
- ✅ User CRUD operations (6 tests)
- ✅ Board CRUD operations (5 tests)
- ✅ Task CRUD and filtering (7 tests)
- ✅ Comments CRUD and caching (5 tests)
- ✅ Task history logging (4 tests)
- ✅ Data integrity validations (4 tests)
- ✅ Complete workflow integration (1 test)

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
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com"}'
```

### 2. Create another user (for board ownership)
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Bob","email":"bob@example.com"}'
```

### 3. Create a board
```bash
curl -X POST http://localhost:3000/boards \
  -H "Content-Type: application/json" \
  -d '{"name":"Q4 Planning","ownerId":"<user_bob_id>","memberIds":["<user_alice_id>"]}'
```

### 4. Create a task
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"boardId":"<board_id>","title":"Design UI","status":"todo","assigneeId":"<user_alice_id>"}'
```

### 5. Update task status (creates history)
```bash
curl -X PATCH http://localhost:3000/tasks/<task_id> \
  -H "Content-Type: application/json" \
  -d '{"status":"in-progress","changedByUserId":"<user_bob_id>"}'
```

### 6. Add a comment
```bash
curl -X POST http://localhost:3000/comments \
  -H "Content-Type: application/json" \
  -d '{"taskId":"<task_id>","userId":"<user_alice_id>","text":"Started working on this"}'
```

### 7. Get task comments (cached on second request)
```bash
curl http://localhost:3000/comments?taskId=<task_id>
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

## 🛠️ Tech Stack

- **Framework**: NestJS 11.x
- **Language**: TypeScript 5.x
- **Database**: MongoDB with Mongoose ODM
- **Caching**: Redis via ioredis
- **Validation**: class-validator, class-transformer
- **Testing**: Jest + Supertest
- **Linting**: ESLint 9.x with TypeScript flat config
- **CI/CD**: GitHub Actions
- **Containerization**: Docker

## 📖 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Mongoose Documentation](https://mongoosejs.com)
- [Redis Documentation](https://redis.io/documentation)
- [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- [Upstash Redis](https://upstash.com/)
- [Render.com Deployment](https://render.com)

## 📄 License

This project is MIT licensed.

---

**Built with ❤️ using NestJS**
