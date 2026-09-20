// song-page.js — interatividade da página de música
(function () {
  const songId = window.__SONG_ID__;
  const artistId = window.__ARTIST_ID__;
  const categoryId = window.__CATEGORY_ID__;

  /* ================================================================
   * 1) PLAYER E DOWNLOAD — configurados primeiro, sem depender do
   *    Supabase, para funcionarem sempre mesmo que a rede falhe.
   * ================================================================ */
  const audio = document.getElementById("player");
  const playBtn = document.getElementById("play-btn");
  const downloadBtn = document.getElementById("download-btn");

  playBtn.addEventListener("click", () => {
    if (audio.paused) {
      audio.play().catch((err) => console.error("Erro ao reproduzir:", err));
      playBtn.textContent = "⏸ Pausar";
    } else {
      audio.pause();
      playBtn.textContent = "▶ Ouvir";
    }
  });
  audio.addEventListener("ended", () => {
    playBtn.textContent = "▶ Ouvir";
  });
  audio.addEventListener("error", () => {
    console.error("Não foi possível carregar o áudio.");
  });

  function guessFileName(url) {
    const titleEl = document.querySelector(".song-title");
    const title = titleEl ? titleEl.textContent.trim() : "musica";
    const ext = (url.split(".").pop() || "mp3").split("?")[0];
    return `${title}.${ext}`.replace(/[\\/:*?"<>|]/g, "");
  }

  downloadBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const url = downloadBtn.getAttribute("href");
    const originalText = downloadBtn.textContent;
    downloadBtn.textContent = "A preparar...";

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Falha ao obter o ficheiro");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = guessFileName(url);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
    } catch (err) {
      console.error("Erro no download, a abrir diretamente:", err);
      window.open(url, "_blank");
    } finally {
      downloadBtn.textContent = originalText;
      registerEvent("download");
    }
  });

  /* ================================================================
   * 2) SUPABASE — contagem de views/downloads e músicas relacionadas.
   *    Se isto falhar, não afeta o player nem o download acima.
   * ================================================================ */
  let supabase = null;
  try {
    const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    console.error("Não foi possível ligar ao Supabase:", e);
  }

  function getSessionHash() {
    let hash = localStorage.getItem("ms_session");
    if (!hash) {
      hash = crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now()) + Math.random().toString(16).slice(2);
      localStorage.setItem("ms_session", hash);
    }
    return hash;
  }

  function alreadyCounted(type) {
    const key = `ms_${type}_${songId}`;
    const last = localStorage.getItem(key);
    if (!last) return false;
    return Date.now() - Number(last) < 60 * 60 * 1000;
  }

  function markCounted(type) {
    localStorage.setItem(`ms_${type}_${songId}`, String(Date.now()));
  }

  async function registerEvent(type) {
    if (!supabase || alreadyCounted(type)) return;
    markCounted(type);
    try {
      const { data, error } = await supabase.rpc("register_song_event", {
        p_song_id: songId,
        p_event_type: type,
        p_session_hash: getSessionHash(),
      });
      if (error) throw error;
      if (type === "view" && data && data.views != null) {
        document.getElementById("views-count").textContent = `👁 ${data.views}`;
      }
      if (type === "download" && data && data.downloads != null) {
        document.getElementById("downloads-count").textContent = `⬇ ${data.downloads}`;
      }
    } catch (e) {
      console.warn("Não foi possível registar evento:", e);
    }
  }

  registerEvent("view");

  async function loadRelated() {
    const grid = document.getElementById("related-grid");
    if (!supabase) { grid.innerHTML = "<p>Sem músicas relacionadas disponíveis.</p>"; return; }

    let query = supabase
      .from("songs")
      .select("id, title, slug, cover_url, artists(slug, name)")
      .eq("published", true)
      .neq("id", songId)
      .limit(6);

    if (artistId) {
      query = query.eq("artist_id", artistId);
    } else if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      grid.innerHTML = "<p>Sem músicas relacionadas disponíveis.</p>";
      return;
    }

    grid.innerHTML = data
      .map((s) => {
        const artistSlug = s.artists ? s.artists.slug : "artista";
        const artistName = s.artists ? s.artists.name : "";
        const url = `${location.origin}${location.pathname.split("/musica/")[0]}/musica/${artistSlug}/${s.slug}/`;
        return `
          <a class="related-card" href="${url}">
            <img src="${s.cover_url || ""}" alt="${s.title}" loading="lazy" width="120" height="120">
            <span class="related-title">${s.title}</span>
            <span class="related-artist">${artistName}</span>
          </a>`;
      })
      .join("");
  }

  loadRelated();
})();
