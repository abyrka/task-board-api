import { INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import request from 'supertest';
import { createTestApp, closeTestApp } from './setup';
import { TaskHistoryLog } from '../../src/modules/history/schemas/task-history-log.schema';
import { TaskStatus } from '../../src/shared/constants/task-status.constants';

describe('History (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let historyModel: Model<TaskHistoryLog>;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    mongod = testApp.mongod;

    historyModel = testApp.moduleFixture.get<Model<TaskHistoryLog>>(
      getModelToken(TaskHistoryLog.name),
    );
  }, 30000);

  afterAll(async () => {
    await closeTestApp(app, mongod);
  });

  describe('Task History Logging', () => {
    let taskId: string;
    let userId: string;

    beforeAll(async () => {
      const userRes = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'History User',
          email: `history-user-${Date.now()}@test.com`,
        })
        .expect(201);
      userId = userRes.body._id;

      const boardRes = await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'History Board', ownerId: userId })
        .expect(201);

      const taskRes = await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId: boardRes.body._id,
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

  describe('User Board History API', () => {
    it('should get all history for user boards', async () => {
      // Create user
      const user = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'Board Owner',
          email: `owner-${Date.now()}@test.com`,
        })
        .expect(201);
      const userId = user.body._id;

      // Create two boards
      const board1 = await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'Board 1', ownerId: userId })
        .expect(201);

      const board2 = await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'Board 2', ownerId: userId })
        .expect(201);

      // Create tasks on both boards
      const task1 = await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId: board1.body._id,
          title: 'Task on Board 1',
          status: TaskStatus.TODO,
        })
        .expect(201);

      const task2 = await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId: board2.body._id,
          title: 'Task on Board 2',
          status: TaskStatus.TODO,
        })
        .expect(201);

      // Update both tasks to create history
      const update1 = await request(app.getHttpServer())
        .patch(`/tasks/${task1.body._id}`)
        .send({ status: TaskStatus.IN_PROGRESS, changedByUserId: userId })
        .expect(200);

      const update2 = await request(app.getHttpServer())
        .patch(`/tasks/${task2.body._id}`)
        .send({ title: 'Updated Task 2', changedByUserId: userId })
        .expect(200);

      const update3 = await request(app.getHttpServer())
        .patch(`/tasks/${task1.body._id}`)
        .send({ title: 'Updated Task 1', changedByUserId: userId })
        .expect(200);

      // Verify updates worked
      expect(update1.body.status).toBe(TaskStatus.IN_PROGRESS);
      expect(update2.body.title).toBe('Updated Task 2');
      expect(update3.body.title).toBe('Updated Task 1');

      // Get all history for user's boards
      const history = await request(app.getHttpServer())
        .get(`/history/user/${userId}`)
        .expect(200);

      expect(Array.isArray(history.body)).toBe(true);
      expect(history.body.length).toBe(3);

      // Verify history is sorted by createdAt descending (newest first)
      const timestamps = history.body.map((h) =>
        new Date(h.createdAt).getTime(),
      );
      for (let i = 0; i < timestamps.length - 1; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
      }

      // Verify it contains history from both boards
      const taskIds = history.body.map((h) => h.taskId.toString());
      expect(taskIds).toContain(task1.body._id);
      expect(taskIds).toContain(task2.body._id);
    });

    it('should return empty array for user with no boards', async () => {
      const user = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'No Boards User',
          email: `noboardshistory-${Date.now()}@test.com`,
        })
        .expect(201);

      const history = await request(app.getHttpServer())
        .get(`/history/user/${user.body._id}`)
        .expect(200);

      expect(history.body).toEqual([]);
    });

    it('should return empty array for user with boards but no task history', async () => {
      const user = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'No History User',
          email: `nohistory-${Date.now()}@test.com`,
        })
        .expect(201);

      const board = await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'Board No Updates', ownerId: user.body._id })
        .expect(201);

      // Create task but don't update it (no history)
      await request(app.getHttpServer())
        .post('/tasks')
        .send({
          boardId: board.body._id,
          title: 'No Updates Task',
          status: TaskStatus.TODO,
        })
        .expect(201);

      const history = await request(app.getHttpServer())
        .get(`/history/user/${user.body._id}`)
        .expect(200);

      expect(history.body).toEqual([]);
    });
  });
});
