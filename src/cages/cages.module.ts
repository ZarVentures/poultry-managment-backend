import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CagesService } from './cages.service';
import { CagesController } from './cages.controller';
import { Cage } from './cage.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Cage])],
  controllers: [CagesController],
  providers: [CagesService],
  exports: [CagesService],
})
export class CagesModule {}
