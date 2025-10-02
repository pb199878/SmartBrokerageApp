export interface Sender {
  id: string;
  email: string;
  name: string;
  domain: string; // e.g., "remax.com"
  isVerified: boolean;
  verifiedAt: Date | null;
  verificationSource: string | null; // e.g., "CREA directory", "manual"
  brokerage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerifySenderDto {
  email: string;
  name: string;
}

