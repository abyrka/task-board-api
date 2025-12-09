import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createTestApp, closeTestApp } from './setup';

describe('Boards (e2e)', () => {
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
        .send({ name: 'Invalid Board', ownerId: '507f1f77bcf86cd799439011' })
        .expect(404);
    });

    it('should get all boards and cache them', async () => {
      const res = await request(app.getHttpServer()).get('/boards').expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should update a board', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'Original Board', ownerId })
        .expect(201);

      const boardId = createRes.body._id;

      const updateRes = await request(app.getHttpServer())
        .patch(`/boards/${boardId}`)
        .send({ name: 'Updated Board' })
        .expect(200);

      expect(updateRes.body.name).toBe('Updated Board');
    });

    it('should invalidate boards cache on create', async () => {
      const beforeRes = await request(app.getHttpServer())
        .get('/boards')
        .expect(200);
      const beforeCount = beforeRes.body.length;

      await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'New Board', ownerId })
        .expect(201);

      const afterRes = await request(app.getHttpServer())
        .get('/boards')
        .expect(200);

      expect(afterRes.body.length).toBe(beforeCount + 1);
    });
  });

  describe('User Boards API', () => {
    it('should get boards by user id', async () => {
      const user = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'User 1', email: `user1-${Date.now()}@test.com` })
        .expect(201);
      const user1Id = user.body._id;

      await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'User 1 Board 1', ownerId: user1Id })
        .expect(201);

      await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'User 1 Board 2', ownerId: user1Id })
        .expect(201);

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

  describe('Board Members Management', () => {
    let ownerId: string;
    let member1Id: string;
    let member2Id: string;
    let member3Id: string;

    beforeAll(async () => {
      const owner = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Owner', email: `owner-${Date.now()}@test.com` })
        .expect(201);
      ownerId = owner.body._id;

      const member1 = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Member 1', email: `member1-${Date.now()}@test.com` })
        .expect(201);
      member1Id = member1.body._id;

      const member2 = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Member 2', email: `member2-${Date.now()}@test.com` })
        .expect(201);
      member2Id = member2.body._id;

      const member3 = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Member 3', email: `member3-${Date.now()}@test.com` })
        .expect(201);
      member3Id = member3.body._id;
    });

    it('should create board with members', async () => {
      const res = await request(app.getHttpServer())
        .post('/boards')
        .send({
          name: 'Team Board',
          ownerId,
          memberIds: [member1Id, member2Id],
        })
        .expect(201);

      expect(res.body.memberIds).toEqual([member1Id, member2Id]);
    });

    it('should fail to create board with non-existent member', async () => {
      await request(app.getHttpServer())
        .post('/boards')
        .send({
          name: 'Invalid Board',
          ownerId,
          memberIds: ['507f1f77bcf86cd799439011'],
        })
        .expect(404);
    });

    it('should update board members', async () => {
      const board = await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'Board to Update', ownerId })
        .expect(201);

      const updateRes = await request(app.getHttpServer())
        .patch(`/boards/${board.body._id}/members`)
        .send({ memberIds: [member1Id, member2Id, member3Id] })
        .expect(200);

      expect(updateRes.body.memberIds).toEqual([
        member1Id,
        member2Id,
        member3Id,
      ]);
    });

    it('should replace members when updating', async () => {
      const board = await request(app.getHttpServer())
        .post('/boards')
        .send({
          name: 'Board with Initial Members',
          ownerId,
          memberIds: [member1Id, member2Id],
        })
        .expect(201);

      const updateRes = await request(app.getHttpServer())
        .patch(`/boards/${board.body._id}/members`)
        .send({ memberIds: [member3Id] })
        .expect(200);

      expect(updateRes.body.memberIds).toEqual([member3Id]);
    });

    it('should clear members with empty array', async () => {
      const board = await request(app.getHttpServer())
        .post('/boards')
        .send({
          name: 'Board to Clear',
          ownerId,
          memberIds: [member1Id, member2Id],
        })
        .expect(201);

      const updateRes = await request(app.getHttpServer())
        .patch(`/boards/${board.body._id}/members`)
        .send({ memberIds: [] })
        .expect(200);

      expect(updateRes.body.memberIds).toEqual([]);
    });

    it('should fail to update members with non-existent member', async () => {
      const board = await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'Board', ownerId })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/boards/${board.body._id}/members`)
        .send({ memberIds: ['507f1f77bcf86cd799439011'] })
        .expect(404);
    });

    it('should get boards where user is a member', async () => {
      const board1 = await request(app.getHttpServer())
        .post('/boards')
        .send({
          name: 'Board 1',
          ownerId,
          memberIds: [member1Id],
        })
        .expect(201);

      const board2 = await request(app.getHttpServer())
        .post('/boards')
        .send({
          name: 'Board 2',
          ownerId,
          memberIds: [member1Id, member2Id],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/boards')
        .send({
          name: 'Board 3',
          ownerId,
          memberIds: [member2Id],
        })
        .expect(201);

      const member1Boards = await request(app.getHttpServer())
        .get(`/boards/user/${member1Id}`)
        .expect(200);

      expect(member1Boards.body.length).toBeGreaterThanOrEqual(2);
      const boardIds = member1Boards.body.map((b) => b._id);
      expect(boardIds).toContain(board1.body._id);
      expect(boardIds).toContain(board2.body._id);
    });

    it('should get boards where user is owner or member', async () => {
      const ownedBoard = await request(app.getHttpServer())
        .post('/boards')
        .send({ name: 'Owned Board', ownerId: member1Id })
        .expect(201);

      const memberBoard = await request(app.getHttpServer())
        .post('/boards')
        .send({
          name: 'Member Board',
          ownerId,
          memberIds: [member1Id],
        })
        .expect(201);

      const userBoards = await request(app.getHttpServer())
        .get(`/boards/user/${member1Id}`)
        .expect(200);

      const boardIds = userBoards.body.map((b) => b._id);
      expect(boardIds).toContain(ownedBoard.body._id);
      expect(boardIds).toContain(memberBoard.body._id);
    });
  });
});
