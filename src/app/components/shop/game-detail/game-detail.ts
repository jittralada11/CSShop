import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { GameService } from '../../../services/game.service';
import { CartService } from '../../../services/cart.service';
import { Game } from '../../../models/game.model';

@Component({
  selector: 'app-game-detail',
  imports: [CommonModule],
  templateUrl: './game-detail.html',
  styleUrl: './game-detail.css'
})
export class GameDetail implements OnInit {
  game: Game | null = null;
  isLoading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private gameService: GameService,
    private cartService: CartService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      const gameId = params['id'];
      if (gameId) {
        this.loadGameDetails(gameId);
      }
    });
  }

  loadGameDetails(gameId: number) {
    this.isLoading = true;
    this.error = ''; // Clear previous errors
    
    console.log('Loading game details for ID:', gameId); // Debug log
    
    this.gameService.getGameById(gameId).subscribe({
      next: (game) => {
        console.log('Received game data:', game); // Debug log
        if (game) {
          this.game = game;
          this.error = '';
        } else {
          this.error = 'ไม่พบเกมที่ต้องการ';
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Game detail error:', err); // Debug log
        
        // ใช้ error message จาก service ถ้ามี
        if (err && err.message) {
          this.error = err.message;
        } else if (typeof err === 'string') {
          this.error = err;
        } else {
          this.error = 'เกิดข้อผิดพลาดในการโหลดข้อมูลเกม กรุณาลองใหม่อีกครั้ง';
        }
        
        this.isLoading = false;
        this.game = null;
      }
    });
  }

  addToCart(game: Game) {
    this.cartService.addToCart(game);
    // Show success message or notification
  }

  goBack() {
    this.router.navigate(['/shop']);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB'
    }).format(price);
  }

  formatDate(date: Date): string {
    return new Intl.DateTimeFormat('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  }
}