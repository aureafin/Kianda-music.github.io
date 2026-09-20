// main.js — homepage: grid de músicas recentes com paginação incremental
(function () {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const PAGE_SIZE = 12;
  let page = 0;
  let finished = false;

  const listEl = document.getElementById("song-list");
  const loadMoreBtn = document.getElementById("load-more-btn");

  function songUrl(song) {
    const artistSlug = song.artists ? song.artists.slug : "artista";
    return `musica/${artistSlug}/${song.slug}/`;
  }

  function renderSongs(songs, append) {
    const cardsHtml = songs
      .map(
        (s) => `
        <a class="song-card" href="${songUrl(s)}">
          <div class="cover-wrap">
            <img src="${s.cover_url || ""}" alt="${s.title}" loading="lazy">
            <span class="play-badge">▶</span>
          </div>
          <div class="info">
            <div class="t">${s.title}</div>
            <div class="a">${s.artists ? s.artists.name : ""}</div>
          </div>
        </a>`
      )
      .join("");

    if (append) {
      const grid = listEl.querySelector(".song-grid");
      if (grid) {
        grid.insertAdjacentHTML("beforeend", cardsHtml);
        return;
      }
    }

    if (!songs.length && !append) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="icon">🎧</div>
          <div>Ainda não há músicas publicadas.</div>
          <div style="font-size:0.78rem;margin-top:6px;">Volta em breve!</div>
        </div>`;
      return;
    }

    listEl.innerHTML = `<div class="song-grid">${cardsHtml}</div>`;
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
      listEl.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div>Erro ao carregar músicas.</div>`;
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

  // ---- Filtro por categoria (chips) ----
  async function loadCategoryChips() {
    const { data } = await supabase.from("categories").select("id, name, slug").order("name").limit(10);
    if (!data || !data.length) return;
    const row = document.getElementById("chip-row");
    const extra = data
      .map((c) => `<span class="chip" data-cat="${c.id}">${c.name}</span>`)
      .join("");
    row.insertAdjacentHTML("beforeend", extra);

    row.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", async () => {
        row.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        const catId = chip.dataset.cat;
        page = 0;
        finished = false;
        listEl.innerHTML = `<div class="skeleton-grid">
          <div class="skeleton-card"><div class="cover-wrap"></div><div class="info"><div class="line"></div><div class="line short"></div></div></div>
          <div class="skeleton-card"><div class="cover-wrap"></div><div class="info"><div class="line"></div><div class="line short"></div></div></div>
        </div>`;

        let query = supabase
          .from("songs")
          .select("id, title, slug, cover_url, created_at, artists(slug, name)")
          .eq("published", true)
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE);
        if (catId) query = query.eq("category_id", catId);

        const { data: filtered, error } = await query;
        if (error) { console.error(error); return; }
        renderSongs(filtered, false);
        loadMoreBtn.style.display = "none";
      });
    });
  }
  loadCategoryChips();
})();
