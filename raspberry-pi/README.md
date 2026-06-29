# Raspberry Pi kiosk setup

This folder contains the early setup pieces for running Stop Motion Station as a Raspberry Pi camera kiosk.

The goal is:

1. Boot Raspberry Pi OS into the graphical desktop.
2. Start a local static server for this repository, or skip the server and use the GitHub Pages deployment.
3. Launch Chromium in kiosk mode pointed at the application URL.
4. Keep the display awake.
5. Make the setup easy to reinstall on a fresh Pi.

## Expected hardware

- Raspberry Pi with a recent Raspberry Pi OS desktop image.
- Raspberry Pi Camera or another camera exposed to Chromium through the operating system camera stack.
- Keyboard or dedicated button controller that can emit the app's keyboard shortcuts.
- Display connected to the Pi.
- Python 3 for the kiosk launcher's local static server. Remote mode does not need Python.

## First-time operating system setup

1. Flash Raspberry Pi OS with desktop support.
2. Enable the camera interface if your camera model and operating system image require it.
3. Confirm Chromium can see the camera outside kiosk mode.
4. Copy or clone this repository to the Pi.
5. From the repository root, run the setup script:

```sh
raspberry-pi/scripts/install-kiosk-mode.sh
```

6. Reboot the Pi.

## Configuration knobs

The generated kiosk launcher reads these environment variables if they are set before launch:

- `STOP_MOTION_STATION_RUN_MODE`: `local` or `remote`. Defaults to `local`.
- `STOP_MOTION_STATION_ROOT`: repository path. Defaults to the current repository path recorded when the installer runs.
- `STOP_MOTION_STATION_PORT`: local static server port. Defaults to `4173`.
- `STOP_MOTION_STATION_URL`: local-mode Chromium URL. Defaults to `http://localhost:${STOP_MOTION_STATION_PORT}`.
- `STOP_MOTION_STATION_REMOTE_URL`: remote-mode Chromium URL. Defaults to `https://wmacfarl.github.io/stop-motion-station/`.
- `STOP_MOTION_STATION_CHROMIUM_PROFILE`: dedicated Chromium kiosk profile directory. Defaults to `~/.local/share/stop-motion-station/chromium-profile`.
- `STOP_MOTION_STATION_DEVTOOLS`: set to `1` to open DevTools and enable Chromium remote debugging.
- `STOP_MOTION_STATION_REMOTE_DEBUGGING_PORT`: remote debugging port when devtools mode is enabled. Defaults to `9222`.
- `STOP_MOTION_STATION_REMOTE_DEBUGGING_ADDRESS`: remote debugging bind address. Defaults to `127.0.0.1`; use `0.0.0.0` only on a trusted development network.
- `CHROMIUM_BINARY`: Chromium executable name. Defaults to `chromium-browser`, then falls back to `chromium`.

The installer persists any of those optional environment variables into the
systemd service when they are set while running `install-kiosk-mode.sh`.

## Scripts

- `scripts/install-kiosk-mode.sh` installs a user-level systemd service and a desktop autostart entry.
- `scripts/launch-kiosk.sh` starts the local static server and Chromium kiosk session by default.
- `scripts/launch-kiosk.sh --remote` skips the local server and opens `https://wmacfarl.github.io/stop-motion-station/`.
- `scripts/launch-kiosk.sh --local` forces the local server mode.
- `scripts/launch-kiosk.sh --url URL` opens a custom URL. In local mode, the local server still starts; in remote mode, no server starts.
- `scripts/launch-kiosk.sh --devtools` opens DevTools for the kiosk tab and starts Chromium remote debugging.

To install autostart in remote mode, set the run mode when installing:

```sh
STOP_MOTION_STATION_RUN_MODE=remote raspberry-pi/scripts/install-kiosk-mode.sh
```

## Kiosk debugging

For a one-off development launch on the Pi:

```sh
STOP_MOTION_STATION_DEVTOOLS=1 raspberry-pi/scripts/launch-kiosk.sh --remote
```

To inspect the kiosk from another computer on the same trusted network:

```sh
STOP_MOTION_STATION_DEVTOOLS=1 \
STOP_MOTION_STATION_REMOTE_DEBUGGING_ADDRESS=0.0.0.0 \
raspberry-pi/scripts/launch-kiosk.sh --remote
```

Then open `http://<pi-ip-address>:9222` from another Chromium browser, or use
`chrome://inspect` and add `<pi-ip-address>:9222`.

To make the autostart service reboot into remote-debuggable kiosk mode, reinstall
the service with the development flags:

```sh
STOP_MOTION_STATION_RUN_MODE=remote \
STOP_MOTION_STATION_DEVTOOLS=1 \
STOP_MOTION_STATION_REMOTE_DEBUGGING_ADDRESS=0.0.0.0 \
raspberry-pi/scripts/install-kiosk-mode.sh
```

The launcher logs the app URL and Chromium profile directory to stderr, so
`journalctl --user -u stop-motion-station-kiosk.service` can confirm which
origin and profile were used on each boot.

## Chromium profile and keyring prompts

The launcher uses a dedicated Chromium profile and `--password-store=basic` so kiosk startup does not try to unlock the desktop keyring or reuse a normal browser profile.

If Chromium still shows an authentication or keyring prompt, make sure you are launching through `raspberry-pi/scripts/launch-kiosk.sh` and not opening Chromium manually with the default profile.

Projects are stored inside that Chromium profile for the exact app origin. Keep
`STOP_MOTION_STATION_CHROMIUM_PROFILE` and the app URL stable across reboots;
switching between `localhost`, `127.0.0.1`, and the GitHub Pages URL creates
separate browser storage buckets. If a profile does come up empty, backend sync
will restore projects for the configured table identity before uploading local
changes.

## Notes and open tasks

- Camera permission behavior should be tested on the target Pi. We may need a Chromium policy or profile preconfiguration once we know the final application origin.
- The current local static server uses Python's built-in HTTP server. That keeps deployment simple, but a system package such as nginx may be preferable later.
- The kiosk launcher assumes a graphical desktop session and Chromium are available.
- Hardware button wiring is not implemented yet. A future script can map General Purpose Input Output button presses to the keyboard shortcuts used by the browser app.
