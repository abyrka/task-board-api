import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { BoardsModule } from './boards/boards.module';
import { TasksModule } from './tasks/tasks.module';
import { CommentsModule } from './comments/comments.module';
import { HistoryModule } from './history/history.module';

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
    require('./common/redis.module').RedisModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
