import { IsString, IsMongoId, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBoardDto {
  @ApiProperty({ example: 'My Project Board', description: 'Board name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'guid', description: 'Owner user ID' })
  @IsMongoId()
  ownerId: string;

  @ApiPropertyOptional({
    example: ['guid', 'guid'],
    description: 'Board member user IDs',
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  memberIds?: string[];
}
