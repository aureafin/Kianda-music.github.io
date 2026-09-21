/**
 * generate-pages.js
 * Corre no GitHub Actions. Lê o catálogo publicado no Supabase e gera:
 *  - /musica/<artista>/<slug>/           (já existia)
 *  - /artista/<slug>/                    (novo — SEO de artista)
 *  - /genero/<slug>/                     (novo — SEO de género)
 *  - /novidades/, /mais-baixadas/, /mais-ouvidas/  (novo — descoberta)
 *  - sitemap.xml (índice) + sitemap-musicas.xml + sitemap-artistas.xml
 *    + sitemap-generos.xml + sitemap-paginas.xml
 *
 * Variáveis de ambiente (GitHub Secrets):
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY
 *  - SITE_URL   (ex: https://aureafin.github.io/Kianda-music.github.io)
 *  - SITE_NAME  (ex: "Kianda Music")
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = (process.env.SITE_URL || "https://exemplo.github.io/site").replace(/\/$/, "");
const SITE_NAME = process.env.SITE_NAME || "Kianda Music";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Erro: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em falta.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ROOT = path.join(__dirname, "..");
const MUSICA_DIR = path.join(ROOT, "musica");
const ARTISTA_DIR = path.join(ROOT, "artista");
const GENERO_DIR = path.join(ROOT, "genero");
const NOVIDADES_DIR = path.join(ROOT, "novidades");
const MAIS_BAIXADAS_DIR = path.join(ROOT, "mais-baixadas");
const MAIS_OUVIDAS_DIR = path.join(ROOT, "mais-ouvidas");

const TEMPLATES_DIR = path.join(__dirname, "templates");
const SONG_TEMPLATE_PATH = path.join(TEMPLATES_DIR, "song-template.html");
const ARTIST_TEMPLATE_PATH = path.join(TEMPLATES_DIR, "artist-template.html");
const GENRE_TEMPLATE_PATH = path.join(TEMPLATES_DIR, "genre-template.html");
const DISCOVERY_TEMPLATE_PATH = path.join(TEMPLATES_DIR, "discovery-template.html");

const DISCOVERY_LIST_SIZE = 40; // quantas músicas embutir em cada página de descoberta
const HUB_LIST_SIZE = 30; // quantas músicas embutir em cada página de artista/género

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeJson(str) {
  return String(str || "").replace(/"/g, '\\"').replace(/\n/g, " ");
}

function formatDateHuman(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" });
}

function applyTemplate(template, replacements) {
  let html = template;
  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(String(value));
  }
  return html;
}

function songCardHtml(song) {
  const artistName = song.artists ? song.artists.name : "Artista Desconhecido";
  const artistSlug = song.artists ? song.artists.slug : "desconhecido";
  const url = `${SITE_URL}/musica/${artistSlug}/${song.slug}/`;
  return `
    <a class="song-card" href="${url}">
      <div class="cover-wrap">
        <img src="${song.cover_url || ""}" alt="${escapeHtml(song.title)}" loading="lazy">
        <span class="play-badge">▶</span>
      </div>
      <div class="info">
        <div class="t">${escapeHtml(song.title)}</div>
        <div class="a">${escapeHtml(artistName)}</div>
      </div>
    </a>`;
}

function songCardsListHtml(songs) {
  if (!songs.length) {
    return `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">🎧</div>Ainda não há músicas aqui.</div>`;
  }
  return songs.map(songCardHtml).join("\n");
}

/* ===================== MÚSICA (já existia) ===================== */

function buildSongHtml(template, song) {
  const artistName = song.artists ? song.artists.name : "Artista Desconhecido";
  const artistSlug = song.artists ? song.artists.slug : "desconhecido";
  const categoryName = song.categories ? song.categories.name : "Geral";
  const categorySlug = song.categories ? song.categories.slug : "geral";

  const canonicalUrl = `${SITE_URL}/musica/${artistSlug}/${song.slug}/`;
  const metaTitle = `${artistName} - ${song.title} | Download e Ouvir | ${SITE_NAME}`;
  const metaDescription = (song.description || `Ouça e faça download de "${song.title}" de ${artistName} grátis no ${SITE_NAME}.`).slice(0, 160);

  const replacements = {
    "{{META_TITLE}}": escapeHtml(metaTitle),
    "{{META_DESCRIPTION}}": escapeHtml(metaDescription),
    "{{CANONICAL_URL}}": canonicalUrl,
    "{{SITE_URL}}": SITE_URL,
    "{{OG_TITLE}}": escapeHtml(metaTitle),
    "{{COVER_URL}}": song.cover_url || `${SITE_URL}/assets/images/logo.png`,
    "{{SITE_NAME}}": escapeHtml(SITE_NAME),
    "{{TITLE_JSON}}": escapeJson(song.title),
    "{{ARTIST_NAME_JSON}}": escapeJson(artistName),
    "{{CATEGORY_NAME_JSON}}": escapeJson(categoryName),
    "{{PUBLISHED_DATE}}": song.created_at,
    "{{PUBLISHED_DATE_HUMAN}}": formatDateHuman(song.created_at),
    "{{TITLE_HTML}}": escapeHtml(song.title),
    "{{ARTIST_NAME_HTML}}": escapeHtml(artistName),
    "{{ARTIST_URL}}": `${SITE_URL}/artista/${artistSlug}/`,
    "{{CATEGORY_NAME_HTML}}": escapeHtml(categoryName),
    "{{CATEGORY_URL}}": `${SITE_URL}/genero/${categorySlug}/`,
    "{{AUDIO_URL}}": song.audio_url,
    "{{VIEWS}}": song.views || 0,
    "{{DOWNLOADS}}": song.downloads || 0,
    "{{DESCRIPTION_HTML}}": escapeHtml(song.description || "Sem descrição disponível."),
    "{{SONG_ID}}": song.id,
    "{{ARTIST_ID}}": song.artist_id || "",
    "{{CATEGORY_ID}}": song.category_id || "",
    "{{ASSETS_PATH}}": "../../..",
  };

  return applyTemplate(template, replacements);
}

function listExistingDirs(baseDir, depth) {
  // depth 1: baseDir/x/  |  depth 2: baseDir/x/y/
  const result = [];
  if (!fs.existsSync(baseDir)) return result;
  if (depth === 1) {
    for (const slug of fs.readdirSync(baseDir)) {
      const p = path.join(baseDir, slug);
      if (fs.statSync(p).isDirectory()) result.push({ slug, fullPath: p });
    }
  } else {
    for (const a of fs.readdirSync(baseDir)) {
      const artistPath = path.join(baseDir, a);
      if (!fs.statSync(artistPath).isDirectory()) continue;
      for (const s of fs.readdirSync(artistPath)) {
        const sp = path.join(artistPath, s);
        if (fs.statSync(sp).isDirectory()) result.push({ artistSlug: a, songSlug: s, fullPath: sp });
      }
    }
  }
  return result;
}

/* ===================== ARTISTA (novo) ===================== */

function buildArtistHtml(template, artist, songs) {
  const canonicalUrl = `${SITE_URL}/artista/${artist.slug}/`;
  const metaTitle = `${artist.name} — Músicas, Letras e Lançamentos | ${SITE_NAME}`;
  const metaDescription = artist.bio
    ? artist.bio.slice(0, 160)
    : `Ouve e descarrega todas as músicas de ${artist.name} grátis no ${SITE_NAME}.`;

  const bioBlock = artist.bio
    ? `<div class="page-heading"><p>${escapeHtml(artist.bio)}</p></div>`
    : "";

  const replacements = {
    "{{META_TITLE}}": escapeHtml(metaTitle),
    "{{META_DESCRIPTION}}": escapeHtml(metaDescription),
    "{{CANONICAL_URL}}": canonicalUrl,
    "{{SITE_URL}}": SITE_URL,
    "{{OG_TITLE}}": escapeHtml(metaTitle),
    "{{PHOTO_URL}}": artist.photo_url || `${SITE_URL}/assets/images/logo.png`,
    "{{SITE_NAME}}": escapeHtml(SITE_NAME),
    "{{ARTIST_NAME_JSON}}": escapeJson(artist.name),
    "{{ARTIST_NAME_HTML}}": escapeHtml(artist.name),
    "{{SONGS_COUNT}}": songs.length,
    "{{BIO_BLOCK}}": bioBlock,
    "{{SONGS_LIST_HTML}}": songCardsListHtml(songs.slice(0, HUB_LIST_SIZE)),
    "{{BROWSE_ALL_URL}}": `${SITE_URL}/musicas/?artist=${artist.id}`,
    "{{ASSETS_PATH}}": "../..",
  };

  return applyTemplate(template, replacements);
}

/* ===================== GÉNERO (novo) ===================== */

function buildGenreHtml(template, category, songs) {
  const canonicalUrl = `${SITE_URL}/genero/${category.slug}/`;
  const metaTitle = `Música ${category.name} — Ouvir e Descarregar Grátis | ${SITE_NAME}`;
  const metaDescription = `Descobre as melhores músicas de ${category.name} no ${SITE_NAME}. Ouve grátis e faz download das faixas mais recentes de ${category.name}.`;
  const introHtml = `Descobre as melhores músicas de <strong>${escapeHtml(category.name)}</strong> no ${escapeHtml(SITE_NAME)}. Catálogo atualizado com os lançamentos mais recentes deste género.`;

  const replacements = {
    "{{META_TITLE}}": escapeHtml(metaTitle),
    "{{META_DESCRIPTION}}": escapeHtml(metaDescription),
    "{{CANONICAL_URL}}": canonicalUrl,
    "{{SITE_URL}}": SITE_URL,
    "{{OG_TITLE}}": escapeHtml(metaTitle),
    "{{SITE_NAME}}": escapeHtml(SITE_NAME),
    "{{GENRE_NAME_JSON}}": escapeJson(category.name),
    "{{GENRE_NAME_HTML}}": escapeHtml(category.name),
    "{{INTRO_HTML}}": introHtml,
    "{{SONGS_COUNT}}": songs.length,
    "{{SONGS_LIST_HTML}}": songCardsListHtml(songs.slice(0, HUB_LIST_SIZE)),
    "{{BROWSE_ALL_URL}}": `${SITE_URL}/musicas/?category=${category.id}`,
    "{{ASSETS_PATH}}": "../..",
  };

  return applyTemplate(template, replacements);
}

/* ===================== DESCOBERTA (novo) ===================== */

function buildDiscoveryHtml(template, opts) {
  const canonicalUrl = `${SITE_URL}/${opts.slug}/`;
  const metaTitle = `${opts.pageTitle} | ${SITE_NAME}`;

  const replacements = {
    "{{META_TITLE}}": escapeHtml(metaTitle),
    "{{META_DESCRIPTION}}": escapeHtml(opts.intro),
    "{{CANONICAL_URL}}": canonicalUrl,
    "{{SITE_URL}}": SITE_URL,
    "{{OG_TITLE}}": escapeHtml(metaTitle),
    "{{SITE_NAME}}": escapeHtml(SITE_NAME),
    "{{PAGE_TITLE_JSON}}": escapeJson(opts.pageTitle),
    "{{PAGE_TITLE_HTML}}": escapeHtml(opts.pageTitle),
    "{{PAGE_INTRO_HTML}}": escapeHtml(opts.intro),
    "{{SONGS_LIST_HTML}}": songCardsListHtml(opts.songs.slice(0, DISCOVERY_LIST_SIZE)),
    "{{ASSETS_PATH}}": "..",
  };

  return applyTemplate(template, replacements);
}

/* ===================== SUPABASE ===================== */

async function fetchPublishedSongs() {
  const { data, error } = await supabase
    .from("songs")
    .select(`
      id, title, slug, description, cover_url, audio_url,
      views, downloads, created_at, updated_at, published,
      artist_id, category_id,
      artists ( id, name, slug, bio, photo_url ),
      categories ( id, name, slug )
    `)
    .eq("published", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao consultar Supabase:", error.message);
    process.exit(1);
  }
  return data;
}

/* ===================== SITEMAPS ===================== */

function xmlUrlset(urls) {
  const body = urls.map((u) => `  <url>\n    <loc>${u}</loc>\n  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function xmlSitemapIndex(files) {
  const body = files
    .map((f) => `  <sitemap>\n    <loc>${SITE_URL}/${f}</loc>\n  </sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

/* ===================== MAIN ===================== */

async function main() {
  console.log("A obter catálogo publicado do Supabase...");
  const songs = await fetchPublishedSongs();
  console.log(`Encontradas ${songs.length} músicas publicadas.`);

  const songTemplate = fs.readFileSync(SONG_TEMPLATE_PATH, "utf-8");
  const artistTemplate = fs.readFileSync(ARTIST_TEMPLATE_PATH, "utf-8");
  const genreTemplate = fs.readFileSync(GENRE_TEMPLATE_PATH, "utf-8");
  const discoveryTemplate = fs.readFileSync(DISCOVERY_TEMPLATE_PATH, "utf-8");

  // ---- Agrupar por artista e por género ----
  const artistsMap = new Map(); // id -> { ...artist, songs: [] }
  const genresMap = new Map(); // id -> { ...category, songs: [] }

  for (const song of songs) {
    if (song.artists) {
      const a = song.artists;
      if (!artistsMap.has(a.id)) artistsMap.set(a.id, { ...a, songs: [] });
      artistsMap.get(a.id).songs.push(song);
    }
    if (song.categories) {
      const c = song.categories;
      if (!genresMap.has(c.id)) genresMap.set(c.id, { ...c, songs: [] });
      genresMap.get(c.id).songs.push(song);
    }
  }

  const songUrls = [];
  const artistUrls = [];
  const genreUrls = [];

  // ---- 1) Páginas de música ----
  const validSongDirs = new Set();
  for (const song of songs) {
    const artistSlug = song.artists ? song.artists.slug : "desconhecido";
    const dir = path.join(MUSICA_DIR, artistSlug, song.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), buildSongHtml(songTemplate, song), "utf-8");
    validSongDirs.add(dir);
    songUrls.push(`${SITE_URL}/musica/${artistSlug}/${song.slug}/`);
  }
  for (const item of listExistingDirs(MUSICA_DIR, 2)) {
    if (!validSongDirs.has(item.fullPath)) {
      fs.rmSync(item.fullPath, { recursive: true, force: true });
      console.log(`Removido: /musica/${item.artistSlug}/${item.songSlug}/`);
      const artistDir = path.join(MUSICA_DIR, item.artistSlug);
      if (fs.existsSync(artistDir) && fs.readdirSync(artistDir).length === 0) fs.rmdirSync(artistDir);
    }
  }
  console.log(`Páginas de música: ${songUrls.length}`);

  // ---- 2) Páginas de artista ----
  const validArtistDirs = new Set();
  for (const artist of artistsMap.values()) {
    if (!artist.songs.length) continue; // nunca gerar página vazia
    const dir = path.join(ARTISTA_DIR, artist.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), buildArtistHtml(artistTemplate, artist, artist.songs), "utf-8");
    validArtistDirs.add(dir);
    artistUrls.push(`${SITE_URL}/artista/${artist.slug}/`);
  }
  for (const item of listExistingDirs(ARTISTA_DIR, 1)) {
    if (!validArtistDirs.has(item.fullPath)) {
      fs.rmSync(item.fullPath, { recursive: true, force: true });
      console.log(`Removido: /artista/${item.slug}/`);
    }
  }
  console.log(`Páginas de artista: ${artistUrls.length}`);

  // ---- 3) Páginas de género ----
  const validGenreDirs = new Set();
  for (const cat of genresMap.values()) {
    if (!cat.songs.length) continue;
    const dir = path.join(GENERO_DIR, cat.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), buildGenreHtml(genreTemplate, cat, cat.songs), "utf-8");
    validGenreDirs.add(dir);
    genreUrls.push(`${SITE_URL}/genero/${cat.slug}/`);
  }
  for (const item of listExistingDirs(GENERO_DIR, 1)) {
    if (!validGenreDirs.has(item.fullPath)) {
      fs.rmSync(item.fullPath, { recursive: true, force: true });
      console.log(`Removido: /genero/${item.slug}/`);
    }
  }
  console.log(`Páginas de género: ${genreUrls.length}`);

  // ---- 4) Páginas de descoberta ----
  fs.mkdirSync(NOVIDADES_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(NOVIDADES_DIR, "index.html"),
    buildDiscoveryHtml(discoveryTemplate, {
      slug: "novidades",
      pageTitle: "Novidades — Últimos Lançamentos",
      intro: `As músicas mais recentes adicionadas ao ${SITE_NAME}, atualizadas automaticamente.`,
      songs: songs,
    }),
    "utf-8"
  );

  fs.mkdirSync(MAIS_BAIXADAS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(MAIS_BAIXADAS_DIR, "index.html"),
    buildDiscoveryHtml(discoveryTemplate, {
      slug: "mais-baixadas",
      pageTitle: "Músicas Mais Baixadas",
      intro: `As músicas com mais downloads no ${SITE_NAME}.`,
      songs: [...songs].sort((a, b) => (b.downloads || 0) - (a.downloads || 0)),
    }),
    "utf-8"
  );

  fs.mkdirSync(MAIS_OUVIDAS_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(MAIS_OUVIDAS_DIR, "index.html"),
    buildDiscoveryHtml(discoveryTemplate, {
      slug: "mais-ouvidas",
      pageTitle: "Músicas Mais Ouvidas",
      intro: `As músicas com mais visualizações no ${SITE_NAME}.`,
      songs: [...songs].sort((a, b) => (b.views || 0) - (a.views || 0)),
    }),
    "utf-8"
  );
  console.log("Páginas de descoberta: novidades, mais-baixadas, mais-ouvidas");

  // ---- 5) Sitemaps (divididos por tipo + índice) ----
  fs.writeFileSync(path.join(ROOT, "sitemap-musicas.xml"), xmlUrlset(songUrls), "utf-8");
  fs.writeFileSync(
    path.join(ROOT, "sitemap-artistas.xml"),
    xmlUrlset([`${SITE_URL}/artistas/`, ...artistUrls]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(ROOT, "sitemap-generos.xml"),
    xmlUrlset([`${SITE_URL}/categorias/`, ...genreUrls]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(ROOT, "sitemap-paginas.xml"),
    xmlUrlset([
      `${SITE_URL}/`,
      `${SITE_URL}/musicas/`,
      `${SITE_URL}/novidades/`,
      `${SITE_URL}/mais-baixadas/`,
      `${SITE_URL}/mais-ouvidas/`,
      `${SITE_URL}/equipa/`,
      `${SITE_URL}/termos/`,
      `${SITE_URL}/privacidade/`,
      `${SITE_URL}/copyright/`,
      `${SITE_URL}/contacto/`,
    ]),
    "utf-8"
  );
  fs.writeFileSync(
    path.join(ROOT, "sitemap.xml"),
    xmlSitemapIndex([
      "sitemap-paginas.xml",
      "sitemap-musicas.xml",
      "sitemap-artistas.xml",
      "sitemap-generos.xml",
    ]),
    "utf-8"
  );
  console.log("Sitemaps atualizados (índice + 4 ficheiros).");

  console.log("Geração concluída com sucesso.");
}

main().catch((err) => {
  console.error("Falha na geração:", err);
  process.exit(1);
});
