import { PartialType } from '@nestjs/mapped-types';
import { CreateVehicleBirdReturnDto } from './create-vehicle-bird-return.dto';

export class UpdateVehicleBirdReturnDto extends PartialType(CreateVehicleBirdReturnDto) {}
