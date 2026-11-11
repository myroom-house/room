// 웹으로 올릴 때 서버(Supabase) 주소와 키를 여기에 넣어두면,
// 친구들은 사이트에 들어와서 바로 가입만 하면 돼요. (anon public key 는 공개돼도 괜찮은 키예요)
window.MYROOM_CONFIG = {
  supabaseUrl: 'https://oynkdkqsokwmjvfbllbs.supabase.co',
  // 문의함 메일 (Web3Forms 키 — 공개돼도 괜찮아요)
  feedbackKey: 'a9c300f0-72dc-4cd4-b5f7-cf54a2fd389b',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95bmtka3Fzb2t3bWp2ZmJsbGJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwMTgyMDcsImV4cCI6MjEwOTU5NDIwN30.od8DjBLTVQjN9N7U-0wmwi6mSXd03V1_c-yYxkd4Ek8'
};
