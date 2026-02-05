import { Module } from '@nestjs/common';
import { FasController } from './fas.controller';
import { FasService } from './fas.service';

@Module({
  controllers: [FasController],
  providers: [FasService],
  exports: [FasService],
})
export class FasModule {}
