// main.js — homepage: lista músicas recentes com paginação incremental
(function () {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const PAGE_SIZE = 15;
  let page = 0;
  let finished = false;

  const listEl = document.getElementById("song-list");
  const loadMoreBtn = document.getElementById("load-more-btn");

  function songUrl(song) {
    const artistSlug = song.artists ? song.artists.slug : "artista";
    return `/musica/${artistSlug}/${song.slug}/`;
  }

  function renderSongs(songs, append) {
    const html = songs
      .map(
        (s) => `
        <a class="song-card-list" href="${songUrl(s)}">
          <img src="${s.cover_url || ""}" alt="${s.title}" loading="lazy" width="56" height="56">
          <div class="song-card-info">
            <div class="t">${s.title}</div>
            <div class="a">${s.artists ? s.artists.name : ""}</div>
          </div>
        </a>`
      )
      .join("");

    if (append) {
      listEl.insertAdjacentHTML("beforeend", html);
    } else {
      listEl.innerHTML = html || "<p style='color:#9a9aa5;'>Ainda não há músicas publicadas.</p>";
    }
  }

  async function loadPage() {
    if (finished) return;
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("songs")
      .select("id, title, slug, cover_url, created_at, artists(slug, name)")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      listEl.innerHTML = "<p style='color:#9a9aa5;'>Erro ao carregar músicas.</p>";
      console.error(error);
      return;
    }

    renderSongs(data, page > 0);

    if (data.length < PAGE_SIZE) {
      finished = true;
      loadMoreBtn.style.display = "none";
    } else {
      loadMoreBtn.style.display = "inline-block";
    }
    page++;
  }

  loadMoreBtn.addEventListener("click", loadPage);
  loadPage();
})();
