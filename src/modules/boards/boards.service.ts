import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Board, BoardDocument } from './schemas/board.schema';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class BoardsService {
  constructor(
    @InjectModel(Board.name) private boardModel: Model<BoardDocument>,
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(createBoardDto: CreateBoardDto) {
    const owner = await this.userModel.findById(createBoardDto.ownerId).exec();
    if (!owner) throw new NotFoundException('Owner user not found');

    const created = new this.boardModel(createBoardDto);
    return created.save();
  }

  findAll() {
    return this.boardModel.find().exec();
  }

  async findByUser(userId: string) {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('User not found');

    return this.boardModel.find({ ownerId: userId }).exec();
  }

  async findOne(id: string) {
    const board = await this.boardModel.findById(id).exec();
    if (!board) throw new NotFoundException('Board not found');
    return board;
  }

  async update(id: string, updateBoardDto: UpdateBoardDto) {
    const board = await this.boardModel.findById(id).exec();
    if (!board) throw new NotFoundException('Board not found');

    if (updateBoardDto.ownerId) {
      const newOwner = await this.userModel
        .findById(updateBoardDto.ownerId)
        .exec();
      if (!newOwner) throw new NotFoundException('New owner user not found');
    }

    return this.boardModel
      .findByIdAndUpdate(id, updateBoardDto, { new: true })
      .exec();
  }

  async remove(id: string) {
    const board = await this.boardModel.findById(id).exec();
    if (!board) throw new NotFoundException('Board not found');

    const taskCount = await this.taskModel
      .countDocuments({ boardId: id })
      .exec();
    if (taskCount > 0) {
      throw new BadRequestException(
        `Cannot delete board with ${taskCount} task(s). Delete all tasks first.`,
      );
    }

    return this.boardModel.findByIdAndDelete(id).exec();
  }
}
