import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './services/auth';
// import { CartService } from './services/cart.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  title = 'CS-Shop';
  isLoggedIn = false;
  isAdmin = false;
  currentUser: any = null;
  cartItemCount: number = 0;
  isMobileMenuOpen = false;

  constructor(
    private authService: AuthService,
    // private cartService: CartService,
    private router: Router
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.isLoggedIn = this.authService.isLoggedIn();
      this.isAdmin = this.authService.isAdmin();
    });

    // Subscribe to cart changes
    // this.cartService.cartItems$.subscribe(items => {
    //   this.cartItemCount = items.reduce((count, item) => count + item.quantity, 0);
    // });
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu() {
    this.isMobileMenuOpen = false;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  navigateToShop() {
    this.closeMobileMenu();
    this.router.navigate(['/shop']);
  }

  navigateToProfile() {
    this.closeMobileMenu();
    this.router.navigate(['/profile']);
  }

  navigateToLibrary() {
    this.closeMobileMenu();
    this.router.navigate(['/library']);
  }

  navigateToCart() {
    this.closeMobileMenu();
    this.router.navigate(['/cart']);
  }

  navigateToAdmin() {
    this.closeMobileMenu();
    this.router.navigate(['/admin']);
  }
}
