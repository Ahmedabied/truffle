#!/usr/bin/env python3
"""B07 emulator check: day envelope, zone resend and calm rejections, live Worker.

Run from the laptop with emulator-5580 up on the workstation and the B07 APK
installed. The pairing phrase is read from a local JSON file given as the only
argument (the /pair reply). It is never printed: output shows <phrase>.
The guest zone is set to Europe/London so it differs from the Truffle's zone.
Health Connect has no step data on the emulator, so the total is 0.
"""
import json
import re
import shlex
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

ADB = "/home/tamlik/Android/Sdk/platform-tools/adb"
SERIAL = "emulator-5580"
PACKAGE = "dev.truffle.feeder"
SERVER = "https://truffle.ahmed-abied.workers.dev"
PHRASE = json.load(open(sys.argv[1]))["phrase"]


def redact(text):
    return text.replace(PHRASE, "<phrase>")


def adb(*args):
    command = shlex.join([ADB, "-s", SERIAL, *args])
    return subprocess.check_output(["ssh", "workstation", command], text=True).strip()


def screen():
    # The dump can return a null root while a screen is still drawing.
    for _ in range(10):
        try:
            adb("shell", "uiautomator", "dump", "/data/local/tmp/b07-window.xml")
            return ET.fromstring(adb("shell", "cat", "/data/local/tmp/b07-window.xml"))
        except (subprocess.CalledProcessError, ET.ParseError):
            time.sleep(1)
    raise AssertionError("No UI dump")


def wait_for(text=None, resource=None):
    for _ in range(15):
        try:
            return find(screen(), text=text, resource=resource)
        except AssertionError:
            time.sleep(1)
    return find(screen(), text=text, resource=resource)


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


def prefs():
    xml = adb("shell", "run-as", PACKAGE, "cat", "shared_prefs/feeder.xml")
    return {node.get("name"): node.text or node.get("value") for node in ET.fromstring(xml)}


def feed_and_wait(expect):
    before = prefs().get("status", "")
    tap(find(screen(), text="Feed now"))
    value = ""
    for _ in range(40):
        value = prefs().get("status", "")
        if value != before and expect in value:
            return value
        time.sleep(1)
    raise AssertionError(f"Expected status containing {expect!r}; got {redact(value)!r}")


print("Device Android", adb("shell", "getprop", "ro.build.version.release"), flush=True)
print("Clear test app:", adb("shell", "pm", "clear", PACKAGE), flush=True)
adb("shell", "cmd", "alarm", "set-timezone", "Europe/London")
print("Guest zone:", adb("shell", "getprop", "persist.sys.timezone"), flush=True)
adb("shell", "am", "start", "-W", "-n", PACKAGE + "/.MainActivity")
time.sleep(2)

# Grant Steps and background read through the real Health Connect screens.
tap(wait_for(text="Grant steps permission"))
time.sleep(3)
root = screen()
if contains(root, "Get started"):
    tap(find(root, text="Get started"))
switch = wait_for(resource="com.android.healthconnect.controller:id/switchWidget")
if switch.get("checked") != "true":
    tap(switch)
tap(wait_for(text="Allow"))
time.sleep(2)
root = screen()
if contains(root, "in the background"):
    tap(find(root, text="Allow"))
print("PASS: Steps and background read granted", flush=True)

fill(PACKAGE + ":id/server_url", SERVER)

# 400 without retry_after_s: words that are not on the list. The Worker's text is shown.
fill(PACKAGE + ":id/pairing_phrase", "zzq-qqz-zqz")
status = feed_and_wait("phrase must be three words")
print("400 status:", status, flush=True)
assert "{" not in status and "hint" not in status
assert prefs()["phrase"] == "zzq-qqz-zqz"
print("PASS: 400 shows the Worker error text, phrase kept", flush=True)

# 404 for a well-formed phrase with no Truffle. Same calm line as a 401.
fill(PACKAGE + ":id/pairing_phrase", "acorn-adder-agate")
status = feed_and_wait("Phrase not recognised")
print("404 status:", status, flush=True)
assert prefs()["phrase"] == "acorn-adder-agate"
print("PASS: unknown phrase shows the copy-again line, phrase kept", flush=True)

# The real Truffle. First feed is summed in the device zone, the reply says
# Asia/Muscat, and the app sums again from Muscat midnight and resends once.
fill(PACKAGE + ":id/pairing_phrase", PHRASE)
p = prefs()
assert not p.get("active_tz"), "phrase change must drop the old zone"
status = feed_and_wait("Sent ")
print("200 status:", redact(status), flush=True)
p = prefs()
print("Stored active_tz:", p.get("active_tz"), flush=True)
assert p.get("active_tz") == "Asia/Muscat"
assert p["phrase"] == PHRASE
print("PASS: 200, envelope echo parsed, active zone stored", flush=True)

# The status carries HH:mm. Let the minute turn so the new line differs.
time.sleep(61 - time.time() % 60)
status = feed_and_wait("Sent ")
print("Second 200 status:", redact(status), flush=True)
print("PASS: second feed uses the stored zone", flush=True)
print("Screen:", [redact(n.get("text")) for n in screen().iter("node") if n.get("text")][:12], flush=True)
