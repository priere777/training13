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
    loadPlaylistFromDB();
};

// --- 2. データの読み込み ---
async function loadPlaylistFromDB() {
    const transaction = db.transaction(["songs"], "readonly");
    const store = transaction.objectStore("songs");
    const request = store.getAll();
    request.onsuccess = () => {
        playlist.forEach(track => { if (track.url) URL.revokeObjectURL(track.url); });
        playlist = request.result.map(song => ({
            id: song.id,
            name: song.name,
            url: URL.createObjectURL(song.data)
        }));
        renderPlaylist();
    };
}

// --- 3. 【爆速】音の抜き出しと保存 ---
document.getElementById('videoInput').onchange = (e) => {
    document.getElementById('convertBtn').disabled = !e.target.files[0];
};

document.getElementById('convertBtn').onclick = async () => {
    const file = document.getElementById('videoInput').files[0];
    if (!file) return;

    document.getElementById('status').textContent = "音を抽出中...（一瞬で終わります）";
    document.getElementById('convertBtn').disabled = true;

    if (!ffmpeg.isLoaded()) await ffmpeg.load();
    ffmpeg.FS('writeFile', 'in.mp4', await fetchFile(file));
    
    // ★ここがポイント：'-c:a copy' で変換せずに音だけコピーする（爆速）
    // 出力は .m4a になります
    await ffmpeg.run('-i', 'in.mp4', '-vn', '-acodec', 'copy', 'out.m4a');
    
    const data = ffmpeg.FS('readFile', 'out.m4a');
    const audioBlob = new Blob([data.buffer], { type: 'audio/mp4' });

    const transaction = db.transaction(["songs"], "readwrite");
    const store = transaction.objectStore("songs");
    const songName = file.name.replace(/\.[^/.]+$/, ""); 
    store.add({ name: songName, data: audioBlob });

    transaction.oncomplete = () => {
        loadPlaylistFromDB();
        document.getElementById('status').textContent = "ライブラリに追加しました！";
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

// --- 5. アクション ---
function playTrack(index) {
    if (index < 0 || index >= playlist.length) return;
    currentIndex = index;
    audio.src = playlist[index].url;
    audio.play();
    document.getElementById('nowPlaying').textContent = `再生中: ${playlist[index].name}`;
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
        store.put(data);
    };
    transaction.oncomplete = () => loadPlaylistFromDB();
}

function deleteTrack(id) {
    if (!confirm("削除しますか？")) return;
    const transaction = db.transaction(["songs"], "readwrite");
    const store = transaction.objectStore("songs");
    store.delete(id);
    transaction.oncomplete = () => {
        if (currentIndex !== -1 && playlist[currentIndex]?.id === id) {
            audio.pause();
            document.getElementById('nowPlaying').textContent = "再生中: なし";
        }
        loadPlaylistFromDB();
    };
}

// --- 6. 制御 ---
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
    e.target.textContent = `シャッフル ${isShuffle ? 'ON' : 'OFF'}`;
};