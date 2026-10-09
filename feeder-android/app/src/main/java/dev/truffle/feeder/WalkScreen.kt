package dev.truffle.feeder

import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.HorizontalScrollView
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
import java.time.format.DateTimeFormatter
import java.util.Locale

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
    private val dateLabel = DateTimeFormatter.ofPattern("MMM d", Locale.US)
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

    private val count = text("--", 48f).apply {
        typeface = Typeface.create("serif", Typeface.BOLD); setTextColor(palette.accent)
        maxLines = 1
        setAutoSizeTextTypeUniformWithConfiguration(22, 48, 1, TypedValue.COMPLEX_UNIT_SP)
    }
    private val countLabel = text("steps recorded today", 16f)
    private val coverage = text("", 14f)
    private val source = text("Reading your walking diary...", 14f)
    private val chartTitle = text("THE SHAPE OF TODAY", 14f, true).apply { setTextColor(palette.accent) }
    private val scale = text("", 14f)
    private val chart = AsciiWalkChartView(activity)
    private val chartCaption = text("", 14f)
    private val stats = text("", 16f).apply { setLineSpacing(dp(6).toFloat(), 1f) }
    private val note = text("", 14f).apply { accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE }
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
        add(text("A little way, together.", 17f), bottom = 22)
        val selector = LinearLayout(activity)
        for ((value, label) in listOf(1 to "Today", 7 to "7 days", 30 to "30 days")) {
            val choice = Button(activity, null, android.R.attr.borderlessButtonStyle).apply {
                text = label; isAllCaps = false; minHeight = dp(48); minWidth = 0
                setPadding(dp(4), dp(8), dp(4), dp(8))
                setOnClickListener { period = value; renderDiary() }
            }
            periodButtons[value] = choice
            selector.addView(choice, LinearLayout.LayoutParams(0, -2, 1f))
        }
        add(selector, bottom = 18)
        add(count)
        add(countLabel)
        add(coverage, top = 8)
        add(source, top = 4, bottom = 28)
        add(chartTitle)
        add(scale, top = 7, bottom = 12)
        add(HorizontalScrollView(activity).apply {
            isFillViewport = true
            addView(chart)
        })
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
        detail(text("Optional. At most one quiet daytime note. Never on a heat day; rest is always welcome.", 14f))
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
        val selectedDays = days.filter { !it.date.isBefore(today.minusDays(period - 1L)) && !it.date.isAfter(today) }
        val summary = WalkChart.period(days, today, period)
        val phone = store.directSelected
        val measure = if (phone) "recorded" else "reported"
        count.text = if (hasData) summary.total?.let(WalkChart::steps) ?: "--" else "--"
        countLabel.text = if (period == 1) "steps $measure today" else "steps $measure in $period days"
        count.contentDescription = if (hasData && summary.total != null) "${count.text} ${countLabel.text}" else "No steps record for this period"
        coverage.text = when {
            !hasData -> "Your diary is waiting for a source."
            period == 1 -> if (summary.recordedDays == 0) "No record today yet" else "${dateLabel.format(today)} · today so far"
            else -> "${dateLabel.format(today.minusDays(period - 1L))} to ${dateLabel.format(today)} · " +
                if (phone) "${summary.recordedDays} of $period days have records" else "$period days read, including today"
        }
        source.text = if (phone) "Phone counter · ${activeZone(FeedSettings(activity).activeTz, ZoneId.systemDefault()).id}"
            else "Health Connect · ${ZoneId.systemDefault().id}"
        chartTitle.text = when (period) { 1 -> "THE SHAPE OF TODAY"; 7 -> "THE PAST SEVEN DAYS"; else -> "THE PAST THIRTY DAYS" }
        if (!hasData) {
            chart.plot(List(if (period == 1) 24 else period) { null }, emptyList(), period == 7, "Walking chart awaits permission or data.")
            scale.text = "Your diary will appear here"
            chartCaption.text = "Allow a source below. Your World is ready either way."
            stats.text = "Every day can have its own pace."
            return
        }
        val plotted: List<Long?> = if (period == 1) (0..23).map { hours.getOrNull(it) }
            else selectedDays.map { if (it.recorded) it.steps else null }
        val max = plotted.filterNotNull().maxOrNull() ?: 0
        scale.text = when {
            plotted.none { it != null } -> "No records in this view yet"
            max == 0L -> "No steps recorded in this view yet"
            else -> "Highest ${if (period == 1) "hour" else "day"} · ${WalkChart.steps(max)} steps"
        }
        val labels = if (period == 1) listOf(0 to "00", 6 to "06", 12 to "12", 18 to "18", 23 to "23")
            else if (period == 7) selectedDays.mapIndexed { index, day -> index to day.date.dayOfWeek.name.take(3).lowercase(Locale.US).replaceFirstChar(Char::titlecase) }
            else listOf(0 to dateLabel.format(today.minusDays(29)), 14 to dateLabel.format(today.minusDays(15)), 29 to "Today")
        val accessibleValues = if (period == 1) plotted.mapIndexedNotNull { hour, value -> value?.let { "$hour:00, ${WalkChart.steps(it)} steps" } }
            else selectedDays.map { "${dateLabel.format(it.date)}, ${if (it.recorded) "${WalkChart.steps(it.steps)} steps" else "no record"}" }
        chart.plot(plotted, labels, period == 7, "${chartTitle.text}. ${accessibleValues.joinToString("; ")}")
        chartCaption.text = (if (period == 1) "One column per hour. Blank means no record or a future hour."
            else "One column per day, oldest first. Blank days have no record.") +
            "\n# = steps   . = no steps recorded" +
            if (activity.resources.configuration.fontScale > 1.15f) "\nScroll sideways for the full chart." else ""
        val best = summary.best
        stats.text = buildString {
            if (period > 1) {
                append(if (phone) "Average per recorded day\n" else "Average per day read\n")
                append(summary.average?.let { "${WalkChart.steps(it)} steps" } ?: "Waiting for a first record")
                append("\n\nBest recorded day in this view\n")
                append(best?.let { "${dateLabel.format(it.date)} · ${WalkChart.steps(it.steps)} steps" } ?: "No steps recorded yet")
            } else {
                val rhythm = WalkChart.stats(days, today).streak
                append(if (rhythm == 0) "Every day can have its own pace." else "Walking rhythm\n$rhythm ${if (rhythm == 1) "day" else "days"} recorded at 3,000+ steps")
            }
            distance?.let { append("\nDistance today   ${WalkChart.distance(it)}") }
        }
    }

    fun load() {
        renderSource()
        if (store.directSelected) {
            val state = store.state()
            val zone = activeZone(FeedSettings(activity).activeTz, ZoneId.systemDefault())
            today = Instant.now().atZone(zone).toLocalDate()
            val diary = if (state.zoneId == zone.id) state.days else emptyMap()
            val day = diary[today.toString()]
            days = WalkChart.fillDays(diary.mapNotNull { (key, value) -> runCatching { LocalDate.parse(key) to value.total }.getOrNull() }.toMap(), today)
            hours = day?.hours?.take(Instant.now().atZone(zone).hour + 1) ?: emptyList()
            distance = null; hasData = true; grant.isVisible = false
            note.text = "Phone records cover only time counted since you enabled this source. Recorded days can be partial. Missing days stay blank and are left out of averages. Hourly steps may arrive in batches. Food credited to Truffle can include earlier Health Connect steps."
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
                note.text = "Health Connect reports steps from connected apps. Zero means no steps reported, not proof of no walking. Today's record is still in progress. " +
                    if (distance == null) "Distance appears only with permission and records." else "Only the daily step total feeds Truffle."
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
