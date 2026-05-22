import { create } from 'zustand';
import type { CartItem } from '@/types';

interface CartState {
  items: CartItem[];
  totalAmount: number;
  itemCount: number;
  setCart: (items: CartItem[], totalAmount: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  totalAmount: 0,
  itemCount: 0,

  setCart: (items, totalAmount) =>
    set({
      items,
      totalAmount,
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    }),

  clearCart: () => set({ items: [], totalAmount: 0, itemCount: 0 }),
}));
