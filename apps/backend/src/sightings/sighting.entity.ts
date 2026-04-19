import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Case } from '../cases/case.entity';
import { User } from '../users/user.entity';

@Entity('sightings')
export class Sighting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Case, (c) => c.sightings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  case: Case;

  @Column({ name: 'case_id' })
  caseId: string;

  @ManyToOne(() => User, (u) => u.sightings)
  @JoinColumn({ name: 'uploader_id' })
  uploader: User;

  @Column({ name: 'uploader_id' })
  uploaderId: string;

  @Column({ nullable: true, type: 'text' })
  location: string;   // "SRID=4326;POINT(lng lat)"

  @Column({ nullable: true })
  address: string;

  @Column({ name: 'image_url', nullable: true })
  imageUrl: string;

  @Column({ name: 'embedding_id', nullable: true, type: 'uuid' })
  embeddingId: string;

  @Column({ type: 'float', nullable: true })
  confidence: number;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
