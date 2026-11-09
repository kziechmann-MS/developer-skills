# Optional real-browser boundary check

Requires Node 22+ and an already-installed Chrome/Chromium. It installs nothing.
From the repository root on Windows:

```powershell
node .\checks\browser-smoke.mjs
```

Set `CHROME_PATH` only if the installed executable is outside the checked
standard locations. The runner serves an explicit four-file allowlist on a
temporary loopback port, launches a separate headless browser with a new
temporary profile, reads the final DOM result, then closes the process/server
and deletes that specific temporary profile. It does not open your normal
browser profile. No remote model, workplace endpoint or external script is used.
The page's content security policy disallows connections and external content.

The browser imports the same implementation modules as the Node tests. It checks
actual delayed registry mounting, two callers, emitted IDs, stable DOM identity
through a title update, atomic completion, a real button handler's server-side
reservation effect, safe plain-text rendering, stale suppression, unsupported
component rejection, cancellation and disposal.

The button uses programmatic `.click()` on a real DOM element. This is not a
native pointer/keyboard activation test, accessibility audit, framework
integration, HTTP action endpoint, or live provider/transport check. Both the
middle tier and client execute locally for this deliberately offline example.
The runner fails explicitly if Chrome is absent, the page never finishes,
an assertion fails or cleanup fails. Browser evidence is not an agent evaluation.
