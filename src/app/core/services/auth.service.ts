import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';

import { User } from '../../store/models/auth.models';
import { getFirebaseBackend } from 'src/app/authUtils';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, map, tap } from 'rxjs/operators';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { GlobalComponent } from "../../global-component";
import { Router } from '@angular/router';

// Action
import { login, loginSuccess, loginFailure, logout, logoutSuccess, RegisterSuccess } from '../../store/actions/authentication.actions';

// Firebase
import { AngularFireAuth } from '@angular/fire/compat/auth';
import firebase from 'firebase/compat/app';

type Role = 'ADMIN' | 'USER';

const AUTH_API = GlobalComponent.AUTH_API;

const httpOptions = {
  headers: new HttpHeaders({ 'Content-Type': 'application/json' })
};

@Injectable({ providedIn: 'root' })
export class AuthenticationService {
  user!: User | null;
  private currentUserSubject: BehaviorSubject<User | null>;

  constructor(
    private http: HttpClient,
    private store: Store,
    private afAuth: AngularFireAuth,
    private router: Router
  ) {
    // seguridad al parsear localStorage si no existe
    const raw = localStorage.getItem('currentUser');
    this.currentUserSubject = new BehaviorSubject<User | null>(raw ? JSON.parse(raw) : null);
  }

  // --- Helpers públicos (roles / estado)
  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return !!this.currentUserValue;
  }

  isAdmin(): boolean {
    return this.currentUserValue?.role === 'ADMIN';
  }

  isUser(): boolean {
    return this.currentUserValue?.role === 'USER';
  }

  // --- Social auth (mantener igual)
  signInWithGoogle(): Promise<User> {
    const provider = new firebase.auth.GoogleAuthProvider();
    return this.signInWithPopup(provider);
  }

  signInWithFacebook(): Promise<User> {
    const provider = new firebase.auth.FacebookAuthProvider();
    return this.signInWithPopup(provider);
  }

  private async signInWithPopup(provider: firebase.auth.AuthProvider): Promise<User> {
    try {
      const result = await this.afAuth.signInWithPopup(provider);
      const user = result.user;
      // Retorna un objeto user simplificado; puedes mapear más campos si quieres
      return {
        // ejemplo (adaptar a tu User model)
        email: user?.email,
        first_name: user?.displayName,
        role: 'USER' // o lógica para asignar role por dominio de email, etc.
      } as unknown as User;
    } catch (error) {
      throw new Error('Failed to sign in with the specified provider.');
    }
  }

  signOut(): Promise<void> {
    // si quieres, además limpiar localStorage
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    this.currentUserSubject.next(null);
    this.store.dispatch(logout());
    this.store.dispatch(logoutSuccess());
    // navega a login
    this.router.navigateByUrl('/login');
    return this.afAuth.signOut();
  }

  // --- Registro
  register(email: string, first_name: string, password: string) {
    return this.http.post(AUTH_API + 'signup', {
      email,
      first_name,
      password,
    }, httpOptions).pipe(
      map((response: any) => {
        // si la API devuelve user y token, adapta aquí
        const user: User = response.user ?? response;
        // aseguramos role (fallback)
        if (!user.role) {
          user.role = (email.toLowerCase().includes('admin') ? 'ADMIN' : 'USER') as Role;
        }
        // persistir
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.currentUserSubject.next(user);
        this.store.dispatch(RegisterSuccess({ user }));
        return user;
      }),
      catchError((error: any) => {
        const errorMessage = 'Registro fallido';
        this.store.dispatch(loginFailure({ error: errorMessage }));
        return throwError(() => errorMessage);
      })
    );
  }

  // --- Login (adaptado para guardar role y token)
  login(email: string, password: string) {
    this.store.dispatch(login({ email, password }));

    return this.http.post(AUTH_API + 'signin', {
      email,
      password
    }, httpOptions).pipe(
      map((response: any) => {
        /**
         * IMPORTANTE:
         * Adapta esta parte según la forma en la que tu backend responda.
         * Dos formatos frecuentes:
         * 1) { token: '...', user: { email, first_name, role } }
         * 2) { email, first_name, role, token }
         *
         * Aquí intentamos soportar ambos de forma flexible.
         */
        const userResp = response.user ?? response;
        const token = response.token ?? (userResp.token ?? null);

        // construir objeto User
        const user: User = {
          ...userResp
        } as User;

        // fallback: si no hay role en la respuesta, asignar por heurística (solo para pruebas)
        if (!user.role) {
          user.role = email.toLowerCase().includes('admin') ? 'ADMIN' : 'USER';
        }

        // persistir en localStorage y BehaviorSubject
        localStorage.setItem('currentUser', JSON.stringify(user));
        if (token) {
          localStorage.setItem('token', token);
        }
        this.currentUserSubject.next(user);

        // dispatch ngrx
        this.store.dispatch(loginSuccess({ user }));
        return user;
      }),
      catchError((error: any) => {
        const errorMessage = 'Login failed';
        this.store.dispatch(loginFailure({ error: errorMessage }));
        return throwError(() => errorMessage);
      })
    );
  }

  logout(): Observable<void> {
    this.store.dispatch(logout());
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    this.currentUserSubject.next(null);
    this.store.dispatch(logoutSuccess());
    return of(undefined).pipe(
      tap(() => {
        this.router.navigateByUrl('/login');
      })
    );
  }

  resetPassword(email: string) {
    return this.http.post(AUTH_API + 'reset-password', { email }, httpOptions);
  }

  /**
   * Returns the current user (desde BehaviorSubject en vez del antiguo getFirebaseBackend directo)
   */
  public currentUser(): any {
    // si quieres mantener getFirebaseBackend, puedes combinar ambos
    const fbUser = getFirebaseBackend()?.getAuthenticatedUser();
    return this.currentUserValue ?? fbUser;
  }
}