// artistas.js — lista de artistas com contagem de músicas + pesquisa
(function () {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const gridEl = document.getElementById("artist-grid");
  const searchInput = document.getElementById("search-input");
  let allArtists = [];

  function initials(name) {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
  }

  function render(list) {
    if (!list.length) {
      gridEl.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">🎤</div>Nenhum artista encontrado.</div>`;
      return;
    }
    gridEl.innerHTML = list
      .map(
        (a) => `
        <a class="artist-card" href="musicas/?artist=${a.id}">
          <div class="avatar">${initials(a.name)}</div>
          <div class="name notranslate" translate="no">${a.name}</div>
          <div class="count">${a.songCount} música${a.songCount === 1 ? "" : "s"}</div>
        </a>`
      )
      .join("");
  }

  async function load() {
    const { data: artists, error } = await supabase
      .from("artists")
      .select("id, name")
      .order("name");

    if (error || !artists) {
      gridEl.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">⚠️</div>Erro ao carregar artistas.</div>`;
      return;
    }

    const { data: songs } = await supabase
      .from("songs")
      .select("artist_id")
      .eq("published", true);

    const counts = {};
    (songs || []).forEach((s) => {
      counts[s.artist_id] = (counts[s.artist_id] || 0) + 1;
    });

    allArtists = artists.map((a) => ({ ...a, songCount: counts[a.id] || 0 }));
    render(allArtists);
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const term = searchInput.value.trim().toLowerCase();
      if (!term) { render(allArtists); return; }
      render(allArtists.filter((a) => a.name.toLowerCase().includes(term)));
    });
  }

  load();
})();
