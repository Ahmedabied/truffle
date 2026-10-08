package dev.truffle.feeder

import android.os.Bundle
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class PermissionsRationaleActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val padding = (24 * resources.displayMetrics.density).toInt()
        val scroll = ScrollView(this).apply {
            addView(TextView(this@PermissionsRationaleActivity).apply {
                textSize = 18f
                setPadding(padding, padding, padding, padding)
                text = """
                    Truffle privacy

                    Direct walking is optional. Android's hardware step counter reads new steps after you enable it under Walk. Physical activity permission is required. A silent foreground notification lets you pause. No GPS, microphone, accelerometer inference or Samsung account is used. Android may show this service only in its active-app controls if notifications are denied.

                    Phone counter readings and up to 30 local days of totals stay in private storage. The app confirms your pet's credited total before adding new phone steps. Only one source feeds at a time; two full-day totals are never added. Restart, reboot or calendar gaps can leave a partial day rather than guessed steps.

                    Quiet companion notes are a separate option, off by default. They require notification permission. At most one can appear during daytime, with safe recent weather and no recent activity or sufficient feeding. Turning them off does not stop your World.

                    Steps feed your Truffle. The Feed screen reads only today's aggregated step count from Health Connect, starting at midnight in your Truffle's time zone.

                    Feed now sends that total, your pairing phrase, today's date in your Truffle's time zone, that zone, and your device time zone to the HTTPS server you choose. Background read access allows the same operation about once an hour. Android may delay it.

                    The Walk screen reads steps by hour for today and by day for the last 30 days, and today's distance if you allow it. Those numbers stay on this phone. They are only drawn on screen. No calories, weight, heart rate or sleep are read.

                    The World screen shows the Truffle web app. The app hands your pet's key to that page once, inside the page address after the # sign. That part of an address is never sent to a server.

                    Only use a server you trust. The server receives your IP address. The Truffle server can use it for a city-level weather estimate. This app does not request location permission.

                    The app stores your phrase, your pet's key, the server addresses, and the latest sync status privately on this phone. Backups are disabled. Raw step records never leave the phone. There are no analytics or advertising SDKs.

                    The Truffle server keeps pet state, a seven-day step history, and the current city-level point. It does not keep raw step records or a location trail. A custom server has its own policy.

                    You can revoke steps, distance and background read access in Health Connect at any time. Forget this truffle under Feed removes the key from this phone. Clearing app storage does the same. Neither deletes server-side pet data.
                """.trimIndent()
            })
        }
        ViewCompat.setOnApplyWindowInsetsListener(scroll) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        setContentView(scroll)
    }
}
