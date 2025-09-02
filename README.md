# My Accountant App (Next.js + Firebase)

Este paquete contiene **solo el código de la app** migrado desde tu SPA a Next.js (App Router).
Incluye autenticación con Firebase, Dashboard, CRUD de Entidades/Cuentas, Transferencias y FX.

## Pasos
1. Instalar dependencias (asegurate de tener `firebase`):
   ```bash
   npm i firebase
   ```
2. Ejecutar en desarrollo:
   ```bash
   npm run dev
   ```

> Config de Firebase está embebida en `src/lib/firebase.ts` y debería migrarse a variables de entorno al desplegar.
