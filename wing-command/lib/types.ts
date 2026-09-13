// =============================================
// Wing Command v4 — Types
// No Supabase. No Redis. Pure in-memory.
// =============================================

export type FlavorPersona = 'face-melter' | 'classicist' | 'sticky-finger';
export type WingSource = 'doordash' | 'ubereats' | 'grubhub' | 'google' | 'yelp';
export type WingStatus = 'green' | 'yellow' | 'red';

export interface WingSpot {
  id: string;
  name: string;
  address: string;
  rating?: number;
  deliveryTime?: string;
  deliveryFee?: string;
  isOpen: boolean;
  imageUrl?: string;
  sourceUrl?: string;
  phone?: string;
  priceRange?: string;
  source: WingSource;
  siteName: string;
  status: WingStatus;
}





export interface AvailabilityStats {
  green: number;
  yellow: number;
  red: number;
  total: number;
  percentage: number;
}

export interface PopularCity {
  name: string;
  state: string;
  zip: string;
}

export interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}







