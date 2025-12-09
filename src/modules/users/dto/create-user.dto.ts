import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'Test User', description: 'User full name' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({
    example: 'testuser@gmail.com',
    description: 'User email address (must be unique)',
  })
  @IsEmail()
  email: string;
}
