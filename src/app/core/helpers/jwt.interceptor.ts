import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent
} from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    try {
      const raw = localStorage.getItem('currentUser');
      const currentUser = raw ? JSON.parse(raw) : null;

      // soporta: currentUser.token | currentUser.data.token | token guardado directamente en localStorage
      const tokenFromUser = currentUser?.token ?? currentUser?.data?.token ?? localStorage.getItem('token');

      if (tokenFromUser) {
        request = request.clone({
          setHeaders: {
            Authorization: `Bearer ${tokenFromUser}`
          }
        });
      }
    } catch (e) {
      // si JSON.parse falla por cualquier motivo, no rompemos la petición; seguimos sin header
      console.warn('JwtInterceptor: no se pudo obtener token de localStorage', e);
    }

    return next.handle(request);
  }
}