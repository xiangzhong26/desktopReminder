<div align="center">
  <img src="assets/icon.png" width="132" alt="MochiMinder Logo" />
  <h1>MochiMinder</h1>
  <p><strong>Cute slime companions that gently remind you to rest, hydrate, and move.</strong></p>

  <p><a href="README.md">简体中文</a> · <a href="README.en.md">English</a></p>

  <p>
    <a href="https://github.com/xiangzhong26/desktopReminder/releases/latest"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/xiangzhong26/desktopReminder?style=flat-square&color=59b99b" /></a>
    <img alt="macOS" src="https://img.shields.io/badge/macOS-Intel%20%7C%20Apple%20Silicon-243b35?style=flat-square&logo=apple" />
    <img alt="Windows" src="https://img.shields.io/badge/Windows-x64-243b35?style=flat-square&logo=windows" />
    <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-59b99b?style=flat-square" /></a>
  </p>
</div>

MochiMinder is an open-source desktop break reminder for Windows and macOS. Create individual reminders for standing up, drinking water, stretching, or looking into the distance. When a work session begins, every enabled task becomes a tiny slime companion on your desktop.

When a reminder is due, its slime runs across the screen with a playful animation. Click it to mark the action complete. Unhandled reminders remain visible and accumulate instead of silently disappearing.

![MochiMinder dashboard](docs/images/dashboard.png)

## Download

| Platform | Installer | Requirements |
| --- | --- | --- |
| Windows | [Download the Windows x64 installer](https://github.com/xiangzhong26/desktopReminder/releases/latest/download/MochiMinder%20Setup%200.2.0.exe) | 64-bit Windows 10/11 |
| macOS Apple Silicon | [Download the arm64 DMG](https://github.com/xiangzhong26/desktopReminder/releases/latest/download/MochiMinder-0.2.0-arm64.dmg) | M1/M2/M3/M4 Mac |
| macOS Intel | [Download the x64 DMG](https://github.com/xiangzhong26/desktopReminder/releases/latest/download/MochiMinder-0.2.0.dmg) | Intel Mac |

Visit the [latest release](https://github.com/xiangzhong26/desktopReminder/releases/latest) for release notes and all available files.

> The current builds are not signed with an Apple Developer ID or a commercial Windows code-signing certificate. Your operating system may show a security warning on first launch. Only download installers from this repository's Releases page.

## Desktop companions

![MochiMinder companions gathered around their campfire](docs/images/desktop-companions.png)

- Every enabled reminder becomes a slime with its own color.
- Slimes gather around a small campfire. Drag the campfire to move the whole group.
- A slime can be dragged away independently and will reconnect with a gooey snap animation when moved close to the campfire or another slime.
- Due reminders follow smooth curved paths with hopping, arm swings, and squash-and-stretch motion.
- Idle companions breathe, blink, look around, and occasionally become sleepy.
- Completing an action triggers a soft chime, a happy expression, and celebration particles.

## Features

### Flexible reminders

- Customize the reminder title, interval, and slime color.
- Enable, disable, edit, or delete tasks at any time.
- Unhandled reminders accumulate independently for each task.

### Work-session statistics

- Time is recorded between Start Work and End Work.
- Multiple sessions in one day are combined automatically.
- Sessions crossing midnight are split correctly by local calendar day.
- Review daily, weekly, monthly, and all-time focus duration.
- Track the total number of completed habit actions.

### Native desktop behavior

- Transparent, always-on-top, independently draggable companion windows.
- Continues running in the system tray when the dashboard is closed.
- Optional launch at login.
- Automated Windows and macOS installer builds.
- All personal data stays on your device and is never uploaded.

## Quick start

1. Download the correct installer from [Releases](https://github.com/xiangzhong26/desktopReminder/releases/latest).
2. Install and open MochiMinder.
3. Create your reminders under **Reminder Tasks**.
4. Select **Start Work** to bring the slime companions onto your desktop.
5. Click a slime whenever you complete its reminder.

### First launch on macOS

The current release is not notarized. If macOS blocks it, right-click MochiMinder in Finder, select **Open**, and confirm once more. Do not download the application from unofficial mirrors.

## Local development

Node.js 20 or newer is required.

```bash
git clone https://github.com/xiangzhong26/desktopReminder.git
cd desktopReminder
npm install
npm run dev
```

Useful commands:

```bash
npm run typecheck    # Check TypeScript types
npm run build:web    # Build the renderer
npm run build:mac    # Create macOS DMG installers
npm run build:win    # Create a Windows NSIS installer
npm run capture:docs # Regenerate README screenshots
```

Build artifacts are written to `release/`. Production distributions should be code-signed and, on macOS, notarized.

## Technology

- Electron for the desktop runtime, tray integration, and companion windows
- React and TypeScript for the dashboard and character state
- SVG and CSS animations for the slime artwork, expressions, and motion
- Vite for development and renderer builds
- electron-builder for DMG and NSIS installers

## Data and privacy

MochiMinder requires no account and sends no usage data to a server. Tasks, work sessions, and completion history are stored in Electron's local application-data directory:

- macOS: `~/Library/Application Support/mochiminder/mochiminder-data.json`
- Windows: `%APPDATA%/mochiminder/mochiminder-data.json`

Deleting this file resets all local data. Back it up first if the history matters to you.

## Project structure

```text
desktopReminder/
├── electron/              # Electron main process and secure preload bridge
├── src/                   # React dashboard, companions, and styles
├── assets/                # Application and installer icons
├── docs/images/           # README screenshots
├── scripts/               # Documentation screenshot tooling
└── .github/workflows/     # Automated Windows/macOS builds and releases
```

## Contributing

Issues, feature ideas, and pull requests are welcome. Before submitting code, run:

```bash
npm install
npm run typecheck
npm run build:web
```

Changes to companion behavior should be checked on both Windows and macOS, especially transparency, dragging, snapping, and multi-monitor behavior.

## License

MochiMinder is available under the [MIT License](LICENSE).
