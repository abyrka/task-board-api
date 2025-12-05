import { IsString, IsMongoId, IsOptional, IsIn } from 'class-validator';

export type TaskStatus = 'todo' | 'in-progress' | 'done';

export class CreateTaskDto {
  @IsMongoId()
  boardId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsIn(['todo', 'in-progress', 'done'])
  status?: TaskStatus;

  @IsOptional()
  @IsMongoId()
  assigneeId?: string;
}
