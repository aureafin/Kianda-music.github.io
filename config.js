// config.js
// A "anon key" do Supabase É SEGURA para ficar pública: ela só
// consegue fazer o que as políticas RLS (ver supabase/schema.sql)
// permitirem, que é apenas LEITURA de músicas publicadas.
// NUNCA coloques aqui a "service_role key".
window.APP_CONFIG = {
  SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
  SUPABASE_ANON_KEY: "COLA_AQUI_A_ANON_KEY_PUBLICA",
  WORKER_URL: "https://SEU-WORKER.SEU-SUBDOMINIO.workers.dev",
  SITE_NAME: "MeuSite Músicas",
};
