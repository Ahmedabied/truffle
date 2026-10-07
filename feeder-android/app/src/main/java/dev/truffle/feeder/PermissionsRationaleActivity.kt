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
                    Truffle Feeder privacy

                    Steps feed your Truffle. This app reads only today's aggregated step count from Health Connect, starting at local midnight.

                    Feed now sends that total, your pairing phrase, and your device time zone to the HTTPS server you choose. Background read access allows the same operation about once an hour. Android may delay it.

                    Only use a server you trust. The server receives your IP address. The Truffle server can use it for a city-level weather estimate. Location sharing in this app is disabled.

                    The app stores your phrase, server URL, and latest sync status privately on this phone. Backups are disabled. Raw step records never leave the phone. There are no analytics or advertising SDKs.

                    The Truffle server keeps pet state, a seven-day step history, and the current city-level point. It does not keep raw step records or a location trail. A custom server has its own policy.

                    You can revoke steps and background read access in Health Connect at any time. Clear this app's storage to remove local settings. Clearing app storage does not delete server-side pet data.
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
