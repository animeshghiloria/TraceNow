import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany,
} from 'typeorm';
import { Case } from '../cases/case.entity';
import { Sighting } from '../sightings/sighting.entity';
import { Alert } from '../alerts/alert.entity';

export enum UserRole {
  CITIZEN = 'citizen',
  AUTHORITY = 'authority',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  phone: string;

  @Column({ nullable: true })
  name: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CITIZEN })
  role: UserRole;

  @Column({ name: 'fcm_token', nullable: true })
  fcmToken: string;

  // Stored as WKT; TypeORM geography not natively supported → raw SQL for geo queries
  @Column({ type: 'text', nullable: true })
  location: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => Case, (c) => c.reporter)
  cases: Case[];

  @OneToMany(() => Sighting, (s) => s.uploader)
  sightings: Sighting[];

  @OneToMany(() => Alert, (a) => a.user)
  alerts: Alert[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
