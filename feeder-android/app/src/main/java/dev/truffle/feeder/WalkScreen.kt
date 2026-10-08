package dev.truffle.feeder

import android.content.res.ColorStateList
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.view.View
import android.widget.Button
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

/** Truffle's palette, light and dark. */
data class TrufflePalette(val background: Int, val ink: Int, val accent: Int) {
    companion object {
        val LIGHT = TrufflePalette(Color.parseColor("#f5f2e9"), Color.parseColor("#293e35"), Color.parseColor("#345437"))
        val DARK = TrufflePalette(Color.parseColor("#141b18"), Color.parseColor("#e4e9dc"), Color.parseColor("#7fae7a"))

        fun of(configuration: Configuration): TrufflePalette =
            if (configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES) DARK else LIGHT
    }
}

/** Steps and distance from Health Connect, drawn as monospace text. Read only while open. */
class WalkScreen(private val activity: MainActivity, private val health: HealthSteps) {
    private val palette = TrufflePalette.of(activity.resources.configuration)
    private val padding = (20 * activity.resources.displayMetrics.density).toInt()
    private val content = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(padding, padding, padding, padding)
    }
    val view: View = ScrollView(activity).apply {
        setBackgroundColor(palette.background)
        addView(content)
    }
    private val title = TextView(activity).apply {
        text = "Walk"
        textSize = 28f
        setTextColor(palette.ink)
    }
    private val chart = TextView(activity).apply {
        typeface = Typeface.MONOSPACE
        textSize = 13f
        setTextColor(palette.ink)
        setLineSpacing(0f, 1.05f)
    }
    private val note = TextView(activity).apply {
        textSize = 14f
        setTextColor(palette.ink)
        setPadding(0, padding / 2, 0, padding / 2)
        accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
    }
    private val grant = Button(activity).apply {
        text = "Grant steps permission"
        backgroundTintList = ColorStateList.valueOf(Color.rgb(179, 38, 30))
        setTextColor(Color.WHITE)
        isVisible = false
        setOnClickListener { activity.requestHealthPermissions() }
    }
    private var reading = false

    init {
        content.addView(title)
        content.addView(HorizontalScrollView(activity).apply { addView(chart) })
        content.addView(note)
        content.addView(grant)
        content.addView(Button(activity, null, android.R.attr.borderlessButtonStyle).apply {
            text = "refresh"
            setTextColor(palette.accent)
            setOnClickListener { load() }
        })
    }

    fun load() {
        if (reading) return
        reading = true
        note.text = "Reading Health Connect..."
        activity.lifecycleScope.launch {
            try {
                val data = health.readWalk()
                chart.text = render(WalkChart.report(data.hourly, data.days, data.today, data.distanceMeters))
                grant.isVisible = false
                note.text = if (data.distanceMeters == null) "Steps from Health Connect. Allow distance too to see kilometres." else "Steps and distance from Health Connect."
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (missing: GrantPermissionException) {
                showGrant(missing.message.orEmpty())
            } catch (_: SecurityException) {
                showGrant("Grant steps permission. Health Connect access was revoked.")
            } catch (unavailable: HealthUnavailableException) {
                grant.isVisible = false
                note.text = unavailable.message.orEmpty()
            } catch (_: Exception) {
                note.text = "Could not read Health Connect. Try refresh in a moment."
            } finally {
                reading = false
            }
        }
    }

    private fun showGrant(message: String) {
        chart.text = ""
        note.text = message
        grant.isVisible = true
    }

    private fun render(lines: List<WalkLine>): CharSequence {
        val out = SpannableStringBuilder()
        lines.forEachIndexed { i, line ->
            val start = out.length
            out.append(line.text)
            if (line.accent) out.setSpan(ForegroundColorSpan(palette.accent), start, out.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            if (i < lines.lastIndex) out.append('\n')
        }
        return out
    }
}
