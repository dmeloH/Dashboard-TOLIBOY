export interface User {
  id?: string;
  email?: string;
  first_name?: string;
  // cualquier otro campo que ya uses...
  role?: 'ADMIN' | 'USER';

  // campos añadidos para compatibilidad con las respuestas del backend
  token?: string; // token cuando la API lo retorne en root
  data?: any;     // algunos endpoints devuelven { data: {...} }
}