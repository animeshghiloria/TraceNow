import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('authorities')
export class Authority {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'badge_number', nullable: true, unique: true })
  badgeNumber: string;

  @Column({ nullable: true })
  department: string;

  @Column({ default: false })
  verified: boolean;

  @Column({ name: 'verified_at', nullable: true, type: 'timestamptz' })
  verifiedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
