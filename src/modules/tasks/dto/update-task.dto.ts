import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';
import { IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiProperty({
    example: 'guid',
    description: 'User ID who made the change (required for audit trail)',
  })
  @IsMongoId()
  changedByUserId: string;
}
