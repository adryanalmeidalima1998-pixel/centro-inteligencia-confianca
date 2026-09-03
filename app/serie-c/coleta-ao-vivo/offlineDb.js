'use client'

const DB_NAME = 'confianca-serie-c-live-v1'
const DB_VERSION = 1
const STORE_MATCHES = 'matches'

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB não está disponível neste navegador.'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_MATCHES)) {
        const store = db.createObjectStore(STORE_MATCHES, { keyPath: 'localId' })
        store.createIndex('matchDate', 'matchDate', { unique: false })
        store.createIndex('dirty', 'dirty', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Falha ao abrir banco offline.'))
  })
}

function runStore(mode, executor) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MATCHES, mode)
    const store = tx.objectStore(STORE_MATCHES)
    let result
    try { result = executor(store) } catch (error) { reject(error); return }
    tx.oncomplete = () => { db.close(); resolve(result?.result ?? result) }
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Falha no banco offline.')) }
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Operação offline cancelada.')) }
  }))
}

export async function listLocalMatches({ includeDeleted = false } = {}) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MATCHES, 'readonly')
    const request = tx.objectStore(STORE_MATCHES).getAll()
    request.onsuccess = () => {
      const rows = (request.result || [])
        .filter(row => includeDeleted || !row.deletedAt)
        .sort((a, b) => String(b.matchDate || '').localeCompare(String(a.matchDate || '')) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      resolve(rows)
    }
    request.onerror = () => reject(request.error || new Error('Falha ao listar partidas offline.'))
    tx.oncomplete = () => db.close()
  })
}

export async function getLocalMatch(localId) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MATCHES, 'readonly')
    const request = tx.objectStore(STORE_MATCHES).get(localId)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error || new Error('Falha ao carregar partida offline.'))
    tx.oncomplete = () => db.close()
  })
}

export async function putLocalMatch(match) {
  const payload = { ...match, updatedAt: new Date().toISOString() }
  await runStore('readwrite', store => store.put(payload))
  return payload
}

export async function removeLocalMatch(localId) {
  await runStore('readwrite', store => store.delete(localId))
}

export async function mergeRemoteMatches(remoteMatches = []) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MATCHES, 'readwrite')
    const store = tx.objectStore(STORE_MATCHES)
    let pending = remoteMatches.length
    if (!pending) { resolve(); db.close(); return }
    for (const remote of remoteMatches) {
      const get = store.get(remote.localId)
      get.onsuccess = () => {
        const local = get.result
        // Alterações offline/pendentes sempre vencem a cópia do servidor.
        if (!local?.dirty && !local?.deletedAt) store.put({ ...remote, dirty: false })
        pending -= 1
      }
      get.onerror = () => { pending -= 1 }
    }
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error || new Error('Falha ao atualizar partidas sincronizadas.')) }
  })
}

export function newLocalId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`
}
