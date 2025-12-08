import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { TaskStatus } from '../../../shared/constants/task-status.constants';
import { MODEL_NAMES } from '../../../shared/constants/model-names.constants';

export type TaskDocument = HydratedDocument<Task>;

@Schema({ timestamps: true })
export class Task {
  @Prop({
    type: Types.ObjectId,
    ref: MODEL_NAMES.BOARD,
    required: true,
    index: true,
  })
  boardId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ type: String, enum: TaskStatus, default: TaskStatus.TODO })
  status: TaskStatus;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

TaskSchema.index({ boardId: 1, status: 1 });

// Pre-hook to clean up related comments and history logs when task is deleted
TaskSchema.pre('deleteOne', async function (next) {
  const taskId = this.getFilter()._id;
  if (taskId) {
    const commentModel = this.model.collection.conn.model(
      MODEL_NAMES.TASK_COMMENT,
    );
    const historyModel = this.model.collection.conn.model(
      MODEL_NAMES.TASK_HISTORY_LOG,
    );

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
    const commentModel = this.model.collection.conn.model(
      MODEL_NAMES.TASK_COMMENT,
    );
    const historyModel = this.model.collection.conn.model(
      MODEL_NAMES.TASK_HISTORY_LOG,
    );

    // delete comments for this task
    await commentModel.deleteMany({ taskId });

    // delete history logs for this task
    await historyModel.deleteMany({ taskId });
  }
  next();
});
