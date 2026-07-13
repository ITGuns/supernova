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
}

export const CUSTOMERS: CustomerRow[] = [
  {
    id: 'c1',
    firstName: 'Jordan',
    lastName: 'Lee',
    code: 'jordan-45q8',
    group: 'All Customers',
    email: 'jordan.lee@example.com',
    phone: '+1 555 0142',
    storeCreditMinor: 0,
    loyaltyMinor: 340,
    accountMinor: 0,
  },
  {
    id: 'c2',
    firstName: 'Priya',
    lastName: 'Nair',
    code: 'priya-8823',
    group: 'VIP',
    email: 'priya.nair@example.com',
    phone: '+1 555 0199',
    storeCreditMinor: 1500,
    loyaltyMinor: 1280,
    accountMinor: 0,
  },
  {
    id: 'c3',
    firstName: 'Marcus',
    lastName: 'Cole',
    code: 'marcus-1170',
    group: 'Wholesale',
    email: 'marcus.cole@example.com',
    phone: '+1 555 0170',
    storeCreditMinor: 0,
    loyaltyMinor: 0,
    accountMinor: 4200,
  },
];
