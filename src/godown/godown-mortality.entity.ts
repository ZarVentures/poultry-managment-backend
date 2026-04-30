import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { GodownInwardEntry } from './godown-inward.entity';

@Entity('godown_mortality')
export class GodownMortality {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'mortality_date', type: 'date' })
  mortalityDate!: string;

  @Column({ name: 'godown_inward_id', type: 'bigint', nullable: true })
  godownInwardId?: string;

  @ManyToOne(() => GodownInwardEntry, { nullable: true })
  @JoinColumn({ name: 'godown_inward_id' })
  godownInward?: GodownInwardEntry;

  @Column({ name: 'number_of_birds_died', type: 'integer' })
  numberOfBirdsDied!: number;

  @Column({ name: 'weight_of_dead_birds', type: 'numeric', precision: 10, scale: 2, nullable: true })
  weightOfDeadBirds?: number;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
