import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Sighting } from './sighting.entity';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsGateway } from '../realtime/events.gateway';
import { CasesService } from '../cases/cases.service';
import { CaseStatus } from '../cases/case.entity';

@Injectable()
export class SightingsService {
  private readonly logger = new Logger(SightingsService.name);
  private readonly aiUrl: string;
  private readonly threshold: number;

  constructor(
    @InjectRepository(Sighting) private readonly repo: Repository<Sighting>,
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    private readonly gateway: EventsGateway,
    private readonly casesService: CasesService,
    private readonly cfg: ConfigService,
  ) {
    this.aiUrl = cfg.get('AI_SERVICE_URL', 'http://ai-service:8000');
    this.threshold = parseFloat(cfg.get('CONFIDENCE_THRESHOLD', '0.75'));
  }

  async create(
    caseId: string,
    uploaderId: string,
    lat: number,
    lng: number,
    notes: string,
    imageBuffer?: Buffer,
    mimeType?: string,
  ): Promise<Sighting & { matchResult?: any }> {
    // 1. Upload image
    let imageUrl: string | null = null;
    if (imageBuffer) {
      imageUrl = await this.storage.uploadBuffer(imageBuffer, mimeType ?? 'image/jpeg', 'sightings');
    }

    // 2. Insert sighting with PostGIS location
    const [row] = await this.dataSource.query(
      `INSERT INTO sightings
         (case_id, uploader_id, location, image_url, notes)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5, $6)
       RETURNING id`,
      [caseId, uploaderId, lng, lat, imageUrl, notes ?? null],
    );

    const sighting = await this.repo.findOne({ where: { id: row.id } });

    // 3. Run AI match
    if (imageBuffer) {
      this.matchAndNotify(sighting, imageBuffer, mimeType).catch((err) =>
        this.logger.error(`AI match failed: ${err.message}`),
      );
    }

    // 4. Emit WebSocket event
    this.gateway.emitNewSighting(caseId, sighting);

    return sighting;
  }

  private async matchAndNotify(
    sighting: Sighting,
    imageBuffer: Buffer,
    mimeType = 'image/jpeg',
  ) {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('image', imageBuffer, { contentType: mimeType, filename: 'sighting.jpg' });
    form.append('top_k', '5');
    form.append('threshold', String(this.threshold));

    const { data } = await axios.post(
      `${this.aiUrl}/embeddings/match`,
      form,
      { headers: form.getHeaders(), timeout: 30_000 },
    );

    const best = data.best_match;
    if (!data.above_threshold || !best) {
      this.logger.log(`Sighting ${sighting.id} — no match above threshold`);
      return;
    }

    // Update sighting with confidence
    await this.repo.update(sighting.id, {
      confidence: best.confidence,
      caseId: best.case_id,
    });

    // Notify authorities via FCM
    const authorities = await this.dataSource.query(
      `SELECT u.fcm_token FROM users u
       JOIN authorities a ON a.user_id = u.id
       WHERE a.verified = true AND u.fcm_token IS NOT NULL`,
    );
    const tokens = authorities.map((a: any) => a.fcm_token);

    await this.notifications.sendMulticast({
      tokens,
      title: '🔍 High-Confidence Sighting Detected',
      body: `Match confidence: ${Math.round(best.confidence * 100)}%. Review immediately.`,
      data: { caseId: best.case_id, sightingId: sighting.id, type: 'SIGHTING_MATCH' },
    });

    // Update case status to investigating
    await this.casesService.updateStatus(best.case_id, CaseStatus.INVESTIGATING);

    this.logger.log(
      `Sighting match: case ${best.case_id} @ ${Math.round(best.confidence * 100)}% confidence`,
    );
  }

  async findByCaseId(caseId: string): Promise<Sighting[]> {
    return this.repo.find({
      where: { caseId },
      order: { createdAt: 'DESC' },
    });
  }
}
