import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { Transaction, WalletTopup } from '../models/transaction.model';
import { API_CONFIG } from '../config/api.config';
@Injectable({
  providedIn: 'root',
})
export class TransactionService {
  private baseUrl = API_CONFIG.baseUrl;
  private transactionsSubject = new BehaviorSubject<Transaction[]>([]);
  public transactions$ = this.transactionsSubject.asObservable();

  private transactions: Transaction[] = [];

  constructor(private http: HttpClient) {
    // Load transactions from localStorage
    // const savedTransactions = localStorage.getItem('transactions');
    // if (savedTransactions) {
    //   this.transactions = JSON.parse(savedTransactions);
    //   this.transactionsSubject.next(this.transactions);
    // }
  }

  // addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Observable<Transaction> {
  //   const newTransaction: Transaction = {
  //     ...transaction,
  //     id: (this.transactions.length + 1).toString(),
  //     createdAt: new Date()
  //   };

  //   this.transactions.push(newTransaction);
  //   this.updateTransactions();
  //   return of(newTransaction);
  // }

  // getUserTransactions(userId: string): Observable<Transaction[]> {
  //   const userTransactions = this.transactions.filter(t => t.userId === userId);
  //   return of(userTransactions);
  // }

  getAllTransactions(): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(`${API_CONFIG.baseUrl}/admin/transactions`);
  }

  // getTransactionsByType(userId: string, type: 'topup' | 'purchase'): Observable<Transaction[]> {
  //   const filtered = this.transactions.filter(t => t.userId === userId && t.type === type);
  //   return of(filtered);
  // }

  // topupWallet(userId: string, topupData: WalletTopup): Observable<Transaction> {
  //   const transaction: Omit<Transaction, 'id' | 'createdAt'> = {
  //     userId,
  //     type: 'topup',
  //     amount: topupData.amount,
  //     description: `Wallet top-up: ฿${topupData.amount}`
  //   };

  //   return this.addTransaction(transaction);
  // }

  // recordPurchase(userId: string, amount: number, purchaseId: string, description: string): Observable<Transaction> {
  //   const transaction: Omit<Transaction, 'id' | 'createdAt'> = {
  //     userId,
  //     type: 'purchase',
  //     amount: -amount, // Negative for purchases
  //     description,
  //     relatedPurchaseId: purchaseId
  //   };

  //   return this.addTransaction(transaction);
  // }

  // private updateTransactions(): void {
  //   this.transactionsSubject.next(this.transactions);
  //   localStorage.setItem('transactions', JSON.stringify(this.transactions));
  // }
  // ✅ ดึงประวัติการทำรายการจาก backend
  getUserTransactions(uid: number): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(`${this.baseUrl}/wallet/transactions?uid=${uid}`);
  }

  getTransactionsByUser(uid: number): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(`${API_CONFIG.baseUrl}/wallet/transactions?uid=${uid}`);
  }

  // ✅ เติมเงินกระเป๋า
  topupWallet(uid: number, amount: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/wallet/topup`, { uid, amount });
  }

  // ✅ ดึงยอดเงินคงเหลือ
  getWalletBalance(uid: number): Observable<{ uid: number; balance: number }> {
    return this.http.get<{ uid: number; balance: number }>(
      `${this.baseUrl}/wallet/balance?uid=${uid}`
    );
  }

  // ✅ บันทึกการซื้อเกม (ฝั่ง backend ต้องมี endpoint นี้ในอนาคต)
  recordPurchase(uid: number, amount: number, description: string): Observable<any> {
    const payload = { uid, amount, description };
    return this.http.post(`${this.baseUrl}/wallet/purchase`, payload);
  }
}
