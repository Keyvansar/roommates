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
  cors: {
    origin: "http://localhost:3000",
    credentials: true
  }
})

interface ChangePayload {
  type: 'items' | 'purchase-logs' | 'profiles' | 'balance'
  action: 'create' | 'update' | 'delete' | 'checkout' | 'bulk'
  ref?: string
  by?: string
  at: string
  householdId?: string
}

// Helper function to read cookies from the websocket handshake
function getCookie(req: any, name: string) {
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  const match = cookies.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

// Import Prisma to verify the session
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

io.on('connection', async (socket) => {
  console.log(`[sync] connected ${socket.id} — total ${io.engine.clientsCount}`)

  // SECURITY FIX: Verify the user's session cookie immediately upon connection
  const sessionToken = getCookie(socket.request, 'hamkhaneh_session')
  if (!sessionToken) {
    console.log(`[sync] rejected ${socket.id}: no session cookie`)
    socket.disconnect(true)
    return
  }

  // Check the database to see if this session is valid and who it belongs to
  const session = await prisma.session.findUnique({
    where: { token: sessionToken },
    include: { user: true }
  })

  if (!session || session.expiresAt < new Date()) {
    console.log(`[sync] rejected ${socket.id}: invalid or expired session`)
    socket.disconnect(true)
    return
  }

  // Store the verified user data on the socket for later use
  socket.data.userId = session.userId
  socket.data.authenticatedHouseholdId = session.activeHouseholdId

  socket.on('join', (data: { householdId?: string; profile?: string }) => {
    const requestedHouseholdId = data?.householdId

    // SECURITY FIX: Ensure they are only joining the household they are authenticated for!
    if (!requestedHouseholdId || requestedHouseholdId !== socket.data.authenticatedHouseholdId) {
      socket.emit('error', { message: 'Unauthorized: Household mismatch' })
      return
    }

    const room = `hh:${requestedHouseholdId}`
    socket.join(room)
    socket.data.profile = data.profile ?? null

    // Send presence list ONLY for this household room
    const list: Array<{ id: string; profile: string }> = []
    for (const [id, s] of io.sockets.sockets) {
      if (s.data?.authenticatedHouseholdId === requestedHouseholdId && s.data?.profile) {
        list.push({ id, profile: s.data.profile })
      }
    }
    socket.emit('presence-list', list)

    // Notify only this room about the newcomer
    io.to(room).emit('presence', { id: socket.id, profile: data.profile, online: true })
  })

  // Broadcast changes only to the sender's verified household room
  socket.on('change', (payload: ChangePayload) => {
    const householdId = socket.data?.authenticatedHouseholdId
    if (!householdId) return // unauthenticated sockets cannot broadcast

    const room = `hh:${householdId}`
    io.to(room).emit('change', { ...payload, at: new Date().toISOString(), householdId: undefined })
  })

  socket.on('disconnect', () => {
    const householdId = socket.data?.authenticatedHouseholdId
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
