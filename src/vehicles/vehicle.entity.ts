import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'vehicles' })
export class Vehicle {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ name: 'vehicle_number', type: 'varchar', length: 50, unique: true })
  vehicleNumber!: string;

  @Column({ name: 'vehicle_type', type: 'varchar', length: 50 })
  vehicleType!: string;

  @Column({ name: 'driver_name', type: 'varchar', length: 150 })
  driverName!: string;

  @Column({ name: 'phone', type: 'varchar', length: 50 })
  phone!: string;

  @Column({ name: 'owner_name', type: 'varchar', length: 150, nullable: true })
  ownerName?: string;

  @Column({ name: 'address', type: 'text', nullable: true })
  address?: string;

  @Column({ name: 'total_capacity', type: 'int', nullable: true })
  totalCapacity?: number | null;

  @Column({ name: 'petrol_tank_capacity', type: 'numeric', precision: 10, scale: 2, nullable: true })
  petrolTankCapacity?: string | null;

  @Column({ name: 'fuel_type', type: 'varchar', length: 20, nullable: true })
  fuelType?: string;

  @Column({ name: 'mileage', type: 'numeric', precision: 10, scale: 2, nullable: true })
  mileage?: string | null;

  @Column({ name: 'join_date', type: 'date' })
  joinDate!: string;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive'],
    enumName: 'vehicle_status_type',
    default: 'active',
  })
  status!: 'active' | 'inactive';

  @Column({ name: 'note', type: 'text', nullable: true })
  note?: string;

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true })
  tenantId?: string;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'NOW()' })
  updatedAt!: Date;
}

