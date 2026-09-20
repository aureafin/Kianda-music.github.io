// config.js
// A "anon key" do Supabase É SEGURA para ficar pública: ela só
// consegue fazer o que as políticas RLS (ver supabase/schema.sql)
// permitirem, que é apenas LEITURA de músicas publicadas.
// NUNCA coloques aqui a "service_role key".
window.APP_CONFIG = {
  SUPABASE_URL: "https://tdeaftjkdggmqryobwpo.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkZWFmdGprZGdnbXFyeW9id3BvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4NjYzMDIsImV4cCI6MjEwNTQ0MjMwMn0.wR4gvxk3VZXF9Mi-dMBHyli-nos06lBwhRIPuuAUBko",
  WORKER_URL: "https://SEU-WORKER.SEU-SUBDOMINIO.workers.dev",
  SITE_NAME: "Kianda Music",
};
