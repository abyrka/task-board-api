import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MODEL_NAMES } from '../../../shared/constants/model-names.constants';

export type TaskHistoryLogDocument = HydratedDocument<TaskHistoryLog>;

@Schema({ timestamps: true })
export class TaskHistoryLog {
  @Prop({
    type: Types.ObjectId,
    ref: MODEL_NAMES.TASK,
    required: true,
    index: true,
  })
  taskId: Types.ObjectId;

  @Prop({ required: true })
  field: string;

  @Prop()
  oldValue?: string;

  @Prop()
  newValue?: string;

  @Prop({ type: Types.ObjectId, ref: MODEL_NAMES.USER, required: true })
  changedByUserId: Types.ObjectId;
}

export const TaskHistoryLogSchema =
  SchemaFactory.createForClass(TaskHistoryLog);
