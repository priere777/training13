const { createFFmpeg, fetchFile } = FFmpeg;
const ffmpeg = createFFmpeg({ log: false });

let db;
let playlist = [];
let currentIndex = -1;
let isShuffle = false;

const audio = document.getElementById('mainAudio');

// --- 1. データベース(IndexedDB)の準備 ---
const request = indexedDB.open("MusicData", 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    db.createObjectStore("songs", { keyPath: "id", autoIncrement: true });
};
request.onsuccess = (e) => {
    db = e.target.result;
    loadPlaylistFromDB(); // 起動時に保存された曲を読み込む
};

// --- 2. データベースから曲を読み込む ---
async function loadPlaylistFromDB() {
    const transaction = db.transaction(["songs"], "readonly");
    const store = transaction.objectStore("songs");
    const request = store.getAll();
    request.onsuccess = () => {
        playlist = request.result.map(song => ({
            id: song.id,
            name: song.name,
            url: URL.createObjectURL(song.data) // 保存されたデータを再生用URLに変換
        }));
        renderPlaylist();
    };
}

// --- 3. 変換と保存 ---
document.getElementById('convertBtn').onclick = async () => {
    const file = document.getElementById('videoInput').files[0];
    if (!file) return;

    document.getElementById('status').textContent = "スマホで変換中...（少し時間がかかります）";
    if (!ffmpeg.isLoaded()) await ffmpeg.load();

    ffmpeg.FS('writeFile', 'in.mp4', await fetchFile(file));
    await ffmpeg.run('-i', 'in.mp4', 'out.mp3');
    const data = ffmpeg.FS('readFile', 'out.mp3');
    const mp3Blob = new Blob([data.buffer], { type: 'audio/mp3' });

    // データベースに保存
    const transaction = db.transaction(["songs"], "readwrite");
    const store = transaction.objectStore("songs");
    const songName = file.name.replace(/\.[^/.]+$/, ""); // .mp4を消す
    store.add({ name: songName, data: mp3Blob });

    transaction.oncomplete = () => {
        loadPlaylistFromDB(); // 保存が終わったらリストを更新
        document.getElementById('status').textContent = "保存完了！";
    };
};

// --- 4. 再生機能 & スマホのロック画面連携 ---
function playTrack(index) {
    if (index < 0 || index >= playlist.length) return;
    currentIndex = index;
    const track = playlist[index];
    audio.src = track.url;
    audio.play();

    // ロック画面に情報を出す（Media Session API）
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.name,
            artist: "My Music Player"
        });
    }
    renderPlaylist();
}

function renderPlaylist() {
    const list = document.getElementById('playlist');
    list.innerHTML = '';
    playlist.forEach((track, i) => {
        const item = document.createElement('div');
        item.className = `track-item ${i === currentIndex ? 'active' : ''}`;
        item.innerHTML = `<div>${track.name}</div>`;
        item.onclick = () => playTrack(i);
        list.appendChild(item);
    });
}

// 自動再生
audio.onended = () => {
    let next = isShuffle ? Math.floor(Math.random() * playlist.length) : (currentIndex + 1) % playlist.length;
    playTrack(next);
};

// ボタン操作
document.getElementById('nextBtn').onclick = () => audio.onended();
document.getElementById('shuffleBtn').onclick = (e) => {
    isShuffle = !isShuffle;
    e.target.textContent = `シャッフル: ${isShuffle ? 'ON' : 'OFF'}`;
};