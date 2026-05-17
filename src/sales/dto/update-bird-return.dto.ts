import { PartialType } from '@nestjs/mapped-types';
import { CreateBirdReturnDto } from './create-bird-return.dto';

export class UpdateBirdReturnDto extends PartialType(CreateBirdReturnDto) {}
