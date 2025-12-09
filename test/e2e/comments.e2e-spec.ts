import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createTestApp, closeTestApp } from './setup';
import { CacheService } from '../../src/shared/cache.service';

describe('Comments (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let cacheService: CacheService;

  beforeAll(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    mongod = testApp.mongod;
    cacheService = app.get(CacheService);
  }, 30000);

  afterAll(async () => {
    await closeTestApp(app, mongod);
  });

  describe('Comments CRUD and Caching', () => {
    let taskId: string;
    let userId: string;

    beforeAll(async () => {
      const userRes = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'Commenter',
          email: `commenter-${Date.now()}@test.com`,
        })
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
          title: 'Task for Comments',
          status: 'todo',
        })
        .expect(201);
      taskId = taskRes.body._id;
    });

    it('should create a comment', async () => {
      const res = await request(app.getHttpServer())
        .post('/comments')
        .send({ taskId, userId, text: 'Great work!' })
        .expect(201);

      expect(res.body).toHaveProperty('_id');
      expect(res.body.text).toBe('Great work!');
      expect(res.body.taskId).toBe(taskId);
    });

    it('should get comments for a task and cache them', async () => {
      const cacheKey = `task:${taskId}:comments`;
      await cacheService.del(cacheKey);

      const res = await request(app.getHttpServer())
        .get('/comments')
        .query({ taskId })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      const cached = await cacheService.get(cacheKey);
      expect(cached).toBeDefined();
    });

    it('should update a comment', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/comments')
        .send({ taskId, userId, text: 'Original Comment' })
        .expect(201);
      const commentId = createRes.body._id;

      const updateRes = await request(app.getHttpServer())
        .patch(`/comments/${commentId}`)
        .send({ text: 'Updated Comment' })
        .expect(200);

      expect(updateRes.body.text).toBe('Updated Comment');
    });

    it('should invalidate comment cache on create', async () => {
      const cacheKey = `task:${taskId}:comments`;
      await request(app.getHttpServer())
        .get('/comments')
        .query({ taskId })
        .expect(200);
      const beforeCache = await cacheService.get(cacheKey);
      expect(beforeCache).toBeDefined();

      await request(app.getHttpServer())
        .post('/comments')
        .send({ taskId, userId, text: 'Cache Invalidation Test' })
        .expect(201);

      const afterCache = await cacheService.get(cacheKey);
      expect(afterCache).toBeNull();
    });

    it('should delete a comment and invalidate cache', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/comments')
        .send({ taskId, userId, text: 'To Delete' })
        .expect(201);
      const commentId = createRes.body._id;

      const cacheKey = `task:${taskId}:comments`;
      await request(app.getHttpServer())
        .get('/comments')
        .query({ taskId })
        .expect(200);
      const beforeCache = await cacheService.get(cacheKey);
      expect(beforeCache).toBeDefined();

      await request(app.getHttpServer())
        .delete(`/comments/${commentId}`)
        .expect(200);

      const afterCache = await cacheService.get(cacheKey);
      expect(afterCache).toBeNull();
    });
  });
});
