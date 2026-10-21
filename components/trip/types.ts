export interface ActivityCatalogItem {
  id: string;
  title: string;
  city_name?: string;
  country?: string;
  description?: string;
  category: string;
  estimated_cost: number;
  currency: string;
  duration_minutes: number;
  rating?: number;
  address?: string;
  image_url?: string;
}

export interface CityCatalogItem {
  id: string;
  name: string;
  country: string;
  country_code?: string;
  region?: string;
  description?: string;
  image_url?: string;
  average_daily_cost: number;
  currency: string;
  rating?: number;
  latitude?: number | null;
  longitude?: number | null;
}

export interface TripStop {
  id: string;
  trip_id: string;
  city_id?: string | null;
  custom_city_name?: string | null;
  order_index: number;
  arrival_date?: string | null;
  departure_date?: string | null;
  notes?: string | null;
  cities?: CityCatalogItem | null;
}

export interface ItineraryItem {
  id: string;
  trip_id: string;
  trip_stop_id?: string | null;
  activity_id?: string | null;
  day_number: number;
  date?: string | null;
  title: string;
  description?: string | null;
  category: string;
  start_time?: string | null;
  end_time?: string | null;
  order_index: number;
  estimated_cost: number;
  currency: string;
  is_completed: boolean;
  notes?: string | null;
  activities?: ActivityCatalogItem | null;
}

export interface Trip {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  total_budget: number;
  currency: string;
  cover_image_url?: string | null;
  is_public: boolean;
  share_slug?: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  trip_id: string;
  itinerary_item_id?: string | null;
  title: string;
  amount: number;
  currency: string;
  category: string;
  expense_date?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

