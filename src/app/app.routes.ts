import { Routes } from '@angular/router';
import { Login } from './components/auth/login/login';
import { Register } from './components/auth/register/register';
import { Shop } from './components/shop/shop/shop';
import { GameDetail } from './components/shop/game-detail/game-detail';
import { Cart } from './components/shop/cart/cart';
import { Profile } from './components/user/profile/profile';
import { Library } from './components/user/library/library';
import { Dashboard } from './components/admin/dashboard/dashboard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'shop', component: Shop },
  { path: 'game/:id', component: GameDetail },
  { path: 'cart', component: Cart },
  { path: 'profile', component: Profile },
  { path: 'library', component: Library },
  { path: 'admin', component: Dashboard },
  { path: '**', redirectTo: '/login' }
];
