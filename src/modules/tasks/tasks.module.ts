import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskSchema } from './schemas/task.schema';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { HistoryModule } from '../history/history.module';
import { BoardsModule } from '../boards/boards.module';
import { RedisModule } from '../../shared/redis.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
    HistoryModule,
    BoardsModule,
    RedisModule,
  ],
  providers: [TasksService],
  controllers: [TasksController],
  exports: [MongooseModule, TasksService],
})
export class TasksModule {}
