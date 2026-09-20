// browse.js — usado na homepage e em /musicas/: pesquisa, categorias, grid, paginação
(function () {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const PAGE_SIZE = 12;
  let page = 0;
  let finished = false;
  let activeCategoryId = "";
  let activeSearchTerm = "";

  const listEl = document.getElementById("song-list");
  const loadMoreBtn = document.getElementById("load-more-btn");
  const listTitle = document.getElementById("list-title");
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");
  const chipRow = document.getElementById("chip-row");

  const params = new URLSearchParams(location.search);
  const presetArtistId = params.get("artist") || "";
  const presetCategoryId = params.get("category") || "";

  function songUrl(song) {
    const artistSlug = song.artists ? song.artists.slug : "artista";
    return `musica/${artistSlug}/${song.slug}/`;
  }

  function skeletonHtml(n) {
    return `<div class="skeleton-grid">${Array(n).fill(
      `<div class="skeleton-card"><div class="cover-wrap"></div><div class="info"><div class="line"></div><div class="line short"></div></div></div>`
    ).join("")}</div>`;
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

    if (!songs.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="icon">🎧</div>
          <div>Nenhuma música encontrada.</div>
          <div style="font-size:0.78rem;margin-top:6px;">Tenta outro termo ou género.</div>
        </div>`;
      return;
    }

    listEl.innerHTML = `<div class="song-grid">${cardsHtml}</div>`;
  }

  async function loadPage() {
    if (finished) return;
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("songs")
      .select("id, title, slug, cover_url, created_at, artists(slug, name, id)")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (activeCategoryId) query = query.eq("category_id", activeCategoryId);
    if (presetArtistId) query = query.eq("artist_id", presetArtistId);

    const { data, error } = await query;
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

  async function runSearch(term) {
    activeSearchTerm = term;
    page = 0;
    finished = true; // pesquisa não usa "carregar mais"
    loadMoreBtn.style.display = "none";
    listEl.innerHTML = skeletonHtml(4);
    if (listTitle) listTitle.textContent = `Resultados para "${term}"`;

    const { data: matchingArtists } = await supabase
      .from("artists")
      .select("id")
      .ilike("name", `%${term}%`);
    const artistIds = (matchingArtists || []).map((a) => a.id);

    let filter = `title.ilike.%${term}%`;
    if (artistIds.length) filter += `,artist_id.in.(${artistIds.join(",")})`;

    const { data, error } = await supabase
      .from("songs")
      .select("id, title, slug, cover_url, created_at, artists(slug, name, id)")
      .eq("published", true)
      .or(filter)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      listEl.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div>Erro na pesquisa.</div>`;
      console.error(error);
      return;
    }
    renderSongs(data, false);
  }

  function resetToBrowse() {
    activeSearchTerm = "";
    page = 0;
    finished = false;
    if (listTitle) listTitle.textContent = "Últimas músicas";
    listEl.innerHTML = skeletonHtml(4);
    loadPage();
  }

  let debounceTimer = null;
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      const term = searchInput.value.trim();
      if (!term) { resetToBrowse(); return; }
      debounceTimer = setTimeout(() => runSearch(term), 350);
    });
  }
  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      const term = searchInput.value.trim();
      if (term) runSearch(term);
    });
  }

  loadMoreBtn.addEventListener("click", loadPage);

  // ---- Chips de categoria ----
  async function loadCategoryChips() {
    if (!chipRow) return;
    const { data } = await supabase.from("categories").select("id, name, slug").order("name").limit(12);
    if (!data || !data.length) return;
    const extra = data
      .map((c) => `<span class="chip" data-cat="${c.id}">${c.name}</span>`)
      .join("");
    chipRow.insertAdjacentHTML("beforeend", extra);

    chipRow.querySelectorAll(".chip").forEach((chip) => {
      if (chip.dataset.cat === presetCategoryId && presetCategoryId) {
        chipRow.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
      }
      chip.addEventListener("click", () => {
        chipRow.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        activeCategoryId = chip.dataset.cat;
        if (searchInput) searchInput.value = "";
        page = 0;
        finished = false;
        if (listTitle) listTitle.textContent = chip.dataset.cat ? chip.textContent : "Últimas músicas";
        listEl.innerHTML = skeletonHtml(4);
        loadPage();
      });
    });
  }

  // ---- Inicialização ----
  const searchOnly = document.body.dataset.searchonly === "true";
  if (presetCategoryId) activeCategoryId = presetCategoryId;
  loadCategoryChips();
  if (!searchOnly) loadPage();
})();
