import { IsString, IsMongoId, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '../../../shared/constants/task-status.constants';

export class CreateTaskDto {
  @ApiProperty({ example: 'guid', description: 'Board ID' })
  @IsMongoId()
  boardId: string;

  @ApiProperty({
    example: 'Implement login feature',
    description: 'Task title',
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    example: 'Add OAuth2 authentication',
    description: 'Task description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'guid', description: 'Assignee user ID' })
  @IsOptional()
  @IsMongoId()
  assigneeId?: string;

  @ApiPropertyOptional({
    example: 'todo',
    enum: TaskStatus,
    description: 'Task status',
  })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}
