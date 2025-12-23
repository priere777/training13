let db;
let playlist = [];
let currentIndex = -1;
let isShuffle = false;

const audio = document.getElementById('mainAudio');

// 1. データベース準備
const request = indexedDB.open("MusicData", 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    db.createObjectStore("songs", { keyPath: "id", autoIncrement: true });
};
request.onsuccess = (e) => {
    db = e.target.result;
    loadPlaylistFromDB();
};

// 2. 読み込み
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

// 3. 保存
document.getElementById('videoInput').onchange = (e) => {
    document.getElementById('convertBtn').disabled = !e.target.files[0];
};

document.getElementById('convertBtn').onclick = () => {
    const file = document.getElementById('videoInput').files[0];
    if (!file) return;
    const status = document.getElementById('status');
    status.textContent = "追加中...";
    document.getElementById('convertBtn').disabled = true;
    const transaction = db.transaction(["songs"], "readwrite");
    const store = transaction.objectStore("songs");
    const songName = file.name.replace(/\.[^/.]+$/, ""); 
    const addRequest = store.add({ name: songName, data: file });
    addRequest.onsuccess = () => {
        status.textContent = "完了！";
        document.getElementById('convertBtn').disabled = false;
        loadPlaylistFromDB();
    };
};

// 4. プレイリスト表示
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
            <div class="track-actions" style="display:flex; gap:10px;">
                <button class="delete-btn" style="color:#1DB954; font-size:0.7rem;" onclick="renameTrack(${track.id})">名変</button>
                <button class="delete-btn" onclick="deleteTrack(${track.id})">削除</button>
            </div>
        `;
        list.appendChild(item);
    });
}

// 5. 再生処理
function playTrack(index) {
    if (index < 0 || index >= playlist.length) return;
    currentIndex = index;
    audio.src = playlist[index].url;
    audio.play().catch(e => console.error(e));
    const nowPlaying = document.getElementById('nowPlaying');
    nowPlaying.textContent = `再生中: ${playlist[index].name}`;
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: playlist[index].name });
    }
    renderPlaylist();
}

// 6. 次の曲へ（シャッフル対応）
function nextTrack() {
    if (playlist.length === 0) return;
    let nextIndex;
    if (isShuffle && playlist.length > 1) {
        // 今の曲以外のインデックスからランダムに選ぶ
        do {
            nextIndex = Math.floor(Math.random() * playlist.length);
        } while (nextIndex === currentIndex);
    } else {
        // 通常の順次再生
        nextIndex = (currentIndex + 1) % playlist.length;
    }
    playTrack(nextIndex);
}

// 7. 操作制御
audio.onended = () => nextTrack();
document.getElementById('nextBtn').onclick = () => nextTrack();
document.getElementById('prevBtn').onclick = () => {
    let prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    playTrack(prevIndex);
};

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
    if (!confirm("ライブラリから削除しますか？")) return;
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

// シャッフルボタンのON/OFF
document.getElementById('shuffleBtn').onclick = (e) => {
    isShuffle = !isShuffle;
    e.target.textContent = isShuffle ? 'SHUFFLE ON' : 'SHUFFLE OFF';
    e.target.style.color = isShuffle ? '#1DB954' : 'white';
    e.target.style.borderColor = isShuffle ? '#1DB954' : '#444';
};
