/**
 * Wraps a database function and automatically retries it if SQLite is locked.
 * This prevents crashes when two users buy items at the exact same time.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    retries = 3,
    delay = 100
): Promise<T> {
    try {
        return await fn()
    } catch (error: any) {
        // Check if it's a "database locked" or "busy" error
        const isLockError =
            error.code === 'P2024' ||
            (error.message && error.message.includes('database is locked')) ||
            (error.message && error.message.includes('SQLITE_BUSY'))

        if (isLockError && retries > 0) {
            console.warn(`Database busy. Retrying in ${delay}ms... (${retries} attempts left)`)
            // Wait a bit before trying again
            await new Promise((resolve) => setTimeout(resolve, delay))
            // Try again, but double the wait time (exponential backoff)
            return withRetry(fn, retries - 1, delay * 2)
        }

        // If it's not a lock error, or we ran out of retries, crash as usual
        throw error
    }
}