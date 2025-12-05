import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, index: true })
  email: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Pre-hook to prevent deletion if user owns boards or has assigned tasks
UserSchema.pre('deleteOne', async function (next) {
  const userId = this.getFilter()._id;
  if (userId) {
    const boardModel = this.model.collection.conn.model('Board');
    const taskModel = this.model.collection.conn.model('Task');

    const ownedBoardCount = await boardModel.countDocuments({
      ownerId: userId,
    });
    if (ownedBoardCount > 0) {
      throw new Error(
        `Cannot delete user who owns ${ownedBoardCount} board(s).`,
      );
    }

    const assignedTaskCount = await taskModel.countDocuments({
      assigneeId: userId,
    });
    if (assignedTaskCount > 0) {
      throw new Error(
        `Cannot delete user with ${assignedTaskCount} assigned task(s).`,
      );
    }
  }
  next();
});

UserSchema.pre('findOneAndDelete', async function (next) {
  const userId = this.getFilter()._id;
  if (userId) {
    const boardModel = this.model.collection.conn.model('Board');
    const taskModel = this.model.collection.conn.model('Task');

    const ownedBoardCount = await boardModel.countDocuments({
      ownerId: userId,
    });
    if (ownedBoardCount > 0) {
      throw new Error(
        `Cannot delete user who owns ${ownedBoardCount} board(s).`,
      );
    }

    const assignedTaskCount = await taskModel.countDocuments({
      assigneeId: userId,
    });
    if (assignedTaskCount > 0) {
      throw new Error(
        `Cannot delete user with ${assignedTaskCount} assigned task(s).`,
      );
    }
  }
  next();
});
