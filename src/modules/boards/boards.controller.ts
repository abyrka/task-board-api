import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';

@ApiTags('boards')
@Controller('boards')
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new board' })
  @ApiResponse({ status: 201, description: 'Board created successfully' })
  @ApiResponse({ status: 404, description: 'Owner user not found' })
  create(@Body() createBoardDto: CreateBoardDto) {
    return this.boardsService.create(createBoardDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all boards' })
  @ApiResponse({ status: 200, description: 'Returns all boards' })
  findAll() {
    return this.boardsService.findAll();
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get boards where user is owner or member' })
  @ApiResponse({ status: 200, description: 'Returns user boards' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findByUser(@Param('userId') userId: string) {
    return this.boardsService.findByUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get board by ID' })
  @ApiResponse({ status: 200, description: 'Returns the board' })
  @ApiResponse({ status: 404, description: 'Board not found' })
  findOne(@Param('id') id: string) {
    return this.boardsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update board' })
  @ApiResponse({ status: 200, description: 'Board updated successfully' })
  @ApiResponse({ status: 404, description: 'Board not found' })
  update(@Param('id') id: string, @Body() updateBoardDto: UpdateBoardDto) {
    return this.boardsService.update(id, updateBoardDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete board' })
  @ApiResponse({ status: 200, description: 'Board deleted successfully' })
  @ApiResponse({ status: 404, description: 'Board not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete board with tasks' })
  remove(@Param('id') id: string) {
    return this.boardsService.remove(id);
  }

  @Patch(':id/members')
  @ApiOperation({ summary: 'Update board members (owner only)' })
  @ApiResponse({ status: 200, description: 'Members updated successfully' })
  @ApiResponse({ status: 404, description: 'Board or member not found' })
  updateMembers(
    @Param('id') id: string,
    @Body() body: { memberIds: string[] },
  ) {
    return this.boardsService.updateMembers(id, body.memberIds);
  }
}
