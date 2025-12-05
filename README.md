# Task Board API

A Trello-like Task Board API built with NestJS, MongoDB, and Redis. Features full CRUD operations for Users, Boards, Tasks, and Comments, with data integrity validation, task history tracking, and Redis caching for optimized performance.

## 📋 Features

- **User Management** — Create, read, update, and delete users with email uniqueness validation.
- **Board Management** — Create boards with owner and member management. Prevents deletion if tasks exist.
- **Task Management** — Full CRUD with status tracking (todo, in-progress, done), optional assignee assignment.
- **Task History** — Automatic tracking of all task field changes (title, status, assignee, board).
- **Comments** — Add, read, update, delete comments on tasks with automatic history.
- **Data Integrity** — Database-level and server-side validation:
  - Cannot delete a board while tasks exist.
  - Cannot delete a user who owns boards or has assigned tasks.
  - Automatic cleanup of comments and history when task is deleted.
- **Redis Caching** — Caches board tasks and task comments (60s TTL) with automatic invalidation on mutations.
- **Normalized Schema** — Proper Mongoose schemas with indexes and ObjectId references.

## 🚀 Prerequisites

- **Node.js** >= 16
- **MongoDB** >= 4.4 (local or cloud)
- **Redis** >= 6 (local or cloud)

## 📦 Installation & Setup

### 1. Clone and install dependencies

```bash
cd 'C:\Work\Pet\Task Board\task-board-api'
npm install
```

### 2. Start MongoDB (local)

**Option A: Using Docker**
```bash
docker run -p 27017:27017 --name taskboard-mongo -d mongo:latest
```

**Option B: Using installed MongoDB**
```bash
mongod
```

### 3. Start Redis (local)

**Option A: Using Docker**
```bash
docker run -p 6379:6379 --name taskboard-redis -d redis:7
```

**Option B: Using installed Redis**
```bash
redis-server
```

### 4. Run the application

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`

### Environment Variables

Create a `.env` file (optional, these are defaults):

```env
MONGODB_URI=mongodb://localhost:27017/taskboard
REDIS_URL=redis://127.0.0.1:6379
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
  "status": "enum: 'todo' | 'in-progress' | 'done'",
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
| Cannot delete board with tasks | Server-side + Database-level (pre-hook) |
| Cannot delete user who owns boards | Server-side + Database-level (pre-hook) |
| Cannot delete user with assigned tasks | Server-side + Database-level (pre-hook) |
| Email must be unique | Database index + Server-side validation |
| Task history auto-created on update | Server-side (service layer) |
| Comments auto-deleted when task deleted | Database-level (cascade pre-hook) |

## ⚡ Caching Strategy

- **Board Tasks**: Cached at `board:{boardId}:tasks` (60s TTL)
  - Invalidated on task create/update/delete
- **Task Comments**: Cached at `task:{taskId}:comments` (60s TTL)
  - Invalidated on comment create/update/delete

Cache is optional — if Redis is unavailable, the API falls back to direct database queries.

## 🏗️ Project Structure

```
src/
├── app.module.ts           # Main app module with all imports
├── main.ts                 # Application entry point
├── users/                  # User CRUD module
│   ├── users.service.ts
│   ├── users.controller.ts
│   ├── users.module.ts
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   └── update-user.dto.ts
│   └── schemas/
│       └── user.schema.ts
├── boards/                 # Board CRUD module
├── tasks/                  # Task CRUD + history module
├── comments/               # Comment CRUD module
├── history/                # Task history logging
├── common/                 # Shared utilities
│   ├── cache.service.ts    # Redis cache wrapper
│   ├── redis.module.ts     # Redis provider
│   └── redis.constants.ts  # Redis token constant
```

## 🧪 Testing

Run the test suite:

```bash
npm run test
npm run test:e2e
```

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
- Ensure MongoDB is running on port 27017 or update `MONGODB_URI`

**"connect ECONNREFUSED 127.0.0.1:6379"**
- Ensure Redis is running on port 6379 or update `REDIS_URL`
- Redis is optional; app will work without it (no caching)

## 📖 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Mongoose Documentation](https://mongoosejs.com)
- [Redis Documentation](https://redis.io/documentation)
- [ioredis Client](https://github.com/luin/ioredis)

## 📄 License

This project is unlicensed.

  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.
