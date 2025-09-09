import { createClient } from '@supabase/supabase-js';


// Initialize Supabase client
// Using direct values from project configuration
const supabaseUrl = 'https://ahjnudmcldltutojholb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFoam51ZG1jbGRsdHV0b2pob2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NDM5NjEsImV4cCI6MjA3MzAxOTk2MX0.isYqV4t3rEPiLD98tZO1wd2EloYg_xAc4ieKSfsl7m0';
const supabase = createClient(supabaseUrl, supabaseKey);


export { supabase };