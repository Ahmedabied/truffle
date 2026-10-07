# 02 - Android toolchain lives on the box (Abied-Tamlik, `ssh workstation`)

Checked 2026-10-07 over SSH. Ahmed: "you can use the workstation box over the ssh to do android stuff, it already has the tools."

- SDK root: `/home/tamlik/Android/Sdk` with platforms android-35, android-36 and build-tools 35.0.0, 36.0.0.
- Disk: 77GB free (laptop has ~9GB). All Gradle/SDK work goes here.
- `java`, `adb`, `gradle` are **not on PATH** for a non-interactive SSH shell. Use the full paths below and the Gradle wrapper (`./gradlew`).
- Probe output (jbr / adb / sdkmanager / docker):
```
/home/tamlik/android-studio/jbr
/home/tamlik/Android/Sdk/cmdline-tools/latest/bin/sdkmanager
/home/tamlik/Android/Sdk/platform-tools/adb
```
- If no JBR was found above: install OpenJDK 17 on the box (`sudo apt install openjdk-17-jdk`) before the first Gradle build; Gradle 8 + AGP 8.x need JDK 17+.
- Workflow: edit in the repo on the laptop, `git push`, `ssh workstation 'cd ~/Desktop/truffle && git pull && cd feeder-android && JAVA_HOME=<jbr or jdk> ANDROID_HOME=~/Android/Sdk ./gradlew assembleDebug'`, then `scp` the APK back or attach it to a GitHub Release. Install on the Samsung by file (no USB needed) or `adb` over Wi-Fi.
