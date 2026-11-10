import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
  type Firestore,
} from 'firebase/firestore'

const env = import.meta.env

const useEmulators = env.VITE_USE_EMULATORS === 'true'

export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'demo-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  // Con emuladores basta un id "demo-*": no toca ningún proyecto real.
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'demo-torreconta',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})

// App Check: solo las peticiones que vienen de esta web (verificadas con
// reCAPTCHA v3) llegan a Firestore. Se activa al configurar la clave.
if (env.VITE_RECAPTCHA_SITE_KEY && !useEmulators) {
  initializeAppCheck(app, { provider: new ReCaptchaV3Provider(env.VITE_RECAPTCHA_SITE_KEY), isTokenAutoRefreshEnabled: true })
}

export const auth = getAuth(app)
if (useEmulators) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })

/* ─────────────── Equipo compartido y caché local ─────────────── */

const CLAVE_COMPARTIDO = 'torreconta.equipoCompartido'

export function esEquipoCompartido(): boolean {
  try {
    return localStorage.getItem(CLAVE_COMPARTIDO) === '1'
  } catch {
    return true // si no hay almacenamiento, lo prudente es no guardar nada
  }
}

export function marcarEquipoCompartido(compartido: boolean) {
  try {
    if (compartido) localStorage.setItem(CLAVE_COMPARTIDO, '1')
    else localStorage.removeItem(CLAVE_COMPARTIDO)
  } catch {
    /* sin almacenamiento disponible */
  }
}

/**
 * Firestore se inicializa al entrar (no al cargar la página) para poder elegir
 * la caché: en un equipo compartido solo en memoria, de modo que no quede
 * ningún dato guardado en el navegador; si no, caché persistente (IndexedDB)
 * para trabajar sin conexión.
 */
export let db: Firestore = undefined as unknown as Firestore
let iniciada = false

export function iniciarFirestore(): Firestore {
  if (iniciada) return db
  db = initializeFirestore(app, {
    localCache: esEquipoCompartido()
      ? memoryLocalCache()
      : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
  if (useEmulators) connectFirestoreEmulator(db, '127.0.0.1', 8080)
  iniciada = true
  return db
}

/** Borra la caché local de Firestore (llamar tras cerrar sesión). */
export async function borrarDatosLocales() {
  if (iniciada) {
    try {
      await terminate(db)
      await clearIndexedDbPersistence(db)
    } catch {
      /* otra pestaña puede tenerla abierta: se borra a mano abajo */
    }
  }
  try {
    const bases = (await indexedDB.databases?.()) ?? []
    await Promise.all(
      bases
        .map((b) => b.name)
        .filter((n): n is string => !!n && n.startsWith('firestore/'))
        .map((n) => new Promise<void>((ok) => {
          const r = indexedDB.deleteDatabase(n)
          r.onsuccess = r.onerror = r.onblocked = () => ok()
        })),
    )
  } catch {
    /* navegador sin indexedDB.databases() */
  }
}
