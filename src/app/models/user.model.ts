export interface User {
  uid: number; // ✅ เปลี่ยนจาก id เป็น uid ให้ตรง DB
  username: string;
  email: string;
  image?: string; // ✅ backend ส่ง image (ไม่ใช่ profileImage)
  profileImage?: string; // ✅ สำหรับอัปเดตโปรไฟล์
  walletBalance?: number; // backend มี wallet_balance
  role: 'user' | 'admin';
  createdAt: string; // backend ส่ง created_at เป็น string
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  image?: string;
  role: 'user' | 'admin';
}

export interface AuthResponse {
  message: string;
  uid: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  image?: string;
  walletBalance?: number;
  createdAt?: string; // backend ส่ง created_at เป็น string
}
