export interface Game {
  id: number;
  name: string;
  price: number;
  category: GameCategory;
  image: string;
  description: string;
  releaseDate: Date;
  salesRank?: number;
  totalSales: number;
}

export interface GameCategory {
  id: string;
  name: string;
  description?: string;
}

export interface CartItem {
  game: Game;
  quantity: number;
}

export interface Purchase {
  id: string;
  userId: string;
  games: Game[];
  totalAmount: number;
  discountCode?: string;
  discountAmount: number;
  finalAmount: number;
  purchaseDate: Date;
}

export interface DiscountCode {
  id: string;
  code: string;
  discountPercentage: number;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
  expiryDate?: Date;
  createdAt: Date;
}