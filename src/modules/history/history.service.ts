import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  TaskHistoryLog,
  TaskHistoryLogDocument,
} from './schemas/task-history-log.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { Board, BoardDocument } from '../boards/schemas/board.schema';

@Injectable()
export class HistoryService {
  constructor(
    @InjectModel(TaskHistoryLog.name)
    private historyModel: Model<TaskHistoryLogDocument>,
    @InjectModel(Task.name)
    private taskModel: Model<TaskDocument>,
    @InjectModel(Board.name)
    private boardModel: Model<BoardDocument>,
  ) {}

  async findByTask(taskId: string) {
    const task = await this.taskModel.findById(taskId).exec();
    if (!task) throw new NotFoundException('Task not found');

    return this.historyModel
      .find({ taskId: new Types.ObjectId(taskId) })
      .sort({ createdAt: 1 })
      .exec();
  }

  async findByUserBoards(userId: string) {
    const boards = await this.boardModel.find({ ownerId: userId }).exec();

    if (boards.length === 0) return [];

    const boardIds = boards.map((b) => b._id.toString());

    const tasks = await this.taskModel
      .find({ boardId: { $in: boardIds } })
      .exec();

    if (tasks.length === 0) return [];

    const taskIds = tasks.map((t) => new Types.ObjectId(t._id.toString()));

    return this.historyModel
      .find({ taskId: { $in: taskIds } })
      .sort({ createdAt: -1 })
      .exec();
  }
}
