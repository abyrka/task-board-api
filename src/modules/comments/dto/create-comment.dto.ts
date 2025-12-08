import { IsMongoId, IsString } from 'class-validator';

export class CreateCommentDto {
  @IsMongoId()
  taskId: string;

  @IsMongoId()
  userId: string;

  @IsString()
  text: string;
}
