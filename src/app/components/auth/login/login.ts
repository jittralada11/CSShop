import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth';
import { LoginRequest } from '../../../models/user.model';
import { API_CONFIG } from '../../../config/api.config';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private baseUrl = API_CONFIG.baseUrl; // ✅ URL ของ Go backend

  loginData: LoginRequest = {
    email: '',
    password: '',
  };

  errorMessage = '';
  isLoading = false;

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit(): void {
    if (!this.loginData.email || !this.loginData.password) {
      this.errorMessage = 'Please fill in all fields';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.loginData).subscribe({
      next: (response: any) => {
        this.isLoading = false;

        // ✅ สร้าง user object จากข้อมูล backend
        const user = {
          uid: response.uid,
          username: response.username,
          email: response.email,
          role: response.role,
          image: response.image || 'https://placehold.co/150x150?text=No+Image',
          profileImage: response.image || 'https://placehold.co/150x150?text=No+Image',
          createdAt: response.createdAt || '',
        };

        // ✅ เก็บ user ลง localStorage
        localStorage.setItem('currentUser', JSON.stringify(user));

        // ✅ ตรวจ role แล้วเปลี่ยนหน้า
        if (user.role === 'admin') {
          this.router.navigate(['/shop']);
        } else {
          this.router.navigate(['/shop']);
        }
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error || 'Login failed';
      },
    });
  }

  navigateToRegister(): void {
    this.router.navigate(['/register']);
  }
}
