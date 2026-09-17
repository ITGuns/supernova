export interface CustomerRow {
  id: string;
  firstName: string;
  lastName: string;
  code: string;
  group: string;
  email: string;
  phone: string;
  storeCreditMinor: number;
  loyaltyMinor: number;
  accountMinor: number;
  /** null = use the store default; set in the customer's settings. */
  onAccountLimitMinor?: number | null;
  loyaltyEnabled?: boolean;
}
