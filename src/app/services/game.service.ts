import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { Game, GameCategory } from '../models/game.model';
import { HttpService } from './http.service';
import { API_CONFIG } from '../config/api.config';

@Injectable({ providedIn: 'root' })
export class GameService {
  private baseUrl = API_CONFIG.baseUrl;
  private gamesSubject = new BehaviorSubject<Game[]>([]);
  public games$ = this.gamesSubject.asObservable();

  private categoriesSubject = new BehaviorSubject<GameCategory[]>([]);
  public categories$ = this.categoriesSubject.asObservable();

  private games: Game[] = [];
  private categories: GameCategory[] = [];

  constructor(private httpService: HttpService) {}

  // ===== READ =====
  getGames(): Observable<Game[]> {
    return this.httpService.get<any[]>('/games').pipe(
      map((list) => list.map(this.transformBackendGameToFrontend)),
      tap((g) => {
        this.games = g;
        this.gamesSubject.next(g);
      }),
      catchError((err) => {
        console.error('GET /games failed:', err);
        return of(this.games);
      })
    );
  }

  getUserGames(userId: string): Observable<Game[]> {
    return this.httpService.get<any[]>(`/users/${userId}/games`).pipe(
      map((list) => list.map(this.transformBackendGameToFrontend)),
      catchError((err) => {
        console.error(`GET /users/${userId}/games failed:`, err);
        return of([]);
      })
    );
  }

  getCategories(): Observable<GameCategory[]> {
    return this.httpService.get<any[]>('/game-types').pipe(
      map((list) => list.map(this.transformBackendCategoryToFrontend)),
      tap((cats) => {
        this.categories = cats;
        this.categoriesSubject.next(cats);
      }),
      catchError((err) => {
        console.error('GET /game-types failed:', err);
        return of(this.categories);
      })
    );
  }

  // ===== CREATE =====
  addGame(
    game: Omit<Game, 'id' | 'totalSales' | 'releaseDate'> & {
      releaseDate?: string | Date;
      sales?: number;
    }
  ): Observable<Game> {
    if (!this.validateGameData(game)) return throwError(() => 'ข้อมูลเกมไม่ถูกต้อง');

    const releaseISO = game.releaseDate ? this.toISODateString(game.releaseDate) : this.todayISO();
    const body = {
      name: game.name,
      description: game.description,
      release_date: releaseISO,
      sales: game['sales'] ?? 0,
      price: game.price,
      image: game.image || '',
      type_id: parseInt(game.category.id, 10),
    };

    return this.httpService.post<any>('/game/add', body).pipe(
      map((res) =>
        res?.game_id
          ? this.transformBackendGameToFrontend(res)
          : ({
              id: Date.now(),
              name: game.name,
              price: game.price,
              category: game.category,
              image: game.image || '/assets/images/default-game.jpg',
              description: game.description,
              releaseDate: new Date(releaseISO),
              totalSales: game['sales'] ?? 0,
            } as Game)
      ),
      tap(() => this.getGames().subscribe()),
      catchError((err) => {
        console.error('POST /game failed:', err);
        const temp: Game = {
          id: this.games.length + 1,
          name: game.name,
          price: game.price,
          category: game.category,
          image: game.image || '/assets/images/default-game.jpg',
          description: game.description,
          releaseDate: new Date(releaseISO),
          totalSales: game['sales'] ?? 0,
        };
        this.games.push(temp);
        this.gamesSubject.next(this.games);
        return of(temp);
      })
    );
  }

  // ===== UPDATE =====
  updateGame(
    id: number | string,
    updates: Partial<Game> & { releaseDate?: string | Date; sales?: number }
  ): Observable<Game | null> {
    if (!this.validateGameUpdateData(updates)) {
      return throwError(() => new Error('ข้อมูลการอัปเดตไม่ถูกต้อง'));
    }

    const numericId = typeof id === 'number' ? id : parseInt(id, 10);

    const body: any = {
      game_id: numericId,
      name: updates.name || '',
      price: updates.price || 0,
      type_id: updates.category ? parseInt(updates.category.id, 10) : 0,
      description: updates.description || '',
      image: updates.image || '/assets/images/default-game.jpg',
    };

    if (updates['sales'] != null) body.sales = updates['sales'];

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    return this.httpService.put<any>(`/game/update`, body, { headers }).pipe(
      map((response) => {
        if (response && response.game) {
          return this.transformBackendGameToFrontend(response.game);
        }
        return null;
      }),
      tap((updatedGame) => {
        if (updatedGame) {
          const gameIndex = this.games.findIndex((g) => g.id === numericId);
          if (gameIndex > -1) {
            this.games[gameIndex] = updatedGame;
            this.gamesSubject.next([...this.games]);
          }
        }
      }),
      catchError((error) => {
        console.error('Error updating game via REST API:', error);
        return throwError(() => new Error('ไม่สามารถอัปเดตเกมได้ กรุณาลองใหม่อีกครั้ง'));
      })
    );
  }

  // ===== DELETE =====
  deleteGame(id: number | string): Observable<boolean> {
    const numericId = typeof id === 'number' ? id : parseInt(id, 10);

    return this.httpService.delete<any>(`/game/delete/${numericId}`).pipe(
      map((res) => {
        return !!(res && (res.message || res.deleted_count));
      }),
      tap((ok) => {
        if (ok) {
          this.games = this.games.filter((g) => g.id !== numericId);
          this.gamesSubject.next([...this.games]);
        }
      }),
      catchError((err) => {
        console.error('DELETE /games failed:', err);
        return throwError(() => new Error('ไม่สามารถลบเกมได้ กรุณาลองใหม่อีกครั้ง'));
      })
    );
  }

  // ===== Helpers =====
  private validateGameData(game: Omit<Game, 'id' | 'totalSales' | 'releaseDate'>): boolean {
    if (!game.name?.trim()) return false;
    if (!game.price || game.price <= 0) return false;
    if (!game.category?.id) return false;
    if (!game.description?.trim()) return false;
    if (!game.image?.trim()) return false;
    return true;
  }

  private validateGameUpdateData(updates: Partial<Game>): boolean {
    if (updates.name !== undefined && !updates.name.trim()) return false;
    if (updates.price !== undefined && updates.price <= 0) return false;
    if (updates.category !== undefined && !updates.category?.id) return false;
    if (updates.description !== undefined && !updates.description.trim()) return false;
    return true;
  }

  private transformBackendGameToFrontend = (b: any): Game => ({
    id: Number(b.game_id),
    name: b.name,
    price: b.price,
    category: {
      id: String(b.type_id),
      name: b.type_name ?? '',
      description: `${b.type_name ?? ''} games`,
    },
    image: b.image || '/assets/images/default-game.jpg',
    description: b.description,
    releaseDate: new Date(b.release_date),
    totalSales: b.sales ?? 0,
    salesRank: undefined,
  });

  private transformBackendCategoryToFrontend = (c: any): GameCategory => ({
    id: String(c.type_id),
    name: c.type_name,
    description: `${c.type_name} games`,
  });

  private todayISO(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private toISODateString(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  getGameById(id: number | string): Observable<Game | null> {
    const numericId = typeof id === 'number' ? id : parseInt(id, 10);
    return this.httpService.get<any>(`/game/${numericId}`).pipe(
      map((response) => {
        if (response && response.error) {
          throw new Error(response.error);
        }
        
        if (!response || !response.game_id) {
          return null;
        }
        
        return this.transformBackendGameToFrontend(response);
      }),
      catchError((error) => {
        console.error('Error fetching game by ID:', error);
        if (error.message && error.message.includes('Server Error Code: 200')) {
          return throwError(() => new Error('ไม่พบเกมที่ต้องการ หรือเกิดข้อผิดพลาดจาก server'));
        }
        return throwError(() => new Error('ไม่สามารถโหลดข้อมูลเกมได้ กรุณาลองใหม่อีกครั้ง'));
      })
    );
  }

  searchGames(searchTerm: string): Observable<Game[]> {
    if (!searchTerm.trim()) {
      return this.getGames();
    }

    return this.getGames().pipe(
      map((games) =>
        games.filter(
          (game) =>
            game.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            game.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            game.category.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    );
  }

  validateDiscountCode(
    code: string
  ): Observable<{ valid: boolean; discount: number; message: string }> {
    return of({
      valid: code === 'DISCOUNT10',
      discount: code === 'DISCOUNT10' ? 0.1 : 0,
      message: code === 'DISCOUNT10' ? 'Valid discount code' : 'Invalid discount code',
    });
  }

  purchaseGames(purchaseData: {
    games: Game[];
    totalAmount: number;
    discountCode?: string;
  }): Observable<{ success: boolean; purchaseId: string; message: string }> {
    return of({
      success: true,
      purchaseId: Date.now().toString(),
      message: 'Purchase completed successfully',
    });
  }
}
