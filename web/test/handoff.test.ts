import { describe, expect, it, vi } from "vitest";
import { APP_UA_MARK, RELEASES_URL, appLink, inApp, isAndroid, offerApp, parseCredsHash, takeCredsFromHash } from "../src/handoff";

const SECRET = "Ab3_x-9QzLm2Rt7Yp0Kq1w"; // 22 base64url chars, the Worker's shape

describe("parseCredsHash: #creds=<phrase>.<secret> from the Truffle app", () => {
  it("reads a real looking phrase and secret", () => {
    expect(parseCredsHash(`#creds=sand-moon-fig.${SECRET}`)).toEqual({ phrase: "sand-moon-fig", secret: SECRET });
  });
  it("accepts the hash without the leading #", () => {
    expect(parseCredsHash(`creds=sand-moon-fig.${SECRET}`)?.phrase).toBe("sand-moon-fig");
  });
  it("splits on the first dot, so a secret with hyphens and underscores survives", () => {
    expect(parseCredsHash("#creds=olive-kite-reef.-_-_abcdEFGH123456")).toEqual({ phrase: "olive-kite-reef", secret: "-_-_abcdEFGH123456" });
  });
  it("decodes percent escapes and lowercases the phrase", () => {
    expect(parseCredsHash(`#creds=Sand-Moon-Fig%2E${SECRET}`)).toEqual({ phrase: "sand-moon-fig", secret: SECRET });
  });
  it("refuses offline demo credentials", () => {
    expect(parseCredsHash("#creds=sand-moon-fig.offline-demo")).toBeNull();
  });
  it.each([
    ["", "empty"],
    ["#", "bare hash"],
    ["#creds=", "no body"],
    [`#creds=sand-moon-fig`, "no secret"],
    [`#creds=sand-moon.${SECRET}`, "two words"],
    [`#creds=sand-moon-fig-kite.${SECRET}`, "four words"],
    [`#creds=sand moon fig.${SECRET}`, "spaces"],
    [`#creds=sand-m00n-fig.${SECRET}`, "digits in a word"],
    ["#creds=sand-moon-fig.short", "secret too short"],
    [`#creds=sand-moon-fig.${"a".repeat(129)}`, "secret too long"],
    [`#creds=sand-moon-fig.${SECRET}.extra`, "dot in the secret"],
    [`#creds=sand-moon-fig.abc+def/ghi=`, "plain base64, not base64url"],
    [`#creds=sand-moon-fig.${SECRET}&x=1`, "extra parameters"],
    ["#creds=%E0%A4%A", "broken escape"],
    [`#other=sand-moon-fig.${SECRET}`, "another key"],
    [`#xcreds=sand-moon-fig.${SECRET}`, "prefix"]
  ])("refuses %s (%s)", (hash) => {
    expect(parseCredsHash(hash)).toBeNull();
  });
});

describe("takeCredsFromHash", () => {
  const hist = () => ({ state: { k: 1 }, replaceState: vi.fn() });

  it("saves the creds and strips the fragment, keeping path and query", () => {
    const h = hist();
    const save = vi.fn();
    const c = takeCredsFromHash({ hash: `#creds=sand-moon-fig.${SECRET}`, pathname: "/", search: "?fps=1" }, h, save);
    expect(c).toEqual({ phrase: "sand-moon-fig", secret: SECRET });
    expect(save).toHaveBeenCalledWith({ phrase: "sand-moon-fig", secret: SECRET });
    expect(h.replaceState).toHaveBeenCalledWith({ k: 1 }, "", "/?fps=1");
  });
  it("strips a malformed creds fragment too, and saves nothing", () => {
    const h = hist();
    const save = vi.fn();
    expect(takeCredsFromHash({ hash: "#creds=bad", pathname: "/", search: "" }, h, save)).toBeNull();
    expect(save).not.toHaveBeenCalled();
    expect(h.replaceState).toHaveBeenCalledWith({ k: 1 }, "", "/");
  });
  it("leaves other fragments alone", () => {
    const h = hist();
    const save = vi.fn();
    expect(takeCredsFromHash({ hash: "#settings", pathname: "/", search: "" }, h, save)).toBeNull();
    expect(h.replaceState).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});

describe("the app hand-off", () => {
  const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
  const WEBVIEW = CHROME_ANDROID.replace("Mobile Safari", "Mobile Safari wv") + " TruffleApp/0.2";
  const DESKTOP = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const real = { demo: false, mock: false, paired: true };

  it("knows the app's user agent mark", () => {
    expect(APP_UA_MARK).toBe("TruffleApp/");
    expect(inApp(WEBVIEW)).toBe(true);
    expect(inApp(CHROME_ANDROID)).toBe(false);
  });
  it("knows Android", () => {
    expect(isAndroid(CHROME_ANDROID)).toBe(true);
    expect(isAndroid(DESKTOP)).toBe(false);
    expect(isAndroid(IPHONE)).toBe(false);
  });
  it("offers the app on Android Chrome for a real paired Truffle", () => {
    expect(offerApp(CHROME_ANDROID, real)).toBe(true);
  });
  it("never offers it inside the app, on desktop, on iPhone, in judge mode, offline or unpaired", () => {
    expect(offerApp(WEBVIEW, real)).toBe(false);
    expect(offerApp(DESKTOP, real)).toBe(false);
    expect(offerApp(IPHONE, real)).toBe(false);
    expect(offerApp(CHROME_ANDROID, { ...real, demo: true })).toBe(false);
    expect(offerApp(CHROME_ANDROID, { ...real, mock: true })).toBe(false);
    expect(offerApp(CHROME_ANDROID, { ...real, paired: false })).toBe(false);
  });
  it("builds the custom scheme link, which round-trips through the parser", () => {
    const c = { phrase: "sand-moon-fig", secret: SECRET };
    const link = appLink(c);
    expect(link).toBe(`truffle://pair?creds=sand-moon-fig.${SECRET}`);
    expect(link.startsWith("truffle://")).toBe(true);
    expect(parseCredsHash("#" + new URL(link).search.slice(1))).toEqual(c);
  });
  it("points the download at the GitHub releases page", () => {
    expect(RELEASES_URL).toBe("https://github.com/ahmedabied/Truffle/releases");
  });
});
