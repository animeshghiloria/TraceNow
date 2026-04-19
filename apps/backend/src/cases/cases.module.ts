import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Case } from './case.entity';
import { CasesService } from './cases.service';
import { CasesController } from './cases.controller';
import { StorageModule } from '../storage/storage.module';
import { AlertsModule } from '../alerts/alerts.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Case]),
    MulterModule.register({ storage: memoryStorage() }),
    StorageModule,
    AlertsModule,
    RealtimeModule,
  ],
  providers: [CasesService],
  controllers: [CasesController],
  exports: [CasesService],
})
export class CasesModule {}
