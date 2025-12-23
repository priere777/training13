const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: true });

const videoInput = document.getElementById('videoInput');
const convertBtn = document.getElementById('convertBtn');
const status = document.getElementById('status');
const mainAudio = document.getElementById('mainAudio');
const playlistElement = document.getElementById('playlist');
const nowPlayingText = document.getElementById('nowPlaying');
const shuffleBtn = document.getElementById('shuffleBtn');

let playlist = []; // 曲のリスト
let currentIndex = -1; // 今何曲目か
let isShuffle = false; // シャッフルモード

// 1. ファイル選択
videoInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
        convertBtn.disabled = false;
        status.textContent = "変換の準備ができました！";
    }
});

// 2. 変換とリスト追加
convertBtn.addEventListener('click', async () => {
    const file = videoInput.files[0];
    if (!file) return;

    status.textContent = "MP3を作成中...";
    convertBtn.disabled = true;

    if (!ffmpeg.isLoaded()) await ffmpeg.load();
    ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(file));
    await ffmpeg.run('-i', 'input.mp4', 'output.mp3');
    const data = ffmpeg.FS('readFile', 'output.mp3');

    // MP3のURLを作成
    const mp3Url = URL.createObjectURL(new Blob([data.buffer], { type: 'audio/mp3' }));
    
    // リストに曲情報を追加
    const track = {
        name: file.name.replace('.mp4', ''),
        url: mp3Url
    };
    playlist.push(track);
    
    renderPlaylist(); // 画面を更新
    status.textContent = "リストに追加しました！";
    convertBtn.disabled = false;

    // もし何も再生していなければ、今追加した曲を再生
    if (currentIndex === -1) {
        playTrack(playlist.length - 1);
    }
});

// 3. プレイリストを画面に表示
function renderPlaylist() {
    playlistElement.innerHTML = '';
    playlist.forEach((track, index) => {
        const div = document.createElement('div');
        div.className = `track-item ${index === currentIndex ? 'active' : ''}`;
        div.innerHTML = `<span>${index + 1}. ${track.name}</span>`;
        div.onclick = () => playTrack(index);
        playlistElement.appendChild(div);
    });
}

// 4. 指定した番号の曲を再生
function playTrack(index) {
    if (index < 0 || index >= playlist.length) return;
    currentIndex = index;
    mainAudio.src = playlist[index].url;
    mainAudio.play();
    nowPlayingText.textContent = `再生中: ${playlist[index].name}`;
    renderPlaylist();
}

// 5. 連続再生（曲が終わったら次へ）
mainAudio.onended = () => {
    playNext();
};

function playNext() {
    if (isShuffle) {
        let nextIndex = Math.floor(Math.random() * playlist.length);
        playTrack(nextIndex);
    } else {
        let nextIndex = (currentIndex + 1) % playlist.length;
        playTrack(nextIndex);
    }
}

// 6. 各種ボタンの動作
document.getElementById('nextBtn').onclick = () => playNext();
document.getElementById('prevBtn').onclick = () => {
    let prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playTrack(prevIndex);
};
shuffleBtn.onclick = () => {
    isShuffle = !isShuffle;
    shuffleBtn.textContent = `シャッフル: ${isShuffle ? 'ON' : 'OFF'}`;
    shuffleBtn.style.background = isShuffle ? '#1db954' : '#555';
};