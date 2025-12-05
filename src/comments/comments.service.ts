import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TaskComment, TaskCommentDocument } from './schemas/task-comment.schema';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { CacheService } from '../common/cache.service';

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(TaskComment.name)
    private commentModel: Model<TaskCommentDocument>,
    @InjectModel(Task.name)
    private taskModel: Model<TaskDocument>,
    private cacheService: CacheService,
  ) {}

  async create(createDto: CreateCommentDto) {
    // ensure task exists
    const task = await this.taskModel.findById(createDto.taskId).exec();
    if (!task) throw new NotFoundException('Task not found');

    const created = new this.commentModel(createDto);
    const saved = await created.save();

    // invalidate comment cache for the task
    await this.cacheService.del(`task:${createDto.taskId}:comments`);

    return saved;
  }

  findAll() {
    return this.commentModel.find().sort({ createdAt: 1 }).exec();
  }

  async findByTask(taskId: string) {
    const key = `task:${taskId}:comments`;
    const cached = await this.cacheService.get<any[]>(key);
    if (cached) return cached;

    const comments = await this.commentModel
      .find({ taskId })
      .sort({ createdAt: 1 })
      .lean()
      .exec();

    await this.cacheService.set(key, comments, 60);

    return comments;
  }

  async findOne(id: string) {
    const c = await this.commentModel.findById(id).exec();
    if (!c) throw new NotFoundException('Comment not found');
    return c;
  }

  async update(id: string, dto: UpdateCommentDto) {
    const updated = await this.commentModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Comment not found');

    // invalidate cache for the task
    await this.cacheService.del(`task:${String(updated.taskId)}:comments`);

    return updated;
  }

  async remove(id: string) {
    const c = await this.commentModel.findById(id).exec();
    if (!c) return null;
    const taskId = String(c.taskId);
    const removed = await this.commentModel.findByIdAndDelete(id).exec();
    await this.cacheService.del(`task:${taskId}:comments`);
    return removed;
  }
}
