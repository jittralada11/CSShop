import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { TransactionService } from '../../../services/transaction.service';
import { User } from '../../../models/user.model';
import { Transaction } from '../../../models/transaction.model';
import { API_CONFIG } from '../../../config/api.config';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile implements OnInit {
  private baseUrl = API_CONFIG.baseUrl; // ✅ URL ของ Go backend

  currentUser: User | null = null;
  transactions: Transaction[] = [];
  isLoading = false;
  errorMessage = '';
  successMessage = '';

  // Edit profile form
  isEditingProfile = false;
  editForm = {
    username: '',
    email: '',
    profileImage: '',
  };

  // Wallet top-up
  isTopUpModalOpen = false;
  topUpAmount = 0;

  // Transaction filters
  transactionFilter = 'all'; // all, purchase, topup
  transactionSort = 'newest'; // newest, oldest, amount_high, amount_low

  constructor(
    private authService: AuthService,
    private transactionService: TransactionService,
    private router: Router
  ) {}

  ngOnInit() {
    // ✅ ล้าง state เก่าก่อนโหลดใหม่
    this.errorMessage = '';
    this.successMessage = '';
    this.previewUrl = null;
    this.loadUserProfile();
    // this.loadTransactions();
    setTimeout(() => {
      this.loadWalletBalance();
      this.loadTransactions();
    }, 300);
  }

  loadUserProfile() {
    this.isLoading = true;

    this.authService.currentUser$.subscribe({
      next: (user: User | null) => {
        // ✅ 1) ถ้า user จาก service ว่าง → ดึงจาก localStorage
        if (!user) {
          const storedUser = localStorage.getItem('currentUser');
          if (storedUser) {
            user = JSON.parse(storedUser);
            this.authService['currentUserSubject'].next(user); // ✅ update service ด้วย
          }
        }

        // ✅ 2) ถ้าได้ user แล้ว อัปเดตข้อมูลทุกฟิลด์
        if (user) {
          this.currentUser = user;
          this.editForm = {
            username: user.username,
            email: user.email,
            profileImage: user.image || user.profileImage || '',
          };

          // ✅ ตั้ง previewUrl เสมอ (ป้องกันกรณีรูปหาย)
          this.previewUrl =
            user.image || user.profileImage || 'https://placehold.co/150x150?text=No+Image';
        } else {
          // ❌ 3) ถ้าไม่มีเลยจริง ๆ (เช่นยังไม่ login) → ส่งกลับหน้า login
          this.router.navigate(['/login']);
        }

        this.isLoading = false;
      },
      error: (error: Error) => {
        console.error('Error loading user profile:', error);
        this.errorMessage = 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้';
        this.isLoading = false;
      },
    });
  }

  loadWalletBalance() {
    if (!this.currentUser) return;

    fetch(`${this.baseUrl}/wallet/balance?uid=${this.currentUser.uid}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.balance !== undefined) {
          this.currentUser!.walletBalance = data.balance;
          localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        }
      })
      .catch((err) => {
        console.error('Error loading wallet balance:', err);
      });
  }

  loadTransactions() {
    if (!this.currentUser) return;

    this.isLoading = true;
    fetch(`${this.baseUrl}/wallet/transactions?uid=${this.currentUser.uid}`)
      .then((res) => res.json())
      .then((data) => {
        this.transactions = data.map((t: any) => ({
          trans_id: t.trans_id,
          amount: t.amount,
          type: t.type,
          description: t.description || (t.type === 'topup' ? 'เติมเงินเข้าระบบ' : 'ซื้อเกม'),
          createdAt: t.createdAt,
        }));

        this.applyTransactionFilters();
        this.isLoading = false;
      })
      .catch((err) => {
        console.error('Error loading transactions:', err);
        this.errorMessage = 'ไม่สามารถโหลดประวัติการทำรายการได้';
        this.isLoading = false;
      });
  }

  applyTransactionFilters() {
    let filteredTransactions = [...this.transactions];

    // Apply filter
    if (this.transactionFilter !== 'all') {
      filteredTransactions = filteredTransactions.filter((t) => t.type === this.transactionFilter);
    }

    // Apply sort
    switch (this.transactionSort) {
      case 'newest':
        filteredTransactions.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case 'oldest':
        filteredTransactions.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        break;
      case 'amount_high':
        filteredTransactions.sort((a, b) => b.amount - a.amount);
        break;
      case 'amount_low':
        filteredTransactions.sort((a, b) => a.amount - b.amount);
        break;
    }

    this.transactions = filteredTransactions;
  }

  onFilterChange() {
    this.applyTransactionFilters();
  }

  startEditProfile() {
    this.isEditingProfile = true;
    this.errorMessage = '';
    this.successMessage = '';
  }

  cancelEditProfile() {
    this.isEditingProfile = false;
    if (this.currentUser) {
      this.editForm = {
        username: this.currentUser.username,
        email: this.currentUser.email,
        profileImage: this.currentUser.image || '',
      };
    }
  }

  previewUrl: string | ArrayBuffer | null = null;

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);

      // ✅ แสดง preview ทันที (เฉพาะ UI เท่านั้น)
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.previewUrl = e.target.result;
      };
      reader.readAsDataURL(file);

      // ✅ upload ไป backend
      fetch(`${this.baseUrl}/upload`, {
        method: 'POST',
        body: formData,
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.path) {
            this.editForm.profileImage = data.path;
            this.previewUrl = `${data.path}?t=${Date.now()}`;
            console.log('📸 รูปถูกอัปโหลดไป Cloudinary แล้ว:', data.path);

            // ✅ อัปเดต currentUser ทันทีหลังอัปโหลดรูป
            if (this.currentUser) {
              this.currentUser.image = data.path;
              this.currentUser.profileImage = data.path;
              localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
              this.authService['currentUserSubject'].next(this.currentUser);
            }
          }
        })
        .catch((err) => {
          console.error('Upload failed:', err);
          this.errorMessage = 'อัปโหลดรูปไม่สำเร็จ';
        });
    }
  }

  saveProfile() {
    if (!this.currentUser) return;

    // ✅ ตรวจแค่ว่ามี email (กันไม่ให้ว่าง)
    if (!this.editForm.email.trim()) {
      this.errorMessage = 'กรุณากรอกอีเมล';
      return;
    }

    const newImage =
      this.editForm.profileImage && this.editForm.profileImage.trim() !== ''
        ? this.editForm.profileImage
        : this.currentUser.image ||
          this.currentUser.profileImage ||
          'https://placehold.co/150x150?text=No+Image';

    console.log('ส่งข้อมูลอัปเดต:', {
      uid: this.currentUser.uid,
      username: this.editForm.username,
      email: this.editForm.email,
      profileImage: newImage,
    });

    this.isLoading = true;
    this.authService
      .updateProfile(this.currentUser.uid, {
        username: this.editForm.username || this.currentUser.username, // ✅ ใช้ค่าเดิมถ้าเว้นว่าง
        email: this.editForm.email,
        profileImage: newImage,
      })
      .subscribe({
        next: (updatedUser: User) => {
          const newImageUrl = `${newImage}?t=${Date.now()}`;

          const mergedUser = {
            ...this.currentUser,
            ...updatedUser,
            image: newImageUrl,
            profileImage: newImageUrl,
          };

          this.currentUser = mergedUser;
          this.previewUrl = newImageUrl;
          localStorage.setItem('currentUser', JSON.stringify(mergedUser));
          this.authService['currentUserSubject'].next(mergedUser);

          this.successMessage = 'อัปเดตข้อมูลสำเร็จ';
          this.isEditingProfile = false;
          this.isLoading = false;
        },
        error: (error: any) => {
          console.error('Update failed:', error);
          this.errorMessage = 'ไม่สามารถอัปเดตข้อมูลได้';
          this.isLoading = false;
        },
      });
  }

  openTopUpModal() {
    this.isTopUpModalOpen = true;
    this.topUpAmount = 0;
    this.errorMessage = '';
    this.successMessage = '';
  }

  closeTopUpModal() {
    this.isTopUpModalOpen = false;
    this.topUpAmount = 0;
  }

  topUpWallet() {
    if (!this.currentUser) return;

    if (this.topUpAmount <= 0) {
      this.errorMessage = 'กรุณาใส่จำนวนเงินที่ถูกต้อง';
      return;
    }

    if (this.topUpAmount > 10000) {
      this.errorMessage = 'จำนวนเงินต่อครั้งไม่เกิน 10,000 บาท';
      return;
    }

    this.isLoading = true;
    this.authService.topUpWallet(this.currentUser.uid, this.topUpAmount).subscribe({
      next: (res: any) => {
        // ✅ อัปเดตยอดเงินใน currentUser (เพิ่มฟิลด์ walletBalance)
        if (this.currentUser) {
          this.currentUser.walletBalance = res.balance;
          localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        }

        this.successMessage = `เติมเงินสำเร็จ ${this.formatPrice(this.topUpAmount)}`;
        this.closeTopUpModal(); // ปิด Modal หลังเติมเงินเสร็จ
        this.isLoading = false;
      },
      error: (error: any) => {
        this.errorMessage = 'ไม่สามารถเติมเงินได้';
        this.isLoading = false;
        console.error('Error topping up wallet:', error);
      },
    });
  }

  navigateToLibrary() {
    this.router.navigate(['/library']);
  }

  navigateToShop() {
    this.router.navigate(['/shop']);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
    }).format(price);
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getTransactionTypeText(type: string): string {
    switch (type) {
      case 'purchase':
        return 'ซื้อเกม';
      case 'topup':
        return 'เติมเงิน';
      default:
        return type;
    }
  }

  getTransactionIcon(type: string): string {
    switch (type) {
      case 'purchase':
        return 'M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 11-4 0v-6m4 0V9a2 2 0 10-4 0v4.01';
      case 'topup':
        return 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
      default:
        return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z';
    }
  }
}
