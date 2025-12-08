import { IsString, IsMongoId, IsOptional, IsEnum } from 'class-validator';
import { TaskStatus } from '../../../shared/constants/task-status.constants';

export class CreateTaskDto {
  @IsMongoId()
  boardId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}
