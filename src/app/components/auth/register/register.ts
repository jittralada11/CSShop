import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http'; // ✅ เพิ่มเข้ามา
import { AuthService } from '../../../services/auth';
import { RegisterRequest } from '../../../models/user.model';
import { API_CONFIG } from '../../../config/api.config';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  private baseUrl = API_CONFIG.baseUrl; // ✅ URL ของ Go backend

  registerData: RegisterRequest = {
    username: '',
    email: '',
    password: '',
    image: '',
    role: 'user',
  };

  confirmPassword = '';
  errorMessage = '';
  isLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient // ✅ inject HttpClient
  ) {}

  onSubmit(): void {
    if (!this.registerData.username || !this.registerData.email || !this.registerData.password) {
      this.errorMessage = 'กรุณากรอกข้อมูลให้ครบถ้วน';
      return;
    }

    if (this.registerData.password !== this.confirmPassword) {
      this.errorMessage = 'รหัสผ่านไม่ตรงกัน';
      return;
    }

    if (this.registerData.password.length < 6) {
      this.errorMessage = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.register(this.registerData).subscribe({
      next: (response) => {
        this.isLoading = false;
        localStorage.setItem('currentUser', JSON.stringify(response));
        this.router.navigate(['/shop']);
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.message || 'การสมัครสมาชิกล้มเหลว';
      },
    });
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  previewUrl: string | ArrayBuffer | null = null;
  selectedFile: File | null = null;
  imagePreview: string | null = null;

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.errorMessage = 'Please select a valid image file';
        return;
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        this.errorMessage = 'File size must be less than 5MB';
        return;
      }
      
      this.selectedFile = file;
      
      // Preview the image
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.imagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }
}
