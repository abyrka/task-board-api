import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  TaskHistoryLog,
  TaskHistoryLogDocument,
} from './schemas/task-history-log.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';

@Injectable()
export class HistoryService {
  constructor(
    @InjectModel(TaskHistoryLog.name)
    private historyModel: Model<TaskHistoryLogDocument>,
    @InjectModel(Task.name)
    private taskModel: Model<TaskDocument>,
  ) {}

  async findByTask(taskId: string) {
    const task = await this.taskModel.findById(taskId).exec();
    if (!task) throw new NotFoundException('Task not found');

    return this.historyModel
      .find({ taskId: new Types.ObjectId(taskId) })
      .sort({ createdAt: 1 })
      .exec();
  }
}
