'use client'

import { io, Socket } from 'socket.io-client'

let socket: Socket

export function getSocket() {
  if (!socket) {
    // ✅ Connect to port 3003 in development, relative path in production
    const url = typeof window !== 'undefined' && window.location.port === '3000'
      ? 'http://localhost:3003'
      : ''

    socket = io(url, {
      withCredentials: true, // ✅ MAGIC: Tells the browser it's safe to send cookies to port 3003!
    })
  }
  return socket
}

export interface ChangePayload {
  type: 'items' | 'purchase-logs' | 'profiles' | 'balance'
  action: 'create' | 'update' | 'delete' | 'checkout' | 'bulk'
  ref?: string
  by?: string
  at: string
}

/** Join a household room so broadcasts are scoped — required before broadcasting. */
export function joinHouseholdRoom(householdId: string, profile?: string) {
  try {
    const s = getSocket()
    const doJoin = () => s.emit('join', { householdId, profile })
    if (s.connected) doJoin()
    else s.once('connect', doJoin)
  } catch { /* non-fatal */ }
}

/** Broadcast a change notification scoped to the current household room. */
export function broadcastChange(payload: Omit<ChangePayload, 'at'>) {
  try {
    const s = getSocket()
    if (s.connected) s.emit('change', payload)
    else s.once('connect', () => s.emit('change', payload))
  } catch { /* non-fatal */ }
}