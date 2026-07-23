import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { catchError, tap } from 'rxjs/operators';
import { map } from 'rxjs/operators';
import { User, LoginRequest, RegisterRequest, AuthResponse } from '../models/user.model';
import { API_CONFIG } from '../config/api.config';
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private baseUrl = API_CONFIG.baseUrl; // ✅ URL ของ Go backend
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    // โหลด user ที่เคย login จาก localStorage
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      this.currentUserSubject.next(JSON.parse(savedUser));
    }
  }

  // Login
  login(loginData: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, loginData).pipe(
      tap((res) => {
        // ✅ เก็บข้อมูลจาก backend ให้ครบทุกฟิลด์
        const user: User = {
          uid: res.uid,
          username: res.username,
          email: res.email,
          role: res.role,
          image: res.image || 'https://placehold.co/150x150?text=No+Image', // แก้ placeholder
          profileImage: res.image || 'https://placehold.co/150x150?text=No+Image',
          createdAt: res.createdAt || '', // ✅ เก็บวันสร้างจาก backend
          walletBalance: res.walletBalance || 0,
        };

        // ✅ บันทึกลง localStorage
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.currentUserSubject.next(user);
      }),
      catchError((error) => {
        console.error('Login failed:', error);
        return throwError(() => new Error(error.error || 'Login failed'));
      })
    );
  }

  // 🔹 Register
  register(registerData: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, registerData).pipe(
      tap((res) => {
        const user: User = {
          uid: res.uid || 0,
          username: res.username,
          email: res.email,
          role: res.role,
          image: res.image || 'https://via.placeholder.com/150',
          walletBalance: 0,
          createdAt: res.createdAt || '',
        };

        localStorage.setItem('currentUser', JSON.stringify(user));
        this.currentUserSubject.next(user);
      }),
      catchError((error) => {
        console.error('Register failed:', error);
        return throwError(() => new Error(error.error || 'Register failed'));
      })
    );
  }

  // 🔹 Logout
  logout(): void {
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
  }

  // 🔹 Helpers
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  isAdmin(): boolean {
    return this.getCurrentUser()?.role === 'admin';
  }
  // อัปเดตข้อมูลโปรไฟล์
  updateProfile(
    uid: number,
    profileData: { username: string; email: string; profileImage?: string }
  ): Observable<User> {
    return this.http
      .put<User>(`${this.baseUrl}/update-profile`, {
        uid: uid,
        username: profileData.username,
        email: profileData.email,
        profileImage: profileData.profileImage,
      })
      .pipe(
        tap((updatedUser) => {
          // ✅ สร้าง object user ครบทุกฟิลด์
          const user: User = {
            uid: updatedUser.uid,
            username: updatedUser.username,
            email: updatedUser.email,
            role: updatedUser.role,
            image: updatedUser.profileImage || updatedUser.image || '',
            profileImage: updatedUser.profileImage || updatedUser.image || '',
            walletBalance: updatedUser.walletBalance || 0,
            createdAt: updatedUser.createdAt || '', // ✅ เพิ่มบรรทัดนี้
          };

          // ✅ บันทึกลง localStorage
          localStorage.setItem('currentUser', JSON.stringify(user));
          this.currentUserSubject.next(user);
        }),
        catchError((error) => {
          console.error('Update profile failed:', error);
          return throwError(() => new Error(error.error || 'Update profile failed'));
        })
      );
  }

  // เติมเงิน Wallet
  topUpWallet(uid: number, amount: number): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/wallet/topup`, {
      uid,
      amount,
    });
  }

  // 🔹 ดึงข้อมูลผู้ใช้ทั้งหมดพร้อมยอดเงินใน Wallet (สำหรับ Admin Dashboard)
  getUsersWithWallet(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/admin/users-wallet`).pipe(
      catchError((error) => {
        console.error('Error fetching users with wallet:', error);
        return throwError(() => new Error(error.error || 'Failed to fetch users'));
      })
    );
  }
}
