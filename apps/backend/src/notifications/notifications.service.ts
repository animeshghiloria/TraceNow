import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface FcmMessage {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly cfg: ConfigService) {}

  /**
   * Send a multi-cast FCM push notification.
   * Silently ignores invalid tokens rather than throwing.
   */
  async sendMulticast(msg: FcmMessage): Promise<void> {
    if (!msg.tokens.length) return;
    if (admin.apps.length === 0) {
      this.logger.warn('Firebase not initialised — skipping FCM send.');
      return;
    }

    // FCM sendEachForMulticast accepts max 500 tokens per batch
    const batchSize = 500;
    for (let i = 0; i < msg.tokens.length; i += batchSize) {
      const batch = msg.tokens.slice(i, i + batchSize);
      const response = await admin.messaging().sendEachForMulticast({
        tokens: batch,
        notification: { title: msg.title, body: msg.body },
        data: msg.data ?? {},
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });

      const failed = response.responses.filter((r) => !r.success).length;
      this.logger.log(
        `FCM batch sent: ${response.successCount} ok, ${failed} failed`,
      );
    }
  }
}
