#!/usr/bin/env python3
"""Local Chrome CDP checks. No server, package install or external request needed."""
import base64
import json
import os
from pathlib import Path
import shutil
import statistics
import subprocess
import tempfile
import time
import urllib.request

import websocket

ROOT = Path('/home/abied/Desktop/Truffle')
RAW = ROOT / 'fleet/outbox/S08/raw'
HTML = ROOT / 'web/spike/ascii.html'
RAW.mkdir(parents=True, exist_ok=True)
checks = []


def check(condition, description):
    if not condition:
        raise AssertionError(description)
    checks.append(description)
    print('PASS ' + description, flush=True)


class CDP:
    def __init__(self, url):
        self.ws = websocket.create_connection(url, timeout=45, suppress_origin=True)
        self.counter = 0
        self.events = []

    def call(self, method, params=None):
        self.counter += 1
        ident = self.counter
        self.ws.send(json.dumps({'id': ident, 'method': method, 'params': params or {}}))
        while True:
            message = json.loads(self.ws.recv())
            if message.get('id') == ident:
                if 'error' in message:
                    raise RuntimeError(message['error'])
                return message.get('result', {})
            self.events.append(message)

    def js(self, expression):
        response = self.call('Runtime.evaluate', {
            'expression': expression, 'returnByValue': True, 'awaitPromise': True,
        })
        if 'exceptionDetails' in response:
            raise RuntimeError(response['exceptionDetails'])
        return response['result'].get('value')


def distribution(values):
    ordered = sorted(values)
    def percentile(fraction):
        return ordered[min(len(ordered) - 1, int((len(ordered) - 1) * fraction))]
    return {
        'samples': len(values), 'mean_ms': round(statistics.mean(values), 4),
        'min_ms': round(min(values), 4), 'p50_ms': round(percentile(.5), 4),
        'p95_ms': round(percentile(.95), 4), 'max_ms': round(max(values), 4),
    }


def main():
    profile = Path(tempfile.mkdtemp(prefix='.chrome-', dir=RAW))
    environment = os.environ.copy()
    # Keep Chrome's Unix socket path below Linux's 108-byte limit.
    for variable, dirname in [('HOME', 'home'), ('XDG_CACHE_HOME', 'cache'), ('XDG_CONFIG_HOME', 'config'), ('TMPDIR', None)]:
        directory = profile / dirname if dirname else RAW
        directory.mkdir(exist_ok=True)
        environment[variable] = str(directory)
    chrome = shutil.which('google-chrome')
    if not chrome:
        raise RuntimeError('google-chrome not found')
    flags = [
        chrome, '--headless=new', '--remote-debugging-port=0',
        '--user-data-dir=' + str(profile / 'user'), '--no-first-run',
        '--no-default-browser-check', '--disable-background-networking',
        '--disable-component-update', '--disable-sync', '--disable-extensions',
        '--disable-default-apps', '--disable-breakpad', '--disable-crash-reporter',
        '--disable-features=Translate', '--metrics-recording-only',
        '--password-store=basic', '--use-mock-keychain', 'about:blank',
    ]
    log = (RAW / 'chrome.log').open('w')
    process = subprocess.Popen(flags, stdout=log, stderr=subprocess.STDOUT, env=environment)
    cdp = None
    try:
        active = profile / 'user/DevToolsActivePort'
        for _ in range(100):
            if active.exists():
                break
            if process.poll() is not None:
                raise RuntimeError('Chrome exited. See raw/chrome.log.')
            time.sleep(.1)
        port = active.read_text().splitlines()[0]
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/json/list') as response:
            targets = json.load(response)
        cdp = CDP(next(t['webSocketDebuggerUrl'] for t in targets if t['type'] == 'page'))
        version = cdp.call('Browser.getVersion')
        for domain in ['Page', 'Runtime', 'Network', 'DOM', 'CSS', 'Log']:
            cdp.call(domain + '.enable')
        cdp.call('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'no-preference'}]})

        def viewport(width, height=844):
            cdp.call('Emulation.setDeviceMetricsOverride', {
                'width': width, 'height': height, 'deviceScaleFactor': 2,
                'mobile': True, 'screenWidth': width, 'screenHeight': height,
                'screenOrientation': {'type': 'portraitPrimary' if height >= width else 'landscapePrimary', 'angle': 0 if height >= width else 90},
            })
            time.sleep(.22)

        def control(ident, value, kind='value'):
            cdp.js(f"(() => {{ const input = document.getElementById({json.dumps(ident)}); input.{kind} = {json.dumps(value)}; input.dispatchEvent(new Event({'"change"' if kind == 'checked' else '"input"'}, {{ bubbles: true }})); }})()")
            time.sleep(.12)

        def radio(name, value):
            selector = f'input[name="{name}"][value="{value}"]'
            cdp.js(f'document.querySelector({json.dumps(selector)}).click()')
            time.sleep(.12)

        def stats():
            return cdp.js('asciiSpike.stats()')

        def text():
            return cdp.js('document.getElementById("world").textContent')

        def screenshot(name, full=False):
            params = {'format': 'png', 'captureBeyondViewport': full}
            if full:
                size = cdp.call('Page.getLayoutMetrics')['cssContentSize']
                params['clip'] = {'x': 0, 'y': 0, 'width': size['width'], 'height': size['height'], 'scale': 1}
            data = cdp.call('Page.captureScreenshot', params)['data']
            (RAW / name).write_bytes(base64.b64decode(data))

        def sample(label, seconds):
            cdp.js('asciiSpike.resetStats()')
            time.sleep(seconds)
            result = stats()
            summary = {
                'label': label, 'requested_seconds': seconds, 'frames': result['frames'],
                'fps': round(result['meanFps'], 4), 'over_100_ms': result['over100'],
                'intervals': distribution(result['intervals']),
                'js_compose_and_text_assignment': distribution(result['drawTimes']),
                'state': result['state'], 'reduced': result['reduced'],
            }
            (RAW / (label + '.json')).write_text(json.dumps(result, indent=2) + '\n')
            print('TIMING ' + json.dumps(summary), flush=True)
            return summary

        viewport(390)
        cdp.call('Page.navigate', {'url': HTML.as_uri()})
        time.sleep(1)
        check(cdp.js("location.protocol === 'file:' && !!window.asciiSpike"), 'file:// page starts without a server')
        check(HTML.stat().st_size < 30000, 'HTML stays below 30,000 bytes')
        layouts = []
        for width, height in [(280, 653), (320, 740), (360, 800), (390, 844), (412, 915), (430, 932), (844, 390)]:
            viewport(width, height)
            value = cdp.js(r"""(() => {
              const pre = document.getElementById('world');
              const range = document.createRange();
              range.setStart(pre.firstChild, 0); range.setEnd(pre.firstChild, 40);
              return { ...asciiSpike.stats().layout, rows: pre.textContent.split('\n').map(row => Array.from(row).length),
                rangeWidth: range.getBoundingClientRect().width,
                pageWidth: document.documentElement.scrollWidth,
                direction: getComputedStyle(pre).direction };
            })()""")
            layouts.append(value)
            check(value['rows'] == [40] * 28, f'{width}x{height}: exact 40x28 buffer')
            check(abs(value['rangeWidth'] - width) < .1, f'{width}x{height}: measured text fits within 0.1 CSS px')
            check(value['pageWidth'] == width and value['direction'] == 'ltr', f'{width}x{height}: no horizontal overflow and LTR grid')
            check(value['mono'], f'{width}x{height}: block and box glyphs match ASCII cell width')
        viewport(390)
        check(cdp.js("document.querySelector('#world[role=img][aria-label]') !== null && [...document.querySelectorAll('input')].every(input => input.labels.length > 0)"), 'image role, description and labels for every input')

        colours = {}
        for hour, expected in [(0, 'night'), (6, 'dawn'), (12, 'day'), (18, 'dusk')]:
            control('hour', hour)
            colours[expected] = cdp.js("getComputedStyle(document.getElementById('world')).getPropertyValue('--sky')")
            check(expected in cdp.js("document.getElementById('world').getAttribute('aria-label')"), f'{expected} hour updates accessible scene description')
            check(('- O -' in text()) == (hour >= 6), f'{expected} draws the correct sun or moon')
        check(len(set(colours.values())) == 4, 'four distinct hour-based sky colours')
        moods = {}
        for mood, eyes in [('content', 'o    o'), ('asleep', '-    -'), ('affectionate', '^    ^')]:
            radio('mood', mood)
            moods[mood] = text().splitlines()[18:25]
            check(eyes in '\n'.join(moods[mood]), mood + ' has distinct eyes in the seven-row sprite')
        check('░' * 10 in (radio('mood', 'asleep') or text()), 'asleep sample has an empty block energy bar')
        radio('mood', 'content')
        control('wind', 0)
        a = stats()['cloudPhase']
        time.sleep(.6)
        check(stats()['cloudPhase'] == a, 'zero wind stops cloud drift')
        control('wind', 40)
        a = stats()['cloudPhase']
        time.sleep(.6)
        check(stats()['cloudPhase'] > a, '40 km/h wind advances clouds')
        control('rain', True, 'checked')
        a = stats()['rainPhase']
        time.sleep(.4)
        check(stats()['rainPhase'] > a, 'rain falls when enabled')
        control('reduce', True, 'checked')
        before = stats()
        still = text()
        time.sleep(.7)
        after = stats()
        check(before['cloudPhase'] == after['cloudPhase'] and before['rainPhase'] == after['rainPhase'] and text() == still, 'manual reduced motion freezes clouds and rain without losing state')
        radio('ground', 'grass')
        check(text() != still and stats()['state']['rain'], 'frozen world still responds to ground changes and keeps rain state')
        radio('ground', 'sand')
        cdp.call('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'reduce'}]})
        control('reduce', False, 'checked')
        before = stats()
        time.sleep(.5)
        after = stats()
        check(after['reduced'] and before['cloudPhase'] == after['cloudPhase'] and before['rainPhase'] == after['rainPhase'], 'system reduced motion applies even when manual checkbox is off')
        cdp.js("document.getElementById('type').click()")
        check(cdp.js("!asciiSpike.stats().typing && document.getElementById('reply').textContent === document.getElementById('reply-status').textContent && document.getElementById('reply').textContent.length > 10"), 'reduced motion reveals and announces the whole reply at once')
        cdp.call('Emulation.setEmulatedMedia', {'features': [{'name': 'prefers-reduced-motion', 'value': 'no-preference'}]})
        time.sleep(.2)

        typing_results = []
        for language, speed in [('ar', '40'), ('en', '12'), ('en', '40')]:
            radio('language', language)
            radio('speed', speed)
            result = cdp.js(r"""new Promise(resolve => {
              const reply = document.getElementById('reply');
              const status = document.getElementById('reply-status');
              const start = performance.now();
              const observer = new MutationObserver(() => {
                if (status.textContent) {
                  observer.disconnect();
                  resolve({ duration_ms: performance.now() - start, text: reply.textContent,
                    language: reply.lang, direction: getComputedStyle(reply).direction,
                    graphemes: [...new Intl.Segmenter(reply.lang, {granularity: 'grapheme'}).segment(reply.textContent)].length });
                }
              });
              observer.observe(status, {childList: true});
              document.getElementById('type').click();
            })""")
            result['requested_ms_per_grapheme'] = int(speed)
            typing_results.append(result)
            check(result['direction'] == ('rtl' if language == 'ar' else 'ltr'), f'{language} {speed} ms typing has the correct automatic text direction')
            check(result['duration_ms'] >= .95 * int(speed) * result['graphemes'], f'{language} {speed} ms uses the requested reveal delay')
        cdp.js("document.getElementById('type').click()")
        time.sleep(.15)
        control('reduce', True, 'checked')
        check(not stats()['typing'], 'enabling reduced motion finishes an in-flight reply')
        control('reduce', False, 'checked')
        cdp.js("document.getElementById('type').click(); document.getElementById('type').click()")
        time.sleep(3)
        check(not stats()['typing'], 'restarting a reply cancels the old timer cleanly')

        writes = cdp.js(r"""new Promise(resolve => {
          let writes = 0;
          const observer = new MutationObserver(records => writes += records.length);
          observer.observe(document.getElementById('world'), {childList: true, characterData: true, subtree: true});
          const frames = asciiSpike.stats().frames;
          setTimeout(() => { observer.disconnect(); resolve({writes, frames: asciiSpike.stats().frames - frames}); }, 1600);
        })""")
        check(writes['writes'] == writes['frames'] and writes['frames'] > 0, 'exactly one pre mutation per rendered frame')
        previous_slow = stats()['over100']
        cdp.js('(() => { const until = performance.now() + 240; while (performance.now() < until) {} })()')
        time.sleep(.3)
        check(stats()['over100'] > previous_slow, 'a deliberate main-thread stall increments the over-100-ms counter')

        control('rain', False, 'checked')
        control('wind', 12)
        timing = [sample('timing-clear', 20)]
        control('rain', True, 'checked')
        control('wind', 40)
        timing.append(sample('timing-rain-wind40', 15))
        control('reduce', True, 'checked')
        timing.append(sample('timing-reduced', 10))
        for item in timing:
            check(10 <= item['fps'] <= 12.5, item['label'] + ': measured render rate stays near the 12 fps target')

        # Repeatable mobile screenshots. The first one shows readable Arabic, not a half word.
        control('hour', 18)
        control('rain', False, 'checked')
        radio('ground', 'sand')
        radio('mood', 'content')
        radio('language', 'ar')
        cdp.js("document.getElementById('type').click()")
        control('reduce', False, 'checked')
        control('wind', 12)
        screenshot('mobile-dusk-arabic.png')
        screenshot('mobile-dusk-arabic-full.png', full=True)
        control('hour', 0)
        radio('ground', 'grass')
        radio('mood', 'affectionate')
        control('rain', True, 'checked')
        control('wind', 40)
        screenshot('mobile-night-rain.png', full=True)

        root = cdp.call('DOM.getDocument')['root']['nodeId']
        fonts = {}
        for selector in ['#world', '#reply']:
            node = cdp.call('DOM.querySelector', {'nodeId': root, 'selector': selector})['nodeId']
            fonts[selector] = cdp.call('CSS.getPlatformFontsForNode', {'nodeId': node})['fonts']
        requests = [e['params']['request']['url'] for e in cdp.events if e.get('method') == 'Network.requestWillBeSent']
        errors = [e for e in cdp.events if e.get('method') == 'Runtime.exceptionThrown' or (e.get('method') == 'Log.entryAdded' and e['params']['entry'].get('level') == 'error')]
        check(not errors, 'Chrome reports no page JavaScript or console errors')
        check(all(url.startswith('file:') for url in requests), 'page makes no HTTP, font or other external requests')
        report = {
            'browser': version, 'html_bytes': HTML.stat().st_size,
            'viewport': {'width': 390, 'height': 844, 'deviceScaleFactor': 2, 'mobile': True},
            'layouts': layouts, 'timing': timing, 'typing': typing_results,
            'fonts': fonts, 'sky_colours': colours, 'mood_rows': moods,
            'grid_mutations': writes, 'network_requests': requests, 'errors': errors,
            'checks': checks,
        }
        (RAW / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print('FONTS ' + json.dumps(fonts), flush=True)
        print(f'PASS {len(checks)} checks. HTML {HTML.stat().st_size} bytes.', flush=True)
    finally:
        if cdp:
            try:
                cdp.call('Browser.close')
            except Exception:
                pass
            cdp.ws.close()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.terminate()
            process.wait(timeout=10)
        log.close()
        shutil.rmtree(profile)


if __name__ == '__main__':
    main()
