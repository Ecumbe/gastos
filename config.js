// config.js - Configuración y credenciales seguras
const SUPABASE_URL = 'https://pwvonpwdqynvfrqrbjwy.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3dm9ucHdkcXludmZycXJiand5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNzkyOTMsImV4cCI6MjA4OTk1NTI5M30.TCkGbviCkCL3ps6Aex8oah1gE_Ne9mFfI2ovwpneZMw'; 
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
