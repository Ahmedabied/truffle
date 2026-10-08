package dev.truffle.feeder

import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/** Truffle's palette, light and dark. */
data class TrufflePalette(val background: Int, val ink: Int, val accent: Int) {
    companion object {
        val LIGHT = TrufflePalette(Color.parseColor("#f5f2e9"), Color.parseColor("#293e35"), Color.parseColor("#345437"))
        val DARK = TrufflePalette(Color.parseColor("#141b18"), Color.parseColor("#e4e9dc"), Color.parseColor("#7fae7a"))
        fun of(configuration: Configuration): TrufflePalette =
            if (configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES) DARK else LIGHT
    }
}

/** A small walking notebook: the measure, its source, then the shape of the day. */
class WalkScreen(private val activity: MainActivity, private val health: HealthSteps) {
    private val palette = TrufflePalette.of(activity.resources.configuration)
    private val density = activity.resources.displayMetrics.density
    private fun dp(value: Int) = (value * density).toInt()
    private val content = LinearLayout(activity).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(22), dp(20), dp(22), dp(28))
    }
    val view: View = ScrollView(activity).apply { setBackgroundColor(palette.background); addView(content) }
    private val store = NativeWalkStore(activity)
    private var renderingSource = false
    private var reading = false
    private var period = 1
    private var today = LocalDate.now()
    private var hours = emptyList<Long>()
    private var days = emptyList<WalkDay>()
    private var distance: Double? = null
    private var hasData = false
    private val periodButtons = mutableMapOf<Int, Button>()

    private fun text(value: String, size: Float = 15f, mono: Boolean = false): TextView = TextView(activity).apply {
        text = value; textSize = size; setTextColor(palette.ink)
        if (mono) typeface = Typeface.MONOSPACE
        setLineSpacing(dp(2).toFloat(), 1f)
    }
    private fun button(label: String, primary: Boolean = false, action: () -> Unit): Button = Button(activity).apply {
        text = label; NotebookStyle.button(this, primary); setOnClickListener { action() }
    }
    private fun add(view: View, top: Int = 0, bottom: Int = 0) {
        content.addView(view, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(top); bottomMargin = dp(bottom) })
    }

    private val count = text("—", 48f).apply { typeface = Typeface.create("serif", Typeface.BOLD); setTextColor(palette.accent) }
    private val countLabel = text("steps today", 15f)
    private val source = text("Reading your walking diary…", 13f)
    private val chartTitle = text("THE SHAPE OF TODAY", 12f, true).apply { setTextColor(palette.accent) }
    private val scale = text("", 12f)
    private val chart = AsciiWalkChartView(activity)
    private val chartCaption = text("", 13f)
    private val stats = text("", 15f)
    private val note = text("", 13f).apply { accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE }
    private val grant = button("Allow Health Connect steps") { activity.requestHealthPermissions() }.apply { isVisible = false }
    private val modeDetails = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL; isVisible = false }
    private val sourceNote = text("", 14f)
    private val mode = button("Choose a walking source") { modeDetails.isVisible = !modeDetails.isVisible }
    private val direct = button("Count with this phone", true) { activity.requestDirectWalking() }
    private val connect = button("Use Health Connect") { activity.useHealthConnect() }
    private val pause = button("Pause phone counting") { activity.pauseDirectWalking() }
    private val reminders = Switch(activity).apply {
        text = "Quiet companion notes"
        textSize = 15f; setTextColor(palette.ink); minHeight = dp(56)
        setOnCheckedChangeListener { _, checked -> if (!renderingSource) activity.requestQuietNotes(checked) }
    }

    init {
        val header = LinearLayout(activity).apply {
            gravity = Gravity.CENTER_VERTICAL
            addView(text("Walk", 32f).apply { NotebookStyle.heading(this) }, LinearLayout.LayoutParams(0, -2, 1f))
            addView(Button(activity, null, android.R.attr.borderlessButtonStyle).apply {
                text = "Refresh"; isAllCaps = false; setTextColor(palette.accent); minHeight = dp(48)
                setOnClickListener { load() }
            })
        }
        add(header)
        add(text("A little way, together.", 17f), bottom = 20)
        val measure = LinearLayout(activity).apply {
            gravity = Gravity.BOTTOM
            addView(count)
            addView(countLabel, LinearLayout.LayoutParams(-2, -2).apply { marginStart = dp(12); bottomMargin = dp(10) })
        }
        add(measure)
        add(source, top = 4, bottom = 22)
        val selector = LinearLayout(activity)
        for ((value, label) in listOf(1 to "Today", 7 to "7 days", 30 to "30 days")) {
            val choice = Button(activity, null, android.R.attr.borderlessButtonStyle).apply {
                text = label; isAllCaps = false; minHeight = dp(48)
                setOnClickListener { period = value; renderDiary() }
            }
            periodButtons[value] = choice
            selector.addView(choice, LinearLayout.LayoutParams(0, -2, 1f))
        }
        add(selector, bottom = 18)
        add(chartTitle)
        add(scale, top = 7, bottom = 12)
        add(chart)
        add(chartCaption, top = 12, bottom = 22)
        add(View(activity).apply { setBackgroundColor(palette.accent); alpha = 0.25f })
        content.getChildAt(content.childCount - 1).layoutParams.height = dp(1)
        add(stats, top = 18, bottom = 12)
        add(note, bottom = 18)
        add(grant, bottom = 12)
        add(mode, top = 8)
        modeDetails.setPadding(dp(14), dp(16), dp(14), dp(8))
        modeDetails.background = GradientDrawable().apply {
            setColor(palette.background); setStroke(dp(1), palette.accent); cornerRadius = dp(8).toFloat()
        }
        fun detail(child: View, gap: Int = 10) {
            modeDetails.addView(child, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(gap) })
        }
        detail(sourceNote)
        detail(direct)
        detail(pause)
        detail(connect)
        detail(reminders, 0)
        detail(text("Optional. At most one quiet daytime note. Never on a heat day; rest is always welcome.", 12f))
        add(modeDetails, top = 8)
        renderSource()
        renderDiary()
    }

    fun renderSource() {
        renderingSource = true
        val selected = store.directSelected
        mode.text = when { store.paused -> "Phone counting paused · options"; selected -> "Walking with this phone · options"; else -> "Health Connect · change source" }
        direct.text = if (selected) "Resume phone counting" else "Count with this phone"
        direct.isEnabled = NativeTracking.available(activity)
        direct.isVisible = !store.enabled
        pause.isVisible = store.enabled
        connect.isVisible = selected
        reminders.isChecked = store.reminders
        sourceNote.text = if (!NativeTracking.available(activity)) "This device has no hardware step counter. You can use Health Connect."
            else store.status + if (selected) "\nNo location is read. Android's tracking notice is separate from optional notes." else "\nPhone counting works without Samsung Health. Only one source feeds at a time."
        renderingSource = false
    }

    private fun renderDiary() {
        periodButtons.forEach { (value, button) ->
            button.setTextColor(if (value == period) palette.background else palette.accent)
            button.setTypeface(null, if (value == period) Typeface.BOLD else Typeface.NORMAL)
            button.background = GradientDrawable().apply { setColor(if (value == period) palette.accent else palette.background); cornerRadius = dp(6).toFloat() }
            button.isSelected = value == period
        }
        count.text = if (hasData) WalkChart.steps(days.lastOrNull { it.date == today }?.steps ?: 0) else "—"
        val phone = store.directSelected
        source.text = if (phone) "PHONE COUNTER · since enabled · ${activeZone(FeedSettings(activity).activeTz, ZoneId.systemDefault()).id}"
            else "HEALTH CONNECT · ${ZoneId.systemDefault().id}"
        if (!hasData) {
            chart.plot(List(24) { null }, emptyList(), false, "Walking chart awaits permission or data.")
            scale.text = "Your diary will appear here"
            chartCaption.text = "Allow a source below. Your World is ready either way."
            stats.text = "Every day can have its own pace."
            return
        }
        val plotted: List<Long?> = if (period == 1) (0..23).map { hours.getOrNull(it) }
            else days.takeLast(period).map { it.steps }
        val max = plotted.filterNotNull().maxOrNull() ?: 0
        chartTitle.text = when (period) { 1 -> "THE SHAPE OF TODAY"; 7 -> "THE PAST WEEK"; else -> "A MONTH OF SMALL JOURNEYS" }
        scale.text = if (max == 0L) "No steps recorded in this view yet" else "Highest ${if (period == 1) "hour" else "day"} · ${WalkChart.steps(max)} steps"
        val labels = if (period == 1) listOf(0 to "00", 6 to "06", 12 to "12", 18 to "18", 23 to "23")
            else if (period == 7) days.takeLast(7).mapIndexed { index, day -> index to day.date.dayOfWeek.name.take(1) }
            else listOf(0 to "${today.minusDays(29).dayOfMonth}/${today.minusDays(29).monthValue}", 14 to "${today.minusDays(15).dayOfMonth}/${today.minusDays(15).monthValue}", 29 to "Today")
        chart.plot(plotted, labels, period == 7, "$period-day walking chart. Highest ${if (period == 1) "hour" else "day"}: $max steps.")
        chartCaption.text = if (period == 1) "Each column is one hour. Future hours stay empty."
            else "One column per day, oldest to newest."
        val summary = WalkChart.stats(days, today)
        val best = summary.best
        stats.text = buildString {
            append("7-day average   ${WalkChart.steps(summary.avg7)} steps\n")
            append(if (best == null) "Best day   waiting to be written" else "Best day   ${WalkChart.steps(best.steps)} steps · ${best.date.month.name.lowercase().replaceFirstChar(Char::titlecase)} ${best.date.dayOfMonth}")
            append("\nWalking rhythm   ${summary.streak} ${if (summary.streak == 1) "day" else "days"} at 3,000+ steps")
            distance?.let { append("\nDistance today   ${WalkChart.distance(it)}") }
        }
        count.contentDescription = "${count.text} steps today"
    }

    fun load() {
        renderSource()
        if (store.directSelected) {
            val state = store.state()
            val zone = activeZone(FeedSettings(activity).activeTz, ZoneId.systemDefault())
            today = Instant.now().atZone(zone).toLocalDate()
            val day = state.days[today.toString()]
            days = WalkChart.fillDays(state.days.mapNotNull { (key, value) -> runCatching { LocalDate.parse(key) to value.total }.getOrNull() }.toMap(), today)
            hours = day?.hours?.take(Instant.now().atZone(zone).hour + 1) ?: List(Instant.now().atZone(zone).hour + 1) { 0L }
            distance = null; hasData = true; grant.isVisible = false
            note.text = "Only steps observed since you enabled this phone. Gaps are not backfilled; hourly increments may arrive in batches. Averages include untracked days as zero. Credited steps can include earlier Health Connect activity."
            renderDiary()
            return
        }
        if (reading) return
        reading = true
        note.text = "Reading Health Connect…"
        activity.lifecycleScope.launch {
            try {
                val data = health.readWalk()
                if (store.directSelected) return@launch
                hours = data.hourly; days = data.days; today = data.today; distance = data.distanceMeters
                hasData = true; grant.isVisible = false
                note.text = if (distance == null) "Steps stay in your diary. Distance appears only when permission and records are available."
                    else "Steps and distance from Health Connect. Only the daily step total feeds Truffle."
                renderDiary()
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (missing: GrantPermissionException) { showGrant(missing.message.orEmpty()) }
            catch (_: SecurityException) { showGrant("Allow Health Connect steps to see this diary, or choose phone counting below.") }
            catch (unavailable: HealthUnavailableException) { hasData = false; grant.isVisible = false; note.text = unavailable.message.orEmpty(); renderDiary() }
            catch (_: Exception) { note.text = "The diary could not refresh. Your last view stays here; try again in a moment." }
            finally { reading = false }
        }
    }

    private fun showGrant(message: String) {
        hasData = false; note.text = message; grant.isVisible = true; modeDetails.isVisible = true; renderDiary()
    }
}
