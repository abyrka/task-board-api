import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskSchema } from './schemas/task.schema';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import {
  TaskHistoryLog,
  TaskHistoryLogSchema,
} from '../history/schemas/task-history-log.schema';
import { Board, BoardSchema } from '../boards/schemas/board.schema';
import { HistoryModule } from '../history/history.module';
import { BoardsModule } from '../boards/boards.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
    // import history and boards to have models available
    HistoryModule,
    BoardsModule,
  ],
  providers: [TasksService],
  controllers: [TasksController],
  exports: [MongooseModule, TasksService],
})
export class TasksModule {}
