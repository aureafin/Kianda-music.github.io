# MeuSite Músicas — Fase 1

Site de download de músicas com páginas HTML geradas automaticamente, hospedado gratuitamente em GitHub Pages + Supabase + Cloudflare R2.

O ADM (painel administrativo) **não está incluído nesta fase** — será um projeto à parte, para depois converteres em APK. Este pacote é só o site público + toda a infraestrutura (banco de dados, storage, gerador, automação).

---

## O que já está pronto nesta Fase 1

- Estrutura completa de pastas
- `supabase/schema.sql` — todas as tabelas, relações, RLS e função anti-fraude de contagem
- `scripts/generate-pages.js` — gerador de páginas HTML reais a partir do Supabase
- `.github/workflows/generate-pages.yml` — automação (Actions)
- `robots.txt` e `sitemap.xml` (gerado automaticamente depois)
- `index.html` + `assets/css/style.css` + `assets/js/*.js` — site público funcional
- `worker/` — Cloudflare Worker (contagem de eventos + upload/delete seguros no R2)
- Uma página de música **de exemplo já gerada** em `musica/gerilson-insrael/nao-vou-desistir/index.html` (dados fictícios, só para veres a estrutura/design — depois é substituída pelas reais)
- Páginas institucionais: `/termos/`, `/privacidade/`, `/copyright/`, `/contacto/`

---

## PASSO 1 — Criar o projeto Supabase

1. Vai a **supabase.com** → cria conta → **New Project**.
2. Escolhe nome, password do banco (guarda-a) e região mais próxima.
3. Depois de criado, vai em **SQL Editor** → **New query**.
4. Cola todo o conteúdo do ficheiro `supabase/schema.sql` e clica **Run**.
5. Vai em **Project Settings → API**. Anota:
   - **Project URL** (ex: `https://xxxx.supabase.co`)
   - **anon public key**
   - **service_role key** (⚠️ nunca partilhes esta, nunca vai no código público)

---

## PASSO 2 — Criar o repositório GitHub

1. Cria um repositório novo (ex: `meusite-musicas`), público.
2. Faz upload de **todos os ficheiros deste pacote** para a raiz do repositório (podes arrastar tudo pela interface web do GitHub se estiveres no telemóvel: botão **Add file → Upload files**).
3. Vai em **Settings → Pages**:
   - Source: **Deploy from a branch**
   - Branch: `main` / pasta `/ (root)`
   - Guarda. O teu site fica em `https://SEUUSUARIO.github.io/meusite-musicas/`

---

## PASSO 3 — Configurar GitHub Secrets

Vai em **Settings → Secrets and variables → Actions → New repository secret** e cria:

| Nome | Valor |
|---|---|
| `SUPABASE_URL` | a Project URL do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | a service_role key do Supabase |
| `SITE_URL` | `https://SEUUSUARIO.github.io/meusite-musicas` |
| `SITE_NAME` | `MeuSite Músicas` (ou o nome que quiseres) |

---

## PASSO 4 — Atualizar os ficheiros com os teus dados reais

Substitui em todos os ficheiros onde aparece:
- `SEUDOMINIO.github.io/SEUREPO` → o teu link real do GitHub Pages
- `assets/js/config.js` → cola a tua `SUPABASE_URL` e `SUPABASE_ANON_KEY` (a **anon**, nunca a service_role)
- `robots.txt` e `sitemap.xml` → o link real do sitemap

(Isto é só para o site público conseguir ler os dados do Supabase diretamente pelo browser, com segurança, porque a RLS já protege tudo.)

---

## PASSO 5 — Criar o bucket no Cloudflare R2

1. Painel Cloudflare → **R2** → **Create bucket** → nome `musicsite-files`.
2. Não precisas tornar o bucket público diretamente — os ficheiros serão servidos através de um **domínio público do R2** ou de um **Custom Domain** que configures em R2 → Settings → Public Access. Ativa o acesso público de leitura (só leitura) para servir os MP3s e capas.
3. Anota a URL pública do bucket (ex: `https://pub-xxxx.r2.dev` ou o teu domínio custom).

---

## PASSO 6 — Publicar o Cloudflare Worker

**Sem usar terminal (mais fácil pelo telemóvel):**

1. Painel Cloudflare → **Workers & Pages** → **Create** → **Create Worker**.
2. Dá o nome `musicsite-worker` → **Deploy**.
3. Depois de criado, entra nele → **Edit code** → apaga o conteúdo de exemplo e cola o conteúdo de `worker/index.js`.
4. **Save and deploy**.
5. Vai em **Settings → Variables**:
   - Em **Environment Variables**, adiciona `ALLOWED_ORIGINS` com o valor `https://SEUUSUARIO.github.io` (sem barra final).
   - Em **Secrets**, adiciona `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
6. Vai em **Settings → Bindings → R2 Bucket** → adiciona binding com nome `BUCKET` apontando para `musicsite-files`.
7. Copia o URL final do Worker (algo como `https://musicsite-worker.SEUUSUARIO.workers.dev`) e cola-o em `assets/js/config.js` no campo `WORKER_URL`.

*(Se preferires linha de comando: `npm install -g wrangler`, depois `wrangler login`, `wrangler r2 bucket create musicsite-files`, e dentro da pasta `worker/`: `wrangler secret put SUPABASE_URL` etc., e `wrangler deploy`.)*

---

## PASSO 7 — Testar o gerador manualmente

No GitHub, vai em **Actions → Gerar Páginas de Músicas → Run workflow** (botão manual). Isto corre o `generate-pages.js`, que:
- vai buscar músicas publicadas no Supabase (nesta fase ainda não existem, porque o ADM só vem na Fase 2 — podes inserir uma música manualmente pela tabela do Supabase para testar);
- gera a pasta `/musica/artista/slug/index.html`;
- atualiza o `sitemap.xml`;
- faz commit automático.

Para testar já, podes inserir manualmente no Supabase (**Table Editor → artists** → adiciona um artista; **Table Editor → songs** → adiciona uma música com `published = true`).

---

## PASSO 8 (opcional, recomendado) — Disparo automático via Webhook

Para o site atualizar sozinho sempre que publicares/editares uma música (sem esperar pelo cron diário):

1. No Supabase: **Database → Webhooks → Create a new hook**.
2. Table: `songs`. Eventos: `INSERT`, `UPDATE`, `DELETE`.
3. Tipo: **HTTP Request** → URL: `https://api.github.com/repos/SEUUSUARIO/meusite-musicas/dispatches`
4. Método: `POST`. Headers:
   - `Accept: application/vnd.github+json`
   - `Authorization: Bearer SEU_GITHUB_TOKEN` (cria um **Personal Access Token** em GitHub → Settings → Developer settings → Fine-grained tokens, com permissão "Contents: Read and write" e "Actions" nesse repositório)
   - `Content-Type: application/json`
5. Body: `{"event_type": "songs-updated"}`

Assim, cada alteração na tabela `songs` dispara o GitHub Actions automaticamente.

---

## Estrutura final

```
/
├── index.html
├── musica/<artista>/<slug>/index.html   ← gerado automaticamente
├── artista/ , categoria/, musicas/, artistas/, categorias/, pesquisa/
├── termos/ privacidade/ copyright/ contacto/
├── assets/css/style.css
├── assets/js/ (config.js, main.js, song-page.js)
├── scripts/generate-pages.js
├── scripts/templates/song-template.html
├── supabase/schema.sql
├── worker/ (index.js, wrangler.toml)
├── .github/workflows/generate-pages.yml
├── robots.txt
├── sitemap.xml
└── package.json
```

---

## Próximas fases

- **Fase 2**: ADM separado (login Supabase Auth, publicar/editar/excluir música, upload direto para R2 via Worker) — projeto à parte, pronto para converteres em APK.
- **Fase 3**: páginas `/musicas/`, `/artistas/`, `/categorias/`, `/pesquisa/` completas, estatísticas, músicas relacionadas mais refinadas.
- **Fase 4**: espaços de publicidade (Adsterra), otimizações de performance e SEO avançado.

Quando quiseres avançar, diz "vamos para a Fase 2 (ADM)" que construo o painel separado, já pensado para correr dentro do teu APK (comunicando com Supabase + Worker via HTTPS, sem depender do GitHub Pages).
