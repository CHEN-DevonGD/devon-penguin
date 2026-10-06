# Codex 與 Claude Code 使用方式

## 同一份可攜套件

`skills/new-project-grill/` 是來源。核心 frontmatter 只用 name、description；Codex 的 agents/openai.yaml 可供顯示，Claude Code 使用同一份 SKILL.md 與相對路徑資源。安裝時完整複製資料夾，不只複製入口，也不修改兩個副本的核心內容；更新以來源整個套件為準。不要同時在同一工具的個人與專案位置安裝同名副本造成選用歧義。

截至 2026-10-06 查核的官方位置：Codex 個人 `~/.agents/skills/`、專案 `.agents/skills/`；Claude Code 個人 `~/.claude/skills/`、專案 `.claude/skills/`。使用者如已有舊版／自訂路徑，以該機器實際能發現的技能位置為準；先看技能清單再判斷。

來源：[Codex Skills](https://learn.chatgpt.com/docs/build-skills)、[Claude Code Skills](https://code.claude.com/docs/en/skills)。本說明的 Claude 指 Claude Code；其他 Claude 介面需依其支援方式，不宣稱可直接使用本機路徑。

## macOS／Linux 個人安裝

從交付 repository 根目錄操作。以下兩段分別供想使用的工具，無須兩者都安裝；這些是使用者自行執行的範例，不自動變更個人目錄。

```sh
mkdir -p "$HOME/.agents/skills"
cp -R skills/new-project-grill "$HOME/.agents/skills/"
```

```sh
mkdir -p "$HOME/.claude/skills"
cp -R skills/new-project-grill "$HOME/.claude/skills/"
```

目標已有同名資料夾時，先確認它是本套件且沒有個人修改，再移走舊副本後複製新版本。不要讓 cp 把新資料夾巢狀放入舊資料夾。

## Windows PowerShell 個人安裝

在 repository 根目錄執行，採原生路徑，不使用 bash 的環境變數或指令串接。

```powershell
$grillDestination = Join-Path $HOME '.agents\skills'
New-Item -ItemType Directory -Force -Path $grillDestination | Out-Null
Copy-Item -Recurse -Path '.\skills\new-project-grill' -Destination $grillDestination
```

Claude Code 將目的地改為：

```powershell
$grillDestination = Join-Path $HOME '.claude\skills'
New-Item -ItemType Directory -Force -Path $grillDestination | Out-Null
Copy-Item -Recurse -Path '.\skills\new-project-grill' -Destination $grillDestination
```

更新前確認並移走已安裝的同名副本，再複製整個資料夾。WSL 依 Linux 步驟使用 WSL 的家目錄，不假定 Windows HOME 與 WSL HOME 相同。

## 呼叫與題目介面

重新開一個對話並確認技能可發現。Codex 用 `$new-project-grill`；Claude Code 用 `/new-project-grill`。可搭配：

> 我想做一個整理檔案的小工具。先幫我查現有做法與釐清需求，每題保留「我不知道，幫我選」，這一輪只要計畫。

原生提問工具可用且該模式允許時使用，例如 Codex 的 request_user_input、可用的非同步提問或 Claude Code 的 AskUserQuestion。遵守實際介面題數、選項限制及非同步等待方式；工具不可用時用每批 1–3 題的文字選項。不要為了使用某工具自行變更宿主模式。問題最後保留代選，自由補充由介面提供或文字回答。

使用者說只要計畫就不執行；宿主 Plan Mode 不因「幫我選」或「開始做」解除。換對話先讀專案文件。持續使用中不需要每次重新安裝。

## 驗證與移除

先確認新對話可載入完整 Skill，回答會依目標提問且保留代選；單看檔案存在不能證明可發現。未實測的宿主明列限制。

移除時只移走自己安裝的 `new-project-grill` 子資料夾，不刪整個 skills 目錄；不改任何工具設定、其他 Skill 或記憶。專案位置安裝則將完整套件放入相對應的 `.agents/skills/` 或 `.claude/skills/`，依專案原有版本控制規則管理。
