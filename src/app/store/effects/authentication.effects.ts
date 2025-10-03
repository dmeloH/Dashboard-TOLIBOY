import { Injectable, Inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { map, switchMap, catchError, exhaustMap, tap } from 'rxjs/operators';
import { from, of } from 'rxjs';
import { AuthenticationService } from '../../core/services/auth.service';
import { login, loginSuccess, loginFailure, logout, logoutSuccess, Register, signInWithFacebook, signInWithGoogle } from '../actions/authentication.actions';
import { Router } from '@angular/router';

@Injectable()
export class AuthenticationEffects {

  Register$ = createEffect(() =>
    this.actions$.pipe(
      ofType(Register),
      exhaustMap(({ email, first_name, password }) =>
        this.AuthenticationService.register(email, first_name, password).pipe(
          map((resp: any) => {
            // normalizar respuesta
            const storedUser = resp?.user ?? resp?.data ?? resp ?? null;
            const token = resp?.token ?? resp?.data?.token ?? resp?.user?.token ?? storedUser?.token ?? localStorage.getItem('token');
            if (storedUser) {
              localStorage.setItem('currentUser', JSON.stringify(storedUser));
            }
            if (token) {
              localStorage.setItem('token', token);
            }
            // Navegar a login (si quieres que vaya a login después del registro)
            this.router.navigate(['/auth/login']);
            return loginSuccess({ user: storedUser });
          }),
          catchError((error) => of(loginFailure({ error })))
        )
      )
    )
  );

  login$ = createEffect(() =>
    this.actions$.pipe(
      ofType(login),
      exhaustMap(({ email, password }) =>
        this.AuthenticationService.login(email, password).pipe(
          map((resp: any) => {
            // Normalizar respuesta defensivamente:
            // formatos soportados: { user: {...}, token: '...' }  OR { data: {...}, token: '...' } OR user en raíz
            const storedUser = resp?.user ?? resp?.data ?? resp ?? null;
            const token = resp?.token ?? resp?.data?.token ?? resp?.user?.token ?? storedUser?.token ?? localStorage.getItem('token');

            // Persistencia defensiva
            if (storedUser) {
              localStorage.setItem('currentUser', JSON.stringify(storedUser));
            } else {
              localStorage.removeItem('currentUser');
            }

            if (token) {
              localStorage.setItem('token', token);
            }

            // Debemos devolver una acción para que el effect despache algo
            return loginSuccess({ user: storedUser });
          }),
          catchError((error) => of(loginFailure({ error })))
        )
      )
    )
  );

  // efecto para reaccionar al loginSuccess y redirigir según rol
  loginSuccessRedirect$ = createEffect(() =>
    this.actions$.pipe(
      ofType(loginSuccess),
      tap(({ user }: any) => {
        const role = user?.role ?? (user?.data?.role ?? null);
        // Si el backend no devuelve role, puedes basarte en alguna heurística o dejar navegar al dashboard por defecto
        if (role === 'USER') {
          // redirigir user a kanban
          this.router.navigateByUrl('/apps/kanban');
        } else {
          // admin u otros roles van al root / dashboard
          this.router.navigateByUrl('/');
        }
      })
    ),
    { dispatch: false }
  );

  signInWithFacebook$ = createEffect(() =>
    this.actions$.pipe(
      ofType(signInWithFacebook),
      exhaustMap(() =>
        from(this.AuthenticationService.signInWithFacebook()).pipe(
          map((resp: any) => {
            const user = resp?.user ?? resp?.data ?? resp ?? null;
            const token = resp?.token ?? resp?.data?.token ?? user?.token ?? localStorage.getItem('token');
            if (user) {
              localStorage.setItem('currentUser', JSON.stringify(user));
            }
            if (token) {
              localStorage.setItem('token', token);
            }
            return loginSuccess({ user });
          }),
          catchError(error => of(loginFailure({ error })))
        )
      )
    )
  );

  signInWithGoogle$ = createEffect(() =>
    this.actions$.pipe(
      ofType(signInWithGoogle),
      exhaustMap(() =>
        from(this.AuthenticationService.signInWithGoogle()).pipe(
          map((resp: any) => {
            const user = resp?.user ?? resp?.data ?? resp ?? null;
            const token = resp?.token ?? resp?.data?.token ?? user?.token ?? localStorage.getItem('token');
            if (user) {
              localStorage.setItem('currentUser', JSON.stringify(user));
            }
            if (token) {
              localStorage.setItem('token', token);
            }
            return loginSuccess({ user });
          }),
          catchError(error => of(loginFailure({ error })))
        )
      )
    )
  );

  logout$ = createEffect(() =>
    this.actions$.pipe(
      ofType(logout),
      tap(() => {
        // Limpiar almacenamiento local al hacer logout
        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
        // puedes invocar servicios si necesitas
      }),
      exhaustMap(() => of(logoutSuccess()))
    )
  );

  constructor(
    @Inject(Actions) private actions$: Actions,
    private AuthenticationService: AuthenticationService,
    private router: Router) { }

}