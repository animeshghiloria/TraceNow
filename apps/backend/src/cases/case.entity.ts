import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Sighting } from '../sightings/sighting.entity';
import { Alert } from '../alerts/alert.entity';

export enum CaseStatus {
  OPEN = 'open',
  INVESTIGATING = 'investigating',
  FOUND_SAFE = 'found_safe',
  CLOSED = 'closed',
}

@Entity('cases')
export class Case {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (u) => u.cases)
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @Column({ name: 'reporter_id' })
  reporterId: string;

  @Column({ name: 'child_name' })
  childName: string;

  @Column({ name: 'child_age', type: 'smallint' })
  childAge: number;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt: Date;

  // Store as JSON string; raw SQL for geo; TypeORM just stores text
  @Column({ name: 'last_seen_loc', type: 'text' })
  lastSeenLoc: string;     // "SRID=4326;POINT(lng lat)"

  @Column({ name: 'last_seen_addr', nullable: true })
  lastSeenAddr: string;

  @Column({ name: 'image_url', nullable: true })
  imageUrl: string;

  @Column({ name: 'embedding_id', nullable: true, type: 'uuid' })
  embeddingId: string;

  @Column({ type: 'enum', enum: CaseStatus, default: CaseStatus.OPEN })
  status: CaseStatus;

  @Column({ name: 'alert_radius_km', type: 'float', default: 5.0 })
  alertRadiusKm: number;

  @OneToMany(() => Sighting, (s) => s.case)
  sightings: Sighting[];

  @OneToMany(() => Alert, (a) => a.case)
  alerts: Alert[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
