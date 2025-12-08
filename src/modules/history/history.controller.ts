import { Controller, Get, Query } from '@nestjs/common';
import { HistoryService } from './history.service';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  findByTask(@Query('taskId') taskId: string) {
    return this.historyService.findByTask(taskId);
  }
}
