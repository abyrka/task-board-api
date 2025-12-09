import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createTestApp, closeTestApp } from './setup';
import { TaskStatus } from '../../src/shared/constants/task-status.constants';

describe('Validations (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    mongod = testApp.mongod;
  }, 30000);

  afterAll(async () => {
    await closeTestApp(app, mongod);
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

      const completedTask = tasks.body.find((t) => t._id === task1.body._id);
      expect(completedTask.status).toBe(TaskStatus.DONE);

      const comments = await request(app.getHttpServer())
        .get('/comments')
        .query({ taskId: task1.body._id })
        .expect(200);

      expect(comments.body.length).toBeGreaterThan(0);

      const history = await request(app.getHttpServer())
        .get('/history')
        .query({ taskId: task1.body._id })
        .expect(200);

      expect(history.body.length).toBeGreaterThan(0);
      const statusChanges = history.body.filter((h) => h.field === 'status');
      expect(statusChanges.length).toBeGreaterThanOrEqual(2);
    });
  });
});
