import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TaskHistoryLogDocument = HydratedDocument<TaskHistoryLog>;

@Schema({ timestamps: true })
export class TaskHistoryLog {
  @Prop({ type: Types.ObjectId, ref: 'Task', required: true, index: true })
  taskId: Types.ObjectId;

  @Prop({ required: true })
  field: string; // e.g. "status", "title", "assigneeId"

  @Prop()
  oldValue?: string;

  @Prop()
  newValue?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  changedByUserId?: Types.ObjectId;
}

export const TaskHistoryLogSchema =
  SchemaFactory.createForClass(TaskHistoryLog);

TaskHistoryLogSchema.index({ taskId: 1, createdAt: 1 });
