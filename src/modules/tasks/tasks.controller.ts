import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  @ApiResponse({ status: 201, description: 'Task created successfully' })
  @ApiResponse({ status: 404, description: 'Board not found' })
  create(@Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tasks or filter by criteria (cached)' })
  @ApiQuery({
    name: 'boardId',
    required: false,
    description: 'Filter by board ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (todo, in-progress, done)',
  })
  @ApiQuery({
    name: 'title',
    required: false,
    description: 'Filter by title (regex search)',
  })
  @ApiQuery({
    name: 'description',
    required: false,
    description: 'Filter by description (regex search)',
  })
  @ApiQuery({
    name: 'assigneeId',
    required: false,
    description: 'Filter by assignee ID',
  })
  @ApiResponse({ status: 200, description: 'Returns tasks' })
  findAll(@Query() query: Record<string, string>) {
    const { boardId, status, title, description, assigneeId } = query;

    // If any filter is provided, use filtered search
    if (boardId || status || title || description || assigneeId) {
      return this.tasksService.findFiltered({
        boardId,
        status,
        title,
        description,
        assigneeId,
      });
    }
    return this.tasksService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  @ApiResponse({ status: 200, description: 'Returns the task' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update task (requires changedByUserId)' })
  @ApiResponse({
    status: 200,
    description: 'Task updated successfully, history logged',
  })
  @ApiResponse({ status: 404, description: 'Task not found' })
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete task (cascades to comments and history)' })
  @ApiResponse({ status: 200, description: 'Task deleted successfully' })
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}
