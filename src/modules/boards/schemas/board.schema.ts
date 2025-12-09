import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types, Model } from 'mongoose';
import { MODEL_NAMES } from '../../../shared/constants/model-names.constants';

export type BoardDocument = HydratedDocument<Board>;

@Schema({ timestamps: true })
export class Board {
  @Prop({ required: true })
  name: string;

  @Prop({
    type: Types.ObjectId,
    ref: MODEL_NAMES.USER,
    required: true,
    index: true,
  })
  ownerId: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: MODEL_NAMES.USER }],
    default: [],
  })
  memberIds: Types.ObjectId[];
}

export const BoardSchema = SchemaFactory.createForClass(Board);

BoardSchema.pre('deleteOne', async function (next) {
  const boardId = this.getFilter()._id;
  if (boardId) {
    const taskModel = this.model.collection.conn.model(MODEL_NAMES.TASK);
    const taskCount = await taskModel.countDocuments({ boardId });
    if (taskCount > 0) {
      throw new Error(
        `Cannot delete board with ${taskCount} task(s). Delete all tasks first.`,
      );
    }
  }
  next();
});

BoardSchema.pre('findOneAndDelete', async function (next) {
  const boardId = this.getFilter()._id;
  if (boardId) {
    const taskModel = this.model.collection.conn.model(MODEL_NAMES.TASK);
    const taskCount = await taskModel.countDocuments({ boardId });
    if (taskCount > 0) {
      throw new Error(
        `Cannot delete board with ${taskCount} task(s). Delete all tasks first.`,
      );
    }
  }
  next();
});
