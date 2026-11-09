# 康娜桌宠

Windows 上的桌面小伙伴。支持拖拽、保持置顶、三档大小、五套衣服、专属动作和日语配音槽位。右键打开菜单，换衣后「播放动作」会更新为该套衣服可用的动作。

## 下载和运行

从 [GitHub Releases](https://github.com/MemoKanna/kanna-desktop-pet/releases/latest) 下载 Windows x64 ZIP，完整解压后双击 `KannaDesktopPet.exe`。保留 EXE 同目录的 `resources`、`locales` 和运行库。公开包使用原创示例形象「星团」，内置各类动作的演示。

## 导入本地素材

右键桌宠，选择 **导入本地素材**，再选择有权使用的兼容素材文件夹。可选 `assets` 文件夹、包含它的目录，或解压后的兼容桌宠目录。导入完整图集后，程序会启用对应的精细动作和换装。

`artwork.json` 列出 WebGL 版本所需的 PNG 图集文件名和像素尺寸。配音为可选素材，放在同一素材文件夹下的 `voice` 子目录。程序识别 `oh.wav`、`happy.wav`、`kobayashi.wav`、`eat.wav`、`yummy.wav`、`majiyaba.wav`、`hungry.wav`、`encourage.wav` 和 `see_you.wav`。建议使用 22,050 Hz 单声道 PCM WAV，按台词用途使用对应的文件名。右键 **配音** 可试听、调音量和静音。

## 从源码运行和打包

在 Windows x64 上安装 Node.js 22.12 或更新版本，然后在仓库目录执行：

```powershell
npm ci
npm start
npm run package:win
```

打包产物位于 `dist/`。如需制作仅在本机使用的完整包，可指定素材目录：

```powershell
npm run package:win -- --local-assets "D:\my-pet-assets"
```

程序在 `%APPDATA%\KannaDesktopPet\settings.json` 保存位置、衣服、播放频率和音量。

## 许可

源码和原创示例形象采用 [MIT](LICENSE)。康娜角色和作品素材归各自权利人所有。项目为非官方桌宠，仓库和公开便携包使用原创示例素材。Electron 及其依赖的许可随便携包附带。
