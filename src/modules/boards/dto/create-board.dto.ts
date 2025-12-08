import { IsString, IsMongoId, IsOptional, IsArray } from 'class-validator';

export class CreateBoardDto {
  @IsString()
  name: string;

  @IsMongoId()
  ownerId: string;
}
