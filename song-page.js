// song-page.js — interatividade da página de música
(function () {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, WORKER_URL } = window.APP_CONFIG;
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const songId = window.__SONG_ID__;
  const artistId = window.__ARTIST_ID__;
  const categoryId = window.__CATEGORY_ID__;

  // ---- Sessão simples (sem dados pessoais) para debounce ----
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
    // Só evita recontagem repetida na mesma hora
    return Date.now() - Number(last) < 60 * 60 * 1000;
  }

  function markCounted(type) {
    localStorage.setItem(`ms_${type}_${songId}`, String(Date.now()));
  }

  async function registerEvent(type) {
    if (alreadyCounted(type)) return;
    markCounted(type);
    try {
      const res = await fetch(`${WORKER_URL}/api/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          song_id: songId,
          event_type: type,
          session_hash: getSessionHash(),
        }),
      });
      const data = await res.json();
      if (type === "view" && data.views != null) {
        document.getElementById("views-count").textContent = `👁 ${data.views}`;
      }
      if (type === "download" && data.downloads != null) {
        document.getElementById("downloads-count").textContent = `⬇ ${data.downloads}`;
      }
    } catch (e) {
      console.warn("Não foi possível registar evento:", e);
    }
  }

  // Regista view ao carregar a página
  registerEvent("view");

  // Player
  const audio = document.getElementById("player");
  const playBtn = document.getElementById("play-btn");
  playBtn.addEventListener("click", () => {
    if (audio.paused) {
      audio.play();
      playBtn.textContent = "⏸ Pausar";
    } else {
      audio.pause();
      playBtn.textContent = "▶ Ouvir";
    }
  });
  audio.addEventListener("ended", () => {
    playBtn.textContent = "▶ Ouvir";
  });

  // Download
  const downloadBtn = document.getElementById("download-btn");
  downloadBtn.addEventListener("click", () => registerEvent("download"));

  // Músicas relacionadas (mesmo artista ou mesma categoria)
  async function loadRelated() {
    const grid = document.getElementById("related-grid");
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
