const { createFFmpeg, fetchFile } = FFmpeg;
// log: true にすると、変換の進み具合がコンソールで見れるようになります
const ffmpeg = createFFmpeg({ log: true });

const videoInput = document.getElementById('videoInput');
const convertBtn = document.getElementById('convertBtn');
const status = document.getElementById('status');
const playerContainer = document.getElementById('playerContainer');

let selectedFile = null;

// 1. ファイルが選ばれた時の処理
videoInput.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
    if (selectedFile) {
        convertBtn.disabled = false;
        status.textContent = "準備完了！ボタンを押してね";
    }
});

// 2. 変換ボタンが押された時のメイン処理
convertBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    try {
        status.textContent = "変換エンジンを起動中...";
        convertBtn.disabled = true;

        // ffmpegが読み込まれていなければロードする
        if (!ffmpeg.isLoaded()) {
            await ffmpeg.load();
        }

        status.textContent = "MP3に変換しています...（数秒かかります）";

        // 動画ファイルをffmpegの仮想メモリに書き込む
        ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(selectedFile));

        // 変換コマンドを実行： input.mp4 を output.mp3 に
        await ffmpeg.run('-i', 'input.mp4', 'output.mp3');

        // 完成したMP3データを読み出す
        const data = ffmpeg.FS('readFile', 'output.mp3');

        // データをブラウザで使えるURLに変換
        const mp3Url = URL.createObjectURL(new Blob([data.buffer], { type: 'audio/mp3' }));

        // 画面にプレイヤーとダウンロードリンクを表示
        playerContainer.innerHTML = `
            <hr>
            <p>✅ 変換成功！</p>
            <audio src="${mp3Url}" controls></audio>
            <br>
            <a href="${mp3Url}" download="${selectedFile.name.replace('.mp4', '')}.mp3" class="download-link">
               💾 MP3を保存する
            </a>
        `;
        status.textContent = "変換が終わりました！";

    } catch (error) {
        console.error(error);
        status.textContent = "エラーが発生しました。ブラウザのセキュリティ制限かもしれません。";
        convertBtn.disabled = false;
    }
});