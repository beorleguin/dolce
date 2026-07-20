export type FeaturedWine = {
  id: string;
  name: string;
  detail?: string;
  winery: string;
  varietal: string;
  image: string;
  featured: boolean;
  order: number;
  pricePerUnit: number;
  unitsPerBox: number;
};

export type CartItem = FeaturedWine & { boxes: number };

export const CART_STORAGE_KEY = 'dolce-vino-cart-v1';
export const MAX_FEATURED_WINES = 5;

export function getCartFromStorage(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) || '[]'); }
  catch { return []; }
}

export function saveCartToStorage(cart: CartItem[]) {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event('dolce-vino-cart-updated'));
}

export const formatPrice = (value:number) => new Intl.NumberFormat('es-AR',{
  style:'currency',currency:'ARS',maximumFractionDigits:0
}).format(value);
