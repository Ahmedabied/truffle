package dev.truffle.feeder

import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.widget.Button
import android.widget.TextView

/** Small native notebook details shared by Walk and Feed; no image assets or animation. */
object NotebookStyle {
    fun heading(view: TextView) {
        view.typeface = Typeface.create("serif", Typeface.BOLD)
        view.textSize = 32f
        view.setTextColor(TrufflePalette.of(view.resources.configuration).ink)
    }
    fun button(view: Button, primary: Boolean = false) {
        val p = TrufflePalette.of(view.resources.configuration)
        view.isAllCaps = false
        view.typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
        view.minHeight = (52 * view.resources.displayMetrics.density).toInt()
        view.setTextColor(if (primary) p.background else p.ink)
        view.backgroundTintList = null
        view.background = GradientDrawable().apply {
            setColor(if (primary) p.accent else p.background)
            cornerRadius = 8 * view.resources.displayMetrics.density
            setStroke((view.resources.displayMetrics.density).toInt().coerceAtLeast(1), p.accent)
        }
        val padding = (14 * view.resources.displayMetrics.density).toInt()
        view.setPadding(padding, padding / 2, padding, padding / 2)
    }
}
