'use client'

import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true, reconnectionAttempts: Infinity,
      reconnectionDelay: 1000, reconnectionDelayMax: 5000, timeout: 10000,
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
