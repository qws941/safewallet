import { Controller, Post, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { FasService } from './fas.service';
import { SyncWorkersDto } from './dto';

@Controller('fas')
export class FasController {
  constructor(private readonly fasService: FasService) {}

  @Post('workers/sync')
  @HttpCode(HttpStatus.OK)
  syncWorkers(@Body() dto: SyncWorkersDto) {
    return this.fasService.syncWorkers(dto);
  }

  @Delete('workers/:externalWorkerId')
  deleteWorker(@Param('externalWorkerId') externalWorkerId: string) {
    return this.fasService.deleteWorker(externalWorkerId);
  }
}
