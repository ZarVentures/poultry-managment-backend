import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { GodownInwardEntry } from './godown-inward.entity';

@Entity('godown_inward_cages')
export class GodownInwardCage {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'godown_inward_id', type: 'bigint' })
  godownInwardId!: string;

  @Column({ name: 'cage_id', type: 'varchar', length: 50, nullable: true })
  cageId?: string;

  @Column({ name: 'bird_type', type: 'varchar', length: 50, nullable: true })
  birdType?: string;

  @Column({ name: 'number_of_birds', type: 'integer' })
  numberOfBirds!: number;

  @Column({ name: 'cage_weight', type: 'numeric', precision: 10, scale: 2 })
  cageWeight!: number;

  // Optional back-reference to the original purchase order
  @Column({ name: 'purchase_order_id', type: 'bigint', nullable: true })
  purchaseOrderId?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @ManyToOne(() => GodownInwardEntry, (entry) => entry.cages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'godown_inward_id' })
  godownInward!: GodownInwardEntry;
}
