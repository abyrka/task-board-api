import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import request from 'supertest';
import { createTestApp, closeTestApp } from './setup';
import { CacheService } from '../../src/shared/cache.service';
import { TaskHistoryLog } from '../../src/modules/history/schemas/task-history-log.schema';
import { TaskStatus } from '../../src/shared/constants/task-status.constants';

describe('Tasks (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let cacheService: CacheService;
  let historyModel: Model<TaskHistoryLog>;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    mongod = testApp.mongod;

    cacheService = app.get(CacheService);
    historyModel = testApp.moduleFixture.get<Model<TaskHistoryLog>>(
      getModelToken(TaskHistoryLog.name),
    );
  }, 30000);

  afterAll(async () => {
    await closeTestApp(app, mongod);
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
        .send({ status: TaskStatus.DONE, changedByUserId: user1Id })
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
      const beforeCache = await cacheService.get(cacheKey);
      expect(beforeCache).toBeDefined();

      await request(app.getHttpServer()).delete(`/tasks/${taskId}`).expect(200);

      const afterCache = await cacheService.get(cacheKey);
      expect(afterCache).toBeNull();
    });

    it('should prevent board deletion when tasks exist', async () => {
      const userRes = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Owner', email: `owner-${Date.now()}@test.com` })
        .expect(201);

      const boardRes = await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'Board With Tasks', ownerId: userRes.body._id })
        .expect(201);
      const newBoardId = boardRes.body._id;

      await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId: newBoardId,
          title: 'Blocking Task',
          status: TaskStatus.TODO,
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/boards/${newBoardId}`)
        .expect(400);
    });
  });

  describe('Task Filtering', () => {
    let boardId: string;
    let assignee1Id: string;
    let assignee2Id: string;

    beforeAll(async () => {
      const owner = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'Filter Owner',
          email: `filterowner-${Date.now()}@test.com`,
        })
        .expect(201);

      const board = await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'Filter Board', ownerId: owner.body._id })
        .expect(201);
      boardId = board.body._id;

      const assignee1 = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Assignee1', email: `assignee1-${Date.now()}@test.com` })
        .expect(201);
      assignee1Id = assignee1.body._id;

      const assignee2 = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Assignee2', email: `assignee2-${Date.now()}@test.com` })
        .expect(201);
      assignee2Id = assignee2.body._id;

      await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId,
          title: 'Backend API',
          description: 'Build REST API',
          status: TaskStatus.IN_PROGRESS,
          assigneeId: assignee1Id,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId,
          title: 'Frontend UI',
          description: 'Design user interface',
          status: TaskStatus.TODO,
          assigneeId: assignee2Id,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId,
          title: 'Database Schema',
          description: 'Design MongoDB schema',
          status: TaskStatus.DONE,
          assigneeId: assignee1Id,
        })
        .expect(201);
    });

    it('should filter tasks by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/tasks')
        .query({ status: TaskStatus.TODO })
        .expect(200);

      expect(res.body.every((t) => t.status === TaskStatus.TODO)).toBe(true);
    });

    it('should filter tasks by assignee', async () => {
      const res = await request(app.getHttpServer())
        .get('/tasks')
        .query({ assigneeId: assignee1Id })
        .expect(200);

      expect(res.body.every((t) => t.assigneeId === assignee1Id)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter tasks by title (regex)', async () => {
      const res = await request(app.getHttpServer())
        .get('/tasks')
        .query({ title: 'API' })
        .expect(200);

      expect(res.body.some((t) => t.title.includes('API'))).toBe(true);
    });

    it('should filter tasks by description (regex)', async () => {
      const res = await request(app.getHttpServer())
        .get('/tasks')
        .query({ description: 'MongoDB' })
        .expect(200);

      expect(res.body.some((t) => t.description?.includes('MongoDB'))).toBe(
        true,
      );
    });

    it('should combine multiple filters', async () => {
      const res = await request(app.getHttpServer())
        .get('/tasks')
        .query({
          status: TaskStatus.IN_PROGRESS,
          assigneeId: assignee1Id,
        })
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.every(
          (t) =>
            t.status === TaskStatus.IN_PROGRESS && t.assigneeId === assignee1Id,
        ),
      ).toBe(true);
    });
  });
});
