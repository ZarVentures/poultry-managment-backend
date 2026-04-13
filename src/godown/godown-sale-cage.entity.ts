import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { GodownSale } from './godown-sale.entity';

@Entity('godown_sale_cages')
export class GodownSaleCage {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'godown_sale_id', type: 'bigint' })
  godownSaleId!: string;

  @Column({ name: 'cage_id', type: 'varchar', length: 50, nullable: true })
  cageId?: string;

  @Column({ name: 'bird_type', type: 'varchar', length: 50, nullable: true })
  birdType?: string;

  @Column({ name: 'number_of_birds', type: 'integer' })
  numberOfBirds!: number;

  @Column({ name: 'cage_weight', type: 'numeric', precision: 10, scale: 2 })
  cageWeight!: number;

  // Optional back-reference to the godown inward entry this cage came from
  @Column({ name: 'godown_inward_id', type: 'bigint', nullable: true })
  godownInwardId?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @ManyToOne(() => GodownSale, (sale) => sale.cages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'godown_sale_id' })
  godownSale!: GodownSale;
}
