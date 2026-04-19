import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from './alert.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsGateway } from '../realtime/events.gateway';

interface NearbyUser {
  user_id: string;
  fcm_token: string | null;
  distance: number;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(Alert) private readonly alertRepo: Repository<Alert>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
    private readonly gateway: EventsGateway,
  ) {}

  /**
   * Main alert distribution method.
   * 1. PostGIS radius query → find nearby users
   * 2. Filter already-notified users
   * 3. Bulk-insert alert records
   * 4. Send FCM batch notification
   * 5. Emit WebSocket event
   */
  async distributeAlert(
    caseId: string,
    lng: number,
    lat: number,
    radiusKm: number,
    caseData: any,
  ): Promise<number> {
    // Step 1: geo query
    const nearby: NearbyUser[] = await this.dataSource.query(
      `SELECT user_id, fcm_token, distance FROM users_within_radius($1, $2, $3)`,
      [lng, lat, radiusKm],
    );

    if (!nearby.length) {
      this.logger.log(`No nearby users found for case ${caseId}`);
      return 0;
    }

    // Step 2: filter already-notified (upsert with ON CONFLICT DO NOTHING)
    const values = nearby
      .map((u) => `('${caseId}', '${u.user_id}', 'both')`)
      .join(', ');

    await this.dataSource.query(
      `INSERT INTO alerts (case_id, user_id, channel)
       VALUES ${values}
       ON CONFLICT (case_id, user_id) DO NOTHING`,
    );

    // Step 3: FCM
    const tokens = nearby.map((u) => u.fcm_token).filter(Boolean) as string[];
    await this.notifications.sendMulticast({
      tokens,
      title: '🚨 Missing Child Alert Nearby',
      body: `${caseData.childName}, age ${caseData.childAge}, was last seen near you. Please help!`,
      data: { caseId, type: 'NEW_CASE' },
    });

    // Step 4: WebSocket
    this.gateway.emitNewCase(caseData);

    this.logger.log(`Alert sent to ${nearby.length} nearby users for case ${caseId}`);
    return nearby.length;
  }
}
