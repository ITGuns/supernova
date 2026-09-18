export interface CustomerAddress {
  street1: string;
  street2: string;
  suburb: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export const EMPTY_CUSTOMER_ADDRESS: CustomerAddress = { street1: '', street2: '', suburb: '', city: '', state: '', zip: '', country: '' };

/** Everything on the Add customer pop-up beyond the contact basics. */
export interface CustomerDetails {
  company: string;
  dateOfBirth: string;
  gender: string;
  website: string;
  twitter: string;
  physical: CustomerAddress;
  postal: CustomerAddress;
  postalSameAsPhysical: boolean;
  customFields: Record<string, string>;
  notes: string;
  taxExempt: boolean;
  emailMarketing: boolean;
}

export const EMPTY_CUSTOMER_DETAILS: CustomerDetails = {
  company: '',
  dateOfBirth: '',
  gender: '',
  website: '',
  twitter: '',
  physical: { ...EMPTY_CUSTOMER_ADDRESS },
  postal: { ...EMPTY_CUSTOMER_ADDRESS },
  postalSameAsPhysical: true,
  customFields: {},
  notes: '',
  taxExempt: false,
  emailMarketing: false,
};

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
  details?: CustomerDetails;
  createdAt?: number;
}
