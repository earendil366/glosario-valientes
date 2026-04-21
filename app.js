let db;

const request = indexedDB.open("ChordDB", 1);

request.onupgradeneeded = (e) => {
  db = e.target.result;

  // canciones
  const songs = db.createObjectStore("songs", {
    keyPath: "id",
    autoIncrement: true
  });

  songs.createIndex("title", "title", { unique: false });

  // setlists
  db.createObjectStore("setlists", {
    keyPath: "id",
    autoIncrement: true
  });

  // relación
  db.createObjectStore("setlistSongs", {
    keyPath: "id",
    autoIncrement: true
  });
};

request.onsuccess = (e) => {
  db = e.target.result;
  console.log("Base de datos lista 🚀");
};

request.onerror = () => {
  console.error("Error al crear DB");
};
function saveSong(title, content) {
  const tx = db.transaction("songs", "readwrite");
  const store = tx.objectStore("songs");

  store.add({ title, content });
}
function getSongs(callback) {
  const tx = db.transaction("songs", "readonly");
  const store = tx.objectStore("songs");

  const songs = [];

  store.openCursor().onsuccess = (e) => {
    const cursor = e.target.result;

    if (cursor) {
      songs.push(cursor.value);
      cursor.continue();
    } else {
      callback(songs);
    }
  };
}

// 🎼 ChordPro
const parser = new chordsheetjs.ChordProParser();
const formatter = new chordsheetjs.HtmlDivFormatter();
let currentSong = null;

// UI
const viewer = document.getElementById("viewer");
const songsDiv = document.getElementById("songs");
const setlistsDiv = document.getElementById("setlists");
const fileInput = document.getElementById("fileInput");

// DB
let db;

const request = indexedDB.open("ChordDB", 2);

request.onupgradeneeded = e => {
  db = e.target.result;

  if (!db.objectStoreNames.contains("songs")) {
    db.createObjectStore("songs", { keyPath: "id", autoIncrement: true });
  }

  if (!db.objectStoreNames.contains("setlists")) {
    db.createObjectStore("setlists", { keyPath: "id", autoIncrement: true });
  }

  if (!db.objectStoreNames.contains("setlistSongs")) {
    db.createObjectStore("setlistSongs", { keyPath: "id", autoIncrement: true });
  }
};

request.onsuccess = e => {
  db = e.target.result;
  loadSongs();
  loadSetlists();
};

// 🎼 Render
function render(content) {
  currentSong = parser.parse(content);
  viewer.innerHTML = formatter.format(currentSong);
}

// ➕ Guardar canción
function saveSong(title, content) {
  const tx = db.transaction("songs", "readwrite");
  tx.objectStore("songs").add({ title, content });
}

// 📚 Cargar canciones
function loadSongs() {
  songsDiv.innerHTML = "";

  const tx = db.transaction("songs", "readonly");

  tx.objectStore("songs").openCursor().onsuccess = e => {
    const cursor = e.target.result;
    if (cursor) {
      const div = document.createElement("div");
      div.className = "item";
      div.textContent = cursor.value.title;

      div.draggable = true;
      div.ondragstart = ev => {
        ev.dataTransfer.setData("songId", cursor.value.id);
      };

      div.onclick = () => render(cursor.value.content);

      songsDiv.appendChild(div);
      cursor.continue();
    }
  };
}

// 🗂 Guardar setlist
function saveSetlist(name) {
  const tx = db.transaction("setlists", "readwrite");
  tx.objectStore("setlists").add({ name });
}

// 📂 Cargar setlists
function loadSetlists() {
  setlistsDiv.innerHTML = "";

  const tx = db.transaction("setlists", "readonly");

  tx.objectStore("setlists").openCursor().onsuccess = e => {
    const cursor = e.target.result;
    if (cursor) {
      createSetlistUI(cursor.value);
      cursor.continue();
    }
  };
}

// 🧩 Crear UI de setlist
function createSetlistUI(setlist) {
  const container = document.createElement("div");
  container.className = "setlist";

  const title = document.createElement("div");
  title.className = "setlist-title";
  title.textContent = "📁 " + setlist.name;

  const dropzone = document.createElement("div");
  dropzone.className = "dropzone";

  // Drag over
  dropzone.ondragover = e => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  };

  dropzone.ondragleave = () => {
    dropzone.classList.remove("dragover");
  };

  // Drop
  dropzone.ondrop = e => {
    e.preventDefault();
    dropzone.classList.remove("dragover");

    const songId = Number(e.dataTransfer.getData("songId"));
    addSongToSetlist(setlist.id, songId);
    renderSetlistSongs(dropzone, setlist.id);
  };

  container.appendChild(title);
  container.appendChild(dropzone);
  setlistsDiv.appendChild(container);

  renderSetlistSongs(dropzone, setlist.id);
}

// ➕ agregar canción a setlist
function addSongToSetlist(setlistId, songId) {
  const tx = db.transaction("setlistSongs", "readwrite");
  tx.objectStore("setlistSongs").add({ setlistId, songId });
}

// 🎧 mostrar canciones dentro del setlist
function renderSetlistSongs(container, setlistId) {
  container.innerHTML = "";

  const tx = db.transaction(["setlistSongs", "songs"], "readonly");
  const relStore = tx.objectStore("setlistSongs");

  relStore.openCursor().onsuccess = e => {
    const cursor = e.target.result;
    if (cursor) {
      if (cursor.value.setlistId === setlistId) {
        const songTx = db.transaction("songs", "readonly");
        const songStore = songTx.objectStore("songs");

        songStore.get(cursor.value.songId).onsuccess = ev => {
          const song = ev.target.result;

          const div = document.createElement("div");
          div.className = "item";
          div.textContent = song.title;
          div.onclick = () => render(song.content);

          container.appendChild(div);
        };
      }
      cursor.continue();
    }
  };
}

// 📂 Importar archivos
document.getElementById("importBtn").onclick = () => fileInput.click();

fileInput.onchange = async e => {
  for (let file of e.target.files) {
    const text = await file.text();
    saveSong(file.name, text);
  }
  loadSongs();
};

// 🗂 Crear setlist
document.getElementById("newSetlist").onclick = () => {
  const name = prompt("Nombre del setlist:");
  if (!name) return;
  saveSetlist(name);
  loadSetlists();
};

// 🔎 Buscar
document.getElementById("search").oninput = e => {
  const term = e.target.value.toLowerCase();

  songsDiv.innerHTML = "";

  const tx = db.transaction("songs", "readonly");

  tx.objectStore("songs").openCursor().onsuccess = ev => {
    const cursor = ev.target.result;
    if (cursor) {
      if (cursor.value.title.toLowerCase().includes(term)) {
        const div = document.createElement("div");
        div.className = "item";
        div.textContent = cursor.value.title;
        div.onclick = () => render(cursor.value.content);
        songsDiv.appendChild(div);
      }
      cursor.continue();
    }
  };
};

// 🎹 Transposición
document.getElementById("transposeUp").onclick = () => {
  currentSong = currentSong.transpose(1);
  viewer.innerHTML = formatter.format(currentSong);
};

document.getElementById("transposeDown").onclick = () => {
  currentSong = currentSong.transpose(-1);
  viewer.innerHTML = formatter.format(currentSong);
};

// 🔍 Tamaño letra
document.getElementById("fontSize").oninput = e => {
  viewer.style.fontSize = e.target.value + "px";
};

// ⏱ Scroll
let scrolling = false;
let speed = 1;

document.getElementById("speed").oninput = e => speed = e.target.value;

document.getElementById("playScroll").onclick = () => {
  scrolling = true;
  scrollLoop();
};

document.getElementById("stopScroll").onclick = () => scrolling = false;

function scrollLoop() {
  if (!scrolling) return;
  viewer.scrollBy(0, speed);
  requestAnimationFrame(scrollLoop);
}