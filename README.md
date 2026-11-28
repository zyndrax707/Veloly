<p align="center">
  <img src="LOGObanie_edited.jpg" width="420" alt="Veloly" />
</p>

<h1 align="center">Veloly</h1>

<p align="center">
  A free, open-source music player for your own library and online discovery.<br />
  <a href="https://veloly-site.vercel.app/">Website</a> ·
  <a href="https://github.com/zyndrax707/Veloly/tree/main/docs">Documentation</a> ·
  <a href="https://veloly-site.vercel.app/ios.html">iPhone and iPad guide</a> ·
  <a href="https://github.com/zyndrax707/Veloly/releases/latest">Downloads</a>
</p>

<p align="center">
  <img src="site/assets/shot-discover.jpg" width="860" alt="Veloly Discover page" />
</p>

<p align="center">
  <img src="site/assets/shot-lyrics.jpg" width="425" alt="Veloly lyrics and player" />
  <img src="site/assets/shot-artist.jpg" width="425" alt="An artist page in Veloly" />
</p>

Veloly is an independent project based on [555](https://github.com/amonre555/555). It has its own name, visual identity, website and release builds, and is not affiliated with the 555 project. See the [GPL-3.0-or-later license](LICENSE).

## What Veloly can do

### Find and play music

- Search and discover tracks, artists and albums using Deezer metadata and artwork, with audio streamed from YouTube Music. Spotify is supported as a playlist import source; it is not an audio provider in Veloly.
- Browse artist and album pages, charts, recommendations, listening statistics and a yearly listening recap.
- See lyrics when a provider has them. Veloly looks for lyrics from LRCLIB and NetEase when the lyrics view is opened; synchronized lyrics follow playback when timing data is available.
- On desktop, use the optional Discord Rich Presence setting to show the playing track and progress in Discord.

Online search, streaming, artwork, lyrics, playlist links and update checks need an internet connection. On desktop, YouTube playback requires `yt-dlp` installed on the computer; Veloly does not download or update it. Mobile playback uses the app's native YouTube stream path and does not require `yt-dlp`.

### Your music and playlists

- Add your own audio files to the local library. Desktop can scan music folders; Android and iPhone/iPad can import files with the system file picker.
- Play local files offline. **Offline mode filters playback to files already in your library**; Veloly does not download streamed tracks from YouTube, Deezer or Spotify for offline listening.
- Like tracks, create playlists, add the same track more than once, sort playlists by title, album or duration, and reorder tracks with drag and drop. Reorder **Next Up** in the queue as well.
- Import playlist links from Spotify, Deezer, YouTube Music or Veloly. Imported services are matched to tracks that Veloly can find; private or unavailable tracks may not import.
- Share a Veloly playlist through a link. The link contains track metadata, not local audio files or file paths. Creating or opening a shared link requires internet access.
- Export and restore a collection backup. Backups move playlists, liked tracks and listening history between devices; they do not continuously sync them.
- Keep a listening history, view listening statistics, and resume the previous song, queue and position on launch.

### Shape the sound and the interface

- Adjust playback with a four-band equalizer, draggable frequency points, presets (including Vocal, Rock and Acoustic), radio and reverb effects, and playback speed.
- Set a crossfade of up to 12 seconds, use the sleep timer, change the output device where supported, and control playback with customizable keyboard shortcuts.
- Choose a color from presets or the color wheel, preview it before applying, and toggle glow effects. Import CSS themes, write Custom CSS and preview or cancel a theme before applying it.
- Adjust text size, contrast and motion, and choose which Discover sections appear and in what order.
- Switch between English and French. A short interactive tour is available on first launch and can be replayed from Settings.

## Privacy and network use

Veloly has no user accounts, profile pages, ads or playlist synchronization. Your library, playlists, likes, history, settings and theme preferences are stored locally on the device.

The app contacts online music and lyrics providers for the features above. It also checks for app updates: desktop builds use the Tauri updater, while Android and iOS check GitHub Releases and open the relevant installer or SideStore flow. If the release build includes the telemetry service, the first-launch counter is **opt-in** in Settings; disabling it asks the service to remove that installation's count. Feedback is sent only when you submit it in the app. Playlist sharing sends the playlist's title and track metadata to the Veloly link service so it can create a share URL. See the [privacy guide source](docs/guide/privacy.md).

## Get Veloly

Download the latest available platform build from [GitHub Releases](https://github.com/zyndrax707/Veloly/releases/latest). Release assets may vary while a platform build is running or being prepared.

- **Windows:** run the `.exe` setup installer. If SmartScreen warns, choose **More info → Run anyway**.
- **macOS:** open the `.dmg` and move Veloly to Applications. Builds are not notarized by Apple; macOS may require **Open Anyway** in Privacy & Security on first launch.
- **Android 8+:** install the `.apk` and allow the browser or file manager to install apps. Android asks you to confirm installation of an update.
- **iPhone and iPad (iOS 15+):** install the `.ipa` with [SideStore](https://sidestore.io), which signs it with your Apple Account. SideStore handles renewals and updates. Follow the [iOS installation guide](https://veloly-site.vercel.app/ios.html). Veloly is not on the App Store.

Windows and macOS can install signed desktop updates from inside Veloly when a compatible release is available. On Android, the update button opens the APK installer. On iPhone and iPad, updates are handled by SideStore.

## Build from source

Requirements: stable Rust, Node.js 22 or later, and platform build tools. Desktop YouTube playback also needs `yt-dlp` installed on the system.

```bash
cd app
npm install
npm run tauri dev
```

Create an optimized desktop build with `npm run tauri build`.

For Android, install Android Studio and its SDK/NDK, enable USB debugging on a connected device, then follow the [Android build script](scripts/android.sh) or the [installation guide source](docs/guide/install.md).

iOS builds require macOS and Xcode:

```bash
cd app
npm install
npm run ios:init   # once per checkout
npm run ios:dev    # simulator or connected device
npm run ios:build
```

Installing on a physical device requires signing. The release workflow produces an unsigned `.ipa` for installation through SideStore.

To work on the interface in a browser without launching Tauri, run `npm run dev` from `app/` and open `http://localhost:1420`. This development mode uses a mock core and sample data; it is not included in release builds. The site's demo screenshots can be viewed with `?demo`, `?demo=lyrics`, `?demo=artist`, `?demo=album` and `?demo=history`.

## Project layout

```
crates/yato-core/   Rust audio player, sources, library, collection and statistics
app/                SolidJS + Vite interface
app/src-tauri/      Tauri v2 desktop and mobile bridge
site/               Static website and its published assets
docs/               VitePress documentation source
telemetry/          Optional Cloudflare Worker for first-launch count, feedback and playlist links
```

The core is independent of the Tauri interface. The desktop and mobile clients use the same Rust player core with platform-specific audio and file access.

## Releases and website

The app version is defined in `Cargo.toml` under `[workspace.package]` and mirrored in `app/package.json`. Release builds are produced by GitHub Actions for Windows, macOS, Android and iPhone/iPad. The workflow uploads installers to the GitHub Release; mobile jobs can take longer than desktop jobs because Android and iOS build on separate runners.

The website is the `site/` directory and is hosted on Vercel at [veloly-site.vercel.app](https://veloly-site.vercel.app/). The project is connected to this repository and uses `site/` as its root directory. Documentation source lives in [`docs/`](docs/); its hosted route is not currently included in the Vercel site, so the links above point to its source on GitHub.

## License

Veloly is distributed under [GPL-3.0-or-later](LICENSE). The upstream project and author are credited above.

Playing YouTube audio outside its official player may be restricted by YouTube's terms. Users are responsible for complying with the terms and rights that apply to the services and music they use.
