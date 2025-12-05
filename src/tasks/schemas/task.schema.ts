import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TaskDocument = HydratedDocument<Task>;

export type TaskStatus = 'todo' | 'in-progress' | 'done';

@Schema({ timestamps: true })
export class Task {
  @Prop({ type: Types.ObjectId, ref: 'Board', required: true, index: true })
  boardId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ default: 'todo' })
  status: TaskStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  assigneeId?: Types.ObjectId;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

// Pre-hook to clean up related comments and history logs when task is deleted
TaskSchema.pre('deleteOne', async function (next) {
  const taskId = this.getFilter()._id;
  if (taskId) {
    const commentModel = this.model.collection.conn.model('TaskComment');
    const historyModel = this.model.collection.conn.model('TaskHistoryLog');

    // delete comments for this task
    await commentModel.deleteMany({ taskId });

    // delete history logs for this task
    await historyModel.deleteMany({ taskId });
  }
  next();
});

TaskSchema.pre('findOneAndDelete', async function (next) {
  const taskId = this.getFilter()._id;
  if (taskId) {
    const commentModel = this.model.collection.conn.model('TaskComment');
    const historyModel = this.model.collection.conn.model('TaskHistoryLog');

    // delete comments for this task
    await commentModel.deleteMany({ taskId });

    // delete history logs for this task
    await historyModel.deleteMany({ taskId });
  }
  next();
});
