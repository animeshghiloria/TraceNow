import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User, UserRole } from './user.entity';

export interface UserStats {
  casesReported: number;
  sightingsUploaded: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async findByPhone(phone: string): Promise<User | null> {
    return this.repo.findOne({ where: { phone } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(data: { phone: string; role?: UserRole; name?: string }): Promise<User> {
    const user = this.repo.create(data);
    return this.repo.save(user);
  }

  async updateFcmToken(userId: string, token: string): Promise<void> {
    await this.repo.update(userId, { fcmToken: token });
  }

  /**
   * Update user's last-known location using PostGIS geography.
   * We use a raw query because TypeORM doesn't natively support geography columns.
   */
  async updateLocation(userId: string, lat: number, lng: number): Promise<void> {
    await this.dataSource.query(
      `UPDATE users SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE id = $3`,
      [lng, lat, userId],
    );
  }

  async updateProfile(userId: string, data: { name?: string }): Promise<User> {
    await this.repo.update(userId, data);
    return this.findById(userId);
  }

  /**
   * Returns aggregate counts for a user's activity.
   */
  async getStats(userId: string): Promise<UserStats> {
    const [casesResult, sightingsResult] = await Promise.all([
      this.dataSource.query(
        `SELECT COUNT(*)::INTEGER AS count FROM cases WHERE reporter_id = $1`,
        [userId],
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::INTEGER AS count FROM sightings WHERE uploader_id = $1`,
        [userId],
      ),
    ]);
    return {
      casesReported: casesResult[0]?.count ?? 0,
      sightingsUploaded: sightingsResult[0]?.count ?? 0,
    };
  }
}
