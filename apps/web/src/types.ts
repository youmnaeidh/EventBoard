export type Role = "attendee" | "organizer";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  interests: string[];
}

export type EventStatus = "upcoming" | "live" | "ended";

export interface EventItem {
  id: number;
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  eventType: string;
  image: string | null;
  details?: { posterUrl?: string; imageCredit?: string; imageSource?: string; imageLicense?: string; imageCaption?: string; imageIllustrative?: boolean; imagePosition?: number; locationAccuracy?: "exact" | "approximate" | "illustrative"; dailyStart?: string; dailyEnd?: string; included?: string; parking?: string; accessibility?: string; preparation?: string; cancellation?: string };
  publicationStatus?: "draft" | "published";
  openNow?: boolean | null;
  venue: string;
  district: string;
  lat: number;
  lng: number;
  startsAt: string;
  endsAt: string;
  price: number;
  isFree: boolean;
  requiresBooking: boolean;
  capacity: number | null;
  seatsLeft: number | null;
  audience: string;
  format: string;
  highlights: string[];
  organizerName: string;
  featured: boolean;
  createdAt: string;
  status: EventStatus;
  avgRating: number | null;
  reviewCount: number;
  favoriteCount: number;
  popularity: number;
  distanceKm: number | null;
  isFavorite: boolean;
}

export interface Meta {
  categories: string[];
  districts: { name: string; lat: number; lng: number }[];
  defaultCenter: { lat: number; lng: number; label: string };
}

export interface SearchResult {
  event: EventItem;
  score: number;
  reasons: string[];
}

export interface SearchResponse {
  mode: "ai" | "basic";
  engine: string;
  interpretation: { relaxedStage?: string | null; when?: string | null } & Record<string, unknown>;
  chips: string[];
  relaxed: boolean;
  results: SearchResult[];
}

export interface RecommendationItem {
  event: EventItem;
  score: number;
  components: Record<string, number>;
  reasons: string[];
}

export interface Review {
  id: number;
  rating: number;
  comment: string;
  verified: boolean;
  createdAt: string;
  authorName: string;
  eventTitle?: string;
  eventSlug?: string;
}

export interface Booking {
  id: string;
  seats: number;
  ticketCode: string;
  status: "confirmed" | "cancelled";
  createdAt: string;
  eventId: number;
  event: EventItem | null;
}

export interface EventDetailResponse {
  event: EventItem;
  ratingDistribution: Record<string, number>;
  similar: EventItem[];
  myBooking: { id: string; seats: number; ticketCode: string; createdAt: string } | null;
  myReview: { id: number; rating: number; comment: string } | null;
}

export interface OrganizerEventRow {
  event: EventItem;
  stats: { views: number; favorites: number; bookings: number; seats: number; revenue: number; fillRate: number | null; conversion: number };
}

export interface Analytics {
  period: {days:number;from:string;to:string;previousFrom:string;timezone:string};
  previous: {views:number;bookings:number;seats:number;revenue:number};
  unpricedBookings: number; cancelled: number;
  event: EventItem;
  funnel: { views: number; visitors: number; favorites: number; shares: number; bookings: number; seats: number };
  rates: { favoriteRate: number; bookingRate: number; fillRate: number | null };
  revenue: number;
  daily: { day: string; views: number; favorites: number; bookings: number }[];
  ratings: { rating: number; count: number }[];
  sources: { source: string; count: number; synthetic?:number }[];
}

export interface Forecast {
  expectedBookings: number;
  low: number;
  high: number;
  expectedFillRate: number | null;
  drivers: { factor: string; label: string; impact: number }[];
  slots: { label: string; weekday: number; hour: number; startsAt?:string; leadDays?:number; expectedBookings: number }[];
  capacityAdvice: string;
  model: { name?: string; algorithm?: string; trainedOn?: { rows: number; source: string }; metrics?: Record<string, number | string> };
}

export interface DemandGap {
  label: string;
  category: string | null;
  searches: number;
  searches7d: number;
  prev7d: number;
  trend: number | null;
  zeroResultShare: number;
  supply: number;
  demandRatio: number;
  opportunity: "high" | "medium" | "low";
  exampleQueries: string[];
}

export interface Insights {
  sample?: {periodDays:number;uniqueSearchers:number;deduplicatedSearches:number;retrievalFailures:number;noInventory:number;engineUnavailable:number};
  mode: "ai" | "basic";
  gaps: DemandGap[];
  totalSearches: number;
  categories: { category: string; events: number; avgRating: number | null; seats: number }[];
}
