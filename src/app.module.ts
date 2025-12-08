import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './modules/users/users.module';
import { BoardsModule } from './modules/boards/boards.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { CommentsModule } from './modules/comments/comments.module';
import { HistoryModule } from './modules/history/history.module';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/taskboard',
      {
        dbName: process.env.MONGODB_DB || 'taskboard',
      },
    ),
    UsersModule,
    BoardsModule,
    TasksModule,
    CommentsModule,
    HistoryModule,
    require('./shared/redis.module').RedisModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
