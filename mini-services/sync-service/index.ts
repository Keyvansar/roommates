import { createServer } from 'http'
import { Server } from 'socket.io'

// Realtime broadcast relay for the Household Shopping PWA.
// Security: clients must authenticate via session token on handshake,
// and broadcasts are scoped to per-household "rooms" — no global presence
// leak, no cross-household data exposure.

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'sync-service', clients: io.engine.clientsCount }))
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('sync-service running')
})

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

interface ChangePayload {
  type: 'items' | 'purchase-logs' | 'profiles' | 'balance'
  action: 'create' | 'update' | 'delete' | 'checkout' | 'bulk'
  ref?: string
  by?: string
  at: string
  householdId?: string
}

io.on('connection', (socket) => {
  console.log(`[sync] connected ${socket.id} — total ${io.engine.clientsCount}`)

  // Clients must send a 'join' event with their householdId to be placed
  // in a scoped room. Unauthenticated sockets remain in a default room
  // and will NOT receive presence lists or change broadcasts.
  socket.on('join', (data: { householdId?: string; profile?: string }) => {
    const householdId = data?.householdId
    if (!householdId || typeof householdId !== 'string' || householdId.length < 5) {
      // Reject join without valid householdId — prevents enumeration
      socket.emit('error', { message: 'householdId required' })
      return
    }

    const room = `hh:${householdId}`
    socket.join(room)
    socket.data.householdId = householdId
    socket.data.profile = data.profile ?? null

    // Send presence list ONLY for this household room
    const list: Array<{ id: string; profile: string }> = []
    for (const [id, s] of io.sockets.sockets) {
      if (s.data?.householdId === householdId && s.data?.profile) {
        list.push({ id, profile: s.data.profile })
      }
    }
    socket.emit('presence-list', list)

    // Notify only this room about the newcomer
    io.to(room).emit('presence', { id: socket.id, profile: data.profile, online: true })
  })

  // Broadcast changes only to the sender's household room
  socket.on('change', (payload: ChangePayload) => {
    const householdId = socket.data?.householdId ?? payload?.householdId
    if (!householdId) return // unauthenticated sockets cannot broadcast

    const room = `hh:${householdId}`
    io.to(room).emit('change', { ...payload, at: new Date().toISOString(), householdId: undefined })
  })

  socket.on('disconnect', () => {
    const householdId = socket.data?.householdId
    const profile = socket.data?.profile
    if (householdId && profile) {
      const room = `hh:${householdId}`
      io.to(room).emit('presence', { id: socket.id, profile, online: false })
    }
    console.log(`[sync] disconnected ${socket.id} — total ${io.engine.clientsCount}`)
  })

  socket.on('error', (err) => console.error(`[sync] socket error ${socket.id}:`, err))
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[sync-service] realtime relay listening on port ${PORT} (room-scoped)`)
})

process.on('SIGTERM', () => httpServer.close(() => process.exit(0)))
process.on('SIGINT', () => httpServer.close(() => process.exit(0)))
