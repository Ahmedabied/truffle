#!/usr/bin/env python3
"""Smoke-test the installed debug APK on the read-only workstation emulator.

Run from the laptop. Requires emulator-5580 on workstation. Only this test app's
state is cleared. All fields use public examples and an unresolvable test host.
No production feed is sent. Android and Gradle remain on the workstation.
"""
import re
import shlex
import subprocess
import time
import xml.etree.ElementTree as ET

ADB = "/home/tamlik/Android/Sdk/platform-tools/adb"
SERIAL = "emulator-5580"
PACKAGE = "dev.truffle.feeder"


def adb(*args):
    command = shlex.join([ADB, "-s", SERIAL, *args])
    return subprocess.check_output(["ssh", "workstation", command], text=True).strip()


def screen():
    adb("shell", "uiautomator", "dump", "/data/local/tmp/s02-window.xml")
    return ET.fromstring(adb("shell", "cat", "/data/local/tmp/s02-window.xml"))


def find(root, text=None, resource=None):
    for node in root.iter("node"):
        if text is not None and node.get("text", "").casefold() == text.casefold():
            return node
        if resource is not None and node.get("resource-id") == resource:
            return node
    raise AssertionError(f"Missing UI node: {text or resource}")


def tap(node):
    left, top, right, bottom = map(int, re.findall(r"\d+", node.get("bounds")))
    adb("shell", "input", "tap", str((left + right) // 2), str((top + bottom) // 2))
    time.sleep(1)


def contains(root, text):
    return any(text in node.get("text", "") for node in root.iter("node"))


def fill(resource, value):
    tap(find(screen(), resource=resource))
    adb("shell", "input", "keycombination", "KEYCODE_CTRL_LEFT", "KEYCODE_A")
    adb("shell", "input", "keyevent", "KEYCODE_DEL")
    adb("shell", "input", "text", value)
    adb("shell", "input", "keyevent", "KEYCODE_BACK")
    time.sleep(1)


def pref_values():
    xml = adb("shell", "run-as", PACKAGE, "cat", "shared_prefs/feeder.xml")
    return {node.get("name"): node.text or node.get("value") for node in ET.fromstring(xml)}


def wait_status(text):
    for _ in range(30):
        value = pref_values().get("status", "")
        if text in value:
            return value
        time.sleep(1)
    raise AssertionError(f"Expected status containing {text!r}; got {value!r}")


assert SERIAL.startswith("emulator-")
print("Device Android", adb("shell", "getprop", "ro.build.version.release"), flush=True)
print("Clear test app:", adb("shell", "pm", "clear", PACKAGE), flush=True)
print(adb("shell", "am", "start", "-W", "-n", PACKAGE + "/.MainActivity"), flush=True)
root = screen()
find(root, text="Grant steps permission")
location = find(root, text="Share coarse location (TODO)")
assert location.get("checked") == "false" and location.get("enabled") == "false"
print("PASS: initial re-grant button, location disabled and OFF", flush=True)

print(adb("shell", "am", "start", "-W", "-a", "androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE", "-n", PACKAGE + "/.PermissionsRationaleActivity"), flush=True)
assert contains(screen(), "Truffle Feeder privacy")
adb("shell", "input", "keyevent", "KEYCODE_BACK")
print("PASS: Health Connect APK rationale intent", flush=True)

tap(find(screen(), text="Grant steps permission"))
root = screen()
if contains(root, "Get started"):
    tap(find(root, text="Get started"))
    root = screen()
assert contains(root, "Steps")
# Test the policy link from Health Connect itself. Android 14+ uses our alias.
tap(find(root, resource="com.android.healthconnect.controller:id/privacy_policy"))
assert contains(screen(), "Truffle Feeder privacy")
adb("shell", "input", "keyevent", "KEYCODE_BACK")
print("PASS: Android 14+ Health Connect privacy-policy alias", flush=True)
root = screen()
step_switch = find(root, resource="com.android.healthconnect.controller:id/switchWidget")
if step_switch.get("checked") != "true":
    tap(step_switch)
tap(find(screen(), text="Allow"))
root = screen()
assert contains(root, "in the background")
tap(find(root, text="Allow"))
assert contains(screen(), "Enter a valid phrase and server URL")
print("PASS: actual permission contract grants Steps and background read", flush=True)

fill(PACKAGE + ":id/pairing_phrase", "sand-moon-fig")
fill(PACKAGE + ":id/server_url", "https://truffle.invalid")
tap(find(screen(), text="Feed now"))
print("Foreground result:", wait_status("Check your connection and try Feed now again"), flush=True)
root = screen()
assert contains(root, "Hourly sync enabled")
values = pref_values()
assert values["phrase"] == "sand-moon-fig" and values["server"] == "https://truffle.invalid"
print("PASS: foreground aggregate reaches transport, configuration persisted", flush=True)

jobs = adb("shell", "dumpsys", "jobscheduler")
job_lines = [line.strip() for line in jobs.splitlines() if line.strip().startswith("JOB ") and PACKAGE + "/androidx.work.impl.background.systemjob.SystemJobService" in line]
assert len(job_lines) == 1, job_lines
job_id = re.search(r"/([0-9]+):", job_lines[0]).group(1)
print("Scheduled:", job_lines[0], flush=True)
adb("shell", "input", "keyevent", "KEYCODE_HOME")
# WorkManager also checks its own first-run delay. Advance only the disposable
# emulator clock, then restore it. This is not an actual one-hour battery test.
original_time = int(adb("shell", "date", "+%s"))
original_auto_time = adb("shell", "settings", "get", "global", "auto_time")
started = time.monotonic()
adb("shell", "settings", "put", "global", "auto_time", "0")
try:
    adb("shell", "su", "0", "date", "-s", "@" + str(original_time + 3700))
    print("Emulator clock advanced 3700 seconds for the initial work delay", flush=True)
    print(adb("shell", "cmd", "jobscheduler", "run", "-f", "-n", "androidx.work.systemjobscheduler", PACKAGE, job_id), flush=True)
    print("Background result:", wait_status("Hourly sync will retry"), flush=True)
finally:
    adb("shell", "su", "0", "date", "-s", "@" + str(original_time + int(time.monotonic() - started)))
    adb("shell", "settings", "put", "global", "auto_time", original_auto_time)
print("PASS: unique periodic job reads in background and retries failed HTTPS", flush=True)

adb("shell", "pm", "revoke", PACKAGE, "android.permission.health.READ_STEPS")
adb("shell", "am", "start", "-W", "-n", PACKAGE + "/.MainActivity")
root = screen()
find(root, text="Grant steps permission")
tap(find(root, text="Feed now"))
print("Revocation result:", wait_status("Grant steps permission to feed Truffle"), flush=True)
root = screen()
assert contains(root, "Grant steps permission")
assert pref_values()["needs_permission"] == "true"
tap(find(root, text="Grant steps permission"))
root = screen()
assert contains(root, "Steps")
print("PASS: revoked permission shows re-grant UI and reopens the contract", flush=True)
print("PASS: emulator smoke checks complete; no live server or Samsung data used", flush=True)
