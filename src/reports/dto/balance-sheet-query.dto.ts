import { IsOptional, Matches } from 'class-validator';

export class BalanceSheetQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'asOnDate must be YYYY-MM-DD' })
  asOnDate?: string;
}
