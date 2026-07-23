import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GameService } from '../../../services/game.service';
import { CartService } from '../../../services/cart.service';
import { Game, GameCategory } from '../../../models/game.model';
import { AuthService } from '../../../services/auth';
import { API_CONFIG } from '../../../config/api.config';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-shop',
  imports: [CommonModule, FormsModule],
  templateUrl: './shop.html',
  styleUrl: './shop.css',
})
export class Shop implements OnInit {
  private baseUrl = API_CONFIG.baseUrl; // ✅ URL ของ Go backend
  currentUser: any = null;

  games: Game[] = [];
  filteredGames: Game[] = [];
  categories: GameCategory[] = [];
  searchTerm: string = '';
  selectedCategory: string = '';
  sortBy: string = 'name';
  isLoading: boolean = false;
  cartItemCount: number = 0;

  constructor(
    private gameService: GameService,
    private cartService: CartService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadGames();
    this.loadCategories();
    this.subscribeToCartChanges();
    this.authService.currentUser$.subscribe((user) => {
      this.currentUser = user;
      if (user) {
        this.loadGames(); // ✅ โหลดหลังจากรู้ uid แล้ว
      } else {
        this.games = [];
        this.filteredGames = [];
        this.isLoading = false;
      }
    });
  }

  subscribeToCartChanges() {
    this.cartService.cartItems$.subscribe((items) => {
      this.cartItemCount = items.reduce((count, item) => count + item.quantity, 0);
    });
  }

  async loadGames() {
    this.isLoading = true;
    try {
      const [games, purchasedGames] = await Promise.all([
        firstValueFrom(this.gameService.getGames()),
        fetch(`${this.baseUrl}/user/games?uid=${this.currentUser?.uid}`).then((res) => res.json()),
      ]);

      const allGames = games || [];
      const purchasedIds = (purchasedGames || []).map((g: any) => g.game_id);

      console.log('✅ purchasedIds:', purchasedIds);
      console.log('✅ allGames sample:', allGames.slice(0, 3));

      // ✅ กรองเกมที่ผู้ใช้ยังไม่ซื้อ
      this.games = allGames.filter((g: any) => !purchasedIds.includes(Number(g.id)));

      this.filteredGames = [...this.games];
    } catch (err) {
      console.error('Error loading games:', err);
    } finally {
      this.isLoading = false;
    }
  }

  loadCategories() {
    this.gameService.getCategories().subscribe((categories) => {
      this.categories = categories;
    });
  }

  onSearch() {
    this.gameService.searchGames(this.searchTerm).subscribe((games) => {
      this.filteredGames = games;
      this.applyFilters();
    });
  }

  onCategoryChange() {
    this.applyFilters();
  }

  onSortChange() {
    this.applyFilters();
  }

  applyFilters() {
    let filtered = [...this.games];

    // Apply search filter
    if (this.searchTerm) {
      this.gameService.searchGames(this.searchTerm).subscribe((games) => {
        filtered = games;
        this.applyCategoryAndSort(filtered);
      });
    } else {
      this.applyCategoryAndSort(filtered);
    }
  }

  applyCategoryAndSort(filtered: Game[]) {
    // Apply category filter
    if (this.selectedCategory) {
      filtered = filtered.filter((game) => game.category.id === this.selectedCategory);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (this.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price':
          return a.price - b.price;
        case 'releaseDate':
          return new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime();
        case 'salesRank':
          return (a.salesRank || 999) - (b.salesRank || 999);
        default:
          return 0;
      }
    });

    this.filteredGames = filtered;
  }

  addToCart(game: Game) {
    this.cartService.addToCart(game);
    // Show success message or notification
  }

  viewGameDetails(game: Game) {
    // Navigate to game details page
    this.router.navigate(['/game', game.id]);
  }

  navigateToCart() {
    this.router.navigate(['/cart']);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(price);
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedCategory = '';
    this.sortBy = 'name';
    this.loadGames();
  }

  buyGame(game: any) {
    if (!this.currentUser) {
      alert('กรุณาเข้าสู่ระบบก่อนซื้อเกม');
      this.router.navigate(['/login']);
      return;
    }

    const body = {
      uid: this.currentUser.uid,
      game_id: game.game_id,
      amount: game.price,
      description: `ซื้อเกม: ${game.name} — ฿${game.price}`,
    };

    fetch(`${this.baseUrl}/wallet/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (!res.ok) {
          const error = await res.text();
          throw new Error(error);
        }
        return res.json();
      })
      .then(() => {
        alert(`✅ ซื้อเกม ${game.name} สำเร็จ!`);
        this.loadGames(); // ✅ โหลดใหม่เพื่อกรองเกมที่ซื้อแล้วออก
      })
      .catch((err) => {
        if (err.message.includes('already own')) {
          alert('❌ คุณมีเกมนี้อยู่แล้ว');
        } else if (err.message.includes('Insufficient balance')) {
          alert('❌ ยอดเงินไม่เพียงพอ');
        } else {
          alert('❌ ซื้อเกมไม่สำเร็จ');
        }
      });
  }
}
