package dev.truffle.feeder

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.view.View
import kotlin.math.ceil
import kotlin.math.max

/** Real text glyphs, positioned cell by cell rather than relying on fallback advances. */
class AsciiWalkChartView(context: Context) : View(context) {
    private val palette = TrufflePalette.of(resources.configuration)
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = Typeface.MONOSPACE; color = palette.accent; textAlign = Paint.Align.CENTER
    }
    private val density = resources.displayMetrics.density
    private val scaledDensity = resources.displayMetrics.scaledDensity
    private var rows = List(6) { " ".repeat(24) }
    private var ticks = listOf(0 to "00", 6 to "06", 12 to "12", 18 to "18", 23 to "23")

    fun plot(values: List<Long?>, labels: List<Pair<Int, String>>, weekly: Boolean, description: String) {
        rows = AsciiWalkPlot.rows(values, barWidth = if (weekly) 3 else 1, gap = if (weekly) 1 else 0)
        ticks = labels.map { (index, label) -> (if (weekly) index * 4 + 1 else index) to label }
        contentDescription = description
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES
        requestLayout()
        invalidate()
    }
    private fun rowHeight(): Float {
        paint.textSize = 15 * scaledDensity
        return max(20 * density, paint.fontMetrics.descent - paint.fontMetrics.ascent + 3 * density)
    }
    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val rowHeight = rowHeight()
        val cols = rows.maxOfOrNull(String::length)?.coerceAtLeast(1) ?: 1
        val desiredWidth = ceil(cols * (paint.measureText("#") + 2 * density) + 20 * density).toInt()
        paint.textSize = 14 * scaledDensity
        val labelHeight = paint.fontMetrics.descent - paint.fontMetrics.ascent
        val desiredHeight = ceil(rows.size * rowHeight + 22 * density + labelHeight).toInt()
        setMeasuredDimension(resolveSize(desiredWidth, widthMeasureSpec), resolveSize(desiredHeight, heightMeasureSpec))
    }
    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val cols = rows.maxOfOrNull(String::length)?.coerceAtLeast(1) ?: 1
        val left = 10 * density
        val cell = (width - 2 * left) / cols
        val rowHeight = rowHeight()
        paint.textSize = 15 * scaledDensity
        paint.color = palette.accent
        rows.forEachIndexed { row, text ->
            text.forEachIndexed { col, glyph ->
                if (glyph != ' ') canvas.drawText(glyph.toString(), left + cell * (col + 0.5f), rowHeight * (row + 1), paint)
            }
        }
        paint.color = palette.ink
        paint.alpha = 100
        repeat(cols) { col -> canvas.drawText("-", left + cell * (col + 0.5f), rowHeight * 6 + 12 * density, paint) }
        paint.alpha = 255
        paint.textSize = 14 * scaledDensity
        ticks.forEach { (col, label) ->
            val half = paint.measureText(label) / 2
            val x = (left + cell * (col + 0.5f)).coerceIn(half, width - half)
            canvas.drawText(label, x, rowHeight * rows.size + 18 * density - paint.fontMetrics.ascent, paint)
        }
    }
}
