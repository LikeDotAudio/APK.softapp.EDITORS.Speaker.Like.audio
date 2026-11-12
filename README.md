# 🔈 Speaker CAD Builder

Part of [APK.audio](https://github.com/LikeDotAudio/APK.audio). It is the Speaker CAD Builder and Datasheet Editor softapp, in the OS menu group **Design**.

With it you design a cabinet enclosure, place and arrange the drivers on the baffle, set the electroacoustic specs and the crossover bands, and export the speaker model.

| | |
|---|---|
| **Version** | `2.0.0` |
| **Entry** | `index.html` (`display.json` registers it with the OS) |
| **Model** | `js/model/speaker.js` |
| **Tests** | `npm test` (`node --test tests/*.test.mjs`) |

In the monorepo it is the submodule `PODS/POD.THIN/Softapps/EDITORS/EDITORS.Speaker.Like.audio`. It was split out of the root, with its history, on 2026-11-05 (ROAD-3536). Its documentation is in [Documentation/](Documentation/README.md).

*MIT Licence. Made by Anthony Kuzub.*

<!-- wiki:smoke -->
**Smoke test** — ✅ PASS 2/2 since 2026-11-12 00:40 EST — [results](Documentation/%F0%9F%A7%A9Manual%20and%20Artifacts/SMOKE.md)
<!-- /wiki:smoke -->
