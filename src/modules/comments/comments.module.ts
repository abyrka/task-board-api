import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TaskComment, TaskCommentSchema } from './schemas/task-comment.schema';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { Task, TaskSchema } from '../tasks/schemas/task.schema';
import { RedisModule } from '../../shared/redis.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TaskComment.name, schema: TaskCommentSchema },
      { name: Task.name, schema: TaskSchema },
    ]),
    RedisModule,
  ],
  providers: [CommentsService],
  controllers: [CommentsController],
  exports: [MongooseModule, CommentsService],
})
export class CommentsModule {}
