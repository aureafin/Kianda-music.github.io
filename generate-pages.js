/**
 * generate-pages.js
 * Corre no GitHub Actions. Lê as músicas publicadas no Supabase,
 * gera uma pasta/index.html física para cada uma, atualiza o
 * sitemap.xml e apaga páginas de músicas que deixaram de existir.
 *
 * Variáveis de ambiente necessárias (vêm de GitHub Secrets):
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY   (nunca commitar, só em Secrets)
 *  - SITE_URL   (ex: https://teuusuario.github.io/teurepo)
 *  - SITE_NAME  (ex: "MeuSite Músicas")
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = (process.env.SITE_URL || "https://exemplo.github.io/site").replace(/\/$/, "");
const SITE_NAME = process.env.SITE_NAME || "MeuSite Músicas";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Erro: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY em falta.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const ROOT = path.join(__dirname, "..");
const MUSICA_DIR = path.join(ROOT, "musica");
const TEMPLATE_PATH = path.join(__dirname, "templates", "song-template.html");
const SITEMAP_PATH = path.join(ROOT, "sitemap.xml");

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

function buildSongHtml(template, song) {
  const artistName = song.artists ? song.artists.name : "Artista Desconhecido";
  const artistSlug = song.artists ? song.artists.slug : "desconhecido";
  const categoryName = song.categories ? song.categories.name : "Geral";
  const categorySlug = song.categories ? song.categories.slug : "geral";

  const canonicalUrl = `${SITE_URL}/musica/${artistSlug}/${song.slug}/`;
  const metaTitle = `${artistName} - ${song.title} | Download e Ouvir`;
  const metaDescription = (song.description || `Ouça e faça download de "${song.title}" de ${artistName}.`).slice(0, 160);

  const replacements = {
    "{{META_TITLE}}": escapeHtml(metaTitle),
    "{{META_DESCRIPTION}}": escapeHtml(metaDescription),
    "{{CANONICAL_URL}}": canonicalUrl,
    "{{OG_TITLE}}": escapeHtml(metaTitle),
    "{{COVER_URL}}": song.cover_url || `${SITE_URL}/assets/images/default-cover.webp`,
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
    "{{CATEGORY_URL}}": `${SITE_URL}/categoria/${categorySlug}/`,
    "{{AUDIO_URL}}": song.audio_url,
    "{{VIEWS}}": song.views || 0,
    "{{DOWNLOADS}}": song.downloads || 0,
    "{{DESCRIPTION_HTML}}": escapeHtml(song.description || "Sem descrição disponível."),
    "{{SONG_ID}}": song.id,
    "{{ARTIST_ID}}": song.artist_id || "",
    "{{CATEGORY_ID}}": song.category_id || "",
  };

  // ASSETS_PATH: caminho relativo à raiz do site. Como as páginas ficam
  // em /musica/<artista>/<slug>/, a raiz fica 3 níveis acima.
  replacements["{{ASSETS_PATH}}"] = "../../..";

  let html = template;
  for (const [key, value] of Object.entries(replacements)) {
    html = html.split(key).join(String(value));
  }
  return html;
}

async function fetchPublishedSongs() {
  const { data, error } = await supabase
    .from("songs")
    .select(`
      id, title, slug, description, cover_url, audio_url,
      views, downloads, created_at, updated_at, published,
      artist_id, category_id,
      artists ( id, name, slug ),
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

function listExistingSongDirs() {
  const result = [];
  if (!fs.existsSync(MUSICA_DIR)) return result;
  for (const artistDir of fs.readdirSync(MUSICA_DIR)) {
    const artistPath = path.join(MUSICA_DIR, artistDir);
    if (!fs.statSync(artistPath).isDirectory()) continue;
    for (const songDir of fs.readdirSync(artistPath)) {
      const songPath = path.join(artistPath, songDir);
      if (fs.statSync(songPath).isDirectory()) {
        result.push({ artistSlug: artistDir, songSlug: songDir, fullPath: songPath });
      }
    }
  }
  return result;
}

function buildSitemap(songs) {
  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/musicas/`,
    `${SITE_URL}/artistas/`,
    `${SITE_URL}/categorias/`,
  ];
  for (const song of songs) {
    const artistSlug = song.artists ? song.artists.slug : "desconhecido";
    urls.push(`${SITE_URL}/musica/${artistSlug}/${song.slug}/`);
  }
  const body = urls
    .map((u) => `  <url>\n    <loc>${u}</loc>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

async function main() {
  console.log("A obter músicas publicadas do Supabase...");
  const songs = await fetchPublishedSongs();
  console.log(`Encontradas ${songs.length} músicas publicadas.`);

  const template = fs.readFileSync(TEMPLATE_PATH, "utf-8");
  const validDirs = new Set();

  for (const song of songs) {
    const artistSlug = song.artists ? song.artists.slug : "desconhecido";
    const dir = path.join(MUSICA_DIR, artistSlug, song.slug);
    fs.mkdirSync(dir, { recursive: true });
    const html = buildSongHtml(template, song);
    fs.writeFileSync(path.join(dir, "index.html"), html, "utf-8");
    validDirs.add(dir);
    console.log(`Gerado: /musica/${artistSlug}/${song.slug}/`);
  }

  // Remove pastas de músicas que já não existem/foram despublicadas
  const existing = listExistingSongDirs();
  for (const item of existing) {
    if (!validDirs.has(item.fullPath)) {
      fs.rmSync(item.fullPath, { recursive: true, force: true });
      console.log(`Removido: /musica/${item.artistSlug}/${item.songSlug}/`);
      // remove a pasta do artista se ficou vazia
      const artistDir = path.join(MUSICA_DIR, item.artistSlug);
      if (fs.existsSync(artistDir) && fs.readdirSync(artistDir).length === 0) {
        fs.rmdirSync(artistDir);
      }
    }
  }

  // Atualiza sitemap.xml
  const sitemap = buildSitemap(songs);
  fs.writeFileSync(SITEMAP_PATH, sitemap, "utf-8");
  console.log("sitemap.xml atualizado.");

  console.log("Geração concluída com sucesso.");
}

main().catch((err) => {
  console.error("Falha na geração:", err);
  process.exit(1);
});
