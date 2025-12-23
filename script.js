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

// --- 2. データの読み込み ---
async function loadPlaylistFromDB() {
    const transaction = db.transaction(["songs"], "readonly");
    const store = transaction.objectStore("songs");
    const request = store.getAll();
    request.onsuccess = () => {
        // メモリ管理のため、古いURLを解放
        playlist.forEach(track => {
            if (track.url) URL.revokeObjectURL(track.url);
        });
        
        playlist = request.result.map(song => ({
            id: song.id,
            name: song.name,
            url: URL.createObjectURL(song.data) // 保存データを再生可能なURLに変換
        }));
        renderPlaylist();
    };
}

// --- 3. 変換と保存 ---
document.getElementById('videoInput').onchange = (e) => {
    document.getElementById('convertBtn').disabled = !e.target.files[0];
};

document.getElementById('convertBtn').onclick = async () => {
    const file = document.getElementById('videoInput').files[0];
    if (!file) return;

    document.getElementById('status').textContent = "変換中...（スマホは時間がかかります）";
    document.getElementById('convertBtn').disabled = true;

    if (!ffmpeg.isLoaded()) await ffmpeg.load();
    ffmpeg.FS('writeFile', 'in.mp4', await fetchFile(file));
    await ffmpeg.run('-i', 'in.mp4', 'out.mp3');
    const data = ffmpeg.FS('readFile', 'out.mp3');
    const mp3Blob = new Blob([data.buffer], { type: 'audio/mp3' });

    // データベースに保存
    const transaction = db.transaction(["songs"], "readwrite");
    const store = transaction.objectStore("songs");
    const songName = file.name.replace(/\.[^/.]+$/, ""); // 初期値から.mp4を消す
    store.add({ name: songName, data: mp3Blob });

    transaction.oncomplete = () => {
        loadPlaylistFromDB();
        document.getElementById('status').textContent = "保存完了！";
        document.getElementById('convertBtn').disabled = false;
    };
};

// --- 4. プレイリスト表示 ---
function renderPlaylist() {
    const list = document.getElementById('playlist');
    list.innerHTML = '';
    playlist.forEach((track, i) => {
        const item = document.createElement('div');
        item.className = `track-item ${i === currentIndex ? 'active' : ''}`;
        item.innerHTML = `
            <div class="track-info" onclick="playTrack(${i})">
                <span class="track-name">${track.name}</span>
            </div>
            <div class="track-actions">
                <button class="edit-btn" onclick="renameTrack(${track.id})">名変</button>
                <button class="delete-btn" onclick="deleteTrack(${track.id})">削除</button>
            </div>
        `;
        list.appendChild(item);
    });
}

// --- 5. 各種アクション (再生・名変・削除) ---
function playTrack(index) {
    if (index < 0 || index >= playlist.length) return;
    currentIndex = index;
    audio.src = playlist[index].url;
    audio.play();
    document.getElementById('nowPlaying').textContent = `再生中: ${playlist[index].name}`;
    
    // スマホのロック画面連携
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: playlist[index].name });
    }
    renderPlaylist();
}

function renameTrack(id) {
    const newName = prompt("新しい曲名を入力してください");
    if (!newName) return;
    const transaction = db.transaction(["songs"], "readwrite");
    const store = transaction.objectStore("songs");
    const req = store.get(id);
    req.onsuccess = () => {
        const data = req.result;
        data.name = newName;
        store.put(data); // 変更後の名前を保存 [cite: 2025-12-22]
    };
    transaction.oncomplete = () => loadPlaylistFromDB();
}

function deleteTrack(id) {
    if (!confirm("ライブラリから削除しますか？")) return;
    const transaction = db.transaction(["songs"], "readwrite");
    const store = transaction.objectStore("songs");
    store.delete(id); // データを削除 [cite: 2025-12-22]
    transaction.oncomplete = () => {
        if (currentIndex !== -1 && playlist[currentIndex]?.id === id) {
            audio.pause();
            document.getElementById('nowPlaying').textContent = "再生中: なし";
        }
        loadPlaylistFromDB();
    };
}

// --- 6. プレーヤー制御 (連続再生・ボタン) ---
audio.onended = () => {
    let next = isShuffle ? Math.floor(Math.random() * playlist.length) : (currentIndex + 1) % playlist.length;
    playTrack(next);
};

document.getElementById('nextBtn').onclick = () => audio.onended();

document.getElementById('prevBtn').onclick = () => {
    let prev = (currentIndex - 1 + playlist.length) % playlist.length;
    playTrack(prev);
};

document.getElementById('shuffleBtn').onclick = (e) => {
    isShuffle = !isShuffle;
    // シンプルな文字表示に変更
    e.target.textContent = `シャッフル ${isShuffle ? 'ON' : 'OFF'}`;
};