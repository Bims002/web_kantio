export interface Material {
  id: string;
  name: string;
  category: string;
  unit: string;
  icon: string | null;
  created_at?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string;
  email: string | null;
  city: string;
  quartier: string | null;
  address: string | null;
  lat: number;
  lng: number;
  delivery_radius: number;
  delivery_zones: string | null;
  stock_availability: 'permanent' | 'partial' | 'on_demand';
  delivery_delay_hours: number;
  is_active: boolean;
  created_at?: string;
  materials?: SupplierMaterial[];
}

export interface SupplierMaterial {
  id: string;
  supplier_id: string;
  material_id: string;
  unit: string;
  material?: Material;
}

export interface Order {
  id: string;
  tracking_token: string;
  site_name: string;
  site_address: string;
  site_lat: number | null;
  site_lng: number | null;
  contact_name: string;
  contact_phone: string;
  supplier_id: string | null;
  supplier_name: string | null;
  supplier_phone: string | null;
  status: 'pending' | 'confirmed' | 'in_delivery' | 'delivered' | 'cancelled';
  notes: string | null;
  whatsapp_sent: boolean;
  customer_confirmed: boolean;
  delivered_at: string | null;
  created_at?: string;
  updated_at?: string;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  material_id: string | null;
  material_name: string;
  quantity: number;
  unit: string;
}
