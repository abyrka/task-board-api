import { Controller, Get, Query, Param, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { HistoryService } from './history.service';

@ApiTags('history')
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  @ApiOperation({ summary: 'Get task history logs by task ID' })
  @ApiQuery({
    name: 'taskId',
    required: true,
    description: 'Task ID to get history for',
  })
  @ApiResponse({ status: 200, description: 'Returns task history logs' })
  findByTask(@Query('taskId') taskId: string) {
    return this.historyService.findByTask(taskId);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: "Get all history for tasks in user's boards" })
  @ApiResponse({
    status: 200,
    description: 'Returns aggregated history for user boards',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  findByUserBoards(@Param('userId') userId: string) {
    return this.historyService.findByUserBoards(userId);
  }
}
