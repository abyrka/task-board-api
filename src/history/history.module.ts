import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TaskHistoryLog,
  TaskHistoryLogSchema,
} from './schemas/task-history-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TaskHistoryLog.name, schema: TaskHistoryLogSchema },
    ]),
  ],
  providers: [],
  controllers: [],
  exports: [MongooseModule],
})
export class HistoryModule {}
