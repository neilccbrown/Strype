
export function detectBrowser(): "chrome" | "safari" | "webkit" | "other" {
    const ua = navigator.userAgent;

    const isChrome = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor);
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    const isWebKit = /AppleWebKit/.test(ua) && !isChrome && !isSafari;

    if (isChrome) {
        return "chrome";
    }
    if (isSafari) {
        return "safari";
    }
    if (isWebKit) {
        return "webkit";
    }

    return "other";
}
