// Datos públicos del proyecto de Supabase "gastos-casa".
// La clave "anon" es pública por diseño: la seguridad la ponen las reglas (RLS) de supabase/schema.sql.
// NUNCA pongas aquí la "service_role" ni una clave "secret".
window.GASTOS_CONFIG = {
  supabaseUrl: "https://zlgfsjaxznrxwtfyoqrh.supabase.co",
  // clave pública para las notificaciones push (la privada solo está en los secretos de Supabase)
  vapidPublicKey: "BNP_TfW_hsoGDDShQwhCSklU_6uDqDG39umYJbW_nlg1uA8DjB6syb35Hqjor8fyuZv2cc6QdY4pIZmtLzQuLfg",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsZ2ZzamF4em5yeHd0ZnlvcXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MDY3ODMsImV4cCI6MjEwNzQ4Mjc4M30.mH0-m2JucEoParAuBH_tnU4J0yMWFl02_2bycHue9C0"
};
