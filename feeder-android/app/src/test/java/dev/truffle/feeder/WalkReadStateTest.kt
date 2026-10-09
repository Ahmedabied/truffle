package dev.truffle.feeder

import org.junit.Assert.*
import org.junit.Test

class WalkReadStateTest {
    @Test fun `switching sources discards a pending result and its errors`() {
        val reads = WalkReadState()
        assertTrue(reads.select("health:session1"))
        val health = reads.begin()!!
        assertTrue(reads.accepts(health, "health:session1"))
        assertTrue(reads.select("phone:session2"))
        assertFalse(reads.accepts(health, "phone:session2"))
        assertFalse(reads.accepts(health, "health:session1"))
    }

    @Test fun `returning to health cannot revive the earlier health request`() {
        val reads = WalkReadState()
        reads.select("health")
        val before = reads.begin()!!
        reads.select("phone")
        reads.select("health")
        val after = reads.begin()!!
        assertFalse(reads.accepts(before, "health"))
        reads.finish(before)
        assertTrue(reads.accepts(after, "health"))
        assertNull(reads.begin())
        reads.finish(after)
        assertNotNull(reads.begin())
    }

    @Test fun `a live source change invalidates the response before screen reload`() {
        val reads = WalkReadState()
        reads.select("health:old")
        val request = reads.begin()!!
        assertFalse(reads.select("health:old"))
        assertNull(reads.begin())
        assertFalse(reads.accepts(request, "health:new"))
        assertTrue(reads.select("health:new"))
        assertNotNull(reads.begin())
    }
}
