/* =========================================================
   CONEXÃO COM O BANCO (Supabase)
   Este é o único lugar onde ficam o endereço e a chave do banco.
   Todas as páginas (portfólio, login e admin) usam este arquivo.

   A chave abaixo é a PÚBLICA (publishable). Ela foi feita para
   aparecer no site. Quem protege os seus dados é a tranca (RLS)
   que está no arquivo banco.sql. Nunca coloque aqui a chave secreta.
   ========================================================= */
window.BANCO_URL = "https://cfyqnpecubyfevpwdnjp.supabase.co";
window.BANCO_CHAVE = "sb_publishable_xSp_0hBhy-5Ks8tZwg1MBw_wxg_z_p7";

/* Cria a conexão. Se a biblioteca do Supabase não carregou
   (internet fora, por exemplo), fica null e as páginas seguem sem o banco. */
window.banco = (window.supabase && window.supabase.createClient)
  ? window.supabase.createClient(window.BANCO_URL, window.BANCO_CHAVE)
  : null;

/* Uma conexão "de visitante": nunca usa o seu login.
   Serve para o painel testar se a tranca está funcionando. */
window.bancoVisitante = function () {
  if (!(window.supabase && window.supabase.createClient)) return null;
  return window.supabase.createClient(window.BANCO_URL, window.BANCO_CHAVE, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "visitante-teste" }
  });
};
