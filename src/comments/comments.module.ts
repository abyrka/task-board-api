import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TaskComment, TaskCommentSchema } from './schemas/task-comment.schema';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { Task, TaskSchema } from '../tasks/schemas/task.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TaskComment.name, schema: TaskCommentSchema },
      { name: Task.name, schema: TaskSchema },
    ]),
  ],
  providers: [CommentsService],
  controllers: [CommentsController],
  exports: [MongooseModule, CommentsService],
})
export class CommentsModule {}
