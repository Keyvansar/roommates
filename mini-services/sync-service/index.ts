import { createServer } from 'http'
import { Server } from 'socket.io'

// Realtime broadcast relay for the Household Shopping PWA.
// Frontend mutates data via Next.js API routes, then emits a `change` event here;
// this service rebroadcasts to ALL connected clients (including sender for confirmation).
// Clients refetch the affected slice on receiving `change`.

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, service: 'sync-service', clients: io.engine.clientsCount }))
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('sync-service running')
})

// NOTE: do NOT set `path: '/'` — it makes socket.io intercept ALL paths
// (including /health). Using the default `/socket.io/` path leaves /health
// free for the http handler above. The frontend connects with
// `io('/?XTransformPort=3003')` which uses `/` as the namespace (default)
// and the default path `/socket.io/` — fully compatible.
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
}

io.on('connection', (socket) => {
  console.log(`[sync] connected ${socket.id} — total ${io.engine.clientsCount}`)

  socket.on('change', (payload: ChangePayload) => {
    // Broadcast to everyone (sender will reconcile via its own optimistic update)
    io.emit('change', { ...payload, at: new Date().toISOString() })
  })

  socket.on('join', (profileName: string) => {
    socket.data.profile = profileName
    io.emit('presence', { id: socket.id, profile: profileName, online: true })
    // Send current presence list to the newcomer
    const list = []
    for (const [id, s] of io.sockets.sockets) {
      if (s.data?.profile) list.push({ id, profile: s.data.profile })
    }
    socket.emit('presence-list', list)
  })

  socket.on('disconnect', () => {
    if (socket.data?.profile) {
      io.emit('presence', { id: socket.id, profile: socket.data.profile, online: false })
    }
    console.log(`[sync] disconnected ${socket.id} — total ${io.engine.clientsCount}`)
  })

  socket.on('error', (err) => console.error(`[sync] socket error ${socket.id}:`, err))
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[sync-service] realtime relay listening on port ${PORT}`)
})

process.on('SIGTERM', () => httpServer.close(() => process.exit(0)))
process.on('SIGINT', () => httpServer.close(() => process.exit(0)))
