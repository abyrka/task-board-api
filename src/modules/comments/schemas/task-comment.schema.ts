import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MODEL_NAMES } from '../../../shared/constants/model-names.constants';

export type TaskCommentDocument = HydratedDocument<TaskComment>;

@Schema({ timestamps: true })
export class TaskComment {
  @Prop({ type: Types.ObjectId, ref: MODEL_NAMES.TASK, required: true, index: true })
  taskId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: MODEL_NAMES.USER, required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  text: string;
}

export const TaskCommentSchema = SchemaFactory.createForClass(TaskComment);
