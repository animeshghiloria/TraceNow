import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CasesModule } from './cases/cases.module';
import { SightingsModule } from './sightings/sightings.module';
import { AlertsModule } from './alerts/alerts.module';
import { RealtimeModule } from './realtime/realtime.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StorageModule } from './storage/storage.module';
import { HealthModule } from './health/health.module';

import { User } from './users/user.entity';
import { Case } from './cases/case.entity';
import { Sighting } from './sightings/sighting.entity';
import { Alert } from './alerts/alert.entity';
import { Authority } from './users/authority.entity';

@Module({
  imports: [
    // ─── Config ──────────────────────────────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true }),

    // ─── Database ─────────────────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        url: cfg.get('DATABASE_URL'),
        entities: [User, Case, Sighting, Alert, Authority],
        synchronize: false,   // schema managed by init.sql
        ssl: cfg.get('NODE_ENV') === 'production'
          ? { rejectUnauthorized: false }
          : false,
      }),
    }),

    // ─── Rate limiting ────────────────────────────────────────────────────
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),

    // ─── Feature modules ──────────────────────────────────────────────────
    AuthModule,
    UsersModule,
    CasesModule,
    SightingsModule,
    AlertsModule,
    RealtimeModule,
    NotificationsModule,
    StorageModule,
    HealthModule,
  ],
})
export class AppModule {}
