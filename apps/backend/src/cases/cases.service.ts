import {
  Injectable, NotFoundException, Logger, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { Case, CaseStatus } from './case.entity';
import { StorageService } from '../storage/storage.service';
import { AlertsService } from '../alerts/alerts.service';
import { EventsGateway } from '../realtime/events.gateway';

export interface CreateCaseDto {
  childName: string;
  childAge: number;
  description?: string;
  lastSeenAt: string;
  lat: number;
  lng: number;
  lastSeenAddr?: string;
  alertRadiusKm?: number;
}

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);
  private readonly aiServiceUrl: string;

  constructor(
    @InjectRepository(Case) private readonly repo: Repository<Case>,
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
    private readonly alerts: AlertsService,
    private readonly gateway: EventsGateway,
    private readonly cfg: ConfigService,
  ) {
    this.aiServiceUrl = cfg.get('AI_SERVICE_URL', 'http://ai-service:8000');
  }

  async create(
    reporterId: string,
    dto: CreateCaseDto,
    imageBuffer?: Buffer,
    mimeType?: string,
  ): Promise<Case> {
    // 1. Upload image
    let imageUrl: string | null = null;
    if (imageBuffer) {
      imageUrl = await this.storage.uploadBuffer(imageBuffer, mimeType || 'image/jpeg', 'cases');
    }

    // 2. Persist case using raw SQL for geography column
    const caseId: string = (
      await this.dataSource.query(
        `INSERT INTO cases
           (reporter_id, child_name, child_age, description, last_seen_at,
            last_seen_loc, last_seen_addr, image_url, alert_radius_km)
         VALUES ($1, $2, $3, $4, $5,
                 ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
                 $8, $9, $10)
         RETURNING id`,
        [
          reporterId,
          dto.childName,
          dto.childAge,
          dto.description ?? null,
          new Date(dto.lastSeenAt),
          dto.lng,
          dto.lat,
          dto.lastSeenAddr ?? null,
          imageUrl,
          dto.alertRadiusKm ?? 5,
        ],
      )
    )[0].id;

    const newCase = await this.repo.findOne({ where: { id: caseId } });

    // 3. Generate face embedding asynchronously
    if (imageBuffer) {
      this.generateAndStoreEmbedding(caseId, imageBuffer, mimeType)
        .catch((err) => this.logger.error(`Embedding generation failed: ${err.message}`));
    }

    // 4. Distribute alerts
    this.alerts
      .distributeAlert(caseId, dto.lng, dto.lat, dto.alertRadiusKm ?? 5, newCase)
      .catch((err) => this.logger.error(`Alert distribution failed: ${err.message}`));

    return newCase;
  }

  private async generateAndStoreEmbedding(
    caseId: string,
    imageBuffer: Buffer,
    mimeType = 'image/jpeg',
  ) {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('image', imageBuffer, { contentType: mimeType, filename: 'child.jpg' });
    form.append('case_id', caseId);
    form.append('embedding_type', 'case');

    const response = await axios.post(
      `${this.aiServiceUrl}/embeddings/store`,
      form,
      { headers: form.getHeaders(), timeout: 30_000 },
    );

    await this.repo.update(caseId, { embeddingId: response.data.embedding_id });
    this.logger.log(`Embedding stored for case ${caseId}`);
  }

  async findAll(status?: CaseStatus, limit = 50, offset = 0, q?: string): Promise<Case[]> {
    const qb = this.repo.createQueryBuilder('c')
      .leftJoinAndSelect('c.reporter', 'reporter')
      .orderBy('c.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (status) qb.where('c.status = :status', { status });
    if (q) {
      const cond = 'c.childName ILIKE :q';
      status ? qb.andWhere(cond, { q: `%${q}%` }) : qb.where(cond, { q: `%${q}%` });
    }
    return qb.getMany();
  }

  async findNearbyCases(lat: number, lng: number, radiusKm = 20): Promise<any[]> {
    return this.dataSource.query(
      `SELECT c.*, 
              ST_Distance(c.last_seen_loc::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) / 1000 AS distance_km
       FROM cases c
       WHERE c.status = 'open'
         AND ST_DWithin(c.last_seen_loc::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3 * 1000)
       ORDER BY distance_km ASC
       LIMIT 100`,
      [lng, lat, radiusKm],
    );
  }

  async findById(id: string): Promise<Case> {
    const c = await this.repo.findOne({
      where: { id },
      relations: ['reporter', 'sightings'],
    });
    if (!c) throw new NotFoundException(`Case ${id} not found`);
    return c;
  }

  async updateStatus(id: string, status: CaseStatus): Promise<Case> {
    await this.repo.update(id, { status });
    const updated = await this.findById(id);
    this.gateway.emitCaseUpdated(id, { id, status });
    return updated;
  }
}
