import { IsMongoId, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ example: 'guid', description: 'Task ID to comment on' })
  @IsMongoId()
  taskId: string;

  @ApiProperty({
    example: 'guid',
    description: 'User ID who created the comment',
  })
  @IsMongoId()
  userId: string;

  @ApiProperty({
    example: 'Great progress on this task!',
    description: 'Comment text',
  })
  @IsString()
  text: string;
}
