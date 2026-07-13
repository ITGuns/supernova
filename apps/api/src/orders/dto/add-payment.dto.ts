import { IsIn, IsInt, Min } from 'class-validator';
import type { TenderMethod } from '../orders.types';

export class AddPaymentDto {
  @IsIn(['CASH', 'CARD', 'GIFT_CARD', 'STORE_CREDIT'])
  method!: TenderMethod;

  @IsInt()
  @Min(1)
  amountMinor!: number;
}
