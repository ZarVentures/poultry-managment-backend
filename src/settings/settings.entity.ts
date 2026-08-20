import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'settings' })
export class Settings {
  @PrimaryColumn({ name: 'tenant_id', type: 'bigint' })
  tenantId!: string;

  @PrimaryColumn({ type: 'text' })
  key!: string;

  @Column({ type: 'text' })
  value!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}