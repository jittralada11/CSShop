import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from '../../../services/auth';
import { GameService } from '../../../services/game.service';
import { TransactionService } from '../../../services/transaction.service';

import { User } from '../../../models/user.model';
import { Game, GameCategory, Purchase } from '../../../models/game.model';
import { Transaction } from '../../../models/transaction.model';

type GameForm = {
  name: string;
  price: number;
  categoryId: string;
  description: string;
  image: string;
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
})
export class Dashboard implements OnInit, OnDestroy {
  currentUser: User | null = null;

  games: Game[] = [];
  categories: GameCategory[] = [];
  purchases: Purchase[] = [];
  transactions: Transaction[] = [];

  totalRevenue = 0;
  totalSales = 0;
  totalUsers = 0;
  topSellingGames: Game[] = [];
  recentTransactions: Transaction[] = [];
  users: any[] = [];
  userTransactions: any[] = [];
  selectedUser: any = null;
  isTransactionModalOpen = false;
  salesByCategory: { [key: string]: number } = {};

  activeTab: string = 'games';
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  selectedGame: Game | null = null;
  isEditingGame = false;
  gameForm: GameForm = { name: '', price: 0, categoryId: '', description: '', image: '' };

  // File upload properties
  selectedImageFile: File | null = null;
  imagePreview: string | null = null;

  private subs: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private gameService: GameService,
    private transactionService: TransactionService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadCategories();
    this.loadUsers();
    this.loadAllTransactions();
  }

  loadUsers(): void {
    this.authService.getUsersWithWallet().subscribe({
      next: (users: any[]) => {
        console.log('📦 Users with wallet:', users);
        this.users = users;
      },
      error: (err: any) => console.error('Error loading users with wallet:', err),
    });
  }

  loadAllTransactions(): void {
    this.transactionService.getAllTransactions().subscribe({
      next: (transactions: Transaction[]) => {
        this.transactions = transactions;
      },
      error: (err: any) => console.error('Error loading transactions:', err),
    });
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  loadDashboardData(): void {
    this.isLoading = true;
    const s1 = this.gameService.getGames().subscribe({
      next: (games) => {
        this.games = games;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading games:', error);
        this.errorMessage = 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
        this.isLoading = false;
      },
    });
    this.subs.push(s1);

    const s2 = this.gameService.games$.subscribe((g) => (this.games = g));
    this.subs.push(s2);
  }

  loadCategories(): void {
    const s = this.gameService.getCategories().subscribe({
      next: (categories) => (this.categories = categories),
      error: (error) => console.error('Error loading categories:', error),
    });
    this.subs.push(s);
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }
  navigateToShop(): void {
    this.router.navigate(['/shop']);
  }
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  hasAdminUsers(): boolean {
    return this.users?.some((u: any) => u.role === 'admin') ?? false;
  }

  hasNormalUsers(): boolean {
    return this.users?.some((u: any) => u.role !== 'admin') ?? false;
  }

  openTransactionModal(user: any): void {
    this.selectedUser = user;
    this.isTransactionModalOpen = true;
    this.userTransactions = user.transactions || [];
  }

  closeTransactionModal(): void {
    this.isTransactionModalOpen = false;
    this.selectedUser = null;
    this.userTransactions = [];
  }
  openAddGameModal(): void {
    this.selectedGame = null;
    this.isEditingGame = true;
    this.resetGameForm();
    this.clearMessages();
  }

  editGame(game: Game): void {
  this.selectedGame = game;

  // ดึง ID ออกมา ไม่ว่าจะส่งมาเป็น Object หรือ ID เปล่าๆ
  const categoryIdFromGame = typeof game.category === 'object' && game.category !== null
    ? game.category.id
    : game.category;

  this.gameForm = {
    name: game.name || '',
    price: game.price || 0,
    // แปลงเป็น String เสมอ เพื่อให้ match กับ value ใน HTML
    categoryId: categoryIdFromGame ? String(categoryIdFromGame) : '',
    description: game.description || '',
    image: game.image || '',
  };

  this.selectedImageFile = null;
  this.imagePreview = game.image;
  this.isEditingGame = true;
  this.clearMessages();
}

  deleteGame(gameId: any): void {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบเกมนี้?')) {
      return;
    }

    this.isLoading = true;
    const s = this.gameService.deleteGame(gameId).subscribe({
      next: (success) => {
        if (success) {
          this.successMessage = 'ลบเกมเรียบร้อยแล้ว';
          // รีเฟรชข้อมูลเกมทั้งหมด
          this.loadDashboardData();
        } else {
          this.errorMessage = 'ไม่สามารถลบเกมได้';
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error deleting game:', error);
        this.errorMessage = error.message || 'เกิดข้อผิดพลาดในการลบเกม';
        this.isLoading = false;
      },
    });
    this.subs.push(s);
  }

  closeGameModal(): void {
    this.isEditingGame = false;
    this.selectedGame = null;
    this.resetGameForm();
    this.clearMessages();
  }

  resetGameForm(): void {
    this.gameForm = { name: '', price: 0, categoryId: '', description: '', image: '' };
    // Reset image upload state
    this.selectedImageFile = null;
    this.imagePreview = null;
  }
  clearMessages(): void {
    this.errorMessage = '';
    this.successMessage = '';
  }

  saveGame(): void {
    this.clearMessages();
    const { name, price, categoryId, description, image } = this.gameForm;

    // ตรวจสอบข้อมูลพื้นฐาน
    if (!name?.trim()) {
      this.errorMessage = 'กรุณากรอกชื่อเกม';
      return;
    }
    if (!price || price <= 0) {
      this.errorMessage = 'กรุณากรอกราคาที่ถูกต้อง (มากกว่า 0)';
      return;
    }
    if (!categoryId) {
      this.errorMessage = 'กรุณาเลือกหมวดหมู่เกม';
      return;
    }
    if (!description?.trim()) {
      this.errorMessage = 'กรุณากรอกคำอธิบายเกม';
      return;
    }

    const selectedCategory = this.categories.find((c) => c.id === categoryId);
    if (!selectedCategory) {
      this.errorMessage = 'ไม่พบหมวดหมู่ที่เลือก';
      return;
    }

    this.isLoading = true;

    // ถ้ามีไฟล์รูปภาพที่เลือก ให้อัปโหลดก่อน
    if (this.selectedImageFile) {
      this.uploadImageAndSaveGame(selectedCategory, name.trim(), price, description.trim());
    } else {
      // ใช้รูปภาพเดิมหรือรูปภาพ default
      const gameData = {
        name: name.trim(),
        price,
        category: selectedCategory,
        description: description.trim(),
        image: image?.trim() || this.imagePreview || '/assets/images/default-game.jpg',
      };
      this.saveGameData(gameData);
    }
  }

  // เมธอดสำหรับอัปโหลดรูปภาพและบันทึกเกม
  private uploadImageAndSaveGame(
    category: any,
    name: string,
    price: number,
    description: string,
  ): void {
    if (!this.selectedImageFile) return;

    const formData = new FormData();
    formData.append('file', this.selectedImageFile);

    // ใช้ HttpService upload method
    this.gameService['httpService'].upload('/upload', formData).subscribe({
      next: (response: any) => {
        console.log('Image uploaded successfully:', response);
        const imageUrl = response.path || response.url || '/assets/images/default-game.jpg';

        const gameData = {
          name,
          price,
          category,
          description,
          image: imageUrl,
        };

        this.saveGameData(gameData);
      },
      error: (error) => {
        console.error('Error uploading image:', error);
        this.errorMessage = 'ไม่สามารถอัปโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง';
        this.isLoading = false;
      },
    });
  }

  // เมธอดสำหรับบันทึกข้อมูลเกม
  private saveGameData(gameData: any): void {
    if (this.selectedGame) {
      // แก้ไขเกมที่มีอยู่
      const s = this.gameService.updateGame(this.selectedGame.id, gameData).subscribe({
        next: (updatedGame) => {
          if (updatedGame) {
            this.successMessage = 'แก้ไขเกมเรียบร้อยแล้ว';
            this.isLoading = false;

            // รีเฟรชข้อมูลเกมทั้งหมดเพื่อให้แน่ใจว่าข้อมูลล่าสุด
            this.loadDashboardData();

            // ปิด modal หลังจาก 1.5 วินาที
            setTimeout(() => {
              this.closeGameModal();
            }, 1500);
          } else {
            this.errorMessage = 'ไม่สามารถแก้ไขเกมได้';
            this.isLoading = false;
          }
        },
        error: (error) => {
          console.error('Error updating game:', error);
          this.errorMessage = error.message || 'เกิดข้อผิดพลาดในการแก้ไขเกม';
          this.isLoading = false;
        },
      });
      this.subs.push(s);
    } else {
      // เพิ่มเกมใหม่
      const s = this.gameService.addGame(gameData).subscribe({
        next: (newGame) => {
          if (newGame) {
            this.successMessage = 'เพิ่มเกมใหม่เรียบร้อยแล้ว';
            this.isLoading = false;

            // รีเฟรชข้อมูลเกมทั้งหมด
            this.loadDashboardData();

            // ปิด modal หลังจาก 1.5 วินาที
            setTimeout(() => {
              this.closeGameModal();
            }, 1500);
          } else {
            this.errorMessage = 'ไม่สามารถเพิ่มเกมได้';
            this.isLoading = false;
          }
        },
        error: (error) => {
          console.error('Error adding game:', error);
          this.errorMessage = error.message || 'เกิดข้อผิดพลาดในการเพิ่มเกม';
          this.isLoading = false;
        },
      });
      this.subs.push(s);
    }
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    target.src = '/assets/images/default-game.jpg';
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('th-TH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  }
  formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  }
  trackByGameId(_: number, g: Game) {
    return g.id;
  }

  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.errorMessage = 'กรุณาเลือกไฟล์รูปภาพเท่านั้น';
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        this.errorMessage = 'ขนาดไฟล์ต้องไม่เกิน 5MB';
        return;
      }

      this.selectedImageFile = file;
      this.clearMessages();

      // Create preview
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.imagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removeSelectedImage(): void {
    this.selectedImageFile = null;
    this.imagePreview = null;
    this.gameForm.image = '';

    // Reset file input
    const fileInput = document.getElementById('imageUpload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
