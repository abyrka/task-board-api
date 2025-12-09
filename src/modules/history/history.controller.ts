import { Controller, Get, Query, Param, Header } from '@nestjs/common';
import { HistoryService } from './history.service';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  findByTask(@Query('taskId') taskId: string) {
    return this.historyService.findByTask(taskId);
  }

  @Get('user/:userId')
  findByUserBoards(@Param('userId') userId: string) {
    return this.historyService.findByUserBoards(userId);
  }
}
