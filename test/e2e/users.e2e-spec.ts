import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createTestApp, closeTestApp } from './setup';

describe('Users (e2e)', () => {
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

  describe('User CRUD Operations', () => {
    it('should create a user with valid data', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'John Doe', email: `john-${Date.now()}@test.com` })
        .expect(201);

      expect(res.body).toHaveProperty('_id');
      expect(res.body.name).toBe('John Doe');
      expect(res.body.email).toContain('@test.com');
    });

    it('should fail to create user with invalid email', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Invalid User', email: 'not-an-email' })
        .expect(400);
    });

    it('should get all users', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Alice', email: `alice-${Date.now()}@test.com` })
        .expect(201);

      const res = await request(app.getHttpServer()).get('/users').expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should update a user', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/users')
        .send({
          name: 'Original Name',
          email: `original-${Date.now()}@test.com`,
        })
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
});
