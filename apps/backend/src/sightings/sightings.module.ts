import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Sighting } from './sighting.entity';
import { SightingsService } from './sightings.service';
import { SightingsController } from './sightings.controller';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CasesModule } from '../cases/cases.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sighting]),
    MulterModule.register({ storage: memoryStorage() }),
    StorageModule,
    NotificationsModule,
    RealtimeModule,
    CasesModule,
  ],
  providers: [SightingsService],
  controllers: [SightingsController],
})
export class SightingsModule {}
