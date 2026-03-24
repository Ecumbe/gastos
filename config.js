// config.js - Configuración y credenciales seguras
const SUPABASE_URL = 'TU_URL_DE_SUPABASE_AQUI'; 
const SUPABASE_KEY = 'TU_API_KEY_AQUI'; 

// Inicializamos el cliente aquí para que todo el proyecto pueda usarlo
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
