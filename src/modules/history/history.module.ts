import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TaskHistoryLog,
  TaskHistoryLogSchema,
} from './schemas/task-history-log.schema';
import { Task, TaskSchema } from '../tasks/schemas/task.schema';
import { HistoryController } from './history.controller';
import { HistoryService } from './history.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TaskHistoryLog.name, schema: TaskHistoryLogSchema },
      { name: Task.name, schema: TaskSchema },
    ]),
  ],
  providers: [HistoryService],
  controllers: [HistoryController],
  exports: [MongooseModule],
})
export class HistoryModule {}
