import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { GodownInwardEntry } from './godown-inward.entity';
import { GodownMaster } from './godown-master.entity';

@Entity('godown_mortality')
export class GodownMortality {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'godown_id', type: 'bigint', nullable: true })
  godownId?: string;

  @ManyToOne(() => GodownMaster, { nullable: true })
  @JoinColumn({ name: 'godown_id' })
  godown?: GodownMaster;

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

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true })
  tenantId?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}
