export enum ListingStatus {
  ACTIVE = 'active',
  SOLD = 'sold',
  EXPIRED = 'expired',
  DRAFT = 'draft',
}

export interface Listing {
  id: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  price: number;
  emailAlias: string; // e.g., "l-abc123"
  sellerId: string;
  status: ListingStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateListingDto {
  address: string;
  city: string;
  province: string;
  postalCode: string;
  price: number;
  sellerId: string;
}

