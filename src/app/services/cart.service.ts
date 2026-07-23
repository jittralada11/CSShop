import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Game, CartItem } from '../models/game.model';
import { API_CONFIG } from '../config/api.config';
@Injectable({
  providedIn: 'root'
})
export class CartService {
  private baseUrl = API_CONFIG.baseUrl;
  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  public cartItems$ = this.cartItemsSubject.asObservable();

  constructor() {
    // Load cart from localStorage
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      this.cartItemsSubject.next(JSON.parse(savedCart));
    }
  }

  addToCart(game: Game): void {
    const currentItems = this.cartItemsSubject.value;
    const existingItem = currentItems.find(item => item.game.id === game.id);

    if (!existingItem) {
      const newItem: CartItem = { game, quantity: 1 };
      const updatedItems = [...currentItems, newItem];
      this.updateCart(updatedItems);
    }
  }

  removeFromCart(gameId: number): void {
    const currentItems = this.cartItemsSubject.value;
    const updatedItems = currentItems.filter(item => item.game.id !== gameId);
    this.updateCart(updatedItems);
  }

  updateQuantity(gameId: number, quantity: number): void {
    const currentItems = this.cartItemsSubject.value;
    const updatedItems = currentItems.map(item => 
      item.game.id === gameId ? { ...item, quantity } : item
    );
    this.updateCart(updatedItems);
  }

  clearCart(): void {
    this.updateCart([]);
  }

  getCartItems(): CartItem[] {
    return this.cartItemsSubject.value;
  }

  getCartTotal(): number {
    return this.cartItemsSubject.value.reduce(
      (total, item) => total + (item.game.price * item.quantity), 0
    );
  }

  getCartItemCount(): number {
    return this.cartItemsSubject.value.reduce(
      (count, item) => count + item.quantity, 0
    );
  }

  isInCart(gameId: number): boolean {
    return this.cartItemsSubject.value.some(item => item.game.id === gameId);
  }

  private updateCart(items: CartItem[]): void {
    this.cartItemsSubject.next(items);
    localStorage.setItem('cart', JSON.stringify(items));
  }
}