import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CartService } from '../../../services/cart.service';
import { GameService } from '../../../services/game.service';
import { AuthService } from '../../../services/auth';
import { TransactionService } from '../../../services/transaction.service';
import { CartItem, DiscountCode } from '../../../models/game.model';
import { API_CONFIG } from '../../../config/api.config';

@Component({
  selector: 'app-cart',
  imports: [CommonModule, FormsModule],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
})
export class Cart implements OnInit {
  private baseUrl = API_CONFIG.baseUrl; // ✅ URL ของ Go backend

  cartItems: CartItem[] = [];
  discountCode: string = '';
  appliedDiscount: DiscountCode | null = null;
  subtotal: number = 0;
  discountAmount: number = 0;
  total: number = 0;
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  currentUser: any = null;

  constructor(
    private cartService: CartService,
    private gameService: GameService,
    private authService: AuthService,
    private transactionService: TransactionService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadCartItems();
    this.currentUser = this.authService.getCurrentUser();
  }

  loadCartItems() {
    this.cartService.cartItems$.subscribe((items) => {
      this.cartItems = items;
      this.calculateTotals();
    });
  }

  calculateTotals() {
    this.subtotal = this.cartItems.reduce((sum, item) => sum + item.game.price * item.quantity, 0);

    if (this.appliedDiscount) {
      this.discountAmount = (this.subtotal * this.appliedDiscount.discountPercentage) / 100;
    } else {
      this.discountAmount = 0;
    }

    this.total = this.subtotal - this.discountAmount;
  }

  updateQuantity(gameId: number, quantity: number) {
    if (quantity > 0) {
      this.cartService.updateQuantity(gameId, quantity);
    } else {
      this.removeFromCart(gameId);
    }
  }

  removeFromCart(gameId: number) {
    this.cartService.removeFromCart(gameId);
  }

  applyDiscountCode() {
    if (!this.discountCode.trim()) {
      this.errorMessage = 'กรุณาใส่รหัสส่วนลด';
      return;
    }

    this.isLoading = true;
    this.gameService.validateDiscountCode(this.discountCode).subscribe({
      next: (response: { valid: boolean; discount: number; message: string }) => {
        if (response.valid) {
          // Create a temporary discount object for calculation
          const tempDiscount = {
            id: 'temp',
            code: this.discountCode,
            discountPercentage: response.discount * 100,
            maxUses: 1,
            currentUses: 0,
            isActive: true,
            createdAt: new Date(),
          };
          this.appliedDiscount = tempDiscount;
          this.calculateTotals();
          this.successMessage = `ใช้รหัสส่วนลด ${response.discount * 100}% สำเร็จ!`;
          this.errorMessage = '';
        } else {
          this.errorMessage = response.message || 'รหัสส่วนลดไม่ถูกต้องหรือหมดอายุ';
          this.successMessage = '';
        }
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'เกิดข้อผิดพลาดในการตรวจสอบรหัสส่วนลด';
        this.isLoading = false;
      },
    });
  }

  removeDiscountCode() {
    this.appliedDiscount = null;
    this.discountCode = '';
    this.calculateTotals();
    this.successMessage = '';
    this.errorMessage = '';
  }

  proceedToCheckout() {
    if (this.cartItems.length === 0) return;

    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    if (this.currentUser.walletBalance < this.total) {
      this.errorMessage = `ยอดเงินในกระเป๋าไม่เพียงพอ (มี ${this.formatPrice(
        this.currentUser.walletBalance,
      )})`;
      return;
    }

    this.isLoading = true;
    const gameIds = this.cartItems.map((item) => item.game.id);

    this.gameService
      .purchaseGames({
        games: this.cartItems.map((item) => item.game),
        totalAmount: this.total,
        discountCode: this.appliedDiscount?.code,
      })
      .subscribe({
        next: (purchase: { success: boolean; purchaseId: string; message: string }) => {
          // Update user wallet
          // this.authService.updateUserWallet(-this.total);

          // Record transaction
          this.transactionService.recordPurchase(
            this.currentUser.id || this.currentUser.uid,
            this.total,
            `ซื้อเกม ${this.cartItems.length} เกม`,
          );

          // Clear cart
          this.cartService.clearCart();
          this.successMessage = '✅ ซื้อเกมสำเร็จทั้งหมดแล้ว!';
          this.errorMessage = '';
          this.isLoading = false;

          // Navigate to library after 2 seconds
          setTimeout(() => {
            this.router.navigate(['/library']);
          }, 2000);
        },
        error: (error: Error) => {
          this.errorMessage = 'เกิดข้อผิดพลาดในการซื้อเกม';
          this.isLoading = false;
        },
      });
  }

  continueShopping() {
    this.router.navigate(['/shop']);
  }

  trackByGameId(index: number, item: CartItem): number {
    return item.game.id;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(price);
  }
}
