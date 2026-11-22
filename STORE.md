# 掲載用の下書き

公開用の文面です。各見出しの本文だけを、GitHub または Chrome ウェブストアの入力欄へコピーしてください。このファイル自体はストアの ZIP に入れません。

## GitHub の description

アクティブなタブを、左端に移動して整理します。その他、同じURLのタブを開かないようにしたり、使っていないタブを自動で閉じることができます。
Moves the active tab to the left. You can also avoid reopening the same URL and automatically close unused tabs.

## ストアの短い説明

132 文字以内のため、言語ごとにどちらか一方を入れます。パッケージの `_locales` と同じ文です。

日本語（70 文字）

アクティブなタブを、左端に移動して整理します。その他、同じURLのタブを開かないようにしたり、使っていないタブを自動で閉じることができます。

English（112 文字）

Moves the active tab to the left. You can also avoid reopening the same URL and automatically close unused tabs.

## ストアの詳しい説明

アクティブなタブを、左端に移動して整理します。その他、同じURLのタブを開かないようにしたり、使っていないタブを自動で閉じることができます。

Moves the active tab to the left. You can also avoid reopening the same URL and automatically close unused tabs.

Tabs Stay Left は、今見ているタブをウィンドウの左へまとめる Chrome 拡張機能です。

オンのあいだは、新しく開いたタブが最初から左端（固定タブのすぐ右）に出ます。設定した秒数見続けたタブも、同じ位置へ移ります。秒数を 0 にすると、切り替えた瞬間に移ります。

アドレスバーやブックマークで開いた URL が既にタブにあれば、新しいタブを作らずそのタブへ移ります。この動作は設定からオフにできます。

ウィンドウ内のタブが最大件数を超えると、新しく開いたタブは残し、一番右のタブを閉じます。固定タブは閉じません。初期値は 20 件です。

ツールバーのアイコンをクリックすると、オンとオフが切り替わります。オフのときはアイコンがグレーになり、タブの移動も、同じ URL のタブを開く動作も止まります。待機時間と最大タブ数は、拡張機能のオプションから変更します。初期状態はオン、待機時間 3 秒、最大タブ数 20 件です。

設定はお使いの Chrome に保存されます。閲覧したページの URL を開発者が受け取ることはありません。

Tabs Stay Left is a Chrome extension that keeps the tab you are viewing on the left side of the window.

While it is on, a newly opened tab appears at the far left, immediately to the right of pinned tabs. A tab you keep viewing for the number of seconds you set also moves there. Set the time to 0 to move it as soon as you switch to it.

If you open a URL from the address bar or a bookmark and that URL is already open in a tab, the extension switches to that tab instead of creating a new one. You can turn this off in the settings.

When the number of tabs in a window exceeds the maximum, the newly opened tab stays and the rightmost tab is closed. Pinned tabs are not closed. The default maximum is 20.

Click the toolbar icon to turn the extension on or off. While it is off, the icon is gray, and both moving tabs and reusing the same URL stop. Change the wait time and the maximum number of tabs in the extension options. The defaults are on, a wait of 3 seconds, and a maximum of 20 tabs.

Settings are saved in your Chrome. The developer does not receive the URLs of pages you visit.

## 単一の目的

タブを左へまとめ、同じ URL の重複を避け、ウィンドウごとのタブ数を上限内に保つ。

## 権限の理由

tabs: タブを左へ移し、既存のタブを前面にし、上限を超えた右端のタブを閉じるため。

storage: オン／オフ、待機秒数、最大タブ数、同じ URL を開くかどうかの設定と、左へ移す予定の一時データを保存するため。

alarms: タブを見続けた秒数を数えてから左へ移すため。

webNavigation: アドレスバーやブックマークで開いた URL が、既にあるタブと同じかを判断するため。

## データの取り扱い（ダッシュボード用）

収集するユーザーデータ: いいえ。

補足として審査メモに書く場合: 設定は chrome.storage.sync、移動予定のタブ ID と時刻は chrome.storage.session に保存する。ページの URL は同じタブを開く比較だけに使い、保存も送信もしない。
