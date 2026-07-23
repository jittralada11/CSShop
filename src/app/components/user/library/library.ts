import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { GameService } from '../../../services/game.service';
import { User } from '../../../models/user.model';
import { Game } from '../../../models/game.model';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './library.html',
  styleUrl: './library.css',
})
export class Library implements OnInit {
  currentUser: User | null = null;
  purchasedGames: Game[] = [];
  filteredGames: Game[] = [];
  isLoading = false;
  errorMessage = '';

  // Filters and sorting
  searchTerm = '';
  selectedCategory = '';
  sortBy = 'name'; // name, purchase_date, price, release_date
  categories: string[] = [];

  constructor(
    private authService: AuthService,
    private gameService: GameService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadCurrentUser();
    this.loadPurchasedGames();
  }

  loadCurrentUser() {
    this.authService.currentUser$.subscribe({
      next: (user: User | null) => {
        this.currentUser = user;
        if (user) {
          this.loadPurchasedGames();
        }
      },
      error: (error: any) => {
        this.errorMessage = 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้';
        console.error('Error loading user:', error);
      },
    });
  }

  loadPurchasedGames() {
    if (!this.currentUser) return;

    this.isLoading = true;
    this.gameService.getUserGames(this.currentUser.uid.toString()).subscribe({
      next: (games) => {
        this.purchasedGames = games;
        this.filteredGames = [...games];
        this.isLoading = false;
      },
      error: (error: any) => {
        this.errorMessage = 'ไม่สามารถโหลดเกมที่ซื้อได้';
        this.isLoading = false;
        console.error('Error loading user games:', error);
      },
    });
  }

  extractCategories() {
    const categorySet = new Set<string>();
    this.purchasedGames.forEach((game) => {
      if (game.category && game.category.name) {
        categorySet.add(game.category.name);
      }
    });
    this.categories = Array.from(categorySet).sort();
  }

  applyFilters() {
    let filtered = [...this.purchasedGames];

    // Apply search filter
    if (this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (game) =>
          game.name.toLowerCase().includes(searchLower) ||
          game.description.toLowerCase().includes(searchLower) ||
          (game.category && game.category.name.toLowerCase().includes(searchLower))
      );
    }

    // Apply category filter
    if (this.selectedCategory) {
      filtered = filtered.filter(
        (game) => game.category && game.category.name === this.selectedCategory
      );
    }

    // Apply sorting
    switch (this.sortBy) {
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'price':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'release_date':
        filtered.sort(
          (a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
        );
        break;
      case 'purchase_date':
        // In a real app, you would have purchase date data
        // For now, we'll sort by game ID as a proxy
        // filtered.sort((a, b) => b.id.localeCompare(a.id));
        filtered.sort((a, b) => b.id - a.id);
        break;
    }

    this.filteredGames = filtered;
  }

  onSearch() {
    this.applyFilters();
  }

  onCategoryChange() {
    this.applyFilters();
  }

  onSortChange() {
    this.applyFilters();
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedCategory = '';
    this.sortBy = 'name';
    this.applyFilters();
  }

  viewGameDetails(gameId: number) {
    // Navigate to game detail page
    this.router.navigate(['/game', gameId]);
  }

  downloadGame(gameId: number) {
    // In a real app, you would initiate game download
    console.log('Download game:', gameId);
    // Show success message
    const game = this.purchasedGames.find((g) => g.id === gameId);
    if (game) {
      alert(`เริ่มดาวน์โหลด ${game.name}`);
    }
  }

  navigateToShop() {
    this.router.navigate(['/shop']);
  }

  navigateToProfile() {
    this.router.navigate(['/profile']);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(price);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  getTotalValue(): number {
    return this.purchasedGames.reduce((total, game) => total + game.price, 0);
  }

  getGamesByCategory(): { [key: string]: number } {
    const categoryCount: { [key: string]: number } = {};
    this.purchasedGames.forEach((game) => {
      if (game.category && game.category.name) {
        categoryCount[game.category.name] = (categoryCount[game.category.name] || 0) + 1;
      }
    });
    return categoryCount;
  }

  trackByGameId(index: number, game: Game): number {
    return game.id;
  }
}
