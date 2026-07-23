// import { Injectable } from '@angular/core';
// import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
// import { Observable, throwError } from 'rxjs';
// import { catchError, retry } from 'rxjs/operators';

// @Injectable({
//   providedIn: 'root'
// })
// export class HttpService {
//   private baseUrl = 'http://192.168.5.70:8080'; // Backend API URL (Real server with database)

//   private httpOptions = {
//     headers: new HttpHeaders({
//       'Content-Type': 'application/json',
//       'Accept': 'application/json'
//     })
//   };

//   constructor(private http: HttpClient) {}

//   // GET request
//   get<T>(endpoint: string): Observable<T> {
//     return this.http.get<T>(`${this.baseUrl}${endpoint}`, this.httpOptions)
//       .pipe(
//         retry(1),
//         catchError(this.handleError)
//       );
//   }

//   // POST request
//   post<T>(endpoint: string, data: any): Observable<T> {
//     return this.http.post<T>(`${this.baseUrl}${endpoint}`, data, this.httpOptions)
//       .pipe(
//         retry(1),
//         catchError(this.handleError)
//       );
//   }

//   // PUT request
//   put<T>(endpoint: string, data: any): Observable<T> {
//     return this.http.put<T>(`${this.baseUrl}${endpoint}`, data, this.httpOptions)
//       .pipe(
//         retry(1),
//         catchError(this.handleError)
//       );
//   }

//   // DELETE request
//   delete<T>(endpoint: string): Observable<T> {
//     return this.http.delete<T>(`${this.baseUrl}${endpoint}`, this.httpOptions)
//       .pipe(
//         retry(1),
//         catchError(this.handleError)
//       );
//   }

//   // Error handling
//   private handleError(error: HttpErrorResponse) {
//     let errorMessage = '';
    
//     if (error.error instanceof ErrorEvent) {
//       // Client-side error
//       errorMessage = `Client Error: ${error.error.message}`;
//     } else {
//       // Server-side error
//       errorMessage = `Server Error Code: ${error.status}\nMessage: ${error.message}`;
//     }
    
//     console.error(errorMessage);
//     return throwError(() => errorMessage);
//   }

//   // Set authorization header
//   setAuthToken(token: string): void {
//     this.httpOptions.headers = this.httpOptions.headers.set('Authorization', `Bearer ${token}`);
//   }

//   // Remove authorization header
//   removeAuthToken(): void {
//     this.httpOptions.headers = this.httpOptions.headers.delete('Authorization');
//   }
// }
import { Injectable } from '@angular/core';
import {
  HttpClient, HttpHeaders, HttpParams, HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { API_CONFIG } from '../config/api.config';
@Injectable({
  providedIn: 'root'
})
export class HttpService {
  private baseUrl = API_CONFIG.baseUrl;
  // private baseUrl = 'https://csgamebackend-production.up.railway.app'; // Backend API URL (Real server with database)

  private defaultHeaders = new HttpHeaders({
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  });

  constructor(private http: HttpClient) {}

  private buildOptions(options?: {
    params?: Record<string, string | number | boolean>;
    headers?: HttpHeaders | Record<string, string>;
  }) {
    let headers = options?.headers instanceof HttpHeaders ? options.headers : this.defaultHeaders;
    if (options?.headers && !(options.headers instanceof HttpHeaders)) {
      for (const [k, v] of Object.entries(options.headers)) headers = headers.set(k, v);
    }
    let params = new HttpParams();
    if (options?.params) for (const [k, v] of Object.entries(options.params)) params = params.set(k, String(v));
    return { headers, params };
  }

  private handleError(error: HttpErrorResponse) {
    const serverMsg = (typeof error.error === 'string' && error.error) || (error.error?.message ?? error.statusText);
    const msg = error.error instanceof ErrorEvent
      ? `Client Error: ${error.error.message}`
      : `Server Error Code: ${error.status}\nMessage: ${serverMsg}`;
    console.error('[HTTP ERROR]', msg, error);
    return throwError(() => msg);
  }

  get<T>(endpoint: string, options?: { params?: Record<string, string | number | boolean>; headers?: HttpHeaders | Record<string, string> }): Observable<T> {
    const opts = this.buildOptions(options);
    return this.http.get<T>(`${this.baseUrl}${endpoint}`, opts).pipe(retry(1), catchError(this.handleError));
  }

  post<T>(endpoint: string, data: any, options?: { params?: Record<string, string | number | boolean>; headers?: HttpHeaders | Record<string, string> }): Observable<T> {
    const opts = this.buildOptions(options);
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, data, opts).pipe(retry(1), catchError(this.handleError));
  }

  put<T>(endpoint: string, data: any, options?: { params?: Record<string, string | number | boolean>; headers?: HttpHeaders | Record<string, string> }): Observable<T> {
    const opts = this.buildOptions(options);
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, data, opts).pipe(retry(1), catchError(this.handleError));
  }

  // ✅ ลบพร้อมแนบ query param เช่น /game?id=123
  delete<T>(endpoint: string, options?: { params?: Record<string, string | number | boolean>; headers?: HttpHeaders | Record<string, string> }): Observable<T> {
    const opts = this.buildOptions(options);
    return this.http.request<T>('DELETE', `${this.baseUrl}${endpoint}`, { ...opts }).pipe(retry(1), catchError(this.handleError));
  }

  setAuthToken(token: string) { this.defaultHeaders = this.defaultHeaders.set('Authorization', `Bearer ${token}`); }
  removeAuthToken() { this.defaultHeaders = this.defaultHeaders.delete('Authorization'); }

  // (optional) multipart upload
  upload<T>(endpoint: string, formData: FormData, options?: { params?: Record<string, string | number | boolean>; headers?: HttpHeaders | Record<string, string> }): Observable<T> {
    const headers = new HttpHeaders({ Accept: 'application/json' });
    const merged = this.buildOptions({ ...options, headers });
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, formData, merged).pipe(retry(1), catchError(this.handleError));
  }
}
