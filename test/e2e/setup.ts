import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';

export async function createTestApp(): Promise<{
  app: INestApplication;
  mongod: MongoMemoryServer;
  moduleFixture: TestingModule;
}> {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  const dbName = uri.split('/').pop()?.split('?')[0] || 'test';
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB = dbName;

  const { AppModule } = require('../../src/app.module');

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe());
  await app.init();

  return { app, mongod, moduleFixture };
}

export async function closeTestApp(
  app: INestApplication,
  mongod: MongoMemoryServer,
): Promise<void> {
  if (app) await app.close();
  if (mongod) await mongod.stop();
}
