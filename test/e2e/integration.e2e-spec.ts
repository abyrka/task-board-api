import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CacheService } from '../../src/common/cache.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TaskHistoryLog } from '../../src/history/schemas/task-history-log.schema';
import { MongoMemoryServer } from 'mongodb-memory-server';

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

    // create assignee
    const assigneeRes = await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'Assignee', email: `assignee-${Date.now()}@test.local` })
      .expect(201);
    const assigneeId = assigneeRes.body._id;

    // create board
    const boardRes = await request(app.getHttpServer())
      .post('/boards')
      .send({ name: 'Test Board', ownerId })
      .expect(201);
    const boardId = boardRes.body._id;

    // create task
    const taskRes = await request(app.getHttpServer())
      .post('/tasks')
      .send({ boardId, title: 'T1', status: 'todo', assigneeId })
      .expect(201);
    const taskId = taskRes.body._id;

    // first fetch (populates cache)
    const first = await request(app.getHttpServer())
      .get('/tasks')
      .query({ boardId })
      .expect(200);
    expect(Array.isArray(first.body)).toBeTruthy();

    // ensure cache key exists
    const cached = await cacheService.get<any[]>(`board:${boardId}:tasks`);
    expect(Array.isArray(cached)).toBeTruthy();

    // deleting board should fail while tasks exist
    await request(app.getHttpServer()).delete(`/boards/${boardId}`).expect(400);

    // update task status -> creates history
    const updatedRes = await request(app.getHttpServer())
      .patch(`/tasks/${taskId}`)
      .send({ status: 'in-progress', changedByUserId: ownerId })
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
});
