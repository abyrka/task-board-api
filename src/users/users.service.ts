import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { Board, BoardDocument } from '../boards/schemas/board.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(Board.name) private boardModel: Model<BoardDocument>,
  ) {}

  async create(createDto: CreateUserDto) {
    // check if email already exists
    const existing = await this.userModel.findOne({ email: createDto.email }).exec();
    if (existing) {
      throw new BadRequestException('Email already in use');
    }

    const created = new this.userModel(createDto);
    return created.save();
  }

  findAll() {
    return this.userModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string) {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, updateDto: UpdateUserDto) {
    // if email is being updated, check uniqueness
    if (updateDto.email) {
      const existing = await this.userModel
        .findOne({ email: updateDto.email, _id: { $ne: id } })
        .exec();
      if (existing) {
        throw new BadRequestException('Email already in use');
      }
    }

    const updated = await this.userModel
      .findByIdAndUpdate(id, updateDto, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  async delete(id: string) {
    // validate user exists
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');

    // check if user owns any boards
    const ownedBoardCount = await this.boardModel
      .countDocuments({ ownerId: id })
      .exec();
    if (ownedBoardCount > 0) {
      throw new BadRequestException(
        `Cannot delete user who owns ${ownedBoardCount} board(s).`,
      );
    }

    // check if user has assigned tasks
    const assignedTaskCount = await this.taskModel
      .countDocuments({ assigneeId: id })
      .exec();
    if (assignedTaskCount > 0) {
      throw new BadRequestException(
        `Cannot delete user with ${assignedTaskCount} assigned task(s).`,
      );
    }

    return this.userModel.findByIdAndDelete(id).exec();
  }
}
