// categorias.js — lista de géneros com contagem de músicas
(function () {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.APP_CONFIG;
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const listEl = document.getElementById("category-list");

  async function load() {
    const { data: categories, error } = await supabase
      .from("categories")
      .select("id, name")
      .order("name");

    if (error || !categories) {
      listEl.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div>Erro ao carregar géneros.</div>`;
      return;
    }

    if (!categories.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="icon">🏷️</div>Ainda não há géneros criados.</div>`;
      return;
    }

    const { data: songs } = await supabase
      .from("songs")
      .select("category_id")
      .eq("published", true);

    const counts = {};
    (songs || []).forEach((s) => {
      if (s.category_id) counts[s.category_id] = (counts[s.category_id] || 0) + 1;
    });

    listEl.innerHTML = categories
      .map(
        (c) => `
        <a class="category-row" href="musicas/?category=${c.id}">
          <span class="notranslate" translate="no">${c.name}</span>
          <span class="arrow">${counts[c.id] || 0} músicas ›</span>
        </a>`
      )
      .join("");
  }

  load();
})();
