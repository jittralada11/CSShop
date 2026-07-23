// export interface Transaction {
//   id: string;
//   userId: string;
//   type: 'topup' | 'purchase';
//   amount: number;
//   description: string;
//   createdAt: Date;
//   relatedPurchaseId?: string;
// }
export interface Transaction {
  trans_id: number;
  amount: number;
  type: 'topup' | 'purchase';
  description?: string;
  createdAt: string;
}

export interface WalletTopup {
  amount: number;
  paymentMethod?: string;
}