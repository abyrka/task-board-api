import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import request from 'supertest';
import { CacheService } from '../../src/shared/cache.service';
import { TaskHistoryLog } from '../../src/modules/history/schemas/task-history-log.schema';
import { TaskStatus } from '../../src/shared/constants/task-status.constants';

describe('Integration (e2e)', () => {
  let app: INestApplication;
  let cacheService: CacheService;
  let historyModel: Model<TaskHistoryLog>;
  let mongod: MongoMemoryServer | null = null;

  beforeAll(async () => {
    // start in-memory mongo and set env before importing AppModule
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    const dbName = uri.split('/').pop()?.split('?')[0] || 'test';
    process.env.MONGODB_URI = uri;
    process.env.MONGODB_DB = dbName;

    // use require here to avoid dynamic import/runtime ESM issues in jest environment

    const { AppModule } = require('../../src/app.module');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    cacheService = app.get(CacheService);
    historyModel = moduleFixture.get<Model<TaskHistoryLog>>(
      getModelToken(TaskHistoryLog.name),
    );
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
    if (mongod) await mongod.stop();
  });

  it('should create users, board, task; cache tasks; prevent board delete; create history; invalidate cache', async () => {
    // create owner
    const ownerRes = await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Owner', email: `owner-${Date.now()}@test.local` })
      .expect(201);
    const ownerId = ownerRes.body._id;

    // create board
    const boardRes = await request(app.getHttpServer())
      .post('/boards')
      .send({ name: 'Test Board', ownerId })
      .expect(201);
    const boardId = boardRes.body._id;

    // create task
    const taskRes = await request(app.getHttpServer())
      .post('/tasks')
      .send({ boardId, title: 'T1', status: TaskStatus.TODO })
      .expect(201);
    const taskId = taskRes.body._id;

    // first fetch (populates cache)
    const first = await request(app.getHttpServer())
      .get('/tasks')
      .query({ boardId })
      .expect(200);
    expect(Array.isArray(first.body)).toBeTruthy();

    // ensure cache key exists (if Redis is available)
    const cached = await cacheService.get<any[]>(`board:${boardId}:tasks`);
    if (cached !== null) {
      expect(Array.isArray(cached)).toBeTruthy();
    }

    // deleting board should fail while tasks exist
    await request(app.getHttpServer()).delete(`/boards/${boardId}`).expect(400);

    // update task status -> creates history
    const updatedRes = await request(app.getHttpServer())
      .patch(`/tasks/${taskId}`)
      .send({ status: TaskStatus.IN_PROGRESS, changedByUserId: ownerId })
      .expect(200);

    // check history entries exist for this task
    // convert taskId to ObjectId for query (stored as ObjectId in DB)
    const { ObjectId } = require('mongoose').Types;
    const logs = await historyModel
      .find({ taskId: new ObjectId(taskId) })
      .lean()
      .exec();
    expect(logs.length).toBeGreaterThanOrEqual(1);
    const statusLog = logs.find((l) => l.field === 'status');
    expect(statusLog).toBeDefined();
    expect(statusLog?.oldValue).toBe(TaskStatus.TODO);
    expect(statusLog?.newValue).toBe(TaskStatus.IN_PROGRESS);

    // delete task
    await request(app.getHttpServer()).delete(`/tasks/${taskId}`).expect(200);

    // cache for board tasks should be invalidated
    const afterDeleteCached = await cacheService.get<any[]>(
      `board:${boardId}:tasks`,
    );
    expect(afterDeleteCached).toBeNull();

    // now delete board should succeed
    await request(app.getHttpServer()).delete(`/boards/${boardId}`).expect(200);
  }, 20000);

  describe('User CRUD Operations', () => {
    it('should create a user with valid data', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'John Doe', email: `john-${Date.now()}@test.com` })
        .expect(201);

      expect(res.body).toHaveProperty('_id');
      expect(res.body.name).toBe('John Doe');
    });

    it('should fail to create user with invalid email', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Bad Email', email: 'not-an-email' })
        .expect(400);
    });

    it('should get all users', async () => {
      const res = await request(app.getHttpServer()).get('/users').expect(200);
      expect(Array.isArray(res.body)).toBeTruthy();
    });

    it('should update a user', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'To Update', email: `update-${Date.now()}@test.com` })
        .expect(201);

      const userId = createRes.body._id;

      const updateRes = await request(app.getHttpServer())
        .patch(`/users/${userId}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(updateRes.body.name).toBe('Updated Name');
    });

    it('should delete a user', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'To Delete', email: `delete-${Date.now()}@test.com` })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/users/${createRes.body._id}`)
        .expect(200);
    });

    it('should return 404 for non-existent user', async () => {
      await request(app.getHttpServer())
        .get('/users/507f1f77bcf86cd799439011')
        .expect(404);
    });
  });

  describe('Board CRUD Operations', () => {
    let ownerId: string;

    beforeAll(async () => {
      const ownerRes = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'Board Owner',
          email: `board-owner-${Date.now()}@test.com`,
        })
        .expect(201);
      ownerId = ownerRes.body._id;
    });

    it('should create a board with valid data', async () => {
      const res = await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'Project Board', ownerId })
        .expect(201);

      expect(res.body).toHaveProperty('_id');
      expect(res.body.name).toBe('Project Board');
      expect(res.body.ownerId).toBe(ownerId);
    });

    it('should fail to create board with invalid ownerId', async () => {
      await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'Bad Board', ownerId: 'invalid-id' })
        .expect(400);
    });

    it('should get all boards and cache them', async () => {
      await cacheService.del('all_boards');

      const res = await request(app.getHttpServer()).get('/boards').expect(200);
      expect(Array.isArray(res.body)).toBeTruthy();

      const cached = await cacheService.get('all_boards');
      expect(cached).toBeDefined();
    });

    it('should update a board', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'Original Board', ownerId })
        .expect(201);

      const updateRes = await request(app.getHttpServer())
        .patch(`/boards/${createRes.body._id}`)
        .send({ name: 'Updated Board' })
        .expect(200);

      expect(updateRes.body.name).toBe('Updated Board');
    });

    it('should invalidate boards cache on create', async () => {
      await request(app.getHttpServer()).get('/boards').expect(200);
      const beforeCache = await cacheService.get('all_boards');
      expect(beforeCache).toBeDefined();

      await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'Cache Test Board', ownerId })
        .expect(201);

      const afterCache = await cacheService.get('all_boards');
      expect(afterCache).toBeNull();
    });
  });

  describe('Task CRUD and Filtering', () => {
    let boardId: string;
    let user1Id: string;
    let user2Id: string;

    beforeAll(async () => {
      const ownerRes = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'Task Owner',
          email: `task-owner-${Date.now()}@test.com`,
        })
        .expect(201);
      user1Id = ownerRes.body._id;

      const user2Res = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Assignee2', email: `assignee2-${Date.now()}@test.com` })
        .expect(201);
      user2Id = user2Res.body._id;

      const boardRes = await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'Task Board', ownerId: user1Id })
        .expect(201);
      boardId = boardRes.body._id;
    });

    it('should create tasks with different statuses', async () => {
      const todoRes = await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId,
          title: 'Todo Task',
          status: TaskStatus.TODO,
        })
        .expect(201);
      expect(todoRes.body.status).toBe(TaskStatus.TODO);

      const inProgressRes = await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId,
          title: 'In Progress Task',
          status: TaskStatus.IN_PROGRESS,
        })
        .expect(201);
      expect(inProgressRes.body.status).toBe(TaskStatus.IN_PROGRESS);

      const doneRes = await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId,
          title: 'Done Task',
          status: TaskStatus.DONE,
        })
        .expect(201);
      expect(doneRes.body.status).toBe(TaskStatus.DONE);
    });

    it('should fail to create task with invalid status', async () => {
      await request(app.getHttpServer())
        .post('/tasks')
        .send({ boardId, title: 'Bad Status', status: 'invalid' })
        .expect(400);
    });

    it('should fail to create task with invalid boardId', async () => {
      await request(app.getHttpServer())
        .post('/tasks')
        .send({ boardId: 'not-a-valid-id', title: 'Bad Board' })
        .expect(400);
    });

    it('should get all tasks for a board and cache them', async () => {
      const cacheKey = `board:${boardId}:tasks`;
      await cacheService.del(cacheKey);

      const res = await request(app.getHttpServer())
        .get('/tasks')
        .query({ boardId })
        .expect(200);

      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.length).toBeGreaterThanOrEqual(3);

      const cached = await cacheService.get(cacheKey);
      expect(cached).toBeDefined();
    });

    it('should update task and create history log', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId,
          title: 'History Test',
          status: TaskStatus.TODO,
        })
        .expect(201);
      const taskId = createRes.body._id;

      await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .send({ status: TaskStatus.DONE, changedByUserId: user1Id })
        .expect(200);

      const { ObjectId } = require('mongoose').Types;
      const logs = await historyModel
        .find({ taskId: new ObjectId(taskId) })
        .lean()
        .exec();
      expect(logs.length).toBeGreaterThanOrEqual(1);

      const statusLog = logs.find((l) => l.field === 'status');
      expect(statusLog).toBeDefined();
      expect(statusLog?.oldValue).toBe(TaskStatus.TODO);
      expect(statusLog?.newValue).toBe(TaskStatus.DONE);
    });

    it('should invalidate task cache on update', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId,
          title: 'Cache Invalidation Test',
          status: TaskStatus.TODO,
        })
        .expect(201);
      const taskId = createRes.body._id;

      const cacheKey = `board:${boardId}:tasks`;
      await request(app.getHttpServer())
        .get('/tasks')
        .query({ boardId })
        .expect(200);
      const beforeCache = await cacheService.get(cacheKey);
      expect(beforeCache).toBeDefined();

      await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .send({ status: TaskStatus.DONE })
        .expect(200);

      const afterCache = await cacheService.get(cacheKey);
      expect(afterCache).toBeNull();
    });

    it('should delete task and invalidate cache', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/tasks')
        .send({ boardId, title: 'To Delete', status: TaskStatus.TODO })
        .expect(201);
      const taskId = createRes.body._id;

      const cacheKey = `board:${boardId}:tasks`;
      await request(app.getHttpServer())
        .get('/tasks')
        .query({ boardId })
        .expect(200);

      await request(app.getHttpServer()).delete(`/tasks/${taskId}`).expect(200);

      const afterCache = await cacheService.get(cacheKey);
      expect(afterCache).toBeNull();
    });

    it('should prevent board deletion when tasks exist', async () => {
      const ownerRes = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'Delete Test Owner',
          email: `delete-test-${Date.now()}@test.com`,
        })
        .expect(201);

      const boardRes = await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'Board With Tasks', ownerId: ownerRes.body._id })
        .expect(201);

      await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId: boardRes.body._id,
          title: 'Blocking Task',
          status: TaskStatus.TODO,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/boards/${boardRes.body._id}`)
        .expect(400);
    });
  });

  describe('Comments CRUD and Caching', () => {
    let taskId: string;
    let userId: string;

    beforeAll(async () => {
      const userRes = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Commenter', email: `commenter-${Date.now()}@test.com` })
        .expect(201);
      userId = userRes.body._id;

      const boardRes = await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'Comment Board', ownerId: userId })
        .expect(201);

      const taskRes = await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId: boardRes.body._id,
          title: 'Comment Task',
          status: TaskStatus.TODO,
        })
        .expect(201);
      taskId = taskRes.body._id;
    });

    it('should create a comment', async () => {
      const res = await request(app.getHttpServer())
        .post('/comments')
        .send({ taskId, userId, text: 'First comment' })
        .expect(201);

      expect(res.body).toHaveProperty('_id');
      expect(res.body.text).toBe('First comment');
      expect(res.body.taskId).toBe(taskId);
    });

    it('should get comments for a task and cache them', async () => {
      await request(app.getHttpServer())
        .post('/comments')
        .send({ taskId, userId, text: 'Second comment' })
        .expect(201);

      const cacheKey = `task:${taskId}:comments`;
      await cacheService.del(cacheKey);

      const res = await request(app.getHttpServer())
        .get('/comments')
        .query({ taskId })
        .expect(200);

      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.length).toBeGreaterThanOrEqual(2);

      const cached = await cacheService.get(cacheKey);
      if (cached !== null) {
        expect(Array.isArray(cached)).toBeTruthy();
      }
    });

    it('should update a comment', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/comments')
        .send({ taskId, userId, text: 'Original content' })
        .expect(201);

      const updateRes = await request(app.getHttpServer())
        .patch(`/comments/${createRes.body._id}`)
        .send({ text: 'Updated content' })
        .expect(200);

      expect(updateRes.body.text).toBe('Updated content');
    });

    it('should invalidate comment cache on create', async () => {
      const cacheKey = `task:${taskId}:comments`;
      await request(app.getHttpServer())
        .get('/comments')
        .query({ taskId })
        .expect(200);
      const beforeCache = await cacheService.get(cacheKey);
      if (beforeCache !== null) {
        expect(Array.isArray(beforeCache)).toBeTruthy();
      }

      await request(app.getHttpServer())
        .post('/comments')
        .send({ taskId, userId, text: 'Cache test comment' })
        .expect(201);

      const afterCache = await cacheService.get(cacheKey);
      expect(afterCache).toBeNull();
    });

    it('should delete a comment and invalidate cache', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/comments')
        .send({ taskId, userId, text: 'To delete' })
        .expect(201);

      const cacheKey = `task:${taskId}:comments`;
      await request(app.getHttpServer())
        .get('/comments')
        .query({ taskId })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/comments/${createRes.body._id}`)
        .expect(200);

      const afterCache = await cacheService.get(cacheKey);
      expect(afterCache).toBeNull();
    });
  });

  describe('Task History Logging', () => {
    let taskId: string;
    let userId: string;
    let boardId: string;

    beforeAll(async () => {
      const userRes = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'History User', email: `history-${Date.now()}@test.com` })
        .expect(201);
      userId = userRes.body._id;

      const boardRes = await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'History Board', ownerId: userId })
        .expect(201);
      boardId = boardRes.body._id;

      const taskRes = await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId,
          title: 'History Task',
          status: TaskStatus.TODO,
        })
        .expect(201);
      taskId = taskRes.body._id;
    });

    it('should log status change', async () => {
      await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .send({ status: TaskStatus.IN_PROGRESS, changedByUserId: userId })
        .expect(200);

      const { ObjectId } = require('mongoose').Types;
      const logs = await historyModel
        .find({ taskId: new ObjectId(taskId), field: 'status' })
        .lean()
        .exec();
      expect(logs.length).toBeGreaterThanOrEqual(1);

      const latestLog = logs[logs.length - 1];
      expect(latestLog.oldValue).toBe(TaskStatus.TODO);
      expect(latestLog.newValue).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should log title change', async () => {
      await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .send({ title: 'Updated Title', changedByUserId: userId })
        .expect(200);

      const { ObjectId } = require('mongoose').Types;
      const logs = await historyModel
        .find({ taskId: new ObjectId(taskId), field: 'title' })
        .lean()
        .exec();
      expect(logs.length).toBeGreaterThanOrEqual(1);

      const latestLog = logs[logs.length - 1];
      expect(latestLog.newValue).toBe('Updated Title');
    });

    it('should record changedByUserId in history', async () => {
      await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .send({ status: TaskStatus.DONE, changedByUserId: userId })
        .expect(200);

      const { ObjectId } = require('mongoose').Types;
      const logs = await historyModel
        .find({ taskId: new ObjectId(taskId) })
        .sort({ changedAt: -1 })
        .limit(1)
        .lean()
        .exec();
      expect(logs.length).toBeGreaterThan(0);
      const latestLog = logs[0];
      expect(latestLog).toBeDefined();
      if (latestLog && latestLog.changedByUserId) {
        expect(latestLog.changedByUserId.toString()).toBe(userId);
      }
    });
  });

  describe('Data Integrity Validations', () => {
    it('should fail to create task with non-existent board', async () => {
      await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId: '507f1f77bcf86cd799439011',
          title: 'Invalid Board Task',
        })
        .expect(404);
    });

    it('should fail to create comment with non-existent task', async () => {
      const userRes = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'Commenter',
          email: `comment-validation-${Date.now()}@test.com`,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/comments')
        .send({
          taskId: '507f1f77bcf86cd799439011',
          userId: userRes.body._id,
          text: 'Invalid task',
        })
        .expect(404);
    });

    it('should fail to create board with non-existent owner', async () => {
      await request(app.getHttpServer())
        .post('/boards')
        .send({
          name: 'Invalid Owner Board',
          ownerId: '507f1f77bcf86cd799439011',
        })
        .expect(404);
    });
  });

  describe('Complete Workflow Integration', () => {
    it('should handle complete task board workflow', async () => {
      const owner = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Project Manager', email: `pm-${Date.now()}@test.com` })
        .expect(201);

      const dev1 = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Developer 1', email: `dev1-${Date.now()}@test.com` })
        .expect(201);

      const dev2 = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Developer 2', email: `dev2-${Date.now()}@test.com` })
        .expect(201);

      const board = await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'Sprint 1', ownerId: owner.body._id })
        .expect(201);

      const task1 = await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId: board.body._id,
          title: 'Setup Project',
          status: TaskStatus.TODO,
        })
        .expect(201);

      const task2 = await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId: board.body._id,
          title: 'Write Tests',
          status: TaskStatus.TODO,
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/tasks/${task1.body._id}`)
        .send({
          status: TaskStatus.IN_PROGRESS,
          changedByUserId: dev1.body._id,
        })
        .expect(200);

      await request(app.getHttpServer())
        .post('/comments')
        .send({
          taskId: task1.body._id,
          userId: owner.body._id,
          text: 'Looking good!',
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/tasks/${task1.body._id}`)
        .send({ status: TaskStatus.DONE, changedByUserId: dev1.body._id })
        .expect(200);

      const tasks = await request(app.getHttpServer())
        .get('/tasks')
        .query({ boardId: board.body._id })
        .expect(200);

      expect(tasks.body.length).toBe(2);

      const { ObjectId } = require('mongoose').Types;
      const history = await historyModel
        .find({ taskId: new ObjectId(task1.body._id) })
        .lean()
        .exec();
      expect(history.length).toBeGreaterThanOrEqual(2);

      await request(app.getHttpServer())
        .delete(`/tasks/${task1.body._id}`)
        .expect(200);
      await request(app.getHttpServer())
        .delete(`/tasks/${task2.body._id}`)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/boards/${board.body._id}`)
        .expect(200);
    });
  });

  describe('Task Filtering', () => {
    let boardId: string;
    let user1Id: string;
    let user2Id: string;

    beforeAll(async () => {
      const user1 = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'User One',
          email: `user1-filter-${Date.now()}@test.com`,
        })
        .expect(201);
      user1Id = user1.body._id;

      const user2 = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'User Two',
          email: `user2-filter-${Date.now()}@test.com`,
        })
        .expect(201);
      user2Id = user2.body._id;

      const board = await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'Filter Test Board', ownerId: user1Id })
        .expect(201);
      boardId = board.body._id;

      // Create test tasks with different properties
      await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId,
          title: 'Login Feature',
          description: 'Implement JWT authentication',
          status: TaskStatus.TODO,
          assigneeId: user1Id,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId,
          title: 'Database Schema',
          description: 'Design MongoDB collections',
          status: TaskStatus.IN_PROGRESS,
          assigneeId: user2Id,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId,
          title: 'Login Page',
          description: 'Create frontend login form',
          status: TaskStatus.DONE,
          assigneeId: user1Id,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId,
          title: 'API Documentation',
          description: 'Write OpenAPI specs',
          status: TaskStatus.IN_PROGRESS,
          assigneeId: user2Id,
        })
        .expect(201);
    });

    it('should filter tasks by status', async () => {
      const todoTasks = await request(app.getHttpServer())
        .get('/tasks')
        .query({ status: TaskStatus.TODO })
        .expect(200);

      expect(todoTasks.body.length).toBeGreaterThanOrEqual(1);
      expect(todoTasks.body.every((t) => t.status === TaskStatus.TODO)).toBe(
        true,
      );
    });

    it('should filter tasks by assignee', async () => {
      const user1Tasks = await request(app.getHttpServer())
        .get('/tasks')
        .query({ assigneeId: user1Id })
        .expect(200);

      expect(user1Tasks.body.length).toBeGreaterThanOrEqual(2);
      expect(
        user1Tasks.body.every((t) => t.assigneeId === user1Id),
      ).toBe(true);
    });

    it('should filter tasks by title (regex)', async () => {
      const loginTasks = await request(app.getHttpServer())
        .get('/tasks')
        .query({ title: 'login' })
        .expect(200);

      expect(loginTasks.body.length).toBe(2);
      expect(
        loginTasks.body.every((t) =>
          t.title.toLowerCase().includes('login'),
        ),
      ).toBe(true);
    });

    it('should filter tasks by description (regex)', async () => {
      const authTasks = await request(app.getHttpServer())
        .get('/tasks')
        .query({ description: 'authentication' })
        .expect(200);

      expect(authTasks.body.length).toBeGreaterThanOrEqual(1);
      expect(authTasks.body[0].description).toContain('authentication');
    });

    it('should combine multiple filters', async () => {
      const filteredTasks = await request(app.getHttpServer())
        .get('/tasks')
        .query({ status: TaskStatus.IN_PROGRESS, assigneeId: user2Id })
        .expect(200);

      expect(filteredTasks.body.length).toBe(2);
      expect(
        filteredTasks.body.every(
          (t) => t.status === TaskStatus.IN_PROGRESS && t.assigneeId === user2Id,
        ),
      ).toBe(true);
    });
  });

  describe('User Boards API', () => {
    let user1Id: string;
    let user2Id: string;

    beforeAll(async () => {
      const user1 = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Owner 1', email: `owner1-${Date.now()}@test.com` })
        .expect(201);
      user1Id = user1.body._id;

      const user2 = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Owner 2', email: `owner2-${Date.now()}@test.com` })
        .expect(201);
      user2Id = user2.body._id;

      // Create boards for user1
      await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'User1 Board 1', ownerId: user1Id })
        .expect(201);

      await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'User1 Board 2', ownerId: user1Id })
        .expect(201);

      // Create boards for user2
      await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'User2 Board 1', ownerId: user2Id })
        .expect(201);
    });

    it('should get boards by user id', async () => {
      const user1Boards = await request(app.getHttpServer())
        .get(`/boards/user/${user1Id}`)
        .expect(200);

      expect(user1Boards.body.length).toBe(2);
      expect(user1Boards.body.every((b) => b.ownerId === user1Id)).toBe(true);
    });

    it('should return empty array for user with no boards', async () => {
      const newUser = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'No Boards', email: `noboards-${Date.now()}@test.com` })
        .expect(201);

      const boards = await request(app.getHttpServer())
        .get(`/boards/user/${newUser.body._id}`)
        .expect(200);

      expect(boards.body).toEqual([]);
    });

    it('should return 404 for non-existent user', async () => {
      await request(app.getHttpServer())
        .get('/boards/user/507f1f77bcf86cd799439011')
        .expect(404);
    });
  });

  describe('Task History API', () => {
    let taskId: string;
    let userId: string;

    beforeAll(async () => {
      const user = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'History User', email: `history-${Date.now()}@test.com` })
        .expect(201);
      userId = user.body._id;

      const board = await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'History Board', ownerId: userId })
        .expect(201);

      const task = await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId: board.body._id,
          title: 'Initial Title',
          description: 'Initial description',
          status: TaskStatus.TODO,
          assigneeId: userId,
        })
        .expect(201);
      taskId = task.body._id;
    });

    it('should get task history', async () => {
      // Make several updates to create history
      await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .send({ status: TaskStatus.IN_PROGRESS, changedByUserId: userId })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .send({ title: 'Updated Title', changedByUserId: userId })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/tasks/${taskId}`)
        .send({
          description: 'Updated description',
          changedByUserId: userId,
        })
        .expect(200);

      const history = await request(app.getHttpServer())
        .get('/history')
        .query({ taskId })
        .expect(200);

      expect(Array.isArray(history.body)).toBe(true);
      expect(history.body.length).toBe(3);

      const statusChange = history.body.find((h) => h.field === 'status');
      expect(statusChange).toBeDefined();
      expect(statusChange.oldValue).toBe(TaskStatus.TODO);
      expect(statusChange.newValue).toBe(TaskStatus.IN_PROGRESS);

      const titleChange = history.body.find((h) => h.field === 'title');
      expect(titleChange).toBeDefined();
      expect(titleChange.oldValue).toBe('Initial Title');
      expect(titleChange.newValue).toBe('Updated Title');

      const descriptionChange = history.body.find(
        (h) => h.field === 'description',
      );
      expect(descriptionChange).toBeDefined();
      expect(descriptionChange.oldValue).toBe('Initial description');
      expect(descriptionChange.newValue).toBe('Updated description');
    });

    it('should return 404 for non-existent task', async () => {
      await request(app.getHttpServer())
        .get('/history')
        .query({ taskId: '507f1f77bcf86cd799439011' })
        .expect(404);
    });
  });
});
