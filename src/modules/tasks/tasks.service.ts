import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Task, TaskDocument } from './schemas/task.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import {
  TaskHistoryLog,
  TaskHistoryLogDocument,
} from '../history/schemas/task-history-log.schema';
import { Board, BoardDocument } from '../boards/schemas/board.schema';
import { CacheService } from '../../shared/cache.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(TaskHistoryLog.name)
    private historyModel: Model<TaskHistoryLogDocument>,
    @InjectModel(Board.name) private boardModel: Model<BoardDocument>,
    private cacheService: CacheService,
  ) {}

  async create(createTaskDto: CreateTaskDto) {
    const board = await this.boardModel.findById(createTaskDto.boardId).exec();
    if (!board) {
      throw new NotFoundException('Board not found');
    }

    const created = new this.taskModel(createTaskDto);
    const saved = await created.save();
    await this.cacheService.del(`board:${createTaskDto.boardId}:tasks`);
    return saved;
  }

  findAll() {
    return this.taskModel.find().exec();
  }

  async findFiltered(filters: {
    boardId?: string;
    status?: string;
    title?: string;
    description?: string;
    assigneeId?: string;
  }) {
    const query: any = {};
    if (filters.boardId) query.boardId = filters.boardId;
    if (filters.status) query.status = filters.status;
    if (filters.title) query.title = { $regex: filters.title, $options: 'i' };
    if (filters.description)
      query.description = { $regex: filters.description, $options: 'i' };
    if (filters.assigneeId) query.assigneeId = filters.assigneeId;
    return this.taskModel.find(query).exec();
  }

  async findByBoard(boardId: string) {
    const key = `board:${boardId}:tasks`;
    const cached = await this.cacheService.get<any[]>(key);
    if (cached) return cached;

    const tasks = await this.taskModel.find({ boardId }).lean().exec();
    await this.cacheService.set(key, tasks, 60);
    return tasks;
  }

  async findOne(id: string) {
    const t = await this.taskModel.findById(id).exec();
    if (!t) throw new NotFoundException('Task not found');
    return t;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto) {
    const task = await this.taskModel.findById(id).exec();
    if (!task) throw new NotFoundException('Task not found');

    const mutable = updateTaskDto as any;
    const historyEntries: Partial<TaskHistoryLog>[] = [];
    const allowedFields = [
      'title',
      'description',
      'status',
      'assigneeId',
      'boardId',
    ];
    for (const key of allowedFields) {
      if (key === 'changedByUserId') continue;
      if (!(key in mutable)) continue;
      const oldVal = (task as any)[key];
      const newVal = mutable[key];
      if (
        (oldVal === undefined && newVal !== undefined) ||
        (oldVal !== undefined && String(oldVal) !== String(newVal))
      ) {
        historyEntries.push({
          taskId: task._id,
          field: key,
          oldValue: oldVal !== undefined ? String(oldVal) : undefined,
          newValue: newVal !== undefined ? String(newVal) : undefined,
          changedByUserId: mutable.changedByUserId,
        });
      }
    }

    const updated = await this.taskModel
      .findByIdAndUpdate(id, updateTaskDto, { new: true })
      .exec();

    if (historyEntries.length) {
      await this.historyModel.insertMany(
        historyEntries.map((h) => ({ ...h, taskId: h.taskId })),
      );
    }

    const oldBoardId = String(task.boardId);
    const newBoardId = updateTaskDto['boardId']
      ? String(updateTaskDto['boardId'])
      : oldBoardId;
    const keysToInvalidate = [
      `board:${oldBoardId}:tasks`,
      `task:${id}:comments`,
    ];
    if (newBoardId !== oldBoardId) {
      keysToInvalidate.push(`board:${newBoardId}:tasks`);
    }
    await this.cacheService.del(...keysToInvalidate);

    return updated;
  }

  async remove(id: string) {
    const task = await this.taskModel.findById(id).exec();
    if (!task) return null;
    const boardId = String(task.boardId);
    const removed = await this.taskModel.findByIdAndDelete(id).exec();
    await this.cacheService.del(
      `board:${boardId}:tasks`,
      `task:${id}:comments`,
    );
    return removed;
  }
}
